import type { GameEngine } from '../engine/GameEngine.ts';
import { EffectController } from '../engine/EffectController.ts';
import { CommandParser } from '../cli/CommandParser.ts';
import type { EngineEvent } from '../engine/types.ts';
import { HeaderZone, MainZone, SidebarZone, FooterZone } from './zones/index.ts';

export class TerminalUI {
  private engine: GameEngine;
  private header: HeaderZone;
  private main: MainZone;
  private sidebar: SidebarZone;
  private footer: FooterZone;
  private effects: EffectController;
  private parser: CommandParser;

  constructor(engine: GameEngine, root: HTMLElement) {
    this.engine = engine;
    this.header = new HeaderZone(root.querySelector('.zone-header') as HTMLElement);
    this.main = new MainZone(root.querySelector('.zone-main') as HTMLElement);
    this.sidebar = new SidebarZone(root.querySelector('.zone-sidebar') as HTMLElement);
    this.footer = new FooterZone(root.querySelector('.zone-footer') as HTMLElement);
    this.effects = new EffectController(engine);
    this.parser = new CommandParser(engine, engine.scenario.cli.commands);

    this.main.setEffectController(this.effects);
    this.sidebar.setOnDiagnosticsView(() => this.engine.markDiagnosticsVerified());
    this.footer.setOnOption((id) => this.engine.selectOption(id));
    this.footer.setOnCommand((input) => this.handleCommand(input));

    this.bindHotkeys();
    this.effects.attach();
    this.engine.subscribe((event) => this.onEngineEvent(event));
  }

  render(): void {
    this.header.render(this.engine);
    this.main.render(this.engine);
    this.sidebar.render(this.engine, this.effects);
    this.footer.render(this.engine);
  }

  private onEngineEvent(event: EngineEvent): void {
    switch (event.type) {
      case 'logAppended':
        if (event.payload?.logEntry) {
          void this.main.appendLogEntry(event.payload.logEntry, this.engine.state.aiStability);
        }
        break;
      case 'effectTriggered':
        if (event.payload?.effect === 'ai_cli_override') {
          const ticket = this.engine.getCurrentTicket();
          const text =
            ticket?.id === 'shift4-manifest'
              ? 'auth.accept_focus --operator Aleksandr --confirm'
              : 'sys.override --force vent B-1 --confirm';
          void this.footer.runAiOverride(text).then(() => {
            this.effects.clearActiveEffect('ai_cli_override');
          });
        }
        break;
      case 'stateChanged':
      case 'ticketPresented':
      case 'ticketResolved':
      case 'shiftChanged':
      case 'gameEnded':
        this.render();
        break;
    }
  }

  private handleCommand(input: string): void {
    if (!input.trim()) return;
    this.footer.appendCliOutput(`> ${input}`);
    const result = this.parser.parse(input);
    if (result.output) {
      this.footer.appendCliOutput(result.output);
    }
    if (result.action) {
      this.engine.applyCliAction(result.action);
    }
    this.render();
  }

  private bindHotkeys(): void {
    document.addEventListener('keydown', (e) => {
      if (this.engine.state.status !== 'playing') return;

      if (e.key === 'F1') {
        e.preventDefault();
        this.sidebar.setTab('protocols');
        this.render();
      }
      if (e.key === 'F2') {
        e.preventDefault();
        this.sidebar.setTab('diagnostics');
        this.engine.markDiagnosticsVerified();
        this.render();
      }
      if (e.key === 'F3') {
        e.preventDefault();
        this.sidebar.setTab('manifest');
        this.render();
      }
      if (e.key === '`' || e.key === '~') {
        e.preventDefault();
        this.footer.toggleMode();
      }

      const ticket = this.engine.getCurrentTicket();
      const options = ticket?.options ?? [];
      if (this.footer && options.length > 0) {
        const idx = ['1', '2', '3'].indexOf(e.key);
        if (idx >= 0 && options[idx]) {
          e.preventDefault();
          this.engine.selectOption(options[idx].id);
        }
      }
    });
  }
}
