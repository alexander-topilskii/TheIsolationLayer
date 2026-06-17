export type TicketSeverity = 'info' | 'warning' | 'critical';
export type SectorStatus = 'nominal' | 'damaged' | 'offline';
export type GameStatus = 'playing' | 'ending' | 'gameover';
export type TriggerEffect = 'ai_cli_override';

export interface MetricImpact {
  energy?: number;
  aiStability?: number;
  colonists?: number;
}

export interface DeceptionClaim {
  sector: string;
  condition: string;
}

export interface Deception {
  active: boolean;
  claim: DeceptionClaim;
  truth: DeceptionClaim;
}

export interface SectorUpdate {
  id: string;
  status?: SectorStatus;
  temperature?: number;
  quarantine?: boolean;
}

export interface TicketSideEffect {
  logAppend?: string;
  triggerEffect?: TriggerEffect;
  setFlags?: string[];
  sectorUpdates?: SectorUpdate[];
}

export interface TicketConditions {
  minEnergy?: number;
  maxEnergy?: number;
  minAiStability?: number;
  shift?: number;
  requiresFlag?: string;
}

export interface TicketOption {
  id: string;
  text: string;
  impact: MetricImpact;
  nextTicket: string | null;
  requiresVerification?: boolean;
  penaltyIfUnverified?: MetricImpact;
}

export interface Ticket {
  id: string;
  shift: number;
  system: string;
  severity: TicketSeverity;
  log: string;
  options?: TicketOption[];
  timeAdvance?: number;
  deception?: Deception;
  onEnter?: TicketSideEffect;
  onResolve?: TicketSideEffect;
  isShiftEnd?: boolean;
  isShiftStart?: boolean;
  conditions?: TicketConditions;
}

export interface SectorDefinition {
  id: string;
  label: string;
  status: SectorStatus;
  temperature: number;
  quarantine: boolean;
}

export interface ColonistRecord {
  id: string;
  lastName: string;
  firstName: string;
  sector: string;
  bio: string;
}

export interface CliCommandDef {
  name: string;
  description: string;
  response: string;
}

export interface CliModule {
  commands: CliCommandDef[];
}

export type ProtocolsModule = Record<string, string[]>;

export interface EndingConditions {
  minEnergy?: number;
  minColonists?: number;
  minAiStability?: number;
  maxAiStability?: number;
  maxEnergy?: number;
  maxColonists?: number;
  gameOverReason?: 'energy' | 'colonists' | 'aiStability';
}

export interface Ending {
  id: string;
  title: string;
  text: string;
  conditions: EndingConditions;
}

export interface InitialState {
  energy: number;
  aiStability: number;
  colonists: number;
  shift: number;
  gameTime: string;
}

export interface ScenarioIndex {
  id: string;
  title: string;
  version: string;
  shifts: number;
  initialState: InitialState;
  modules: {
    tickets: string;
    protocols: string;
    colonists: string;
    sectors: string;
    cli: string;
  };
  startTicket: string;
  endings: Ending[];
}

export interface LoadedScenario {
  index: ScenarioIndex;
  tickets: Ticket[];
  protocols: ProtocolsModule;
  colonists: ColonistRecord[];
  sectors: SectorDefinition[];
  cli: CliModule;
  ticketMap: Map<string, Ticket>;
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'CRIT' | 'AI' | 'SYS';
  system: string;
  message: string;
}

export interface SectorState extends SectorDefinition {}

export interface GameStateSnapshot {
  energy: number;
  aiStability: number;
  colonists: number;
  shift: number;
  gameTime: string;
  currentTicketId: string | null;
  log: LogEntry[];
  sectors: SectorState[];
  flags: string[];
  verifiedDiagnostics: boolean;
  status: GameStatus;
  endingId: string | null;
  endingTitle: string | null;
  endingText: string | null;
}

export type EngineEventType =
  | 'stateChanged'
  | 'ticketPresented'
  | 'ticketResolved'
  | 'shiftChanged'
  | 'effectTriggered'
  | 'gameEnded'
  | 'logAppended';

export interface EngineEvent {
  type: EngineEventType;
  payload?: {
    ticket?: Ticket;
    effect?: TriggerEffect;
    ending?: Ending;
    logEntry?: LogEntry;
  };
}

export type EngineListener = (event: EngineEvent) => void;
