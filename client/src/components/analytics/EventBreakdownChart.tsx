import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import type { AnalyticsSummary } from "./types";

interface EventBreakdownChartProps {
  analytics: AnalyticsSummary | undefined;
}

export function EventBreakdownChart({ analytics }: EventBreakdownChartProps) {
  return (
    <Card data-testid="card-event-breakdown">
      <CardHeader>
        <CardTitle>Event Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={[
              { name: "Page Views", value: analytics?.pageViews || 0 },
              { name: "Form Submissions", value: analytics?.formSubmissions || 0 },
              { name: "Button Clicks", value: analytics?.buttonClicks || 0 },
              { name: "Phone Clicks", value: analytics?.phoneClicks || 0 },
            ]}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis dataKey="name" type="category" width={120} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
