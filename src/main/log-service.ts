import type { LogLevel, LogRecord } from "../shared/types";
import { LOG_BUFFER_SIZE } from "../shared/constants";

function now(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

export interface LogTreeItem {
  timestamp: string;
  message: string;
  level: LogLevel;
}

export class LogService {
  private buffer: LogTreeItem[] = [];

  constructor(
    private size: number = LOG_BUFFER_SIZE,
    private emit?: (record: LogTreeItem) => void
  ) {}

  log(message: string, level: LogLevel = "info"): void {
    const record: LogTreeItem = { timestamp: now(), message, level };
    this.buffer.push(record);
    if (this.buffer.length > this.size) this.buffer.shift();
    this.emit?.(record);
  }

  warning(message: string) {
    this.log(message, "warn");
  }
  error(message: string) {
    this.log(message, "error");
  }
  success(message: string) {
    this.log(message, "success");
  }
  info(message: string) {
    this.log(message, "info");
  }
  rate(message: string) {
    this.log(message, "rate");
  }

  iter_all(): LogTreeItem[] {
    return [...this.buffer];
  }

  get count() {
    return this.buffer.length;
  }

  clear() {
    this.buffer = [];
  }

  as_records(): LogRecord[] {
    return this.buffer.map((r) => ({ ...r, timestamp: Date.now() }));
  }
}