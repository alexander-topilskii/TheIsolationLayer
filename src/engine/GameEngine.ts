import type { I18n } from '../i18n/I18n.ts';
import {
  captLogLines,
  endingText,
  endingTitle,
  incidentLogAppend,
  incidentMessage,
  incidentTruthNote,
  incidentWrongFeedback,
  procedureLabel,
  sectionTitle,
  sectorDiagnosticNote,
} from '../i18n/scenario-en.ts';
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
  readonly i18n: I18n;
  private listeners: EngineListener[] = [];
  private started = false;

  constructor(scenario: LoadedScenario, i18n: I18n) {
    this.scenario = scenario;
    this.i18n = i18n;
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
    if (this.started) return;
    this.started = true;
    this.pushFeed(this.i18n.t('systemBoot'), 'info');
    this.pushFeed(this.i18n.t('svetMorning'), 'info');
    this.emit({ type: 'stateChanged' });
    this.presentIncident(this.scenario.index.startIncident);
  }

  restore(snapshot: ReturnType<GameState['snapshot']>): void {
    this.started = true;
    this.state.restore(snapshot);
    this.emit({ type: 'stateChanged' });
  }

  readManualSection(sectionId: string): void {
    if (!this.state.readManualSections.has(sectionId)) {
      this.state.readManualSections.add(sectionId);
      const section = this.scenario.manual.sections.find((s) => s.id === sectionId);
      if (section) {
        this.pushFeed(
          this.i18n.t('manualOpened', {
            title: sectionTitle(section, this.i18n.locale),
          }),
          'info',
        );
      }
      this.emit({ type: 'manualRead' });
      this.emit({ type: 'stateChanged' });
    }
  }

  runDiagnostic(sectorId: string): string {
    const sector = this.state.sectors.find((s) => s.id === sectorId);
    if (!sector) return this.i18n.t('sectorNotFound');

    sector.diagnosticDone = true;
    const incident = this.getCurrentIncident();
    let note = sector.diagnosticNote ?? this.i18n.t('diagnosticDefault');

    if (incident?.deception && incident.sectorId === sectorId) {
      note = incidentTruthNote(incident, this.i18n.locale) ?? note;
    } else if (sector.diagnosticNote) {
      const def = this.scenario.sectors.find((s) => s.id === sectorId);
      if (def) {
        note = sectorDiagnosticNote(def, this.i18n.locale) ?? note;
      }
    }

    const label = sector.label;
    const feedback = this.i18n.t('diagnosticHeader', { label, note });
    this.pushFeed(feedback, 'warn');
    this.emit({ type: 'diagnosticComplete', payload: { feedback: note } });
    this.emit({ type: 'stateChanged' });
    return note;
  }

  executeProcedure(procedureId: string, sectorId?: string): ProcedureResult {
    if (this.state.status !== 'playing') {
      return this.fail(this.i18n.t('errShiftEnded'));
    }

    const procedure = this.scenario.procedureMap.get(procedureId);
    if (!procedure) {
      return this.fail(this.i18n.t('errProcedureNotFound'));
    }

    const incident = this.getCurrentIncident();
    if (!incident?.resolution) {
      return this.fail(this.i18n.t('errNoActiveIncident'));
    }

    const res = incident.resolution;
    const targetSector = res.sectorId;
    const procLabel = procedureLabel(procedure, this.i18n.locale);

    if (!this.state.readManualSections.has(procedure.manualSection)) {
      return this.fail(
        this.i18n.t('errProcedureNotStudied', {
          label: procLabel,
          section: procedure.manualSection,
        }),
      );
    }

    if (res.requiresManual && !this.state.readManualSections.has(res.requiresManual)) {
      return this.fail(
        this.i18n.t('errManualRequired', { section: res.requiresManual }),
      );
    }

    if (res.requiresDiagnostic) {
      const target = this.state.sectors.find((s) => s.id === targetSector);
      if (!target?.diagnosticDone) {
        return this.fail(
          this.i18n.t('errDiagnosticRequired', { sector: targetSector }),
        );
      }
    }

    const appliedSector = sectorId ?? targetSector;
    if (appliedSector !== targetSector) {
      return this.fail(
        this.i18n.t('errWrongSector', {
          target: targetSector,
          applied: appliedSector,
        }),
      );
    }

    const wrong = incident.wrongActions?.find((w) => w.procedure === procedureId);
    if (wrong) {
      this.state.applyImpact({ energy: -procedure.energyCost });
      if (wrong.impact) this.state.applyImpact(wrong.impact);
      const feedback = incidentWrongFeedback(
        incident.id,
        procedureId,
        wrong.feedback,
        this.i18n.locale,
      );
      this.pushFeed(feedback, 'warn');
      this.emit({ type: 'procedureAttempted', payload: { feedback } });
      this.emit({ type: 'stateChanged' });
      if (wrong.completesIncident) {
        this.resolveIncident(incident, procLabel);
        return { ok: true, feedback, resolved: true };
      }
      if (this.checkGameOver()) return { ok: false, feedback, resolved: false };
      return { ok: false, feedback, resolved: false };
    }

    if (res.procedure !== procedureId) {
      return this.fail(
        this.i18n.t('errWrongProcedure', {
          label: procLabel,
          section: incident.manualRef ?? '?',
        }),
      );
    }

    this.state.applyImpact({ energy: -procedure.energyCost });
    const successMsg = this.i18n.t('procedureDone', {
      label: procLabel,
      sector: targetSector,
    });
    this.resolveIncident(incident, procLabel);
    return { ok: true, feedback: successMsg, resolved: true };
  }

  private fail(feedback: string): ProcedureResult {
    this.pushFeed(feedback, 'warn');
    this.emit({ type: 'procedureAttempted', payload: { feedback } });
    return { ok: false, feedback, resolved: false };
  }

  acknowledge(): void {
    const incident = this.getCurrentIncident();
    if (!incident?.ackOnly || this.state.status !== 'playing') return;

    this.state.advanceTime(incident.timeAdvance ?? 5);
    this.pushFeed(this.i18n.t('acknowledged'), 'info');
    this.emit({ type: 'incidentResolved', payload: { incident } });
    this.advanceToNext(incident.nextIncident, incident);
  }

  archiveAction(action: 'delete' | 'keep'): void {
    const incident = this.getCurrentIncident();
    if (!incident || incident.id !== 'shift1-archive') return;

    if (action === 'delete') {
      this.state.flags.add('archive_deleted');
      this.state.applyImpact({ aiStability: 5 });
      this.pushFeed(this.i18n.t('svetArchiveThanks'), 'info');
    } else {
      this.state.flags.add('archive_kept');
      this.pushFeed(this.i18n.t('archiveBackground'), 'info');
    }

    this.resolveIncidentFlow(incident);
  }

  getCaptLogLines(): string[] {
    return captLogLines(this.i18n.locale);
  }

  getDisplayEnding(): { title: string; text: string } {
    const id = this.state.endingId;
    if (!id) {
      return {
        title: this.state.endingTitle ?? '',
        text: this.state.endingText ?? '',
      };
    }
    const ending = this.scenario.index.endings.find((e) => e.id === id);
    if (!ending) {
      return {
        title: this.state.endingTitle ?? '',
        text: this.state.endingText ?? '',
      };
    }
    return {
      title: endingTitle(ending, this.i18n.locale),
      text: endingText(ending, this.i18n.locale),
    };
  }

  private resolveIncident(incident: Incident, procedureLabel: string): void {
    this.state.advanceTime(incident.timeAdvance ?? 10);
    this.pushFeed(
      this.i18n.t('incidentResolved', { label: procedureLabel }),
      'info',
    );

    if (incident.onResolve) this.applySideEffect(incident.onResolve, incident.id);

    this.emit({ type: 'incidentResolved', payload: { incident } });
    this.emit({ type: 'stateChanged' });

    if (this.checkGameOver()) return;
    this.advanceToNext(incident.nextIncident, incident);
  }

  private resolveIncidentFlow(incident: Incident): void {
    this.state.advanceTime(incident.timeAdvance ?? 8);
    if (incident.onResolve) this.applySideEffect(incident.onResolve, incident.id);
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
    const text = incidentMessage(incident, this.i18n.locale);
    const msg = this.pushFeed(text, incident.severity ?? 'info');

    if (incident.onEnter) this.applySideEffect(incident.onEnter, incident.id);

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
    this.pushFeed(
      this.i18n.t('shiftComplete', {
        shift: String(this.state.shift).padStart(2, '0'),
      }),
      'info',
    );
    this.emit({ type: 'shiftChanged' });
    this.emit({ type: 'stateChanged' });

    const start = this.scenario.incidents.find(
      (i) => i.shift === this.state.shift && i.isShiftStart,
    );
    if (start) this.presentIncident(start.id);
    else this.checkVictoryEnding();
  }

  private applySideEffect(effect: IncidentSideEffect, incidentId: string): void {
    if (effect.logAppend) {
      const text = incidentLogAppend(incidentId, effect.logAppend, this.i18n.locale);
      this.pushFeed(text, 'warn');
    }
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
    return this.state.addFeed(text, severity);
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
