import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

import { AuthGate } from '@/components/auth-gate';
import { Shell } from '@/components/cr-ui';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/lib/auth';
import ChangeRequestDetail from '@/pages/change-request-detail';
import NewChangeRequest from '@/pages/change-request-new';
import ChangeRequests from '@/pages/change-requests';
import Dashboard from '@/pages/dashboard';
import NotFound from '@/pages/not-found';
import Settings from '@/pages/settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

function Home() {
  const [, setLocation] = useLocation();
  useEffect(() => setLocation('/dashboard', { replace: true }), [setLocation]);
  return null;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return (
    // Shell (sidebar, navbar) nam ngoai boundary de van con khi 1 trang loi.
    <RoutedErrorBoundary>
      <Shell>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/change-requests/new" component={NewChangeRequest} />
          <Route path="/change-requests/:id" component={ChangeRequestDetail} />
          <Route path="/change-requests" component={ChangeRequests} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </Shell>
    </RoutedErrorBoundary>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <AuthGate>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
          </AuthGate>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
