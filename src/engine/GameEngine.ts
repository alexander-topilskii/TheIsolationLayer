import { GameState } from './GameState.ts';
import type {
  Ending,
  EndingConditions,
  EngineEvent,
  EngineListener,
  LoadedScenario,
  MetricImpact,
  Ticket,
  TicketOption,
  TicketSideEffect,
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

  getCurrentTicket(): Ticket | null {
    if (!this.state.currentTicketId) return null;
    return this.scenario.ticketMap.get(this.state.currentTicketId) ?? null;
  }

  getProtocolsForCurrentShift(): string[] {
    return this.scenario.protocols[String(this.state.shift)] ?? [];
  }

  start(): void {
    this.state.addLog('SYS', 'BOOT', 'TERRA-4 CORE v1.0.4 — Recovery Mode');
    this.state.addLog('AI', 'MOTHER', 'Оператор, вы на смене. Протокол изоляции активен.');
    this.emit({ type: 'stateChanged' });
    this.presentTicket(this.scenario.index.startTicket);
  }

  selectOption(optionId: string): void {
    if (this.state.status !== 'playing') return;

    const ticket = this.getCurrentTicket();
    if (!ticket?.options) return;

    const option = ticket.options.find((o) => o.id === optionId);
    if (!option) return;

    this.resolveOption(ticket, option);
  }

  markDiagnosticsVerified(): void {
    if (!this.state.verifiedDiagnostics) {
      this.state.verifiedDiagnostics = true;
      this.state.addLog('INFO', 'DIAG', 'Диагностика сверена с первичными датчиками.');
      this.emit({ type: 'stateChanged' });
    }
  }

  applySideEffect(effect: TicketSideEffect): void {
    if (effect.logAppend) {
      const entry = this.state.addLog('AI', 'MOTHER', effect.logAppend);
      this.emit({ type: 'logAppended', payload: { logEntry: entry } });
    }

    if (effect.setFlags) {
      for (const flag of effect.setFlags) {
        this.state.flags.add(flag);
      }
    }

    if (effect.sectorUpdates) {
      for (const update of effect.sectorUpdates) {
        const sector = this.state.sectors.find((s) => s.id === update.id);
        if (sector) {
          if (update.status !== undefined) sector.status = update.status;
          if (update.temperature !== undefined) sector.temperature = update.temperature;
          if (update.quarantine !== undefined) sector.quarantine = update.quarantine;
        }
      }
    }

    if (effect.triggerEffect) {
      this.emit({ type: 'effectTriggered', payload: { effect: effect.triggerEffect } });
    }
  }

  private resolveOption(ticket: Ticket, option: TicketOption): void {
    let impact: MetricImpact = { ...option.impact };

    if (option.requiresVerification) {
      if (!this.state.verifiedDiagnostics) {
        impact = option.penaltyIfUnverified
          ? mergeImpact(impact, option.penaltyIfUnverified)
          : mergeImpact(impact, { aiStability: -10 });
      }
    }

    this.state.applyImpact(impact);
    this.state.advanceTime(ticket.timeAdvance ?? 10);
    this.state.addLog('INFO', ticket.system.toUpperCase(), `Выбрано: ${option.text}`);

    if (ticket.onResolve) {
      this.applySideEffect(ticket.onResolve);
    }

    this.state.verifiedDiagnostics = false;
    this.emit({ type: 'ticketResolved', payload: { ticket } });
    this.emit({ type: 'stateChanged' });

    if (this.checkGameOver()) return;

    this.advanceToNext(option.nextTicket, ticket);
  }

  private advanceToNext(nextTicketId: string | null, currentTicket: Ticket): void {
    if (nextTicketId) {
      this.presentTicket(nextTicketId);
      return;
    }

    if (currentTicket.isShiftEnd) {
      this.advanceShift();
      return;
    }

    if (this.state.shift >= this.scenario.index.shifts) {
      this.checkVictoryEnding();
    } else {
      this.advanceShift();
    }
  }

  private presentTicket(ticketId: string): void {
    const ticket = this.scenario.ticketMap.get(ticketId);
    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    if (ticket.conditions && !this.meetsConditions(ticket.conditions)) {
      throw new Error(`Ticket "${ticketId}" conditions not met`);
    }

    this.state.currentTicketId = ticketId;
    const level =
      ticket.severity === 'critical' ? 'CRIT' : ticket.severity === 'warning' ? 'WARN' : 'INFO';
    const entry = this.state.addLog(level, ticket.system.toUpperCase(), ticket.log);

    if (ticket.onEnter) {
      this.applySideEffect(ticket.onEnter);
    }

    this.emit({ type: 'logAppended', payload: { logEntry: entry } });
    this.emit({ type: 'ticketPresented', payload: { ticket } });
    this.emit({ type: 'stateChanged' });
  }

  private advanceShift(): void {
    if (this.state.shift >= this.scenario.index.shifts) {
      this.checkVictoryEnding();
      return;
    }

    this.state.shift += 1;
    this.state.verifiedDiagnostics = false;
    this.state.addLog('SYS', 'SHIFT', `Начало смены ${String(this.state.shift).padStart(2, '0')}`);
    this.emit({ type: 'shiftChanged' });
    this.emit({ type: 'stateChanged' });

    const startTicket = this.scenario.tickets.find(
      (t) => t.shift === this.state.shift && t.isShiftStart,
    );
    if (startTicket) {
      this.presentTicket(startTicket.id);
    } else {
      this.checkVictoryEnding();
    }
  }

  private meetsConditions(conditions: NonNullable<Ticket['conditions']>): boolean {
    if (conditions.shift !== undefined && this.state.shift !== conditions.shift) return false;
    if (conditions.minEnergy !== undefined && this.state.energy < conditions.minEnergy) return false;
    if (conditions.maxEnergy !== undefined && this.state.energy > conditions.maxEnergy) return false;
    if (conditions.minAiStability !== undefined && this.state.aiStability < conditions.minAiStability)
      return false;
    if (conditions.requiresFlag !== undefined && !this.state.flags.has(conditions.requiresFlag))
      return false;
    return true;
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
      this.state.currentTicketId = null;
      this.emit({ type: 'gameEnded', payload: { ending } });
      this.emit({ type: 'stateChanged' });
    }
    return true;
  }

  private checkVictoryEnding(): void {
    if (this.checkGameOver()) return;

    const ending = this.findVictoryEnding();
    if (ending) {
      this.state.setEnding(ending);
      this.state.currentTicketId = null;
      this.emit({ type: 'gameEnded', payload: { ending } });
      this.emit({ type: 'stateChanged' });
    }
  }

  private findVictoryEnding(): Ending | undefined {
    for (const ending of this.scenario.index.endings) {
      if (ending.conditions.gameOverReason) continue;
      if (matchesEnding(this.state, ending.conditions)) {
        return ending;
      }
    }
    return this.scenario.index.endings.find((e) => e.id === 'autonomous-flight');
  }

  private emit(event: EngineEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

function mergeImpact(a: MetricImpact, b: MetricImpact): MetricImpact {
  return {
    energy: (a.energy ?? 0) + (b.energy ?? 0),
    aiStability: (a.aiStability ?? 0) + (b.aiStability ?? 0),
    colonists: (a.colonists ?? 0) + (b.colonists ?? 0),
  };
}

function matchesEnding(state: GameState, conditions: EndingConditions): boolean {
  if (conditions.minEnergy !== undefined && state.energy < conditions.minEnergy) return false;
  if (conditions.maxEnergy !== undefined && state.energy > conditions.maxEnergy) return false;
  if (conditions.minColonists !== undefined && state.colonists < conditions.minColonists) return false;
  if (conditions.maxColonists !== undefined && state.colonists > conditions.maxColonists) return false;
  if (conditions.minAiStability !== undefined && state.aiStability < conditions.minAiStability)
    return false;
  if (conditions.maxAiStability !== undefined && state.aiStability <= conditions.maxAiStability)
    return false;
  return true;
}
