export async function typewriter(
  text: string,
  onChar: (partial: string) => void,
  msPerChar: number,
  signal?: AbortSignal,
): Promise<void> {
  let partial = '';
  for (const char of text) {
    if (signal?.aborted) break;
    partial += char;
    onChar(partial);
    await sleep(msPerChar, signal);
  }
}

export async function typewriterInto(
  element: HTMLElement,
  text: string,
  msPerChar: number,
  signal?: AbortSignal,
): Promise<void> {
  await typewriter(
    text,
    (partial) => {
      element.textContent = partial;
    },
    msPerChar,
    signal,
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

export interface AudioManager {
  playKeypress(): void;
  playAlarm(): void;
  setAmbientIntensity(intensity: number): void;
}

export class StubAudioManager implements AudioManager {
  playKeypress(): void {}
  playAlarm(): void {}
  setAmbientIntensity(_intensity: number): void {}
}
