import { createBrowserRouter, redirect, Outlet } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import LandingPage from './components/LandingPage';
import MainApp from './components/MainApp';
import NotFound from './components/NotFound';
import Dashboard from './pages/Dashboard';
import TasteProfile from './pages/TasteProfile';
import FeedbackDashboard from './pages/FeedbackDashboard';
import LogsPage from './pages/LogsPage';
import AppLayout from './components/AppLayout';
import ErrorFallback from './components/ErrorFallback';

// Auth callback loader - handles OAuth callback without a component
const authCallbackLoader = ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const success = url.searchParams.get('success');
  const error = url.searchParams.get('error');

  console.log('AuthCallback loader - URL params:', { 
    token: token ? 'present' : 'missing', 
    success, 
    error 
  });

  if (error) {
    console.error('Authentication error:', error);
    return redirect('/landing?error=' + encodeURIComponent(error));
  }

  if (token && success === 'true') {
    console.log('Authentication successful, storing JWT token');
    localStorage.setItem('spotify_jwt', token);
    return redirect('/');
  } else {
    console.log('Invalid authentication callback, redirecting to landing page');
    return redirect('/landing');
  }
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
    path: "*",
    element: <NotFound />
  }
]);

// Root component for RouterProvider
function App() {
  return <Outlet />;
}

export default App;