export type AnalyticsSummary = {
  pageViews: number;
  formSubmissions: number;
  buttonClicks: number;
  phoneClicks: number;
  bySource: { source: string; count: number }[];
  byDay: { date: string; count: number }[];
};
