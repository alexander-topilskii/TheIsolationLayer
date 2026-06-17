import { ScenarioLoader } from './engine/ScenarioLoader.ts';
import { GameEngine } from './engine/GameEngine.ts';
import { TerminalUI } from './ui/TerminalUI.ts';

async function bootstrap(): Promise<void> {
  const terminal = document.getElementById('terminal');
  if (!terminal) {
    throw new Error('Terminal root element not found');
  }

  const scenario = await ScenarioLoader.load(`${import.meta.env.BASE_URL}scenarios/terra4/index.json`);
  const engine = new GameEngine(scenario);
  const ui = new TerminalUI(engine, terminal);

  ui.render();
  engine.start();
}

bootstrap().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#ff4444;padding:20px;font-family:monospace">BOOT FAILED:\n${err}</pre>`;
});
