import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Play, Pause, Trash2, BarChart3 } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { AbTest } from "@shared/schema";

interface ABTestCardProps {
  test: AbTest;
  getPageTitle: (pageId: string) => string;
  onUpdateStatus: (data: { id: string; status: string }) => void;
  onDelete: (id: string) => void;
}

export function ABTestCard({ test, getPageTitle, onUpdateStatus, onDelete }: ABTestCardProps) {
  return (
    <Card data-testid={`card-test-${test.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              {test.name}
              <StatusBadge status={test.status} />
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
                onClick={() => onUpdateStatus({ id: test.id, status: "running" })}
                data-testid={`button-start-${test.id}`}
              >
                <Play className="w-4 h-4 mr-1" />
                Start
              </Button>
            ) : test.status === "running" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUpdateStatus({ id: test.id, status: "paused" })}
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
              aria-label={`Delete test ${test.name}`}
              onClick={() => onDelete(test.id)}
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
  );
}
