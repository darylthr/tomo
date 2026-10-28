import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { prefetchPages } from './app/router';
import { loadServerConfig } from './features/server/config';
import './shared/theme/tokens.css';

// Read /tomo.config.json first (first launch only), so the shelf loads from the right address.
void loadServerConfig().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
).then(() => {
  // After the shelf has painted, fetch the other pages while the phone is idle.
  const idle = window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 1500));
  idle(prefetchPages);
});

// Production only: the dev server's modules aren't hashed, so caching them would show stale code.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
