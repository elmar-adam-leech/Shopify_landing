type LogLevel = "error" | "warn" | "info";

interface LogContext {
  endpoint?: string;
  storeId?: string | null;
  operation?: string;
  errorType?: string;
  [key: string]: unknown;
}

function truncateMessage(msg: string, maxLength = 500): string {
  if (msg.length <= maxLength) return msg;
  return msg.slice(0, maxLength) + "...[truncated]";
}

function extractErrorInfo(error: unknown): { type: string; message: string } {
  if (error instanceof Error) {
    return {
      type: error.constructor.name,
      message: truncateMessage(error.message),
    };
  }
  return {
    type: "UnknownError",
    message: truncateMessage(String(error)),
  };
}

function formatLogEntry(level: LogLevel, message: string, context?: LogContext, error?: unknown): string {
  const parts: string[] = [`[${level.toUpperCase()}]`, message];

  if (context) {
    const contextParts: string[] = [];
    if (context.endpoint) contextParts.push(`endpoint=${context.endpoint}`);
    if (context.storeId) contextParts.push(`storeId=${context.storeId}`);
    if (context.operation) contextParts.push(`operation=${context.operation}`);

    const extraKeys = Object.keys(context).filter(
      (k) => !["endpoint", "storeId", "operation", "errorType"].includes(k)
    );
    for (const key of extraKeys) {
      const val = context[key];
      if (val !== undefined && val !== null) {
        contextParts.push(`${key}=${String(val)}`);
      }
    }
    if (contextParts.length > 0) {
      parts.push(`{${contextParts.join(", ")}}`);
    }
  }

  if (error) {
    const errInfo = extractErrorInfo(error);
    const errorType = context?.errorType || errInfo.type;
    parts.push(`[${errorType}] ${errInfo.message}`);
  } else if (context?.errorType) {
    parts.push(`[${context.errorType}]`);
  }

  return parts.join(" ");
}

export function logError(message: string, context?: LogContext, error?: unknown): void {
  console.error(formatLogEntry("error", message, context, error));
}

export function logWarn(message: string, context?: LogContext): void {
  console.warn(formatLogEntry("warn", message, context));
}

export function logInfo(message: string, context?: LogContext): void {
  console.log(formatLogEntry("info", message, context));
}
