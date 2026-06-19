import type { GameEngine } from '../engine/GameEngine.ts';
import { ControlPanel } from './ControlPanel.ts';

export class DesktopUI {
  private engine: GameEngine;
  private root: HTMLElement;
  private feedEl: HTMLElement;
  private menuBar: HTMLElement;
  private controlPanel: ControlPanel;

  constructor(engine: GameEngine, root: HTMLElement) {
    this.engine = engine;
    this.root = root;
    this.feedEl = root.querySelector('.message-feed-body') as HTMLElement;
    this.menuBar = root.querySelector('.menu-bar-metrics') as HTMLElement;
    this.controlPanel = new ControlPanel(
      root.querySelector('.control-panel') as HTMLElement,
      engine,
      () => this.render(),
    );

    engine.subscribe((event) => this.onEvent(event));
  }

  render(): void {
    this.renderMenuBar();
    this.renderFeed();
    this.controlPanel.render();
  }

  private renderMenuBar(): void {
    const s = this.engine.state;
    this.menuBar.innerHTML = `
      <span class="menu-app">TERRA-4 Operator</span>
      <span class="menu-metric">Смена ${String(s.shift).padStart(2, '0')}</span>
      <span class="menu-metric">${s.gameTime}</span>
      <span class="menu-metric">PWR ${s.energy}%</span>
      <span class="menu-metric">AI ${s.aiStability}%</span>
      <span class="menu-metric">COL ${s.colonists.toLocaleString('ru-RU')}</span>
    `;
  }

  private renderFeed(): void {
    if (this.engine.state.status !== 'playing' && this.engine.state.endingTitle) {
      this.feedEl.innerHTML = `
        <div class="feed-msg feed-critical">
          <span class="feed-time">${this.engine.state.gameTime}</span>
          <span class="feed-text"><strong>${this.engine.state.endingTitle}</strong><br>${this.engine.state.endingText ?? ''}</span>
        </div>
      `;
      return;
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

  private onEvent(event: { type: string }): void {
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
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
