import { huHU } from '@clerk/localizations';
import { ClerkProvider } from '@clerk/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is not set');
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={publishableKey}
      localization={huHU}
      signInUrl="/admin/login"
      afterSignOutUrl="/admin/login"
    >
      <App />
    </ClerkProvider>
  </StrictMode>,
);
