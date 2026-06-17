import type { GameEngine } from '../../engine/GameEngine.ts';
import type { LogEntry } from '../../engine/types.ts';
import { corruptText, formatLogLine } from '../effects/textCorruption.ts';
import type { EffectController } from '../../engine/EffectController.ts';

export class HeaderZone {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  render(engine: GameEngine): void {
    const s = engine.state;
    this.root.innerHTML = `
      <div class="header-row">
        <span class="header-item">SHIFT: ${String(s.shift).padStart(2, '0')} // TIME: ${s.gameTime}</span>
        <span class="header-item">STASIS_CNT: ${s.colonists.toLocaleString('ru-RU')} / 50,000</span>
      </div>
      <div class="header-row metrics">
        <span class="metric ${s.energy < 20 ? 'metric-critical' : ''}">PWR ${bar(s.energy)} ${s.energy}%</span>
        <span class="metric ${s.aiStability < 30 ? 'metric-critical metric-blink' : s.aiStability < 50 ? 'metric-warn' : ''}">AI.STB ${bar(s.aiStability)} ${s.aiStability}%</span>
      </div>
    `;
  }
}

function bar(value: number): string {
  const filled = Math.round(value / 10);
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}]`;
}

export class MainZone {
  private logEl: HTMLElement;
  private ticketEl: HTMLElement;
  private effectController: EffectController | null = null;
  private renderedLogCount = 0;

  constructor(root: HTMLElement) {
    this.logEl = root.querySelector('.main-log') as HTMLElement;
    this.ticketEl = root.querySelector('.main-ticket') as HTMLElement;
  }

  setEffectController(controller: EffectController): void {
    this.effectController = controller;
  }

  async appendLogEntry(entry: LogEntry, aiStability: number): Promise<void> {
    const line = document.createElement('div');
    line.className = `log-line log-${entry.level.toLowerCase()}`;
    const full = formatLogLine(entry.timestamp, entry.level, entry.system, entry.message);
    const intensity = this.effectController?.getCorruptionIntensity() ?? 0;
    const msPerChar = aiStability >= 70 ? 25 : aiStability >= 40 ? 40 : 60;

    this.logEl.appendChild(line);
    await this.typeLine(line, full, msPerChar, intensity);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  render(engine: GameEngine): void {
    const intensity = this.effectController?.getCorruptionIntensity() ?? 0;

    if (this.renderedLogCount === 0) {
      this.logEl.innerHTML = '';
      for (const entry of engine.state.log) {
        const line = document.createElement('div');
        line.className = `log-line log-${entry.level.toLowerCase()} faded`;
        line.textContent = corruptText(
          formatLogLine(entry.timestamp, entry.level, entry.system, entry.message),
          intensity * 0.5,
        );
        this.logEl.appendChild(line);
      }
      this.renderedLogCount = engine.state.log.length;
      this.logEl.scrollTop = this.logEl.scrollHeight;
    }

    const ticket = engine.getCurrentTicket();
    if (engine.state.status !== 'playing' || !ticket) {
      this.ticketEl.className = 'main-ticket';
      this.ticketEl.innerHTML = this.renderEnding(engine);
      return;
    }

    const isCritical = ticket.severity === 'critical';
    this.ticketEl.className = `main-ticket${isCritical ? ' main-ticket-critical' : ''}`;
    this.ticketEl.innerHTML = isCritical
      ? `<div class="critical-banner">[ CRITICAL ACTION REQUIRED ]</div>
         <div class="ticket-body">${corruptText(ticket.log, intensity)}</div>`
      : `<div class="ticket-body">${corruptText(ticket.log, intensity)}</div>`;
  }

  markLogSynced(): void {
    this.renderedLogCount = -1;
  }

  private renderEnding(engine: GameEngine): string {
    if (!engine.state.endingTitle) return '';
    return `
      <div class="ending-screen">
        <div class="ending-title">// ${engine.state.endingTitle} //</div>
        <div class="ending-text">${engine.state.endingText ?? ''}</div>
      </div>
    `;
  }

  private async typeLine(
    el: HTMLElement,
    text: string,
    msPerChar: number,
    intensity: number,
  ): Promise<void> {
    let partial = '';
    for (const char of text) {
      partial += char;
      el.textContent = corruptText(partial, intensity);
      await new Promise((r) => setTimeout(r, msPerChar));
    }
    el.classList.add('faded');
  }
}

export type SidebarTab = 'protocols' | 'diagnostics' | 'manifest';

export class SidebarZone {
  private root: HTMLElement;
  private contentEl: HTMLElement;
  private activeTab: SidebarTab = 'protocols';
  private onDiagnosticsView: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.contentEl = root.querySelector('.sidebar-content') as HTMLElement;
    this.root.querySelectorAll('.sidebar-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.setTab(tab.getAttribute('data-tab') as SidebarTab);
      });
    });
  }

  setOnDiagnosticsView(callback: () => void): void {
    this.onDiagnosticsView = callback;
  }

  setTab(tab: SidebarTab): void {
    this.activeTab = tab;
    this.root.querySelectorAll('.sidebar-tab').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-tab') === tab);
    });
    if (tab === 'diagnostics') {
      this.onDiagnosticsView?.();
    }
  }

  getActiveTab(): SidebarTab {
    return this.activeTab;
  }

  render(engine: GameEngine, effectController: EffectController | null): void {
    const intensity = effectController?.getCorruptionIntensity() ?? 0;

    switch (this.activeTab) {
      case 'protocols': {
        const rules = engine.getProtocolsForCurrentShift();
        this.contentEl.innerHTML =
          rules.length > 0
            ? rules.map((r, i) => `<div class="protocol-line">${i + 1}. ${corruptText(r, intensity)}</div>`).join('')
            : '<div class="protocol-line dim">Протоколы недоступны.</div>';
        break;
      }
      case 'diagnostics':
        this.contentEl.innerHTML = this.renderDiagnostics(engine.state.sectors, intensity);
        break;
      case 'manifest':
        this.contentEl.innerHTML = `
          <div class="manifest-hint">Введите фамилию в CLI: SEARCH &lt;фамилия&gt;</div>
          <div class="manifest-hint dim">Или переключитесь в режим CLI (клавиша \`)</div>
        `;
        break;
    }
  }

  private renderDiagnostics(
    sectors: { id: string; label: string; status: string; temperature: number; quarantine: boolean }[],
    intensity: number,
  ): string {
    const rows = sectors.map((s) => {
      const icon = s.status !== 'nominal' ? '[X]' : '[ ]';
      const q = s.quarantine ? ' Q' : '';
      return `${icon} ${s.label.padEnd(4)} ${s.temperature}°C${q}`;
    });

    const grid = [];
    for (let i = 0; i < rows.length; i += 2) {
      grid.push(`${rows[i] ?? ''}  ${rows[i + 1] ?? ''}`);
    }

    return `<pre class="sector-grid">${corruptText(grid.join('\n'), intensity)}</pre>`;
  }
}

