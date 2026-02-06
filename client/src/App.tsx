import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { StoreProvider } from "@/lib/store-context";
import { ShopifyProviders } from "@/components/providers/AppBridgeProvider";
import PagesList from "@/pages/PagesList";
import Editor from "@/pages/Editor";
import Preview from "@/pages/Preview";
import Analytics from "@/pages/Analytics";
import ABTests from "@/pages/ABTests";
import ABTestResults from "@/pages/ABTestResults";
import Stores from "@/pages/Stores";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import NotFound from "@/pages/not-found";
import { useState, useCallback } from "react";

function isShopifyEmbedded(): boolean {
  const params = new URLSearchParams(window.location.search);
  return !!params.get("shop") && !!params.get("host");
}

function ShopifyRouter() {
  return (
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
  );
}

function AdminApp() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

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
  const isLoading = sessionQuery.isLoading;

  const handleLoginSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
  }, []);

  const handleLogout = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return <AdminDashboard onLogout={handleLogout} />;
}

function App() {
  const embedded = isShopifyEmbedded();

  if (embedded) {
    return (
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
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <AdminApp />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
