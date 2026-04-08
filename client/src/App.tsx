import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { StoreProvider } from "@/lib/store-context";
import { ShopifyProviders } from "@/components/providers/AppBridgeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazy, Suspense, useCallback } from "react";

const PagesList = lazy(() => import("@/pages/PagesList"));
const Editor = lazy(() => import("@/pages/Editor"));
const Preview = lazy(() => import("@/pages/Preview"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const ABTests = lazy(() => import("@/pages/ABTests"));
const ABTestResults = lazy(() => import("@/pages/ABTestResults"));
const Stores = lazy(() => import("@/pages/Stores"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

function isShopifyEmbedded(): boolean {
  const params = new URLSearchParams(window.location.search);
  return !!params.get("shop") && !!params.get("host");
}

function ShopifyRouter() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={PagesList} />
        <Route path="/stores" component={Stores} />
        <Route path="/editor/:id" component={Editor} />
        <Route path="/preview/:id" component={Preview} />
        <Route path="/analytics/:id" component={Analytics} />
        <Route path="/ab-tests" component={ABTests} />
        <Route path="/ab-tests/:id" component={ABTestResults} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AdminApp() {
  const sessionQuery = useQuery({
    queryKey: ["/api/admin/session"],
    queryFn: async () => {
      const res = await fetch("/api/admin/session", { credentials: "include" });
      if (!res.ok) return { authenticated: false };
      return res.json();
    },
    staleTime: 60000,
  });

  const authenticated = sessionQuery.data?.authenticated === true;
  const csrfToken = sessionQuery.data?.csrfToken as string | undefined;
  const isLoading = sessionQuery.isLoading;

  const handleLoginSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
  }, []);

  const handleLogout = useCallback(() => {
    queryClient.setQueryData(["/api/admin/session"], { authenticated: false });
    queryClient.removeQueries({ queryKey: ["/api/admin/stores"] });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <Suspense fallback={<PageFallback />}>
        <AdminLogin onLoginSuccess={handleLoginSuccess} csrfToken={csrfToken} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <AdminDashboard onLogout={handleLogout} csrfToken={csrfToken} />
    </Suspense>
  );
}

function App() {
  const embedded = isShopifyEmbedded();

  if (embedded) {
    return (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ShopifyProviders>
            <ThemeProvider>
              <StoreProvider>
                <TooltipProvider>
                  <Toaster />
                  <ShopifyRouter />
                </TooltipProvider>
              </StoreProvider>
            </ThemeProvider>
          </ShopifyProviders>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <AdminApp />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
