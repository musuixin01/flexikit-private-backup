import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/**
 * Restricts manual crawls within a single NestJS instance.
 * Scheduled jobs are unchanged; distributed limits and execution budgets
 * remain independent release gates.
 */
@Injectable()
export class CrawlerManualTriggerGate {
  private running = false;
  private readonly lastStartedAt = new Map<string, number>();
  private static readonly MIN_INTERVAL_MS = 60_000;

  async run(source: string, task: () => Promise<number>): Promise<number> {
    if (this.running) {
      throw new HttpException('已有手动抓取任务运行中，请稍后重试', HttpStatus.TOO_MANY_REQUESTS);
    }
    const now = Date.now();
    const previous = this.lastStartedAt.get(source);
    if (previous !== undefined && now - previous < CrawlerManualTriggerGate.MIN_INTERVAL_MS) {
      throw new HttpException('该来源触发过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    }
    // Set both gates before the first await to block racing triggers.
    this.running = true;
    this.lastStartedAt.set(source, now);
    try {
      return await task();
    } finally {
      this.running = false;
    }
  }
}
