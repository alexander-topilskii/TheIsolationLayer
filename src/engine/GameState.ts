import type {
  Ending,
  FeedMessage,
  FeedSeverity,
  InitialState,
  SectorDefinition,
  SectorState,
} from './types.ts';

let feedCounter = 0;

export class GameState {
  energy: number;
  aiStability: number;
  colonists: number;
  shift: number;
  gameTime: string;
  currentIncidentId: string | null = null;
  feed: FeedMessage[] = [];
  sectors: SectorState[];
  flags = new Set<string>();
  readManualSections = new Set<string>();
  status: 'playing' | 'ending' | 'gameover' = 'playing';
  endingId: string | null = null;
  endingTitle: string | null = null;
  endingText: string | null = null;

  constructor(initial: InitialState, sectors: SectorDefinition[]) {
    this.energy = initial.energy;
    this.aiStability = initial.aiStability;
    this.colonists = initial.colonists;
    this.shift = initial.shift;
    this.gameTime = initial.gameTime;
    this.sectors = sectors.map((s) => ({ ...s, diagnosticDone: false }));
  }

  addFeed(text: string, severity: FeedSeverity = 'info'): FeedMessage {
    const entry: FeedMessage = {
      id: `msg-${++feedCounter}`,
      time: this.gameTime,
      text,
      severity,
    };
    this.feed.push(entry);
    if (this.feed.length > 80) this.feed.shift();
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

  snapshot() {
    return {
      energy: this.energy,
      aiStability: this.aiStability,
      colonists: this.colonists,
      shift: this.shift,
      gameTime: this.gameTime,
      currentIncidentId: this.currentIncidentId,
      feed: [...this.feed],
      sectors: this.sectors.map((s) => ({ ...s })),
      flags: [...this.flags],
      readManualSections: [...this.readManualSections],
      status: this.status,
      endingId: this.endingId,
      endingTitle: this.endingTitle,
      endingText: this.endingText,
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
