import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { OgCard } from './og';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import './app.css';

const path = window.location.pathname;

function Root() {
  if (path === '/og') return <OgCard />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
