const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Token-bucket limiter; one instance shared across all tokens. */
export class RateLimiter {
  private tokens: number;
  private updated: number;

  constructor(private rate = 40.0, private burst = 10) {
    this.tokens = burst;
    this.updated = Date.now();
  }

  async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      this.tokens = Math.min(this.burst, this.tokens + ((now - this.updated) / 1000) * this.rate);
      this.updated = now;
      if (this.tokens >= 1.0) {
        this.tokens -= 1.0;
        return;
      }
      await sleep(((1.0 - this.tokens) / this.rate) * 1000);
    }
  }
}