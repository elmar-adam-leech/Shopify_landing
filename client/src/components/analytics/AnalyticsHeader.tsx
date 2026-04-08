import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

interface AnalyticsHeaderProps {
  pageTitle: string;
  pageId: string;
  dateRange: string;
  onDateRangeChange: (value: string) => void;
}

export function AnalyticsHeader({ pageTitle, pageId, dateRange, onDateRangeChange }: AnalyticsHeaderProps) {
  return (
    <header className="h-16 border-b bg-background sticky top-0 z-50 flex items-center justify-between gap-4 px-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" aria-label="Back to pages" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-semibold text-lg" data-testid="text-page-title">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground">Analytics Dashboard</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={dateRange} onValueChange={onDateRangeChange}>
          <SelectTrigger className="w-32" data-testid="select-date-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Link href={`/editor/${pageId}`}>
          <Button variant="outline" data-testid="button-edit-page">Edit Page</Button>
        </Link>
      </div>
    </header>
  );
}
