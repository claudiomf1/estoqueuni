import path from 'node:path';
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config.js';

const resolveOutDir = (mode) => {
  if (mode === 'production') return path.resolve(__dirname, '../build/www');
  if (mode === 'staging') return path.resolve(__dirname, '../build/staging');
  return path.resolve(__dirname, '../build/dev');
};

export default defineConfig(({ mode }) => {
  const devPort = Number(process.env.ESTOQUEUNI_VITE_PORT || 5174);

  const envConfig = {
    base: '/',
    server: {
      port: devPort,
      strictPort: true,
    },
    preview: {
      port: devPort,
    },
    build: {
      outDir: resolveOutDir(mode),
      emptyOutDir: true,
      minify: mode === 'production' ? 'terser' : false,
    },
  };

  return mergeConfig(baseConfig, envConfig);
});







