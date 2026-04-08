import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { useABTests } from "@/hooks/use-ab-tests";
import { CreateTestDialog } from "@/components/ab-tests/CreateTestDialog";
import { ABTestCard } from "@/components/ab-tests/ABTestCard";
import { ABTestsEmptyState } from "@/components/ab-tests/ABTestsEmptyState";

export default function ABTests() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);
  const {
    tests,
    pages,
    testsLoading,
    testsError,
    pagesLoading,
    createTestMutation,
    updateTestMutation,
    deleteTestMutation,
    getPageTitle,
  } = useABTests({
    onCreateSuccess: () => {
      setCreateDialogOpen(false);
      setFormResetKey((k) => k + 1);
    },
  });

  if (testsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading A/B tests...</div>
      </div>
    );
  }

  if (testsError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="error-state">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Failed to load A/B tests. Please try again.</p>
          <Link href="/">
            <Button variant="outline" data-testid="button-back-to-pages">Back to Pages</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b bg-background sticky top-0 z-50 flex items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" aria-label="Back to pages" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            <h1 className="font-semibold text-lg">A/B Tests</h1>
          </div>
        </div>
        <CreateTestDialog
          pages={pages}
          pagesLoading={pagesLoading}
          onCreate={(data) => createTestMutation.mutate(data)}
          isPending={createTestMutation.isPending}
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          resetKey={formResetKey}
        />
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {tests.length === 0 ? (
          <ABTestsEmptyState onCreateClick={() => setCreateDialogOpen(true)} />
        ) : (
          <div className="grid gap-4">
            {tests.map((test) => (
              <ABTestCard
                key={test.id}
                test={test}
                getPageTitle={getPageTitle}
                onUpdateStatus={(data) => updateTestMutation.mutate(data)}
                onDelete={(id) => deleteTestMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
