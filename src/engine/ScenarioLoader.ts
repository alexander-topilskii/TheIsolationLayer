import type {
  ColonistRecord,
  Incident,
  LoadedScenario,
  ManualModule,
  Procedure,
  ScenarioIndex,
  SectorDefinition,
} from './types.ts';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json() as Promise<T>;
}

function toAbsoluteUrl(url: string): string {
  return new URL(url, window.location.href).href;
}

function resolveModuleUrl(baseUrl: string, relativePath: string): string {
  const absoluteBase = toAbsoluteUrl(baseUrl);
  const base = absoluteBase.substring(0, absoluteBase.lastIndexOf('/') + 1);
  return new URL(relativePath, base).href;
}

export class ScenarioLoader {
  static async load(indexUrl: string): Promise<LoadedScenario> {
    const absoluteIndexUrl = toAbsoluteUrl(indexUrl);
    const index = await fetchJson<ScenarioIndex>(absoluteIndexUrl);

    const [incidents, manual, procedures, colonists, sectors] = await Promise.all([
      fetchJson<Incident[]>(resolveModuleUrl(absoluteIndexUrl, index.modules.incidents)),
      fetchJson<ManualModule>(resolveModuleUrl(absoluteIndexUrl, index.modules.manual)),
      fetchJson<Procedure[]>(resolveModuleUrl(absoluteIndexUrl, index.modules.procedures)),
      fetchJson<ColonistRecord[]>(resolveModuleUrl(absoluteIndexUrl, index.modules.colonists)),
      fetchJson<SectorDefinition[]>(resolveModuleUrl(absoluteIndexUrl, index.modules.sectors)),
    ]);

    const incidentMap = new Map(incidents.map((i) => [i.id, i]));
    const procedureMap = new Map(procedures.map((p) => [p.id, p]));

    const scenario: LoadedScenario = {
      index,
      incidents,
      incidentMap,
      manual,
      procedures,
      procedureMap,
      colonists,
      sectors,
    };

    validateScenario(scenario);
    return scenario;
  }
}

function validateScenario(scenario: LoadedScenario): void {
  const { index, incidents, incidentMap } = scenario;
  const errors: string[] = [];

  if (!incidentMap.has(index.startIncident)) {
    errors.push(`startIncident "${index.startIncident}" not found`);
  }

  for (const inc of incidents) {
    if (inc.nextIncident && !incidentMap.has(inc.nextIncident)) {
      errors.push(`Incident "${inc.id}" -> unknown next "${inc.nextIncident}"`);
    }
    if (inc.skipIfFail && !incidentMap.has(inc.skipIfFail)) {
      errors.push(`Incident "${inc.id}" skipIfFail invalid`);
    }
    if (inc.resolution && !scenario.procedureMap.has(inc.resolution.procedure)) {
      errors.push(`Incident "${inc.id}" unknown procedure "${inc.resolution.procedure}"`);
    }
  }

  if (errors.length) throw new Error(`Scenario validation failed:\n${errors.join('\n')}`);
}
