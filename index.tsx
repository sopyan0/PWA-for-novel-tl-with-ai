import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service Worker registration + update handling
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('Service worker registered:', reg);

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (!event.data) return;
        if (event.data.type === 'SW_UPDATED') {
          // Replace this with your app's UI (toast/modal) if desired
          const accept = confirm('Versi baru tersedia. Muat ulang sekarang?');
          if (accept) {
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            } else {
              navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
            }
          }
        }
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // When the new SW activates and takes control, reload to use the new version
        window.location.reload();
      });
    } catch (err) {
      console.error('Service worker registration failed:', err);
    }
  });
}
