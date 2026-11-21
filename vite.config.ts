import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from GitHub Pages at /alrahma-charity/
export default defineConfig({
  base: process.env.BASE_PATH ?? '/alrahma-charity/',
  plugins: [react()],
});
