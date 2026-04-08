import type { AbTest } from "@shared/schema";

export type VariantResult = {
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

export type TestResults = {
  test: AbTest;
  results: VariantResult[];
};

export type ChartDataItem = {
  name: string;
  conversionRate: number;
  pageViews: number;
  conversions: number;
  fill: string;
};

export const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];
