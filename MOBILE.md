# 📱 Empaquetado móvil (Android + iOS) con Capacitor

> **Importante:** TanStack Start es un framework SSR (renderiza el HTML en el
> servidor). El build produce `dist/client/` (assets) + `dist/server/` (worker
> nitro), pero **no** un `index.html` estático. Por eso `capacitor.config.ts`
> usa `webDir: "dist/client"` y `server.url` apuntando a la URL publicada,
> que es el patrón oficial para SSR + Capacitor. Antes de `cap sync`,
> publicá la app y reemplazá `server.url` en `capacitor.config.ts`.


La aplicación ya está preparada para funcionar como app nativa mediante
[Capacitor](https://capacitorjs.com/) sin cambios en el código web.

## Qué ya viene incluido

- **PWA instalable**: `public/manifest.webmanifest`, íconos 192/512/maskable/180
  y meta tags `theme-color`, `apple-mobile-web-app-*`, `viewport-fit=cover`.
- **Safe areas (notch / barra de gestos)**: variables `--sat/--sar/--sab/--sal`
  y utilidades `.safe-*` en `src/styles.css`.
- **Configuración Capacitor lista**: `capacitor.config.ts` con `appId`,
  `webDir=dist`, splash screen, status bar oscura y ajustes de teclado.
- **UX móvil**: layout responsive, tap targets ≥ 44px (shadcn), scroll natural,
  sin selección accidental de texto en headers.

## Pasos para generar la APK / IPA

Estos pasos se ejecutan **localmente**, no en Lovable, porque requieren
Android Studio y/o Xcode.

```bash
# 1. Instalar dependencias de Capacitor
bun add -d @capacitor/cli
bun add @capacitor/core @capacitor/android @capacitor/ios \
        @capacitor/app @capacitor/status-bar @capacitor/splash-screen \
        @capacitor/haptics @capacitor/keyboard @capacitor/network \
        @capacitor/preferences @capacitor/share

# 2. Build de producción de la web
bun run build

# 3. Agregar plataformas nativas (solo la primera vez)
bunx cap add android
bunx cap add ios      # solo en macOS

# 4. Sincronizar web + plugins en cada cambio
bunx cap sync

# 5. Abrir en el IDE nativo
bunx cap open android   # Android Studio → Build > Generate Signed APK/Bundle
bunx cap open ios       # Xcode → Product > Archive
```

## Buenas prácticas ya aplicadas

- No se usan APIs exclusivas del navegador que rompan en WebView.
- Auth de Lovable Cloud funciona igual en WebView; los redirects usan
  `window.location.origin`.
- `bundledWebRuntime: false` — Capacitor inyecta el runtime en tiempo de build.
- Splash screen y status bar con el color de marca `#0f172a`.
- `contentInset: 'always'` en iOS respeta la isla dinámica / notch.

## Recomendaciones al portar

- Usar `Capacitor.getPlatform()` para diferenciar `web | ios | android`.
- Reemplazar `window.open` por `@capacitor/browser` cuando quieras abrir links
  externos dentro de la app.
- Para almacenamiento sensible usar `@capacitor/preferences` en vez de
  `localStorage`.
- Íconos y splash finales: generarlos con
  `bunx @capacitor/assets generate` a partir de un PNG 1024×1024.
