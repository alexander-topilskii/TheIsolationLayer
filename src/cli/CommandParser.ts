import type { GameEngine } from '../engine/GameEngine.ts';
import type { CliCommandDef } from '../engine/types.ts';

export interface CommandResult {
  output: string;
  handled: boolean;
}

export class CommandParser {
  private engine: GameEngine;
  private extraCommands: CliCommandDef[];

  constructor(engine: GameEngine, extraCommands: CliCommandDef[] = []) {
    this.engine = engine;
    this.extraCommands = extraCommands;
  }

  parse(input: string): CommandResult {
    const trimmed = input.trim();
    if (!trimmed) {
      return { output: '', handled: false };
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toUpperCase();
    const args = parts.slice(1);

    switch (command) {
      case 'HELP':
        return { output: this.helpText(), handled: true };
      case 'SYS_STATUS':
        return { output: this.sysStatus(), handled: true };
      case 'SEARCH':
        return { output: this.search(args.join(' ')), handled: true };
      case 'CLEAR':
        return { output: '__CLEAR__', handled: true };
      default: {
        const extra = this.extraCommands.find((c) => c.name.toUpperCase() === command);
        if (extra) {
          return { output: extra.response, handled: true };
        }
        return { output: `Неизвестная команда: ${command}. Введите HELP.`, handled: true };
      }
    }
  }

  private helpText(): string {
    const builtin = [
      'HELP        — список команд',
      'SYS_STATUS  — диагностика секторов (первичные датчики)',
      'SEARCH <ф>  — поиск колониста по фамилии',
      'CLEAR       — очистить вывод CLI',
    ];
    const extra = this.extraCommands.map((c) => `${c.name.padEnd(12)} — ${c.description}`);
    return [...builtin, ...extra].join('\n');
  }

  private sysStatus(): string {
    this.engine.markDiagnosticsVerified();

    const lines = ['=== SYS_STATUS // PRIMARY SENSORS ===', ''];
    for (const sector of this.engine.state.sectors) {
      const q = sector.quarantine ? ' [QUARANTINE]' : '';
      const statusIcon = sector.status === 'nominal' ? 'OK' : sector.status === 'damaged' ? 'DMG' : 'OFF';
      lines.push(
        `SECTOR ${sector.id} (${sector.label}): ${statusIcon} | TEMP: ${sector.temperature}°C${q}`,
      );
    }

    const ticket = this.engine.getCurrentTicket();
    if (ticket?.deception?.active) {
      lines.push('');
      lines.push('>>> ANOMALY: Расхождение с логами МАТЬ обнаружено.');
      lines.push(
        `>>> TRUTH ${ticket.deception.truth.sector}: ${ticket.deception.truth.condition.toUpperCase()}`,
      );
      lines.push(
        `>>> CLAIM ${ticket.deception.claim.sector}: ${ticket.deception.claim.condition.toUpperCase()} (UNVERIFIED)`,
      );
    }

    return lines.join('\n');
  }

  private search(query: string): string {
    if (!query) {
      return 'Использование: SEARCH <фамилия>';
    }

    const normalized = query.toLowerCase();
    const matches = this.engine.scenario.colonists.filter((c) =>
      c.lastName.toLowerCase().includes(normalized),
    );

    if (matches.length === 0) {
      return `Записей не найдено: "${query}"`;
    }

    return matches
      .map(
        (c) =>
          `[${c.id}] ${c.lastName} ${c.firstName} | Сектор: ${c.sector}\n  ${c.bio}`,
      )
      .join('\n\n');
  }
}
