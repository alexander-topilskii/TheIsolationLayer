import type { GameEngine } from './GameEngine.ts';
import type { TriggerEffect } from './types.ts';

export class EffectController {
  private engine: GameEngine;
  private activeEffects = new Set<TriggerEffect>();
  private unsubscribe: (() => void) | null = null;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  attach(): void {
    this.unsubscribe = this.engine.subscribe((event) => {
      if (event.type === 'effectTriggered' && event.payload?.effect) {
        const effect = event.payload.effect;
        if (effect === 'screen_flash') {
          this.flashScreen();
        } else {
          this.activeEffects.add(effect);
        }
        this.apply();
      }
      if (event.type === 'stateChanged' || event.type === 'shiftChanged') {
        this.apply();
      }
    });
    this.apply();
  }

  detach(): void {
    this.unsubscribe?.();
    this.clearClasses();
  }

  clearActiveEffect(effect: TriggerEffect): void {
    this.activeEffects.delete(effect);
    this.apply();
  }

  hasActiveEffect(effect: TriggerEffect): boolean {
    return this.activeEffects.has(effect);
  }

  getCorruptionIntensity(): number {
    const stability = this.engine.state.aiStability;
    if (stability >= 50) return 0;
    if (stability >= 30) return 0.08;
    return 0.15;
  }

  private flashScreen(): void {
    const root = document.documentElement;
    root.classList.add('effect-flash');
    setTimeout(() => root.classList.remove('effect-flash'), 1200);
  }

  private apply(): void {
    const root = document.documentElement;
    const { energy, aiStability } = this.engine.state;

    root.classList.toggle('effect-corruption', aiStability < 50);
    root.classList.toggle('effect-panic', aiStability < 30);
    root.classList.toggle('effect-blackout', energy < 20);
    root.classList.toggle('effect-ai-typing', this.activeEffects.has('ai_cli_override'));
    root.classList.toggle(
      'effect-loyalty',
      this.engine.state.flags.has('path_loyalty') && this.engine.state.shift >= 5,
    );
    root.classList.toggle(
      'effect-resistance',
      this.engine.state.flags.has('path_resistance') && this.engine.state.shift >= 5,
    );
  }

  private clearClasses(): void {
    const root = document.documentElement;
    root.classList.remove('effect-corruption', 'effect-panic', 'effect-blackout', 'effect-ai-typing');
  }
}
