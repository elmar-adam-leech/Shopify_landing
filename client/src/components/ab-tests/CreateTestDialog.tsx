import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import type { Page } from "@shared/schema";

interface CreateTestDialogProps {
  pages: Page[];
  pagesLoading: boolean;
  onCreate: (data: {
    name: string;
    description: string;
    originalPageId: string;
    trafficSplitType: string;
    goalType: string;
  }) => void;
  isPending: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resetKey: number;
}

export function CreateTestDialog({ pages, pagesLoading, onCreate, isPending, open, onOpenChange, resetKey }: CreateTestDialogProps) {
  const [newTestName, setNewTestName] = useState("");
  const [newTestDescription, setNewTestDescription] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [trafficSplitType, setTrafficSplitType] = useState<"random" | "source_based">("random");
  const [goalType, setGoalType] = useState<"form_submission" | "button_click" | "page_view">("form_submission");

  const prevResetKey = useRef(resetKey);
  useEffect(() => {
    if (resetKey !== prevResetKey.current) {
      prevResetKey.current = resetKey;
      setNewTestName("");
      setNewTestDescription("");
      setSelectedPageId("");
    }
  }, [resetKey]);

  const handleCreate = () => {
    onCreate({
      name: newTestName,
      description: newTestDescription,
      originalPageId: selectedPageId,
      trafficSplitType,
      goalType,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Select value={selectedPageId} onValueChange={setSelectedPageId} disabled={pagesLoading}>
              <SelectTrigger data-testid="select-original-page">
                <SelectValue placeholder={pagesLoading ? "Loading pages..." : (pages.length === 0 ? "No pages available" : "Select a page")} />
              </SelectTrigger>
              <SelectContent>
                {pages.length === 0 ? (
                  <SelectItem value="_empty" disabled>No pages available</SelectItem>
                ) : (
                  pages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.title}
                    </SelectItem>
                  ))
                )}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={!newTestName || !selectedPageId || isPending}
            data-testid="button-confirm-create"
          >
            Create Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
