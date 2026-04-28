import { IonApp, IonRouterOutlet } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Suspense } from 'react';

import { ToastProvider } from './components/ui/Toast';
import { AppRoutes } from './routes';

/**
 * App root.
 *
 *   • IonApp + IonReactRouter for native-feel transitions.
 *   • <ToastProvider> wraps the router so any page can call useToast().
 *   • <Suspense> covers lazy-loaded routes with a minimal placeholder.
 */
export function App(): JSX.Element {
  return (
    <IonApp>
      <ToastProvider>
        <IonReactRouter>
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
      </ToastProvider>
    </IonApp>
  );
}
