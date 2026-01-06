import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Plus, Trophy, TrendingUp, Eye, FileText, MousePointer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useStore } from "@/lib/store-context";
import type { AbTest, AbTestVariant, Page } from "@shared/schema";

type VariantResult = {
  variantId: string;
  variantName: string;
  pageId: string;
  isControl: boolean;
  trafficPercentage: number;
  pageViews: number;
  formSubmissions: number;
  buttonClicks: number;
  phoneClicks: number;
  conversionRate: string;
  bySource: { source: string; count: number }[];
  byDay: { date: string; count: number }[];
};

type TestResults = {
  test: AbTest;
  results: VariantResult[];
};

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];

export default function ABTestResults() {
  const [, params] = useRoute("/ab-tests/:id/results");
  const testId = params?.id;
  const { toast } = useToast();
  const { selectedStoreId } = useStore();
  const [addVariantOpen, setAddVariantOpen] = useState(false);
  const [variantName, setVariantName] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [trafficPercentage, setTrafficPercentage] = useState("50");
  const [utmSourceMatch, setUtmSourceMatch] = useState("");

  const { data: results, isLoading } = useQuery<TestResults>({
    queryKey: ["/api/ab-tests", testId, "results"],
    staleTime: 0,
  });

  const { data: variants = [] } = useQuery<AbTestVariant[]>({
    queryKey: ["/api/ab-tests", testId, "variants"],
  });

  const { data: pages = [] } = useQuery<Page[]>({
    queryKey: ["/api/pages", selectedStoreId],
    queryFn: async () => {
      const url = selectedStoreId ? `/api/pages?storeId=${selectedStoreId}` : "/api/pages";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch pages");
      return res.json();
    },
  });

  const addVariantMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/ab-tests/${testId}/variants`, {
        name: variantName,
        pageId: selectedPageId,
        trafficPercentage: parseInt(trafficPercentage),
        utmSourceMatch: utmSourceMatch || null,
        isControl: variants.length === 0,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ab-tests", testId] });
      setAddVariantOpen(false);
      setVariantName("");
      setSelectedPageId("");
      setTrafficPercentage("50");
      setUtmSourceMatch("");
      toast({ title: "Variant added" });
    },
    onError: () => {
      toast({ title: "Failed to add variant", variant: "destructive" });
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: async (variantId: string) => {
      await apiRequest("DELETE", `/api/ab-tests/${testId}/variants/${variantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ab-tests", testId] });
      toast({ title: "Variant deleted" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading test results...</div>
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
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold text-lg" data-testid="text-test-name">{test.name}</h1>
            <p className="text-sm text-muted-foreground">A/B Test Results</p>
          </div>
        </div>
        <Dialog open={addVariantOpen} onOpenChange={setAddVariantOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-variant">
              <Plus className="w-4 h-4 mr-2" />
              Add Variant
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-add-variant">
            <DialogHeader>
              <DialogTitle>Add Variant</DialogTitle>
              <DialogDescription>Add a page variant to compare in this test</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="variant-name">Variant Name</Label>
                <Input
                  id="variant-name"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  placeholder="e.g., Variant A, Control"
                  data-testid="input-variant-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Page</Label>
                <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                  <SelectTrigger data-testid="select-variant-page">
                    <SelectValue placeholder="Select a page" />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((page) => (
                      <SelectItem key={page.id} value={page.id}>
                        {page.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="traffic-percentage">Traffic Percentage</Label>
                <Input
                  id="traffic-percentage"
                  type="number"
                  min="1"
                  max="100"
                  value={trafficPercentage}
                  onChange={(e) => setTrafficPercentage(e.target.value)}
                  data-testid="input-traffic-percentage"
                />
              </div>
              {test.trafficSplitType === "source_based" && (
                <div className="space-y-2">
                  <Label htmlFor="utm-source">UTM Source Match (optional)</Label>
                  <Input
                    id="utm-source"
                    value={utmSourceMatch}
                    onChange={(e) => setUtmSourceMatch(e.target.value)}
                    placeholder="e.g., facebook, google"
                    data-testid="input-utm-source"
                  />
                  <p className="text-xs text-muted-foreground">
                    Users with this UTM source will see this variant
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddVariantOpen(false)}>Cancel</Button>
              <Button
                onClick={() => addVariantMutation.mutate()}
                disabled={!variantName || !selectedPageId || addVariantMutation.isPending}
                data-testid="button-confirm-add-variant"
              >
                Add Variant
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
              <Card className="mb-6 border-primary/50 bg-primary/5" data-testid="card-winner">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">Current Leader</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{winningVariant.variantName}</p>
                      <p className="text-muted-foreground">
                        {winningVariant.conversionRate}% conversion rate
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-lg px-4 py-2">
                      {winningVariant.pageViews} views
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2 mb-6">
              <Card data-testid="card-conversion-comparison">
                <CardHeader>
                  <CardTitle>Conversion Rate Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px'
                        }}
                        formatter={(value: number) => [`${value}%`, "Conversion Rate"]}
                      />
                      <Bar dataKey="conversionRate" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card data-testid="card-traffic-comparison">
                <CardHeader>
                  <CardTitle>Traffic Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px'
                        }}
                      />
                      <Bar dataKey="pageViews" name="Page Views" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <h2 className="text-lg font-semibold mb-4">Variant Details</h2>
            <div className="grid gap-4">
              {variantResults.map((variant, index) => (
                <Card key={variant.variantId} data-testid={`card-variant-${variant.variantId}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <CardTitle className="text-base">
                          {variant.variantName}
                          {variant.isControl && (
                            <Badge variant="outline" className="ml-2">Control</Badge>
                          )}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{variant.trafficPercentage}% traffic</Badge>
                        <Link href={`/editor/${variant.pageId}`}>
                          <Button variant="outline" size="sm">Edit Page</Button>
                        </Link>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Views</p>
                          <p className="text-xl font-bold">{variant.pageViews}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Forms</p>
                          <p className="text-xl font-bold">{variant.formSubmissions}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MousePointer className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Clicks</p>
                          <p className="text-xl font-bold">{variant.buttonClicks}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Conversion</p>
                          <p className="text-xl font-bold">{variant.conversionRate}%</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Progress</p>
                        <Progress value={parseFloat(variant.conversionRate)} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
