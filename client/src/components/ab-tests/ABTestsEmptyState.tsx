import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FlaskConical, Plus } from "lucide-react";

interface ABTestsEmptyStateProps {
  onCreateClick: () => void;
}

export function ABTestsEmptyState({ onCreateClick }: ABTestsEmptyStateProps) {
  return (
    <Card className="p-12 text-center" data-testid="empty-state">
      <FlaskConical className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
      <h2 className="text-lg font-semibold mb-2">No A/B Tests Yet</h2>
      <p className="text-muted-foreground mb-4">
        Create your first A/B test to start comparing page variants and optimize conversions.
      </p>
      <Button onClick={onCreateClick}>
        <Plus className="w-4 h-4 mr-2" />
        Create Your First Test
      </Button>
    </Card>
  );
}
