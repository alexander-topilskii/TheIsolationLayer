import type {
  CliModule,
  ColonistRecord,
  LoadedScenario,
  ProtocolsModule,
  ScenarioIndex,
  SectorDefinition,
  Ticket,
} from './types.ts';
import { validateScenario } from './validators.ts';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
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

    const ticketsUrl = resolveModuleUrl(absoluteIndexUrl, index.modules.tickets);
    const protocolsUrl = resolveModuleUrl(absoluteIndexUrl, index.modules.protocols);
    const colonistsUrl = resolveModuleUrl(absoluteIndexUrl, index.modules.colonists);
    const sectorsUrl = resolveModuleUrl(absoluteIndexUrl, index.modules.sectors);
    const cliUrl = resolveModuleUrl(absoluteIndexUrl, index.modules.cli);

    const [tickets, protocols, colonists, sectors, cli] = await Promise.all([
      fetchJson<Ticket[]>(ticketsUrl),
      fetchJson<ProtocolsModule>(protocolsUrl),
      fetchJson<ColonistRecord[]>(colonistsUrl),
      fetchJson<SectorDefinition[]>(sectorsUrl),
      fetchJson<CliModule>(cliUrl),
    ]);

    const ticketMap = new Map<string, Ticket>();
    for (const ticket of tickets) {
      ticketMap.set(ticket.id, ticket);
    }

    const scenario: LoadedScenario = {
      index,
      tickets,
      protocols,
      colonists,
      sectors,
      cli,
      ticketMap,
    };

    validateScenario(scenario);
    return scenario;
  }
}
