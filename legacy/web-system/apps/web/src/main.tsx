import { setupIonicReact } from '@ionic/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Ionic CSS (order matters)
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

import { App } from './App';
import { queryClient } from './lib/queryClient';
import './styles/globals.css';

setupIonicReact({
  mode: 'md',
  rippleEffect: true,
  animated: true,
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

// Hide the splash screen on the next animation frame after React mounted —
// gives the LoginPage motion variants a single frame to attach so the
// transition feels continuous.
requestAnimationFrame(() => {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.dataset.hidden = 'true';
    setTimeout(() => splash.remove(), 320);
  }
});
