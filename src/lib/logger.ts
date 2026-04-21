type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") {
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...context,
    };
    process.stdout.write(JSON.stringify(entry) + "\n");
  } else {
    const prefix = `[${level.toUpperCase()}]`;
    const contextStr = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";
    const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleFn(`${prefix} ${message}${contextStr}`);
  }
}

export const logger = {
  info(message: string, context?: Record<string, unknown>): void {
    emit("info", message, context);
  },
  warn(message: string, context?: Record<string, unknown>): void {
    emit("warn", message, context);
  },
  error(message: string, context?: Record<string, unknown>): void {
    emit("error", message, context);
  },
};
