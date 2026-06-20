import type { Locale } from '../i18n/types.ts';
import type { GameStateSnapshot } from '../engine/types.ts';
import type { ControlTab } from '../ui/ControlPanel.ts';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'terra4-save';

export interface SaveData {
  version: typeof SAVE_VERSION;
  scenarioId: string;
  locale: Locale;
  savedAt: number;
  snapshot: GameStateSnapshot;
  ui?: {
    activeTab: ControlTab;
    selectedSectorId: string | null;
    selectedManualId: string | null;
  };
}

export class SaveManager {
  static hasSave(): boolean {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  static save(data: SaveData): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  static load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SaveData;
      if (parsed.version !== SAVE_VERSION) return null;
      if (!parsed.snapshot || !parsed.scenarioId) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  static clear(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  static savedAtLabel(locale: Locale): string | null {
    const data = SaveManager.load();
    if (!data) return null;
    const date = new Date(data.savedAt);
    return date.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US');
  }
}
