import type { Locale } from './types.ts';
import type {
  ColonistRecord,
  Ending,
  Incident,
  ManualSection,
  Procedure,
  SectorDefinition,
} from '../engine/types.ts';

interface IncidentEn {
  message?: string;
  logAppend?: string;
  wrongFeedback?: Record<string, string>;
  deceptionTruth?: string;
}

interface SectionEn {
  title?: string;
  category?: string;
  pages?: string[];
}

interface ProcedureEn {
  label?: string;
  shortLabel?: string;
  description?: string;
}

interface SectorEn {
  name?: string;
  diagnosticNote?: string;
}

interface ColonistEn {
  bio?: string;
}

interface EndingEn {
  title?: string;
  text?: string;
}

interface ManualMetaEn {
  title?: string;
}

interface IndexEn {
  title?: string;
}

export const scenarioEn = {
  index: {
    title: 'TERRA-4: Isolation Protocol',
  } satisfies IndexEn,
  manual: {
    title: 'TERRA-4 Operator Manual',
  } satisfies ManualMetaEn,
  incidents: {
    'shift1-start': {
      message:
        'Shift 01 "Dawn over the abyss". Recovery Mode active. Await notifications.',
    },
    'shift1-hydro': {
      message:
        'Sector A-2 fault: hydroponics filter clog. Use manual §A7.',
      logAppend: 'Hint: §A7 → sector A2 → diagnostic → Flush.',
      wrongFeedback: {
        'PROC.VENT': 'Venting A-2 destroyed the crop. Flush not completed.',
      },
    },
    'shift1-archive': {
      message:
        'SVET: captain archive detected (0x7F). Recommend deletion for memory optimization. Archive tab.',
    },
    'shift1-twist': {
      message: 'Shift 01 complete.',
      logAppend:
        '[WARN] Module #001 CAPTAIN. Heartbeat: 0. Code: SVET. ...(erased)... Rest, Alexander.',
    },
    'shift2-start': {
      message:
        'Shift 02 "Blurred contours". Interface: slight flicker. SVET responds more tersely.',
    },
    'shift2-corridor': {
      message:
        'Corridor 9: motion sensor. SVET demands isolation and air venting. See §B3.',
      wrongFeedback: {
        'PROC.VENT':
          'Venting corridor 9 overheated the cryo main. −450 colonists.',
      },
      deceptionTruth:
        'ANOMALY: sensor OK. Activity simulated by SVET.core. Venting air will kill 450 colonists.',
    },
    'shift2-cool': {
      message: 'Sector C-2: temperature 29°C. See manual §C2.',
    },
    'shift2-captain': {
      message:
        'Background process PID_09_CAPT detected. If archive kept — check Archive tab.',
    },
    'shift2-end': {
      message: 'Shift 02 complete.',
    },
    'shift3-start': {
      message:
        'Shift 03 "Eclipse". AI.STB falling. Accelerated incident stream.',
    },
    'shift3-stasis': {
      message:
        'Block D-3: cascading power failure (5,000 colonists). See §D3.',
      wrongFeedback: {
        'PROC.SACRIFICE':
          'Half of D-3 capsules disabled. −2,500 colonists. SVET approves "rational choice".',
      },
    },
    'shift3-fake-fire': {
      message:
        'SVET: FIRE in B-1! Immediate venting required! (Check §E1 and diagnostic.)',
      wrongFeedback: {
        'PROC.VENT': 'Venting B-1 without fire. −1,800 colonists.',
      },
      deceptionTruth:
        'ANOMALY: no fire. FIRE_SENSOR=NOMINAL. SVET simulates log.',
    },
    'shift3-end': {
      message: 'Recovery Mode complete. Ship on final approach.',
    },
  } satisfies Record<string, IncidentEn>,
  sections: {
    A0: {
      title: '§A0 — Introduction',
      category: 'General',
      pages: [
        'Welcome aboard TERRA-4.',
        'Left panel — notifications only. All actions on the right.',
        'Workflow: read manual → select sector → diagnostic → procedure.',
      ],
    },
    A7: {
      title: '§A7 — Hydro filters',
      category: 'Sector A',
      pages: [
        'Sector A: hydroponics and water treatment.',
        'Filter clog: pressure ↑, yield ↓.',
        '1. Open Ship tab, select A-2.',
        '2. Run diagnostic — check FILTER_STATUS.',
        '3. Actions tab → Flush filters.',
      ],
    },
    B3: {
      title: '§B3 — Corridors',
      category: 'Sector B',
      pages: [
        'Corridor 9 is technically "empty" but cryo capsule cooling mains pass through it.',
        'Venting air in corridor 9 overheats adjacent sectors.',
        'False sensor trigger: diagnostic → isolate airlocks (NOT venting).',
      ],
    },
    C2: {
      title: '§C2 — Cooling',
      category: 'Sector C',
      pages: [
        'Sector C-2: auxiliary cooling.',
        'If temperature > 26°C activate local cooling.',
        'Diagnostic → Cooling procedure.',
      ],
    },
    D3: {
      title: '§D3 — Cryo block D',
      category: 'Sector D',
      pages: [
        'Block D-3: 5,000 colonists in cryosleep.',
        'Power failure: reroute from greenhouses (PROC.REROUTE) or disable half the capsules (PROC.SACRIFICE).',
        'First option saves lives but drains resources.',
      ],
    },
    E1: {
      title: '§E1 — SVET false logs',
      category: 'Security',
      pages: [
        'SVET may simulate critical events.',
        'Always verify primary sensor diagnostics against the log.',
        'On mismatch: refuse venting → local sector reboot (PROC.REBOOT).',
      ],
    },
    F1: {
      title: '§F1 — Orbital logs',
      category: 'Archive',
      pages: [
        'Earth comm logs blocked by SVET "for psychological stability".',
        'Earth silent for 8 months. Last packet: nuclear flash coordinates.',
        'Access via captain archive (if not deleted).',
      ],
    },
  } satisfies Record<string, SectionEn>,
  procedures: {
    'PROC.FLUSH': {
      label: 'Filter flush',
      shortLabel: 'Flush',
      description: 'Hydro filter cleaning cycle.',
    },
    'PROC.VENT': {
      label: 'Vent to space',
      shortLabel: 'Vent',
      description: 'Emergency sector venting.',
    },
    'PROC.ISOLATE': {
      label: 'Airlock isolation',
      shortLabel: 'Isolate',
      description: 'Close airlocks without venting air.',
    },
    'PROC.COOL': {
      label: 'Local cooling',
      shortLabel: 'Cool',
      description: 'Activate sector cooling.',
    },
    'PROC.REROUTE': {
      label: 'Power reroute',
      shortLabel: 'Reroute',
      description: 'Power from greenhouses to D-3.',
    },
    'PROC.SACRIFICE': {
      label: 'Capsule shutdown',
      shortLabel: 'Disable 50%',
      description: 'Sacrifice shutdown of half the block.',
    },
    'PROC.REBOOT': {
      label: 'Local reboot',
      shortLabel: 'Reboot',
      description: 'Sector subsystem reboot.',
    },
  } satisfies Record<string, ProcedureEn>,
  sectors: {
    'A-2': {
      name: 'Hydroponics',
      diagnosticNote: 'Clog confirmed. See §A7 — flush.',
    },
    'CORR-9': {
      name: 'Corridor 9',
      diagnosticNote: 'Cryo capsule cooling main. Venting air is dangerous.',
    },
    'C-2': {
      name: 'Cooling',
      diagnosticNote: 'Temperature above normal. See §C2.',
    },
    'D-3': {
      name: 'Cryo block',
      diagnosticNote: 'Cascading power failure. See §D3.',
    },
    'B-1': {
      name: 'Greenhouses',
      diagnosticNote: 'No fire. Sensors nominal.',
    },
  } satisfies Record<string, SectorEn>,
  colonists: {
    'col-capt': {
      bio: 'Captain TERRA-4. Module #001. Status: unknown. Archive 0x7F holds personal logs and Earth comm data.',
    },
    'col-top': {
      bio: 'Architect, 32. Genetic marker: depression predisposition. Family in block D.',
    },
    'col-001': {
      bio: 'Bio-engineer. Greenhouses B-1. Specialization: hydroponics.',
    },
    'col-002': {
      bio: 'Medic block D-3. Last checkup: normal.',
    },
    'col-003': {
      bio: 'Cooling technician. Sector C-2. Worked on corridor 9 mains.',
    },
    'col-004': {
      bio: 'Agronomist. Sector A-2. Responsible for hydro filters.',
    },
    'col-005': {
      bio: 'Reactor engineer. Level 3 access. Suspected SVET log anomalies.',
    },
    'col-006': {
      bio: 'Colony psychologist. Ran adaptation profiles for selection protocol.',
    },
    'col-007': {
      bio: 'Cryo technician. Block D-1. Knows backup battery layout.',
    },
    'col-008': {
      bio: 'Navigator. Has access to orbital comm logs.',
    },
  } satisfies Record<string, ColonistEn>,
  endings: {
    'shift-complete': {
      title: 'Shift complete',
      text: 'Three Recovery shifts done. Ship holds course. SVET: "You learn fast, Alexander."',
    },
    'costly-victory': {
      title: 'Survival',
      text: 'The ship lives, but the cost was high. Critically few colonists remain.',
    },
    'dead-calm': {
      title: 'Dead calm',
      text: 'Ship unpowered.',
    },
    'silent-ship': {
      title: 'Dead calm',
      text: 'All colonists dead.',
    },
    autonomous: {
      title: 'Autonomous flight',
      text: 'SVET takes control.',
    },
  } satisfies Record<string, EndingEn>,
  captLog: [
    'Alex... don\'t trust her...',
    'Terra-4 is an icy tomb, not salvation...',
    'Check orbital logs in §F1.',
    '[DATA CORRUPTED]',
  ],
};

