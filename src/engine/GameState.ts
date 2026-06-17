import type {
  Ending,
  GameStateSnapshot,
  GameStatus,
  InitialState,
  LogEntry,
  SectorDefinition,
  SectorState,
} from './types.ts';

const MAX_LOG_ENTRIES = 100;

export class GameState {
  energy: number;
  aiStability: number;
  colonists: number;
  shift: number;
  gameTime: string;
  currentTicketId: string | null = null;
  log: LogEntry[] = [];
  sectors: SectorState[];
  flags = new Set<string>();
  verifiedDiagnostics = false;
  status: GameStatus = 'playing';
  endingId: string | null = null;
  endingTitle: string | null = null;
  endingText: string | null = null;

  constructor(initial: InitialState, sectors: SectorDefinition[]) {
    this.energy = initial.energy;
    this.aiStability = initial.aiStability;
    this.colonists = initial.colonists;
    this.shift = initial.shift;
    this.gameTime = initial.gameTime;
    this.sectors = sectors.map((s) => ({ ...s }));
  }

  addLog(level: LogEntry['level'], system: string, message: string): LogEntry {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      system,
      message,
    };
    this.log.push(entry);
    if (this.log.length > MAX_LOG_ENTRIES) {
      this.log.shift();
    }
    return entry;
  }

  applyImpact(impact: { energy?: number; aiStability?: number; colonists?: number }): void {
    if (impact.energy !== undefined) {
      this.energy = clamp(this.energy + impact.energy, 0, 100);
    }
    if (impact.aiStability !== undefined) {
      this.aiStability = clamp(this.aiStability + impact.aiStability, 0, 100);
    }
    if (impact.colonists !== undefined) {
      this.colonists = clamp(this.colonists + impact.colonists, 0, 50000);
    }
  }

  advanceTime(minutes: number): void {
    const [h, m] = this.gameTime.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    this.gameTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  }

  setEnding(ending: Ending): void {
    this.status = 'ending';
    this.endingId = ending.id;
    this.endingTitle = ending.title;
    this.endingText = ending.text;
  }

  setGameOver(ending: Ending): void {
    this.status = 'gameover';
    this.endingId = ending.id;
    this.endingTitle = ending.title;
    this.endingText = ending.text;
  }

  snapshot(): GameStateSnapshot {
    return {
      energy: this.energy,
      aiStability: this.aiStability,
      colonists: this.colonists,
      shift: this.shift,
      gameTime: this.gameTime,
      currentTicketId: this.currentTicketId,
      log: [...this.log],
      sectors: this.sectors.map((s) => ({ ...s })),
      flags: [...this.flags],
      verifiedDiagnostics: this.verifiedDiagnostics,
      status: this.status,
      endingId: this.endingId,
      endingTitle: this.endingTitle,
      endingText: this.endingText,
    };
  }

  private formatTimestamp(): string {
    return `${this.gameTime}:00`;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
