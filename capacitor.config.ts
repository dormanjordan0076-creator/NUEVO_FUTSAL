import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor — Campeonato Integración Profesional Futsal
 *
 * IMPORTANTE sobre el build:
 * TanStack Start hace SSR sobre Cloudflare Workers (nitro), por lo que
 * `bun run build` genera:
 *   - dist/client/  → assets estáticos (JS, CSS, íconos, manifest)  ← webDir
 *   - dist/server/  → worker SSR que genera el HTML en tiempo real
 *
 * No hay un `index.html` estático porque el HTML lo produce el servidor.
 * Para Capacitor esto significa que el WebView debe cargar la app desde la
 * URL publicada (patrón oficial para frameworks SSR + Capacitor), no desde
 * los archivos empaquetados. Los assets locales igual se sirven desde
 * `dist/client` para íconos, splash, manifest y fallback offline básico.
 *
 * → Antes de `bunx cap sync`, publicá la app en Lovable y reemplazá
 *   `server.url` de abajo por tu URL pública (…lovable.app o tu dominio).
 *
 * Comandos completos en MOBILE.md.
 */
const config: CapacitorConfig = {
  appId: 'app.integracion.futsal',
  appName: 'Integración Futsal',
  webDir: 'dist/client',
  bundledWebRuntime: false,
  backgroundColor: '#0f172a',

  server: {
    // 👇 Reemplazar por la URL publicada antes de `cap sync`.
    //    Ej: 'https://integracion-futsal.lovable.app'
    // url: 'https://<tu-app>.lovable.app',
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false,
    allowNavigation: [
      '*.lovable.app',
      '*.supabase.co',
    ],
  },

  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: '#0f172a',
    scrollEnabled: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    App: {
      launchUrl: '/',
    },
  },
};

export default config;
