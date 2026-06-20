import type { I18n } from '../i18n/I18n.ts';
import type { GameEngine } from '../engine/GameEngine.ts';
import { SaveManager, SAVE_VERSION } from '../save/SaveManager.ts';
import type { ControlPanel } from './ControlPanel.ts';

export class SettingsDialog {
  private overlay: HTMLElement;
  private i18n: I18n;
  private engine: GameEngine;
  private controlPanel: ControlPanel;
  private onChange: () => void;
  private onNewGame: () => void;

  constructor(
    root: HTMLElement,
    i18n: I18n,
    engine: GameEngine,
    controlPanel: ControlPanel,
    onChange: () => void,
    onNewGame: () => void,
  ) {
    this.i18n = i18n;
    this.engine = engine;
    this.controlPanel = controlPanel;
    this.onChange = onChange;
    this.onNewGame = onNewGame;

    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-overlay';
    this.overlay.hidden = true;
    this.overlay.innerHTML = `
      <div class="settings-dialog mac-window" role="dialog" aria-labelledby="settings-title">
        <div class="window-titlebar settings-titlebar">
          <span id="settings-title" class="window-title"></span>
        </div>
        <div class="settings-body">
          <fieldset class="settings-field">
            <legend class="settings-legend"></legend>
            <label class="settings-option">
              <input type="radio" name="locale" value="ru" />
              <span data-label="ru"></span>
            </label>
            <label class="settings-option">
              <input type="radio" name="locale" value="en" />
              <span data-label="en"></span>
            </label>
          </fieldset>
          <p class="settings-save-info hint"></p>
          <div class="settings-actions">
            <button type="button" class="mac-btn btn-save"></button>
            <button type="button" class="mac-btn btn-load"></button>
            <button type="button" class="mac-btn btn-new-game"></button>
            <button type="button" class="mac-btn btn-close"></button>
          </div>
          <p class="settings-feedback hint"></p>
        </div>
      </div>
    `;
    root.appendChild(this.overlay);

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.overlay.querySelector('.btn-close')?.addEventListener('click', () => this.close());
    this.overlay.querySelector('.btn-save')?.addEventListener('click', () => this.save());
    this.overlay.querySelector('.btn-load')?.addEventListener('click', () => this.load());
    this.overlay.querySelector('.btn-new-game')?.addEventListener('click', () => this.newGame());

    this.overlay.querySelectorAll('input[name="locale"]').forEach((input) => {
      input.addEventListener('change', () => {
        const value = (input as HTMLInputElement).value;
        if (value === 'ru' || value === 'en') {
          this.i18n.setLocale(value);
          this.render();
          this.onChange();
        }
      });
    });
  }

  open(): void {
    this.render();
    this.overlay.hidden = false;
    this.setFeedback('');
  }

  close(): void {
    this.overlay.hidden = true;
  }

  private render(): void {
    const t = this.i18n.t.bind(this.i18n);
    this.overlay.querySelector('#settings-title')!.textContent = t('settingsTitle');
    this.overlay.querySelector('.settings-legend')!.textContent = t('settingsLanguage');
    this.overlay.querySelector('[data-label="ru"]')!.textContent = t('settingsLangRu');
    this.overlay.querySelector('[data-label="en"]')!.textContent = t('settingsLangEn');
    this.overlay.querySelector('.btn-save')!.textContent = t('settingsSave');
    this.overlay.querySelector('.btn-load')!.textContent = t('settingsLoad');
    this.overlay.querySelector('.btn-new-game')!.textContent = t('settingsNewGame');
    this.overlay.querySelector('.btn-close')!.textContent = t('settingsClose');

    const ruInput = this.overlay.querySelector('input[value="ru"]') as HTMLInputElement;
    const enInput = this.overlay.querySelector('input[value="en"]') as HTMLInputElement;
    ruInput.checked = this.i18n.locale === 'ru';
    enInput.checked = this.i18n.locale === 'en';

    const info = this.overlay.querySelector('.settings-save-info') as HTMLElement;
    const savedAt = SaveManager.savedAtLabel(this.i18n.locale);
    info.textContent = savedAt
      ? `${this.i18n.t('lastSave')}: ${savedAt}`
      : '';

    const loadBtn = this.overlay.querySelector('.btn-load') as HTMLButtonElement;
    loadBtn.disabled = !SaveManager.hasSave();
  }

  private setFeedback(text: string): void {
    const el = this.overlay.querySelector('.settings-feedback') as HTMLElement;
    el.textContent = text;
  }

  private save(): void {
    SaveManager.save({
      version: SAVE_VERSION,
      scenarioId: this.engine.scenario.index.id,
      locale: this.i18n.locale,
      savedAt: Date.now(),
      snapshot: this.engine.state.snapshot(),
      ui: this.controlPanel.getUiState(),
    });
    this.setFeedback(this.i18n.t('saveSuccess'));
    this.render();
  }

  private load(): void {
    const data = SaveManager.load();
    if (!data) {
      this.setFeedback(this.i18n.t('saveNone'));
      return;
    }
    this.i18n.setLocale(data.locale);
    this.engine.restore(data.snapshot);
    if (data.ui) this.controlPanel.applyUiState(data.ui);
    this.setFeedback(this.i18n.t('loadSuccess'));
    this.onChange();
    this.render();
  }

  private newGame(): void {
    if (!confirm(this.i18n.t('newGameConfirm'))) return;
    SaveManager.clear();
    this.close();
    this.onNewGame();
  }
}