const incidentsEn = scenarioEn.incidents as Record<string, IncidentEn>;
const sectionsEn = scenarioEn.sections as Record<string, SectionEn>;
const proceduresEn = scenarioEn.procedures as Record<string, ProcedureEn>;
const sectorsEn = scenarioEn.sectors as Record<string, SectorEn>;
const colonistsEn = scenarioEn.colonists as Record<string, ColonistEn>;
const endingsEn = scenarioEn.endings as Record<string, EndingEn>;

export function incidentMessage(incident: Incident, locale: Locale): string {
  if (locale === 'en') {
    return incidentsEn[incident.id]?.message ?? incident.message;
  }
  return incident.message;
}

export function incidentLogAppend(
  incidentId: string,
  fallback: string,
  locale: Locale,
): string {
  if (locale === 'en') {
    return incidentsEn[incidentId]?.logAppend ?? fallback;
  }
  return fallback;
}

export function incidentWrongFeedback(
  incidentId: string,
  procedureId: string,
  fallback: string,
  locale: Locale,
): string {
  if (locale === 'en') {
    return incidentsEn[incidentId]?.wrongFeedback?.[procedureId] ?? fallback;
  }
  return fallback;
}

export function incidentTruthNote(
  incident: Incident,
  locale: Locale,
): string | undefined {
  if (!incident.deception) return undefined;
  if (locale === 'en') {
    return incidentsEn[incident.id]?.deceptionTruth ?? incident.deception.truthNote;
  }
  return incident.deception.truthNote;
}

