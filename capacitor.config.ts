import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.integracion.futsal',
  appName: 'Integración Futsal',
  webDir: 'dist/client', // ← Volver a dist/client
  backgroundColor: '#0f172a',

  server: {
    // 👇 Descomenta esta línea y pon la URL real de tu app publicada
    // (Ejemplo: Supabase / Lovable / Vercel / Netlify / etc.)
    url: 'https://tu-app-desplegada.lovable.app', 
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