import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Play, Pause, Trash2, BarChart3, FlaskConical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AbTest, Page } from "@shared/schema";

export default function ABTests() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTestName, setNewTestName] = useState("");
  const [newTestDescription, setNewTestDescription] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [trafficSplitType, setTrafficSplitType] = useState<"random" | "source_based">("random");
  const [goalType, setGoalType] = useState<"form_submission" | "button_click" | "page_view">("form_submission");

  const { data: tests = [], isLoading: testsLoading } = useQuery<AbTest[]>({
    queryKey: ["/api/ab-tests"],
  });

  const { data: pages = [] } = useQuery<Page[]>({
    queryKey: ["/api/pages"],
  });

  const createTestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ab-tests", {
        name: newTestName,
        description: newTestDescription,
        originalPageId: selectedPageId,
        trafficSplitType,
        goalType,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ab-tests"] });
      setCreateDialogOpen(false);
      setNewTestName("");
      setNewTestDescription("");
      setSelectedPageId("");
      toast({ title: "A/B Test created" });
    },
    onError: () => {
      toast({ title: "Failed to create test", variant: "destructive" });
    },
  });

  const updateTestMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/ab-tests/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ab-tests"] });
      toast({ title: "Test status updated" });
    },
  });

  const deleteTestMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ab-tests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ab-tests"] });
      toast({ title: "Test deleted" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Running</Badge>;
      case "paused":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Paused</Badge>;
      case "completed":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Completed</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const getPageTitle = (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    return page?.title || "Unknown Page";
  };

  if (testsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading A/B tests...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b bg-background sticky top-0 z-50 flex items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            <h1 className="font-semibold text-lg">A/B Tests</h1>
          </div>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-test">
              <Plus className="w-4 h-4 mr-2" />
              Create Test
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-test">
            <DialogHeader>
              <DialogTitle>Create A/B Test</DialogTitle>
              <DialogDescription>Set up a new split test to compare page variants</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="test-name">Test Name</Label>
                <Input
                  id="test-name"
                  value={newTestName}
                  onChange={(e) => setNewTestName(e.target.value)}
                  placeholder="e.g., Hero Banner A/B Test"
                  data-testid="input-test-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-description">Description (optional)</Label>
                <Input
                  id="test-description"
                  value={newTestDescription}
                  onChange={(e) => setNewTestDescription(e.target.value)}
                  placeholder="What are you testing?"
                  data-testid="input-test-description"
                />
              </div>
              <div className="space-y-2">
                <Label>Original Page</Label>
                <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                  <SelectTrigger data-testid="select-original-page">
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
                <Label>Traffic Split Type</Label>
                <Select value={trafficSplitType} onValueChange={(v: "random" | "source_based") => setTrafficSplitType(v)}>
                  <SelectTrigger data-testid="select-traffic-split">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Random Split</SelectItem>
                    <SelectItem value="source_based">By Traffic Source</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Goal Type</Label>
                <Select value={goalType} onValueChange={(v: "form_submission" | "button_click" | "page_view") => setGoalType(v)}>
                  <SelectTrigger data-testid="select-goal-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="form_submission">Form Submission</SelectItem>
                    <SelectItem value="button_click">Button Click</SelectItem>
                    <SelectItem value="page_view">Page View</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createTestMutation.mutate()}
                disabled={!newTestName || !selectedPageId || createTestMutation.isPending}
                data-testid="button-confirm-create"
              >
                Create Test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {tests.length === 0 ? (
          <Card className="p-12 text-center" data-testid="empty-state">
            <FlaskConical className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">No A/B Tests Yet</h2>
            <p className="text-muted-foreground mb-4">
              Create your first A/B test to start comparing page variants and optimize conversions.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Test
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {tests.map((test) => (
              <Card key={test.id} data-testid={`card-test-${test.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {test.name}
                        {getStatusBadge(test.status)}
                      </CardTitle>
                      {test.description && (
                        <CardDescription className="mt-1">{test.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {test.status === "draft" || test.status === "paused" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateTestMutation.mutate({ id: test.id, status: "running" })}
                          data-testid={`button-start-${test.id}`}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Start
                        </Button>
                      ) : test.status === "running" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateTestMutation.mutate({ id: test.id, status: "paused" })}
                          data-testid={`button-pause-${test.id}`}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pause
                        </Button>
                      ) : null}
                      <Link href={`/ab-tests/${test.id}`}>
                        <Button variant="outline" size="sm" data-testid={`button-view-results-${test.id}`}>
                          <BarChart3 className="w-4 h-4 mr-1" />
                          Results
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTestMutation.mutate(test.id)}
                        data-testid={`button-delete-${test.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Original Page:</span>
                      <p className="font-medium">{getPageTitle(test.originalPageId)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Traffic Split:</span>
                      <p className="font-medium capitalize">{test.trafficSplitType.replace("_", " ")}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Goal:</span>
                      <p className="font-medium capitalize">{test.goalType.replace("_", " ")}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <p className="font-medium">{new Date(test.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
