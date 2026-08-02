import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5172,
    watch: {
      usePolling: true,
    },
  },
});