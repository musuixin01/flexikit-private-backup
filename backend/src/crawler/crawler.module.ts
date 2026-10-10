import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DiscoveryModule } from '../discovery/discovery.module';
import { AdminModule } from '../admin/admin.module';
import { CrawlerManualTriggerGate } from './crawler-manual-trigger.gate';
import { CrawlerService } from './crawler.service';
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
import { CrawlerController } from './crawler.controller';

@Module({
  imports: [
    DiscoveryModule,
    AdminModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [CrawlerController],
  providers: [
    CrawlerService,
    CrawlerManualTriggerGate,
    V2exCrawlerService,
    AppinnCrawlerService,
    IplaysoftCrawlerService,
    ProducthuntCrawlerService,
    JuejinCrawlerService,
    SspaiCrawlerService,
    ApprcnCrawlerService,
    IfanrCrawlerService,
    Kr36CrawlerService,
    OschinaCrawlerService,
  ],
  exports: [
    CrawlerService,
    V2exCrawlerService,
    AppinnCrawlerService,
    IplaysoftCrawlerService,
    ProducthuntCrawlerService,
    JuejinCrawlerService,
    SspaiCrawlerService,
    ApprcnCrawlerService,
    IfanrCrawlerService,
    Kr36CrawlerService,
    OschinaCrawlerService,
  ],
})
export class CrawlerModule {}
