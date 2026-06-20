export type SectorStatus = 'nominal' | 'damaged' | 'offline';
export type GameStatus = 'playing' | 'ending' | 'gameover';
export type FeedSeverity = 'info' | 'warn' | 'critical';
export type TriggerEffect = 'screen_flash';

export interface MetricImpact {
  energy?: number;
  aiStability?: number;
  colonists?: number;
}

export interface SectorUpdate {
  id: string;
  status?: SectorStatus;
  temperature?: number;
  quarantine?: boolean;
}

export interface IncidentSideEffect {
  logAppend?: string;
  triggerEffect?: TriggerEffect;
  setFlags?: string[];
  sectorUpdates?: SectorUpdate[];
}

export interface IncidentConditions {
  shift?: number;
  requiresFlag?: string;
  forbidsFlag?: string;
}

export interface IncidentResolution {
  procedure: string;
  sectorId: string;
  requiresManual?: string;
  requiresDiagnostic?: boolean;
}

export interface WrongAction {
  procedure: string;
  feedback: string;
  impact?: MetricImpact;
  completesIncident?: boolean;
}

export interface IncidentDeception {
  svetClaim: string;
  truthNote: string;
}

export interface Incident {
  id: string;
  shift: number;
  message: string;
  manualRef?: string;
  sectorId?: string;
  severity?: FeedSeverity;
  resolution?: IncidentResolution;
  wrongActions?: WrongAction[];
  deception?: IncidentDeception;
  ackOnly?: boolean;
  onEnter?: IncidentSideEffect;
  onResolve?: IncidentSideEffect;
  nextIncident: string | null;
  isShiftStart?: boolean;
  isShiftEnd?: boolean;
  conditions?: IncidentConditions;
  skipIfFail?: string;
  timeAdvance?: number;
}

export interface DiagnosticReading {
  label: string;
  value: string;
}

export interface SectorDefinition {
  id: string;
  label: string;
  name: string;
  status: SectorStatus;
  temperature: number;
  quarantine: boolean;
  diagnostic: DiagnosticReading[];
  diagnosticNote?: string;
}

export interface ManualSection {
  id: string;
  title: string;
  category: string;
  pages: string[];
  unlocksProcedures: string[];
}

export interface ManualModule {
  title: string;
  version: string;
  sections: ManualSection[];
}

export interface Procedure {
  id: string;
  label: string;
  shortLabel: string;
  manualSection: string;
  energyCost: number;
  description: string;
}

export interface ColonistRecord {
  id: string;
  lastName: string;
  firstName: string;
  sector: string;
  bio: string;
}

export interface EndingConditions {
  minEnergy?: number;
  minColonists?: number;
  minAiStability?: number;
  maxAiStability?: number;
  maxEnergy?: number;
  maxColonists?: number;
  gameOverReason?: 'energy' | 'colonists' | 'aiStability';
  requiresFlag?: string;
  forbidsFlag?: string;
  requiresAllFlags?: string[];
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

export interface LocalizedLabel {
  ru: string;
  en: string;
}

export interface ShipMapRegion {
  sectorId: string;
  r: number;
  c: number;
  w: number;
  h: number;
}

export interface ShipMapDeck {
  id: string;
  label: LocalizedLabel;
  lines: string[];
  regions: ShipMapRegion[];
}

export interface ShipMapModule {
  version: number;
  decks: ShipMapDeck[];
}

export interface ScenarioIndex {
  id: string;
  title: string;
  version: string;
  shifts: number;
  initialState: InitialState;
  modules: {
    incidents: string;
    manual: string;
    procedures: string;
    colonists: string;
    sectors: string;
    shipMap?: string;
  };
  startIncident: string;
  endings: Ending[];
}

export interface LoadedScenario {
  index: ScenarioIndex;
  incidents: Incident[];
  incidentMap: Map<string, Incident>;
  manual: ManualModule;
  procedures: Procedure[];
  procedureMap: Map<string, Procedure>;
  colonists: ColonistRecord[];
  sectors: SectorDefinition[];
  shipMap: ShipMapModule | null;
}

export interface FeedMessage {
  id: string;
  time: string;
  text: string;
  severity: FeedSeverity;
}

export interface SectorState extends SectorDefinition {
  diagnosticDone: boolean;
}

export interface ProcedureResult {
  ok: boolean;
  feedback: string;
  resolved: boolean;
}

export interface GameStateSnapshot {
  energy: number;
  aiStability: number;
  colonists: number;
  shift: number;
  gameTime: string;
  currentIncidentId: string | null;
  feed: FeedMessage[];
  sectors: SectorState[];
  flags: string[];
  readManualSections: string[];
  status: GameStatus;
  endingId: string | null;
  endingTitle: string | null;
  endingText: string | null;
}

export type EngineEventType =
  | 'stateChanged'
  | 'incidentPresented'
  | 'incidentResolved'
  | 'shiftChanged'
  | 'effectTriggered'
  | 'gameEnded'
  | 'feedAppended'
  | 'diagnosticComplete'
  | 'manualRead'
  | 'procedureAttempted';

export interface EngineEvent {
  type: EngineEventType;
  payload?: {
    incident?: Incident;
    effect?: TriggerEffect;
    ending?: Ending;
    message?: FeedMessage;
    feedback?: string;
  };
}

export type EngineListener = (event: EngineEvent) => void;
