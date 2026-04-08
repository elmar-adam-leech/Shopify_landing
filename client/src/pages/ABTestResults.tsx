import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, TrendingUp } from "lucide-react";
import { useABTestResults } from "@/components/ab-test-results/useABTestResults";
import { AddVariantDialog } from "@/components/ab-test-results/AddVariantDialog";
import { WinnerCard } from "@/components/ab-test-results/WinnerCard";
import { ResultsChart } from "@/components/ab-test-results/ResultsChart";
import { VariantDetailCard } from "@/components/ab-test-results/VariantDetailCard";
import { COLORS } from "@/components/ab-test-results/types";

export default function ABTestResults() {
  const {
    results,
    isLoading,
    resultsError,
    pages,
    pagesLoading,
    addVariantOpen,
    setAddVariantOpen,
    variantName,
    setVariantName,
    selectedPageId,
    setSelectedPageId,
    trafficPercentage,
    setTrafficPercentage,
    utmSourceMatch,
    setUtmSourceMatch,
    addVariantMutation,
    deleteVariantMutation,
  } = useABTestResults();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading test results...</div>
      </div>
    );
  }

  if (resultsError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="error-state">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Failed to load test results. Please try again.</p>
          <Link href="/ab-tests">
            <Button variant="outline" data-testid="button-back-to-tests">Back to A/B Tests</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Test not found</div>
      </div>
    );
  }

  const { test } = results;
  const variantResults = results.results;
  const winningVariant = variantResults.length > 0
    ? variantResults.reduce((prev, current) => 
        parseFloat(current.conversionRate) > parseFloat(prev.conversionRate) ? current : prev
      )
    : null;

  const chartData = variantResults.map((v, index) => ({
    name: v.variantName,
    conversionRate: parseFloat(v.conversionRate),
    pageViews: v.pageViews,
    conversions: v.formSubmissions + v.buttonClicks,
    fill: COLORS[index % COLORS.length],
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b bg-background sticky top-0 z-50 flex items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-4">
          <Link href="/ab-tests">
            <Button variant="ghost" size="icon" aria-label="Back to A/B tests" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold text-lg" data-testid="text-test-name">{test.name}</h1>
            <p className="text-sm text-muted-foreground">A/B Test Results</p>
          </div>
        </div>
        <AddVariantDialog
          open={addVariantOpen}
          onOpenChange={setAddVariantOpen}
          variantName={variantName}
          onVariantNameChange={setVariantName}
          selectedPageId={selectedPageId}
          onSelectedPageIdChange={setSelectedPageId}
          trafficPercentage={trafficPercentage}
          onTrafficPercentageChange={setTrafficPercentage}
          utmSourceMatch={utmSourceMatch}
          onUtmSourceMatchChange={setUtmSourceMatch}
          pages={pages}
          pagesLoading={pagesLoading}
          trafficSplitType={test.trafficSplitType}
          isPending={addVariantMutation.isPending}
          onSubmit={() => addVariantMutation.mutate()}
        />
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        {variantResults.length === 0 ? (
          <Card className="p-12 text-center" data-testid="empty-variants">
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">No Variants Yet</h2>
            <p className="text-muted-foreground mb-4">
              Add at least two page variants to start comparing their performance.
            </p>
            <Button onClick={() => setAddVariantOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Variant
            </Button>
          </Card>
        ) : (
          <>
            {winningVariant && variantResults.length > 1 && (
              <WinnerCard winner={winningVariant} />
            )}

            <div className="grid gap-6 md:grid-cols-2 mb-6">
              <ResultsChart
                title="Conversion Rate Comparison"
                data={chartData}
                dataKey="conversionRate"
                unit="%"
                formatter={(value: number) => [`${value}%`, "Conversion Rate"]}
                testId="card-conversion-comparison"
              />
              <ResultsChart
                title="Traffic Distribution"
                data={chartData}
                dataKey="pageViews"
                name="Page Views"
                testId="card-traffic-comparison"
              />
            </div>

            <h2 className="text-lg font-semibold mb-4">Variant Details</h2>
            <div className="grid gap-4">
              {variantResults.map((variant, index) => (
                <VariantDetailCard
                  key={variant.variantId}
                  variant={variant}
                  colorIndex={index}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