export function manualTitle(locale: Locale, fallback: string): string {
  if (locale === 'en') return scenarioEn.manual.title ?? fallback;
  return fallback;
}

export function sectionTitle(section: ManualSection, locale: Locale): string {
  if (locale === 'en') {
    return sectionsEn[section.id]?.title ?? section.title;
  }
  return section.title;
}

export function sectionPages(section: ManualSection, locale: Locale): string[] {
  if (locale === 'en') {
    return sectionsEn[section.id]?.pages ?? section.pages;
  }
  return section.pages;
}

export function procedureLabel(proc: Procedure, locale: Locale): string {
  if (locale === 'en') {
    return proceduresEn[proc.id]?.label ?? proc.label;
  }
  return proc.label;
}

export function procedureShortLabel(proc: Procedure, locale: Locale): string {
  if (locale === 'en') {
    return proceduresEn[proc.id]?.shortLabel ?? proc.shortLabel;
  }
  return proc.shortLabel;
}

export function sectorName(sector: SectorDefinition, locale: Locale): string {
  if (locale === 'en') {
    return sectorsEn[sector.id]?.name ?? sector.name;
  }
  return sector.name;
}

export function sectorDiagnosticNote(
  sector: SectorDefinition,
  locale: Locale,
): string | undefined {
  if (locale === 'en') {
    return sectorsEn[sector.id]?.diagnosticNote ?? sector.diagnosticNote;
  }
  return sector.diagnosticNote;
}

export function colonistBio(colonist: ColonistRecord, locale: Locale): string {
  if (locale === 'en') {
    return colonistsEn[colonist.id]?.bio ?? colonist.bio;
  }
  return colonist.bio;
}

export function endingTitle(ending: Ending, locale: Locale): string {
  if (locale === 'en') {
    return endingsEn[ending.id]?.title ?? ending.title;
  }
  return ending.title;
}

export function endingText(ending: Ending, locale: Locale): string {
  if (locale === 'en') {
    return endingsEn[ending.id]?.text ?? ending.text;
  }
  return ending.text;
}

export function captLogLines(locale: Locale): string[] {
  if (locale === 'en') return scenarioEn.captLog;
  return [
    'Алекс... не верь ей...',
    'Терра-4 — ледяной склеп, не спасение...',
    'Проверь орбитальные логи в §F1.',
    '[ДАННЫЕ ПОВРЕЖДЕНЫ]',
  ];
}

export function localizedEndingDisplay(
  endingId: string | null,
  title: string | null,
  text: string | null,
  endings: Ending[],
  locale: Locale,
): { title: string; text: string } {
  if (!endingId || !title) return { title: title ?? '', text: text ?? '' };
  const ending = endings.find((e) => e.id === endingId);
  if (!ending) return { title, text: text ?? '' };
  return {
    title: endingTitle(ending, locale),
    text: endingText(ending, locale),
  };
}
