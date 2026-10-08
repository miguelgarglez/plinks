import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { OgCard } from './og';
import { ExploreA, ExploreB, ExploreC } from './explore/Explore';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import './app.css';

const path = window.location.pathname;

function Root() {
  if (path === '/og') return <OgCard />;
  if (path.startsWith('/explore/b')) return <ExploreB />;
  if (path.startsWith('/explore/c')) return <ExploreC />;
  if (path.startsWith('/explore/a')) return <ExploreA />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
