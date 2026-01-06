import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { StoreProvider } from "@/lib/store-context";
import PagesList from "@/pages/PagesList";
import Editor from "@/pages/Editor";
import Preview from "@/pages/Preview";
import Analytics from "@/pages/Analytics";
import ABTests from "@/pages/ABTests";
import ABTestResults from "@/pages/ABTestResults";
import Stores from "@/pages/Stores";
import NotFound from "@/pages/not-found";

function Router() {
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <StoreProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </StoreProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
