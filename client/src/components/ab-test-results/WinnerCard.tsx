import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import type { VariantResult } from "./types";

interface WinnerCardProps {
  winner: VariantResult;
}

export function WinnerCard({ winner }: WinnerCardProps) {
  return (
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
            <p className="text-2xl font-bold">{winner.variantName}</p>
            <p className="text-muted-foreground">
              {winner.conversionRate}% conversion rate
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {winner.pageViews} views
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
