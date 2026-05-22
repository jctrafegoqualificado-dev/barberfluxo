import "server-only";

type Level = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: Level;
  msg: string;
  time: string;
  [key: string]: unknown;
}

function log(level: Level, msg: string, context?: Record<string, unknown>) {
  const entry: LogEntry = { level, msg, time: new Date().toISOString(), ...context };
  if (process.env.NODE_ENV === "production") {
    console.log(JSON.stringify(entry));
  } else {
    const prefix = { info: "ℹ", warn: "⚠", error: "✖", debug: "⚙" }[level];
    const extra = context ? ` ${JSON.stringify(context)}` : "";
    console.log(`${entry.time} ${prefix} [${level.toUpperCase()}] ${msg}${extra}`);
  }
}

export const logger = {
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
};
