import { escapeHtml } from "@shared/html-utils";

export function sanitizePixelId(id: string): string {
  return escapeHtml(id.replace(/[^a-zA-Z0-9\-_/]/g, ""));
}

export function getUrlParam(paramName: string): string {
  if (typeof window === "undefined") return "";
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(paramName) || "";
}
