import { ScenarioLoader } from './engine/ScenarioLoader.ts';
import { GameEngine } from './engine/GameEngine.ts';
import { DesktopUI } from './ui/DesktopUI.ts';

async function bootstrap(): Promise<void> {
  const desktop = document.getElementById('desktop');
  if (!desktop) throw new Error('#desktop not found');

  const scenario = await ScenarioLoader.load(`${import.meta.env.BASE_URL}scenarios/terra4/index.json`);
  const engine = new GameEngine(scenario);
  const ui = new DesktopUI(engine, desktop);

  ui.render();
  engine.start();
}

bootstrap().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="padding:20px;font-family:monospace">BOOT FAILED:\n${err}</pre>`;
});
