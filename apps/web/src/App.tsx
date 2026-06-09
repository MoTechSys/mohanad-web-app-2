import { IonApp, IonRouterOutlet } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Suspense, useEffect } from 'react';

import { ReloadPrompt } from './components/pwa/ReloadPrompt';
import { ToastProvider, useToast } from './components/ui/Toast';
import { setHttpToastSink } from './lib/http';
import { AppRoutes } from './routes';
import { useAuthStore } from './stores/authStore';

/**
 * App root — Phase 2 P2-5.
 *
 *   • IonApp + IonReactRouter for native-feel transitions.
 *   • <ToastProvider> wraps the router so any page can call useToast().
 *   • <Suspense> covers lazy-loaded routes with a minimal placeholder.
 *   • <AppBootstrap> wires the global axios → toast bridge (403/5xx) and
 *     kicks off the silent /auth/refresh probe on first paint.
 */

/**
 * Internal: bridges the axios-level toast sink (set by lib/http.ts) into
 * the live React toast provider, and triggers a one-shot auth bootstrap
 * on mount so a returning user lands authenticated.
 */
function AppBootstrap({ children }: { children: React.ReactNode }): JSX.Element {
  const toast = useToast();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const hasBootstrapped = useAuthStore((s) => s.hasBootstrapped);

  useEffect(() => {
    setHttpToastSink((variant, message) => {
      switch (variant) {
        case 'success':
          toast.success(message);
          return;
        case 'warning':
          toast.warning(message);
          return;
        case 'info':
          toast.info(message);
          return;
        default:
          toast.error(message);
      }
    });
    return () => setHttpToastSink(null);
  }, [toast]);

  // Kick off the silent /auth/refresh probe exactly once.
  useEffect(() => {
    if (!hasBootstrapped) void bootstrap();
  }, [hasBootstrapped, bootstrap]);

  return <>{children}</>;
}

export function App(): JSX.Element {
  return (
    <IonApp>
      <ToastProvider>
        <AppBootstrap>
          <IonReactRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <IonRouterOutlet>
              <Suspense
                fallback={
                  <div className="grid place-items-center min-h-screen">
                    <div className="h-9 w-9 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin" />
                  </div>
                }
              >
                <AppRoutes />
              </Suspense>
            </IonRouterOutlet>
          </IonReactRouter>
          <ReloadPrompt />
        </AppBootstrap>
      </ToastProvider>
    </IonApp>
  );
}
