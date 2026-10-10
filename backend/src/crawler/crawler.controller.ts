import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminAccessGuard } from '../admin/admin-access.guard';
import { CrawlerManualTriggerGate } from './crawler-manual-trigger.gate';
import { V2exCrawlerService } from './v2ex.crawler.service';
import { AppinnCrawlerService } from './appinn.crawler.service';
import { IplaysoftCrawlerService } from './iplaysoft.crawler.service';
import { ProducthuntCrawlerService } from './producthunt.crawler.service';
import { JuejinCrawlerService } from './juejin.crawler.service';
import { SspaiCrawlerService } from './sspai.crawler.service';
import { ApprcnCrawlerService } from './apprcn.crawler.service';
import { IfanrCrawlerService } from './ifanr.crawler.service';
import { Kr36CrawlerService } from './36kr.crawler.service';
import { OschinaCrawlerService } from './oschina.crawler.service';

@UseGuards(JwtAuthGuard, AdminAccessGuard)
@Controller('crawler')
export class CrawlerController {
  constructor(
    private readonly manualGate: CrawlerManualTriggerGate,
    private readonly v2exCrawlerService: V2exCrawlerService,
    private readonly appinnCrawlerService: AppinnCrawlerService,
    private readonly iplaysoftCrawlerService: IplaysoftCrawlerService,
    private readonly producthuntCrawlerService: ProducthuntCrawlerService,
    private readonly juejinCrawlerService: JuejinCrawlerService,
    private readonly sspaiCrawlerService: SspaiCrawlerService,
    private readonly apprcnCrawlerService: ApprcnCrawlerService,
    private readonly ifanrCrawlerService: IfanrCrawlerService,
    private readonly kr36CrawlerService: Kr36CrawlerService,
    private readonly oschinaCrawlerService: OschinaCrawlerService,
  ) {}

  /**
   * 手动触发 V2EX 爬虫
   */
  @Post('v2ex')
  async triggerV2exCrawler() {
    const count = await this.manualGate.run('v2ex', () => this.v2exCrawlerService.crawl());
    return {
      success: true,
      message: `V2EX 爬虫执行完成，新增 ${count} 个工具`,
      newTools: count,
    };
  }

  /**
   * 手动触发小众软件爬虫
   */
  @Post('appinn')
  async triggerAppinnCrawler() {
    const count = await this.manualGate.run('appinn', () => this.appinnCrawlerService.crawl());
    return {
      success: true,
      message: `小众软件爬虫执行完成，新增 ${count} 个工具`,
      newTools: count,
    };
  }

  /**
   * 手动触发异次元软件爬虫
   */
  @Post('iplaysoft')
  async triggerIplaysoftCrawler() {
    const count = await this.manualGate.run('iplaysoft', () => this.iplaysoftCrawlerService.crawl());
    return {
      success: true,
      message: `异次元软件爬虫执行完成，新增 ${count} 个工具`,
      newTools: count,
    };
  }

  /**
   * 手动触发 Product Hunt 爬虫
   */
  @Post('producthunt')
  async triggerProducthuntCrawler() {
    const count = await this.manualGate.run('producthunt', () => this.producthuntCrawlerService.crawl());
    return {
      success: true,
      message: `Product Hunt 爬虫执行完成，新增 ${count} 个工具`,
      newTools: count,
    };
  }

  /**
   * 手动触发掘金爬虫
   */
  @Post('juejin')
  async triggerJuejinCrawler() {
    const count = await this.manualGate.run('juejin', () => this.juejinCrawlerService.crawl());
    return {
      success: true,
      message: `掘金爬虫执行完成，新增 ${count} 个工具`,
      newTools: count,
    };
  }

  /**
   * 手动触发少数派爬虫
   */
  @Post('sspai')
  async triggerSspaiCrawler() {
    const count = await this.manualGate.run('sspai', () => this.sspaiCrawlerService.crawl());
    return {
      success: true,
      message: `少数派爬虫执行完成，新增 ${count} 个工具`,
      newTools: count,
    };
  }

  /**
   * 手动触发反斗软件爬虫
   */
  @Post('apprcn')
  async triggerApprcnCrawler() {
    const count = await this.manualGate.run('apprcn', () => this.apprcnCrawlerService.crawl());
    return {
      success: true,
      message: `反斗软件爬虫执行完成，新增 ${count} 个工具`,
      newTools: count,
    };
  }

  /**
   * 手动触发爱范儿爬虫
   */
  @Post('ifanr')
  async triggerIfanrCrawler() {
    const count = await this.manualGate.run('ifanr', () => this.ifanrCrawlerService.crawl());
    return {
      success: true,
      message: `爱范儿爬虫执行完成，新增 ${count} 个工具`,
      newTools: count,
    };
  }

  /**
   * 手动触发36氪爬虫
   */
  @Post('36kr')
  async trigger36krCrawler() {
    const count = await this.manualGate.run('36kr', () => this.kr36CrawlerService.crawl());
    return {
      success: true,
      message: `36氪爬虫执行完成，新增 ${count} 个工具`,
      newTools: count,
    };
  }

  /**
   * 手动触发开源中国爬虫
   */
  @Post('oschina')
  async triggerOschinaCrawler() {
    const count = await this.manualGate.run('oschina', () => this.oschinaCrawlerService.crawl());
    return {
      success: true,
      message: `开源中国爬虫执行完成，新增 ${count} 个工具`,
      newTools: count,
    };
  }
}
