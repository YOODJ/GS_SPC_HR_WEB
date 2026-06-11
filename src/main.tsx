import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BridgeTestPage } from './pages/BridgeTestPage';
import { FileTestPage } from './pages/FileTestPage';
import { HomePage } from './pages/HomePage';
import './styles.css';

type RoutePath = '/' | '/bridge' | '/file';

function currentPath(): RoutePath {
  const hashPath = window.location.hash.replace(/^#/, '');

  if (hashPath === '/bridge' || hashPath === '/file') {
    return hashPath;
  }

  return '/';
}

function navigate(path: RoutePath) {
  window.location.hash = path;
}

function App() {
  const [path, setPath] = useState<RoutePath>(currentPath);

  useEffect(() => {
    const handleHashChange = () => setPath(currentPath());
    window.addEventListener('hashchange', handleHashChange);

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  switch (path) {
    case '/bridge':
      return <BridgeTestPage onBack={() => navigate('/')} />;
    case '/file':
      return <FileTestPage onBack={() => navigate('/')} />;
    default:
      return <HomePage onNavigate={(nextPath) => navigate(nextPath as RoutePath)} />;
  }
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
