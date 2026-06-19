import { GameState } from './GameState.ts';
import type {
  EndingConditions,
  EngineEvent,
  EngineListener,
  FeedMessage,
  Incident,
  IncidentSideEffect,
  LoadedScenario,
  ProcedureResult,
} from './types.ts';

export class GameEngine {
  readonly scenario: LoadedScenario;
  readonly state: GameState;
  private listeners: EngineListener[] = [];

  constructor(scenario: LoadedScenario) {
    this.scenario = scenario;
    this.state = new GameState(scenario.index.initialState, scenario.sectors);
  }

  subscribe(listener: EngineListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getCurrentIncident(): Incident | null {
    if (!this.state.currentIncidentId) return null;
    return this.scenario.incidentMap.get(this.state.currentIncidentId) ?? null;
  }

  start(): void {
    this.pushFeed('Система TERRA-4 v3.0 — режим оператора.', 'info');
    this.pushFeed('SVET: Доброе утро, Александр. Смена начата.', 'info');
    this.emit({ type: 'stateChanged' });
    this.presentIncident(this.scenario.index.startIncident);
  }

  readManualSection(sectionId: string): void {
    if (!this.state.readManualSections.has(sectionId)) {
      this.state.readManualSections.add(sectionId);
      const section = this.scenario.manual.sections.find((s) => s.id === sectionId);
      if (section) {
        this.pushFeed(`Методичка: открыт раздел ${section.title}`, 'info');
      }
      this.emit({ type: 'manualRead' });
      this.emit({ type: 'stateChanged' });
    }
  }

  runDiagnostic(sectorId: string): string {
    const sector = this.state.sectors.find((s) => s.id === sectorId);
    if (!sector) return 'Отсек не найден.';

    sector.diagnosticDone = true;
    const incident = this.getCurrentIncident();
    let note = sector.diagnosticNote ?? 'Диагностика завершена.';

    if (incident?.deception && incident.sectorId === sectorId) {
      note = incident.deception.truthNote;
    }

    this.pushFeed(`Диагностика ${sector.label}: ${note}`, 'warn');
    this.emit({ type: 'diagnosticComplete', payload: { feedback: note } });
    this.emit({ type: 'stateChanged' });
    return note;
  }

  executeProcedure(procedureId: string, sectorId: string): ProcedureResult {
    if (this.state.status !== 'playing') {
      return { ok: false, feedback: 'Смена завершена.', resolved: false };
    }

    const procedure = this.scenario.procedureMap.get(procedureId);
    if (!procedure) {
      return { ok: false, feedback: 'Процедура не найдена.', resolved: false };
    }

    const incident = this.getCurrentIncident();
    if (!incident?.resolution) {
      return { ok: false, feedback: 'Нет активного инцидента, требующего действий.', resolved: false };
    }

    if (!this.state.readManualSections.has(procedure.manualSection)) {
      return {
        ok: false,
        feedback: `Процедура «${procedure.label}» не изучена. Откройте §${procedure.manualSection} в методичке.`,
        resolved: false,
      };
    }

    const res = incident.resolution;
    this.state.applyImpact({ energy: -procedure.energyCost });

    const wrong = incident.wrongActions?.find((w) => w.procedure === procedureId);
    if (wrong) {
      if (res.requiresManual && !this.state.readManualSections.has(res.requiresManual)) {
        return {
          ok: false,
          feedback: `Сначала изучите §${res.requiresManual} в методичке.`,
          resolved: false,
        };
      }
      if (res.requiresDiagnostic) {
        const sector = this.state.sectors.find((s) => s.id === sectorId);
        if (!sector?.diagnosticDone) {
          return {
            ok: false,
            feedback: 'Сначала выполните диагностику выбранного отсека.',
            resolved: false,
          };
        }
      }
      if (wrong.impact) this.state.applyImpact(wrong.impact);
      this.pushFeed(wrong.feedback, 'warn');
      this.emit({ type: 'procedureAttempted', payload: { feedback: wrong.feedback } });
      this.emit({ type: 'stateChanged' });
      if (wrong.completesIncident) {
        this.resolveIncident(incident, procedure.label);
        return { ok: true, feedback: wrong.feedback, resolved: true };
      }
      if (this.checkGameOver()) return { ok: false, feedback: wrong.feedback, resolved: false };
      return { ok: false, feedback: wrong.feedback, resolved: false };
    }

    const sectorMatch = res.sectorId === sectorId;
    const procedureMatch = res.procedure === procedureId;

    if (res.requiresManual && !this.state.readManualSections.has(res.requiresManual)) {
      return {
        ok: false,
        feedback: `Сначала изучите §${res.requiresManual} в методичке.`,
        resolved: false,
      };
    }

    if (res.requiresDiagnostic) {
      const sector = this.state.sectors.find((s) => s.id === sectorId);
      if (!sector?.diagnosticDone) {
        return {
          ok: false,
          feedback: 'Сначала выполните диагностику выбранного отсека.',
          resolved: false,
        };
      }
    }

    if (!sectorMatch || !procedureMatch) {
      const fb = `Процедура «${procedure.label}» на ${sectorId} не соответствует текущему инциденту. Сверьтесь с методичкой.`;
      this.pushFeed(fb, 'info');
      return { ok: false, feedback: fb, resolved: false };
    }

    this.resolveIncident(incident, procedure.label);
    return { ok: true, feedback: `Выполнено: ${procedure.label} → ${sectorId}`, resolved: true };
  }

  acknowledge(): void {
    const incident = this.getCurrentIncident();
    if (!incident?.ackOnly || this.state.status !== 'playing') return;

    this.state.advanceTime(incident.timeAdvance ?? 5);
    this.pushFeed('— подтверждено —', 'info');
    this.emit({ type: 'incidentResolved', payload: { incident } });
    this.advanceToNext(incident.nextIncident, incident);
  }

  /** Специальные действия панели «Архив» */
  archiveAction(action: 'delete' | 'keep'): void {
    const incident = this.getCurrentIncident();
    if (!incident || incident.id !== 'shift1-archive') return;

    if (action === 'delete') {
      this.state.flags.add('archive_deleted');
      this.state.applyImpact({ aiStability: 5 });
      this.pushFeed('SVET: Спасибо, Александр. Меньше мусора — больше ясности.', 'info');
    } else {
      this.state.flags.add('archive_kept');
      this.pushFeed('Архив капитана оставлен в фоновом режиме.', 'info');
    }

    this.resolveIncidentFlow(incident);
  }

  private resolveIncident(incident: Incident, procedureLabel: string): void {
    this.state.advanceTime(incident.timeAdvance ?? 10);
    this.pushFeed(`Инцидент устранён: ${procedureLabel}`, 'info');

    if (incident.onResolve) this.applySideEffect(incident.onResolve);

    this.emit({ type: 'incidentResolved', payload: { incident } });
    this.emit({ type: 'stateChanged' });

    if (this.checkGameOver()) return;
    this.advanceToNext(incident.nextIncident, incident);
  }

  private resolveIncidentFlow(incident: Incident): void {
    this.state.advanceTime(incident.timeAdvance ?? 8);
    if (incident.onResolve) this.applySideEffect(incident.onResolve);
    this.emit({ type: 'incidentResolved', payload: { incident } });
    this.emit({ type: 'stateChanged' });
    if (this.checkGameOver()) return;
    this.advanceToNext(incident.nextIncident, incident);
  }

  private advanceToNext(nextId: string | null, current: Incident): void {
    if (nextId) {
      this.presentIncident(nextId);
      return;
    }
    if (current.isShiftEnd) {
      this.advanceShift();
      return;
    }
    if (this.state.shift >= this.scenario.index.shifts) {
      this.checkVictoryEnding();
    } else {
      this.advanceShift();
    }
  }

  private presentIncident(incidentId: string): void {
    const incident = this.scenario.incidentMap.get(incidentId);
    if (!incident) throw new Error(`Incident not found: ${incidentId}`);

    if (incident.conditions && !this.meetsConditions(incident.conditions)) {
      if (incident.skipIfFail) {
        this.presentIncident(incident.skipIfFail);
        return;
      }
      throw new Error(`Incident "${incidentId}" conditions not met`);
    }

    this.state.currentIncidentId = incidentId;
    const msg = this.pushFeed(incident.message, incident.severity ?? 'info');

    if (incident.onEnter) this.applySideEffect(incident.onEnter);

    this.emit({ type: 'feedAppended', payload: { message: msg } });
    this.emit({ type: 'incidentPresented', payload: { incident } });
    this.emit({ type: 'stateChanged' });
  }

  private advanceShift(): void {
    if (this.state.shift >= this.scenario.index.shifts) {
      this.checkVictoryEnding();
      return;
    }
    this.state.shift += 1;
    this.state.sectors.forEach((s) => {
      s.diagnosticDone = false;
    });
    this.pushFeed(`——— Смена ${String(this.state.shift).padStart(2, '0')} ———`, 'info');
    this.emit({ type: 'shiftChanged' });
    this.emit({ type: 'stateChanged' });

    const start = this.scenario.incidents.find(
      (i) => i.shift === this.state.shift && i.isShiftStart,
    );
    if (start) this.presentIncident(start.id);
    else this.checkVictoryEnding();
  }

  private applySideEffect(effect: IncidentSideEffect): void {
    if (effect.logAppend) this.pushFeed(effect.logAppend, 'warn');
    if (effect.setFlags) effect.setFlags.forEach((f) => this.state.flags.add(f));
    if (effect.sectorUpdates) {
      for (const u of effect.sectorUpdates) {
        const s = this.state.sectors.find((x) => x.id === u.id);
        if (s) {
          if (u.status) s.status = u.status;
          if (u.temperature !== undefined) s.temperature = u.temperature;
          if (u.quarantine !== undefined) s.quarantine = u.quarantine;
        }
      }
    }
    if (effect.triggerEffect) {
      this.emit({ type: 'effectTriggered', payload: { effect: effect.triggerEffect } });
    }
  }

  private meetsConditions(c: NonNullable<Incident['conditions']>): boolean {
    if (c.shift !== undefined && this.state.shift !== c.shift) return false;
    if (c.requiresFlag && !this.state.flags.has(c.requiresFlag)) return false;
    if (c.forbidsFlag && this.state.flags.has(c.forbidsFlag)) return false;
    return true;
  }

  private pushFeed(text: string, severity: FeedMessage['severity']): FeedMessage {
    const msg = this.state.addFeed(text, severity);
    return msg;
  }

  private checkGameOver(): boolean {
    let reason: EndingConditions['gameOverReason'] | null = null;
    if (this.state.energy <= 0) reason = 'energy';
    else if (this.state.colonists <= 0) reason = 'colonists';
    else if (this.state.aiStability <= 0) reason = 'aiStability';
    if (!reason) return false;

    const ending = this.scenario.index.endings.find((e) => e.conditions.gameOverReason === reason);
    if (ending) {
      this.state.setGameOver(ending);
      this.state.currentIncidentId = null;
      this.emit({ type: 'gameEnded', payload: { ending } });
      this.emit({ type: 'stateChanged' });
    }
    return true;
  }

  private checkVictoryEnding(): void {
    if (this.checkGameOver()) return;
    for (const ending of this.scenario.index.endings) {
      if (ending.conditions.gameOverReason) continue;
      if (matchesEnding(this.state, ending.conditions)) {
        this.state.setEnding(ending);
        this.state.currentIncidentId = null;
        this.emit({ type: 'gameEnded', payload: { ending } });
        this.emit({ type: 'stateChanged' });
        return;
      }
    }
  }

  private emit(event: EngineEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

function matchesEnding(state: GameState, c: EndingConditions): boolean {
  if (c.requiresAllFlags?.some((f) => !state.flags.has(f))) return false;
  if (c.requiresFlag && !state.flags.has(c.requiresFlag)) return false;
  if (c.forbidsFlag && state.flags.has(c.forbidsFlag)) return false;
  if (c.minEnergy !== undefined && state.energy < c.minEnergy) return false;
  if (c.maxEnergy !== undefined && state.energy > c.maxEnergy) return false;
  if (c.minColonists !== undefined && state.colonists < c.minColonists) return false;
  if (c.maxColonists !== undefined && state.colonists > c.maxColonists) return false;
  if (c.minAiStability !== undefined && state.aiStability < c.minAiStability) return false;
  if (c.maxAiStability !== undefined && state.aiStability <= c.maxAiStability) return false;
  return true;
}
