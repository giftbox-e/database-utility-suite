import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(), 
        tailwindcss(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['vite.svg'],
          manifest: {
            "short_name": "DB Utility",
            "name": "Database Utility Suite",
            "icons": [
              {
                "src": "vite.svg",
                "sizes": "512x512",
                "type": "image/svg+xml",
                "purpose": "any maskable"
              }
            ],
            "start_url": "/",
            "display": "standalone",
            "theme_color": "#111827",
            "background_color": "#111827"
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env': {},
        'global': {}
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
