import {
  ConflictException, GoneException, HttpException, HttpStatus, Injectable,
  ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import type { SafeUser } from './auth.service';
import { ExtensionPairing } from './extension-pairing.entity';
import type { StartExtensionPairDto, CompleteExtensionPairDto } from './dto/extension-pair.dto';
import { EXTENSION_PAIR_TTL_MS, extensionPairVerifierHash, generateExtensionPairCode, matchesExtensionPairVerifier } from './extension-pair-lifecycle';

type RequestQuota = { windowStart: number; count: number };
const START_QUOTA_WINDOW_MS = 60_000;
const START_QUOTA_LIMIT = 8;
const MAX_LIVE_PAIRS = 1500;

@Injectable()
export class ExtensionPairingService {
  private readonly quotas = new Map<string, RequestQuota>();

  constructor(
    @InjectRepository(ExtensionPairing)
    private readonly pairings: Repository<ExtensionPairing>,
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  private checkStartQuota(ip: string): void {
    const now = Date.now();
    for (const [key, entry] of this.quotas) {
      if (now - entry.windowStart > START_QUOTA_WINDOW_MS) this.quotas.delete(key);
    }
    const entry = this.quotas.get(ip);
    const next = entry && now - entry.windowStart <= START_QUOTA_WINDOW_MS
      ? { windowStart: entry.windowStart, count: entry.count + 1 }
      : { windowStart: now, count: 1 };
    this.quotas.set(ip, next);
    if (next.count > START_QUOTA_LIMIT) throw new HttpException('配对请求过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
  }

  async start(dto: StartExtensionPairDto, ip: string) {
    this.checkStartQuota(ip);
    await this.pairings.createQueryBuilder().delete()
      .where('expires_at <= :now', { now: new Date() }).execute();
    const liveCount = await this.pairings.count({ where: { expiresAt: MoreThan(new Date()), consumedAt: IsNull() } });
    if (liveCount >= MAX_LIVE_PAIRS) throw new ServiceUnavailableException('配对繁忙，请稍后重试');

    const activeForDevice = await this.pairings.count({
      where: { clientInstanceId: dto.client_instance_id, expiresAt: MoreThan(new Date()), consumedAt: IsNull() },
    });
    if (activeForDevice >= 3) throw new HttpException('当前扩展已有配对码，请使用已有配对码或稍后重试', HttpStatus.TOO_MANY_REQUESTS);

    for (let tries = 0; tries < 5; tries++) {
      const code = generateExtensionPairCode();
      const exists = await this.pairings.exist({ where: { code } });
      if (exists) continue;
      await this.pairings.save(this.pairings.create({
        code, clientInstanceId: dto.client_instance_id,
        verifierHash: extensionPairVerifierHash(dto.verifier),
        expiresAt: new Date(Date.now() + EXTENSION_PAIR_TTL_MS),
        approvedUserId: null, consumedAt: null, failedClaims: 0,
      }));
      return { code, expires_at: new Date(Date.now() + EXTENSION_PAIR_TTL_MS).toISOString() };
    }
    throw new ConflictException('配对码生成失败，请重试');
  }

  async approve(code: string, userId: number): Promise<{ paired: boolean }> {
    const user = await this.users.findOne(userId);
    if (!user || user.status !== 'active') throw new UnauthorizedException('账号已失效');
    return this.dataSource.transaction(async manager => {
      const repo = manager.getRepository(ExtensionPairing);
      const pair = await repo.findOne({ where: { code }, lock: { mode: 'pessimistic_write' } });
      if (!pair || pair.expiresAt.getTime() <= Date.now() || pair.consumedAt) {
        throw new GoneException('配对码不存在或已失效');
      }
      if (pair.approvedUserId !== null) throw new ConflictException('配对码已确认');
      pair.approvedUserId = userId;
      await repo.save(pair);
      return { paired: true };
    });
  }

  async complete(dto: CompleteExtensionPairDto) {
    const result = await this.dataSource.transaction(async manager => {
      const repo = manager.getRepository(ExtensionPairing);
      const pair = await repo.findOne({ where: { code: dto.code }, lock: { mode: 'pessimistic_write' } });
      if (!pair || pair.expiresAt.getTime() <= Date.now() || pair.consumedAt) {
        throw new GoneException('配对码已失效，请重新开始');
      }
      if (pair.clientInstanceId !== dto.client_instance_id
        || !matchesExtensionPairVerifier(dto.verifier, pair.verifierHash)) {
        pair.failedClaims += 1;
        if (pair.failedClaims >= 5) pair.expiresAt = new Date();
        await repo.save(pair);
        return { status: 'invalid' as const };
      }
      if (!pair.approvedUserId) return { status: 'pending' as const };

      const user = await manager.getRepository(User).findOne({ where: { id: pair.approvedUserId } });
      if (!user || user.status !== 'active') throw new UnauthorizedException('账号已失效');
      pair.consumedAt = new Date();
      await repo.save(pair);
      const { password_hash: _hash, ...safeUser } = user;
      const auth = await this.auth.login(
        safeUser as SafeUser,
        {
          clientType: 'extension', clientInstanceId: dto.client_instance_id,
          clientName: 'FlexiKit Browser Companion',
        },
        manager,
      );
      return { status: 'connected' as const, auth };
    });
    if (result.status === 'invalid') throw new UnauthorizedException('配对设备不匹配');
    return result;
  }
}
