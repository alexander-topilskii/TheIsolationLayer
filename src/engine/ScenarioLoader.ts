import type {
  ColonistRecord,
  Incident,
  LoadedScenario,
  ManualModule,
  Procedure,
  ScenarioIndex,
  SectorDefinition,
  ShipMapModule,
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

    const shipMapUrl = index.modules.shipMap
      ? resolveModuleUrl(absoluteIndexUrl, index.modules.shipMap)
      : null;

    const [incidents, manual, procedures, colonists, sectors, shipMap] = await Promise.all([
      fetchJson<Incident[]>(resolveModuleUrl(absoluteIndexUrl, index.modules.incidents)),
      fetchJson<ManualModule>(resolveModuleUrl(absoluteIndexUrl, index.modules.manual)),
      fetchJson<Procedure[]>(resolveModuleUrl(absoluteIndexUrl, index.modules.procedures)),
      fetchJson<ColonistRecord[]>(resolveModuleUrl(absoluteIndexUrl, index.modules.colonists)),
      fetchJson<SectorDefinition[]>(resolveModuleUrl(absoluteIndexUrl, index.modules.sectors)),
      shipMapUrl ? fetchJson<ShipMapModule>(shipMapUrl) : Promise.resolve(null),
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
      shipMap,
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

  if (scenario.shipMap) {
    validateShipMap(scenario, errors);
  }

  if (errors.length) throw new Error(`Scenario validation failed:\n${errors.join('\n')}`);
}

function validateShipMap(scenario: LoadedScenario, errors: string[]): void {
  const shipMap = scenario.shipMap!;
  const sectorIds = new Set(scenario.sectors.map((s) => s.id));
  const mappedSectors = new Set<string>();

  for (const deck of shipMap.decks) {
    for (const region of deck.regions) {
      if (!sectorIds.has(region.sectorId)) {
        errors.push(
          `ship-map deck "${deck.id}": unknown sectorId "${region.sectorId}"`,
        );
      }
      mappedSectors.add(region.sectorId);

      const line = deck.lines[region.r];
      if (!line) {
        errors.push(`ship-map deck "${deck.id}": region row ${region.r} out of bounds`);
        continue;
      }
      if (region.c + region.w > line.length) {
        errors.push(
          `ship-map deck "${deck.id}": region "${region.sectorId}" exceeds line width`,
        );
      }
    }
  }

  for (const sector of scenario.sectors) {
    if (!mappedSectors.has(sector.id)) {
      errors.push(`ship-map: sector "${sector.id}" not placed on map`);
    }
  }
}
