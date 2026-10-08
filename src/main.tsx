import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ExploreA, ExploreB, ExploreC } from './explore/Explore';
import './app.css';

const path = window.location.pathname;

function Root() {
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
