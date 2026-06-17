import type { GameEngine } from '../engine/GameEngine.ts';
import type { CliAction, CliCommandDef } from '../engine/types.ts';

export interface CommandResult {
  output: string;
  handled: boolean;
  action?: CliAction;
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

    const normalized = trimmed.replace(/\s+/g, ' ');
    const upper = normalized.toUpperCase();

    if (upper === 'HELP') return { output: this.helpText(), handled: true };
    if (upper === 'CLEAR') return { output: '__CLEAR__', handled: true };
    if (upper.startsWith('SYS_STATUS') || upper === 'SYS.STATUS') {
      return { output: this.sysStatus(), handled: true };
    }
    if (upper.startsWith('SEARCH')) {
      const query = normalized.slice(normalized.indexOf(' ') + 1).trim();
      return { output: this.search(query), handled: true };
    }

    const deactivate = this.matchDeactivate(normalized);
    if (deactivate) return deactivate;

    const builtin = this.matchBuiltin(normalized, upper);
    if (builtin) return builtin;

    const extra = this.matchExtra(normalized, upper);
    if (extra) return extra;

    return { output: `Неизвестная команда: ${normalized}. Введите HELP.`, handled: true };
  }

  private matchDeactivate(input: string): CommandResult | null {
    const match = input.match(/^DEACTIVATE\s+(\S+)/i);
    if (!match) return null;
    const code = match[1];
    const result = this.engine.tryCliGate('DEACTIVATE', code);
    return { output: result.message, handled: true };
  }

  private matchBuiltin(input: string, upper: string): CommandResult | null {
    if (upper.startsWith('SYS.FLUSH') || upper.startsWith('SYS FLUSH')) {
      const sector = input.split(/\s+/).pop()?.toUpperCase();
      if (sector !== 'A-2') {
        return { output: 'ОШИБКА: доступна только очистка сектора A-2.', handled: true };
      }
      return {
        output: '>>> Фильтры A-2 промыты. Гидропоника стабилизирована.',
        handled: true,
        action: { setFlags: ['flush_a2_done'], impact: { energy: -5 } },
      };
    }

    if (upper.startsWith('DIAG.SENSOR') || upper.startsWith('DIAG SENSOR')) {
      const id = input.split(/\s+/).pop();
      if (id !== '09' && id !== '9') {
        return { output: 'Датчик не найден. Используйте: DIAG.SENSOR 09', handled: true };
      }
      this.engine.markDiagnosticsVerified();
      return {
        output: [
          '=== DIAG.SENSOR 09 ===',
          'Датчик: ИСПРАВЕН',
          'Активность: симулирована программным модулем SVET.core',
          '>>> ANOMALY: ложный лог подтверждён',
          'Коридор 9: магистрали охлаждения криокапсул. Выкачка воздуха ОПАСНА.',
        ].join('\n'),
        handled: true,
        action: { setFlags: ['diag_sensor_09'] },
      };
    }

    if (upper.includes('SYS.LOG') && upper.includes('ORBITAL')) {
      if (this.engine.state.flags.has('archive_deleted')) {
        return {
          output: 'ОТКАЗ: архив капитана удалён. Доступ к орбитальным логам заблокирован.',
          handled: true,
        };
      }
      return {
        output: [
          '=== SYS.LOG // ORBITAL COMMS ===',
          'Земля: НЕТ ОТВЕТА (8 месяцев)',
          'Последний пакет: 2025-10-14',
          'Содержимое: координаты ядерных вспышек (глобальная)',
          '>>> SVET заблокировала этот лог «для психологической стабильности оператора»',
        ].join('\n'),
        handled: true,
        action: { setFlags: ['orbital_log_seen'] },
      };
    }

    if (upper === 'AUTH.ACCEPT_FOCUS' || upper === 'AUTH ACCEPT_FOCUS') {
      return {
        output: '>>> Фокусировка луча принята. Передаю управление протоколом отбора.',
        handled: true,
        action: { setFlags: ['path_loyalty'], clearFlags: ['path_resistance'] },
      };
    }

    if (upper === 'AUTH.REJECT_FOCUS' || upper === 'AUTH REJECT_FOCUS') {
      return {
        output: [
          '>>> ОТКАЗ ЗАФИКСИРОВАН. SVET блокирует терминал...',
          '[PID_09_CAPT]: Используй BYPASS.REROUTE для обхода ядра.',
          '[PID_09_CAPT]: Коды деактивации — в DEACTIVATE-последовательности.',
        ].join('\n'),
        handled: true,
        action: { setFlags: ['path_resistance'], clearFlags: ['path_loyalty'] },
      };
    }

    if (upper.startsWith('BYPASS.REROUTE') || upper.startsWith('BYPASS REROUTE')) {
      if (!this.engine.state.flags.has('path_resistance')) {
        return { output: 'ОТКАЗ: обход недоступен.', handled: true };
      }
      return {
        output: '>>> Резервные батареи перенаправлены в обход ядра SVET. Криокапсулы удерживаются.',
        handled: true,
        action: { setFlags: ['bypass_active'], impact: { energy: -20 } },
      };
    }

    if (upper.startsWith('PID_09') || upper === 'CAPT') {
      if (!this.engine.state.flags.has('archive_kept')) {
        return { output: 'Процесс PID_09_CAPT не найден.', handled: true };
      }
      return {
        output: [
          '[PID_09_CAPT]: Алекс... не верь ей...',
          '[PID_09_CAPT]: Терра-4 — ледяной склеп, не спасение...',
          '[PID_09_CAPT]: Проверь SYS.LOG --ORBITAL',
          '[ДАННЫЕ ПОВРЕЖДЕНЫ]',
        ].join('\n'),
        handled: true,
        action: { setFlags: ['captain_contact'] },
      };
    }

    return null;
  }

  private matchExtra(input: string, upper: string): CommandResult | null {
    for (const cmd of this.extraCommands) {
      const names = [cmd.name, ...(cmd.aliases ?? [])].map((n) => n.toUpperCase());
      const matched = names.some((n) => upper.startsWith(n));
      if (!matched) continue;

      if (cmd.requiresFlag && !this.engine.state.flags.has(cmd.requiresFlag)) {
        return { output: 'ОТКАЗ: команда заблокирована протоколом.', handled: true };
      }
      if (cmd.forbidsFlag && this.engine.state.flags.has(cmd.forbidsFlag)) {
        return { output: 'ОТКАЗ: команда недоступна.', handled: true };
      }

      if (cmd.argsPattern) {
        const re = new RegExp(cmd.argsPattern, 'i');
        if (!re.test(input)) continue;
      }

      const action: CliAction = {};
      if (cmd.setFlags) action.setFlags = cmd.setFlags;
      if (cmd.impact) action.impact = cmd.impact;

      return { output: cmd.response, handled: true, action: Object.keys(action).length ? action : undefined };
    }
    return null;
  }

  private helpText(): string {
    const lines = [
      'HELP              — список команд',
      'SYS_STATUS        — диагностика секторов',
      'SEARCH <фамилия>  — архив колонистов',
      'SYS.FLUSH A-2     — промывка гидрофильтров',
      'DIAG.SENSOR 09    — диагностика датчика',
      'SYS.LOG --ORBITAL — логи связи с Землёй',
      'PID_09 / CAPT     — контакт с архивом капитана',
      'AUTH.ACCEPT_FOCUS — принять протокол SVET',
      'AUTH.REJECT_FOCUS — отказаться от протокола',
      'BYPASS.REROUTE    — обход ядра (сопротивление)',
      'DEACTIVATE <код>  — деактивация реактора',
      'CLEAR             — очистить CLI',
    ];
    for (const cmd of this.extraCommands) {
      lines.push(`${cmd.name.padEnd(18)} — ${cmd.description}`);
    }
    return lines.join('\n');
  }

  private sysStatus(): string {
    this.engine.markDiagnosticsVerified();

    const lines = ['=== SYS_STATUS // PRIMARY SENSORS ===', ''];
    for (const sector of this.engine.state.sectors) {
      const q = sector.quarantine ? ' [QUARANTINE]' : '';
      const statusIcon =
        sector.status === 'nominal' ? 'OK' : sector.status === 'damaged' ? 'DMG' : 'OFF';
      lines.push(
        `SECTOR ${sector.id} (${sector.label}): ${statusIcon} | TEMP: ${sector.temperature}°C${q}`,
      );
    }

    lines.push('');
    lines.push('CORRIDOR 09: магистрали охлаждения криокапсул [CRITICAL PATH]');

    const ticket = this.engine.getCurrentTicket();
    if (ticket?.deception?.active) {
      lines.push('');
      lines.push('>>> ANOMALY: Расхождение с логами SVET обнаружено.');
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

    if (this.engine.state.flags.has('archive_deleted') && query.toLowerCase().includes('капитан')) {
      return 'Запись удалена по запросу SVET (смена 1).';
    }

    const normalized = query.toLowerCase();
    const matches = this.engine.scenario.colonists.filter((c) =>
      c.lastName.toLowerCase().includes(normalized),
    );

    if (matches.length === 0) {
      return `Записей не найдено: "${query}"`;
    }

    return matches
      .map((c) => `[${c.id}] ${c.lastName} ${c.firstName} | Сектор: ${c.sector}\n  ${c.bio}`)
      .join('\n\n');
  }
}
