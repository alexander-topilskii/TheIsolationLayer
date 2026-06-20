import type { GameEngine } from '../engine/GameEngine.ts';
import { ControlPanel } from './ControlPanel.ts';
import { SettingsDialog } from './SettingsDialog.ts';

export class DesktopUI {
  private engine: GameEngine;
  private root: HTMLElement;
  private feedEl: HTMLElement;
  private feedTitleEl: HTMLElement;
  private menuBar: HTMLElement;
  private controlPanel: ControlPanel;
  private settings: SettingsDialog;

  constructor(engine: GameEngine, root: HTMLElement) {
    this.engine = engine;
    this.root = root;
    this.feedEl = root.querySelector('.message-feed-body') as HTMLElement;
    this.feedTitleEl = root.querySelector('.feed-window-title') as HTMLElement;
    this.menuBar = root.querySelector('.menu-bar-metrics') as HTMLElement;
    this.controlPanel = new ControlPanel(
      root.querySelector('.control-panel') as HTMLElement,
      engine,
      () => this.render(),
    );
    this.settings = new SettingsDialog(
      root,
      engine.i18n,
      engine,
      this.controlPanel,
      () => this.render(),
      () => this.onNewGame(),
    );

    root.querySelector('.btn-settings')?.addEventListener('click', () => {
      this.settings.open();
    });

    engine.subscribe((event) => this.onEvent(event));
  }

  render(): void {
    this.renderStaticLabels();
    this.renderMenuBar();
    this.renderFeed();
    this.controlPanel.render();
  }

  private renderStaticLabels(): void {
    const t = this.engine.i18n.t.bind(this.engine.i18n);
    if (this.feedTitleEl) this.feedTitleEl.textContent = t('feedTitle');
    const settingsBtn = this.root.querySelector('.btn-settings') as HTMLButtonElement;
    if (settingsBtn) {
      settingsBtn.title = t('btnSettings');
      settingsBtn.setAttribute('aria-label', t('btnSettings'));
    }
  }

  private renderMenuBar(): void {
    const s = this.engine.state;
    const t = this.engine.i18n.t.bind(this.engine.i18n);
    this.menuBar.innerHTML = `
      <span class="menu-app">${t('appTitle')}</span>
      <span class="menu-metric">${t('shift')} ${String(s.shift).padStart(2, '0')}</span>
      <span class="menu-metric">${s.gameTime}</span>
      <span class="menu-metric">PWR ${s.energy}%</span>
      <span class="menu-metric">AI ${s.aiStability}%</span>
      <span class="menu-metric">COL ${this.engine.i18n.formatNumber(s.colonists)}</span>
    `;
  }

  private renderFeed(): void {
    if (this.engine.state.status !== 'playing') {
      const ending = this.engine.getDisplayEnding();
      if (ending.title) {
        this.feedEl.innerHTML = `
        <div class="feed-msg feed-critical">
          <span class="feed-time">${this.engine.state.gameTime}</span>
          <span class="feed-text"><strong>${escapeHtml(ending.title)}</strong><br>${escapeHtml(ending.text)}</span>
        </div>
      `;
        return;
      }
    }

    this.feedEl.innerHTML = this.engine.state.feed
      .map(
        (m) => `
      <div class="feed-msg feed-${m.severity}">
        <span class="feed-time">${m.time}</span>
        <span class="feed-text">${escapeHtml(m.text)}</span>
      </div>`,
      )
      .join('');
    this.feedEl.scrollTop = this.feedEl.scrollHeight;
  }

  private onEvent(event: import('../engine/types.ts').EngineEvent): void {
    if (event.type === 'incidentPresented') {
      this.controlPanel.onIncidentPresented(event.payload?.incident ?? null);
    }
    if (
      [
        'stateChanged',
        'feedAppended',
        'incidentPresented',
        'incidentResolved',
        'shiftChanged',
        'gameEnded',
        'diagnosticComplete',
        'manualRead',
        'procedureAttempted',
        'effectTriggered',
      ].includes(event.type)
    ) {
      this.render();
    }
    if (event.type === 'effectTriggered') {
      this.root.classList.add('flash');
      setTimeout(() => this.root.classList.remove('flash'), 800);
    }
  }

  private onNewGame(): void {
    window.location.reload();
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
