const CORRUPT_CHARS = '@#%&!?*~$^';

export function corruptText(text: string, intensity: number): string {
  if (intensity <= 0) return text;

  return text
    .split('')
    .map((char) => {
      if (char === ' ' || char === '\n') return char;
      if (Math.random() < intensity) {
        return CORRUPT_CHARS[Math.floor(Math.random() * CORRUPT_CHARS.length)];
      }
      return char;
    })
    .join('');
}

export function formatLogLine(
  timestamp: string,
  level: string,
  system: string,
  message: string,
): string {
  return `[${timestamp}] [${level}] [${system}] ${message}`;
}
