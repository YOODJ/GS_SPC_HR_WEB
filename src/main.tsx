import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AutoLoginTestPage } from './pages/AutoLoginTestPage';
import { BridgeTestPage } from './pages/BridgeTestPage';
import { FcmTestPage } from './pages/FcmTestPage';
import { FileTestPage } from './pages/FileTestPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import './styles.css';

const ROUTE_PATHS = ['/bridge', '/fcm', '/file', '/login', '/autologin'] as const;

type RoutePath = '/' | (typeof ROUTE_PATHS)[number];

function isRoutePath(value: string): value is RoutePath {
  return (ROUTE_PATHS as readonly string[]).includes(value);
}

function currentPath(): RoutePath {
  const hashPath = window.location.hash.replace(/^#/, '');

  return isRoutePath(hashPath) ? hashPath : '/';
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
      if (isRoutePath(cleanPath)) {
        const newUrl = window.location.origin + window.location.pathname + '#' + cleanPath;
        window.history.replaceState({}, document.title, newUrl);
        setPath(cleanPath);
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
    case '/autologin':
      return <AutoLoginTestPage onBack={() => navigate('/')} />;
    default:
      return <HomePage onNavigate={(nextPath) => navigate(nextPath as RoutePath)} />;
  }
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
