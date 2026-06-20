import { ScenarioLoader } from './engine/ScenarioLoader.ts';
import { GameEngine } from './engine/GameEngine.ts';
import { DesktopUI } from './ui/DesktopUI.ts';
import { createI18n } from './i18n/I18n.ts';

async function bootstrap(): Promise<void> {
  const desktop = document.getElementById('desktop');
  if (!desktop) throw new Error('#desktop not found');

  const i18n = createI18n();
  const scenario = await ScenarioLoader.load(`${import.meta.env.BASE_URL}scenarios/terra4/index.json`);
  const engine = new GameEngine(scenario, i18n);
  const ui = new DesktopUI(engine, desktop);

  ui.render();
  engine.start();
}

bootstrap().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="padding:20px;font-family:monospace">BOOT FAILED:\n${err}</pre>`;
});
