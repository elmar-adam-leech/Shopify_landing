import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Eye, FileText, MousePointer, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import type { VariantResult } from "./types";
import { COLORS } from "./types";

interface VariantDetailCardProps {
  variant: VariantResult;
  colorIndex: number;
}

export function VariantDetailCard({ variant, colorIndex }: VariantDetailCardProps) {
  return (
    <Card data-testid={`card-variant-${variant.variantId}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: COLORS[colorIndex % COLORS.length] }}
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
  );
}
