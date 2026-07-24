import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/Header";
import { ChampionshipProvider } from "@/lib/championship";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-black text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">La ruta que buscás no existe.</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo salió mal</h1>
        <p className="mt-2 text-sm text-muted-foreground">No pudimos cargar esta página.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >Reintentar</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Inicio · Campeonato Integración Profesional Futsal" },
      { name: "description", content: "Resumen, próximos partidos y tabla de posiciones del Campeonato Integración Profesional Futsal." },
      { name: "author", content: "Campeonato Integración" },
      { name: "theme-color", content: "#0f172a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Integración Futsal" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "Inicio · Campeonato Integración Profesional Futsal" },
      { property: "og:description", content: "Resumen, próximos partidos y tabla de posiciones del Campeonato Integración Profesional Futsal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Inicio · Campeonato Integración Profesional Futsal" },
      { name: "twitter:description", content: "Resumen, próximos partidos y tabla de posiciones del Campeonato Integración Profesional Futsal." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/KvthSVHFjheKQPLcBxSvqHnNFRt1/social-images/social-1783093910908-Gemini_Generated_Image_q1ata4q1ata4q1at.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/KvthSVHFjheKQPLcBxSvqHnNFRt1/social-images/social-1783093910908-Gemini_Generated_Image_q1ata4q1ata4q1at.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-192.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icon-180.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ChampionshipProvider>
        <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <main className="flex-1"><Outlet /></main>
          <Toaster richColors position="top-right" />
        </div>
      </ChampionshipProvider>
    </QueryClientProvider>
  );
}