export class FooterZone {
  private root: HTMLElement;
  private buttonsEl: HTMLElement;
  private cliPanel: HTMLElement;
  private cliOutput: HTMLElement;
  private cliInput: HTMLInputElement;
  private mode: 'buttons' | 'cli' = 'buttons';
  private onOption: ((id: string) => void) | null = null;
  private onCommand: ((input: string) => void) | null = null;
  private aiTypingAbort: AbortController | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.buttonsEl = root.querySelector('.footer-buttons') as HTMLElement;
    this.cliPanel = root.querySelector('.footer-cli') as HTMLElement;
    this.cliOutput = root.querySelector('.cli-output') as HTMLElement;
    this.cliInput = root.querySelector('.cli-input') as HTMLInputElement;

    root.querySelector('.mode-toggle')?.addEventListener('click', () => this.toggleMode());

    this.cliInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const value = this.cliInput.value;
        this.cliInput.value = '';
        this.onCommand?.(value);
      }
      if (e.key === 'Escape') {
        this.cancelAiTyping();
      }
    });
  }

  setOnOption(callback: (id: string) => void): void {
    this.onOption = callback;
  }

  setOnCommand(callback: (input: string) => void): void {
    this.onCommand = callback;
  }

  toggleMode(): void {
    this.mode = this.mode === 'buttons' ? 'cli' : 'buttons';
    this.updateModeVisibility();
    if (this.mode === 'cli') {
      this.cliInput.focus();
    }
  }

  setMode(mode: 'buttons' | 'cli'): void {
    this.mode = mode;
    this.updateModeVisibility();
  }

  appendCliOutput(text: string): void {
    if (text === '__CLEAR__') {
      this.cliOutput.textContent = '';
      return;
    }
    const block = document.createElement('div');
    block.className = 'cli-line';
    block.textContent = text;
    this.cliOutput.appendChild(block);
    this.cliOutput.scrollTop = this.cliOutput.scrollHeight;
  }

  async runAiOverride(text: string): Promise<void> {
    this.setMode('cli');
    this.cancelAiTyping();
    this.aiTypingAbort = new AbortController();
    const signal = this.aiTypingAbort.signal;

    this.cliInput.value = '';
    this.cliInput.placeholder = '>>> SVET ПЕРЕХВАТИЛА ВВОД...';

    try {
      let partial = '';
      for (const char of text) {
        if (signal.aborted) break;
        partial += char;
        this.cliInput.value = partial;
        await new Promise((r) => setTimeout(r, 45));
      }
    } finally {
      this.cliInput.placeholder = 'OPERATOR@TERRA4_CORE> ';
    }
  }

  cancelAiTyping(): void {
    this.aiTypingAbort?.abort();
    this.aiTypingAbort = null;
  }

  render(engine: GameEngine): void {
    if (engine.state.status !== 'playing') {
      this.buttonsEl.innerHTML = '';
      return;
    }

    const ticket = engine.getCurrentTicket();
    const inputMode = ticket?.inputMode ?? 'both';

    if (inputMode === 'cli') {
      this.setMode('cli');
      this.root.querySelector('.mode-toggle')!.setAttribute('hidden', '');
    } else {
      this.root.querySelector('.mode-toggle')!.removeAttribute('hidden');
    }

    const options = (ticket?.options ?? []).filter(
      (o) => !o.requiresFlag || engine.state.flags.has(o.requiresFlag),
    );

    if (inputMode === 'cli' && options.length === 0) {
      this.buttonsEl.innerHTML =
        '<div class="cli-hint dim">Только CLI. Введите команду согласно протоколу.</div>';
    } else if (inputMode === 'cli') {
      this.buttonsEl.innerHTML = '';
    } else {
      this.buttonsEl.innerHTML = options
        .map(
          (o, i) =>
            `<button type="button" class="action-btn" data-option="${o.id}">[ ${i + 1}: ${o.text} ]</button>`,
        )
        .join('');

      this.buttonsEl.querySelectorAll('.action-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-option');
          if (id) this.onOption?.(id);
        });
      });
    }
  }

  private updateModeVisibility(): void {
    this.buttonsEl.hidden = this.mode !== 'buttons';
    this.cliPanel.hidden = this.mode !== 'cli';
    this.root.querySelector('.mode-toggle')!.textContent =
      this.mode === 'buttons' ? '[ ` ] CLI MODE' : '[ ` ] BUTTON MODE';
  }
}
