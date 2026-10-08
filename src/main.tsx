import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ExploreA, ExploreB, ExploreC } from './explore/Explore';

const path = window.location.pathname;

function App() {
  if (path.startsWith('/explore/b')) return <ExploreB />;
  if (path.startsWith('/explore/c')) return <ExploreC />;
  return <ExploreA />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
