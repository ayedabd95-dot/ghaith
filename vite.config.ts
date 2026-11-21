import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from GitHub Pages at /ghaith/
export default defineConfig({
  base: process.env.BASE_PATH ?? '/ghaith/',
  plugins: [react()],
});
