import { createBrowserRouter, redirect, Outlet } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import LandingPage from './components/LandingPage';
import MainApp from './components/MainApp';
import NotFound from './components/NotFound';
import Dashboard from './pages/Dashboard';
import TasteProfile from './pages/TasteProfile';
import FeedbackDashboard from './pages/FeedbackDashboard';
import LogsPage from './pages/LogsPage';
import WebSocketDemo from './pages/WebSocketDemo';
import PlaylistSearch from './pages/PlaylistSearch';
import AppLayout from './components/AppLayout';
import ErrorFallback from './components/ErrorFallback';
import AuthSuccess from './components/AuthSuccess';

// Auth callback loader - handles legacy OAuth callback (should not be used anymore)
const authCallbackLoader = ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');

  console.log('Legacy auth callback accessed - redirecting to landing');

  if (error) {
    console.error('Authentication error:', error);
    return redirect('/landing?error=' + encodeURIComponent(error));
  }

  return redirect('/landing?message=auth_system_updated');
};

// Create router with loaders
export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Sentry.ErrorBoundary fallback={ErrorFallback} showDialog>
        <AppLayout />
      </Sentry.ErrorBoundary>
    ),
    children: [
      {
        index: true,
        element: <MainApp />
      },
      {
        path: "dashboard",
        element: <Dashboard />
      },
      {
        path: "taste-profile",
        element: <TasteProfile />
      },
      {
        path: "feedback-dashboard",
        element: <FeedbackDashboard />
      },
      {
        path: "logs",
        element: <LogsPage />
      },
      {
        path: "websocket-demo",
        element: <WebSocketDemo />
      },
      {
        path: "playlist-search",
        element: <PlaylistSearch />
      }
    ]
  },
  {
    path: "/landing",
    element: <LandingPage />
  },
  {
    path: "/callback",
    loader: authCallbackLoader,
    element: <div>Processing authentication...</div> // This won't render due to redirect
  },
  {
    path: "/auth-success",
    element: <AuthSuccess />
  },
  {
    path: "*",
    element: <NotFound />
  }
]);

// Root component for RouterProvider
function App() {
  return <Outlet />;
}

export default App;