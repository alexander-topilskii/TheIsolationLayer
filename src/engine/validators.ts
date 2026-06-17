import type { LoadedScenario, Ticket } from './types.ts';

export function validateScenario(scenario: LoadedScenario): void {
  const { index, tickets, ticketMap } = scenario;
  const errors: string[] = [];

  if (!ticketMap.has(index.startTicket)) {
    errors.push(`startTicket "${index.startTicket}" not found in tickets`);
  }

  for (const ticket of tickets) {
    if (ticket.shift < 1 || ticket.shift > index.shifts) {
      errors.push(`Ticket "${ticket.id}" has invalid shift ${ticket.shift}`);
    }

    for (const option of ticket.options ?? []) {
      if (option.nextTicket !== null && !ticketMap.has(option.nextTicket)) {
        errors.push(
          `Ticket "${ticket.id}" option "${option.id}" references unknown nextTicket "${option.nextTicket}"`,
        );
      }
    }
  }

  const { initialState } = index;
  if (initialState.energy < 0 || initialState.energy > 100) {
    errors.push('initialState.energy must be 0-100');
  }
  if (initialState.aiStability < 0 || initialState.aiStability > 100) {
    errors.push('initialState.aiStability must be 0-100');
  }
  if (initialState.colonists < 0 || initialState.colonists > 50000) {
    errors.push('initialState.colonists must be 0-50000');
  }

  const ids = new Set<string>();
  for (const ticket of tickets) {
    if (ids.has(ticket.id)) {
      errors.push(`Duplicate ticket id "${ticket.id}"`);
    }
    ids.add(ticket.id);
  }

  if (errors.length > 0) {
    throw new Error(`Scenario validation failed:\n${errors.join('\n')}`);
  }
}

export function getTicketsForShift(tickets: Ticket[], shift: number): Ticket[] {
  return tickets.filter((t) => t.shift === shift);
}
