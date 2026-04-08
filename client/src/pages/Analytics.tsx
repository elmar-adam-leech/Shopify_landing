import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Eye, MousePointer, FileText, TrendingUp } from "lucide-react";
import type { Page } from "@shared/schema";
import type { AnalyticsSummary } from "@/components/analytics/types";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { StatCard } from "@/components/analytics/StatCard";
import { TrafficOverTimeChart } from "@/components/analytics/TrafficOverTimeChart";
import { TrafficSourcesChart } from "@/components/analytics/TrafficSourcesChart";
import { EventBreakdownChart } from "@/components/analytics/EventBreakdownChart";

export default function Analytics() {
  const [, params] = useRoute("/analytics/:id");
  const pageId = params?.id;
  const [dateRange, setDateRange] = useState("7d");

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    switch (dateRange) {
      case "24h":
        start.setDate(start.getDate() - 1);
        break;
      case "7d":
        start.setDate(start.getDate() - 7);
        break;
      case "30d":
        start.setDate(start.getDate() - 30);
        break;
      case "90d":
        start.setDate(start.getDate() - 90);
        break;
      default:
        start.setDate(start.getDate() - 7);
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [dateRange]);

  const { data: page, isLoading: pageLoading, error: pageError } = useQuery<Page>({
    queryKey: ["/api/pages", pageId],
    enabled: !!pageId,
  });

  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/pages", pageId, "analytics", "summary", startDate, endDate],
    enabled: !!pageId,
    queryFn: async () => {
      const response = await fetch(`/api/pages/${pageId}/analytics/summary?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
    staleTime: 0,
  });

  const isLoading = !pageId || pageLoading || analyticsLoading;
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  if (pageError || analyticsError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-muted-foreground mb-4">Failed to load analytics</div>
          <Link href="/">
            <Button variant="outline" data-testid="button-back-to-pages">Back to Pages</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Page not found</div>
      </div>
    );
  }

  const totalConversions = (analytics?.formSubmissions || 0) + (analytics?.buttonClicks || 0);
  const conversionRate = analytics?.pageViews && analytics.pageViews > 0
    ? ((totalConversions / analytics.pageViews) * 100).toFixed(2)
    : "0.00";

  return (
    <div className="min-h-screen bg-background">
      <AnalyticsHeader
        pageTitle={page.title}
        pageId={pageId!}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      <main className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Page Views" value={analytics?.pageViews || 0} icon={Eye} data-testid="card-page-views" />
          <StatCard title="Form Submissions" value={analytics?.formSubmissions || 0} icon={FileText} data-testid="card-form-submissions" />
          <StatCard title="Button Clicks" value={analytics?.buttonClicks || 0} icon={MousePointer} data-testid="card-button-clicks" />
          <StatCard title="Conversion Rate" value={`${conversionRate}%`} icon={TrendingUp} data-testid="card-conversion-rate" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <TrafficOverTimeChart data={analytics?.byDay} />
          <TrafficSourcesChart data={analytics?.bySource} />
        </div>

        <EventBreakdownChart analytics={analytics} />
      </main>
    </div>
  );
}
