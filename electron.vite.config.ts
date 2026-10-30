import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

const shared = { '~shared': resolve('src/shared') };
const renderer = (dir: string) => resolve('src/renderer/src', dir);

export default defineConfig({
  main: {
    resolve: { alias: { ...shared, '~engine': resolve('src/main/engine') } },
  },
  preload: {
    resolve: { alias: shared },
  },
  renderer: {
    resolve: {
      alias: {
        ...shared,
        '~components': renderer('components'),
        '~pages': renderer('pages'),
        '~hooks': renderer('hooks'),
        '~lib': renderer('lib'),
        '~styles': renderer('styles'),
        '~store': renderer('store'),
      },
    },
    plugins: [react()],
  },
});
