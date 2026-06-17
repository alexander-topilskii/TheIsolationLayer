import { defineConfig } from 'vite';

// GitHub Pages: https://<user>.github.io/<repo>/
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
});
