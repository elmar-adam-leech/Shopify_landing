import { escapeHtml } from "../html-utils";

export function sanitizePixelId(id: string): string {
  return escapeHtml(id.replace(/[^a-zA-Z0-9\-_/]/g, ""));
}
