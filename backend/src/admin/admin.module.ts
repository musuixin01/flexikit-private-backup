import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Tool } from '../tools/tool.entity';
import { Favorite } from '../favorites/favorite.entity';
import { RefreshSession } from '../auth/refresh-session.entity';
import { AiModule } from '../ai/ai.module';
import { AdminAuditEvent } from './admin-audit-event.entity';
import { AdminAccessService } from './admin-access.service';
import { AdminAccessGuard } from './admin-access.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    AiModule,
    TypeOrmModule.forFeature([
      User,
      Tool,
      Favorite,
      RefreshSession,
      AdminAuditEvent,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminAccessService, AdminAccessGuard, AdminService],
  exports: [AdminAccessGuard],
})
export class AdminModule {}
