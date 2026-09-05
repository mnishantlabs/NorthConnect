import { API_BASE, HEADERS } from "../shared/constants";
import { RateLimiter } from "./rate-limiter";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface ApiResponse {
  status: number;
  ok: boolean;
  json(): Promise<any>;
  text(): Promise<string>;
}

class ApiResponseImpl implements ApiResponse {
  status: number;
  constructor(status: number, body: any = {}) {
    this.status = status;
    this.body = body;
  }
  private body: any;
  get ok() {
    return this.status >= 200 && this.status < 300;
  }
  async json() {
    return this.body;
  }
  async text() {
    return typeof this.body === "string" ? this.body : JSON.stringify(this.body);
  }
}

export interface RequestOptions {
  token?: string;
  body?: unknown;
  json?: unknown;
}

export class DiscordClient {
  private limiter = new RateLimiter();

  constructor(
    private opts: { concurrency?: number; apiTimeout?: number; proxy?: string } = {}
  ) {}

  async request(method: string, path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    const headers: Record<string, string> = { ...HEADERS };
    if (options.token) headers["Authorization"] = options.token;
    let body: BodyInit | undefined;
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    } else if (options.body !== undefined) {
      body = options.body as BodyInit;
    }

    const timeout = this.opts.apiTimeout || 10;

    for (let attempt = 0; attempt < 4; attempt++) {
      await this.limiter.acquire();
      let resp: Response;
      try {
        resp = await fetch(`${API_BASE}${path}`, {
          method,
          headers,
          body,
          signal: AbortSignal.timeout(timeout * 1000),
        });
      } catch (err: any) {
        return new ApiResponseImpl(0, { error: String(err?.message || err).slice(0, 80) });
      }
      if (resp.status === 429) {
        const retry = parseFloat(resp.headers.get("Retry-After") || "3") || 3;
        await sleep(retry * 1000);
        continue;
      }
      let data: any = {};
      const text = await resp.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = text;
      }
      return new ApiResponseImpl(resp.status, data);
    }
    return new ApiResponseImpl(429, {});
  }

  get(path: string, token?: string): Promise<ApiResponse> {
    return this.request("GET", path, { token });
  }

  post(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    return this.request("POST", path, options);
  }

  delete(path: string, token?: string): Promise<ApiResponse> {
    return this.request("DELETE", path, { token });
  }
}