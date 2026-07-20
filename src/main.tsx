import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BridgeTestPage } from './pages/BridgeTestPage';
import { FcmTestPage } from './pages/FcmTestPage';
import { FileTestPage } from './pages/FileTestPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import './styles.css';

type RoutePath = '/' | '/bridge' | '/fcm' | '/file' | '/login';

function currentPath(): RoutePath {
  const hashPath = window.location.hash.replace(/^#/, '');

  if (hashPath === '/bridge' || hashPath === '/fcm' || hashPath === '/file' || hashPath === '/login') {
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
    const params = new URLSearchParams(window.location.search);
    const appLink = params.get('APP_LINK');
    if (appLink) {
      const cleanPath = appLink.replace(/^#/, '');
      if (cleanPath === '/bridge' || cleanPath === '/fcm' || cleanPath === '/file' || cleanPath === '/login') {
        const newUrl = window.location.origin + window.location.pathname + '#' + cleanPath;
        window.history.replaceState({}, document.title, newUrl);
        setPath(cleanPath as RoutePath);
        return;
      }
    }

    const handleHashChange = () => setPath(currentPath());
    window.addEventListener('hashchange', handleHashChange);

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  switch (path) {
    case '/bridge':
      return <BridgeTestPage onBack={() => navigate('/')} />;
    case '/fcm':
      return <FcmTestPage onBack={() => navigate('/')} />;
    case '/file':
      return <FileTestPage onBack={() => navigate('/')} />;
    case '/login':
      return <LoginPage onBack={() => navigate('/')} />;
    default:
      return <HomePage onNavigate={(nextPath) => navigate(nextPath as RoutePath)} />;
  }
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
