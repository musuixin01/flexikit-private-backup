import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { parseAccessTokenTtlSeconds } from './access-session-lifecycle';
import { RefreshSession } from './refresh-session.entity';
import {
  normalizeAuthClientContext,
  type AuthClientContext,
  type AuthClientType,
} from './auth-client-context';
import {
  createRefreshTokenMaterial,
  matchesRefreshTokenSecret,
  parseRefreshToken,
  parseRefreshTokenTtlSeconds,
} from './refresh-session-lifecycle';

export interface JwtPayload {
  username: string;
  sub: number;
  token_use?: 'access' | 'refresh';
  sid?: string;
}

export interface AccessTokenResult {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  expires_at: string;
}

export interface RefreshTokenResult {
  refresh_token: string;
  refresh_expires_in: number;
  refresh_expires_at: string;
}

export interface AuthSessionResult {
  session_id: string;
  client_type: AuthClientType;
  client_instance_id: string | null;
  client_name: string | null;
}

export interface RefreshSessionResult
  extends RefreshTokenResult, AuthSessionResult {}

export interface AuthResult
  extends AccessTokenResult, RefreshTokenResult, AuthSessionResult {}

export interface ManagedAuthSession {
  session_id: string;
  client_type: AuthClientType;
  client_instance_id: string | null;
  client_name: string | null;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  is_current: boolean;
}

export interface SafeUser {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  avatar: string | null;
  avatarType: string | null;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  created_at: Date;
}

@Injectable()
export class AuthService {
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshSession)
    private readonly refreshSessionsRepository: Repository<RefreshSession>,
    private readonly dataSource: DataSource,
  ) {
    const configuredAccessTtl = this.configService.get<string | number>('ACCESS_TOKEN_TTL')
      ?? this.configService.get<string | number>('JWT_EXPIRES_IN');
    this.accessTokenTtlSeconds = parseAccessTokenTtlSeconds(configuredAccessTtl);

    const configuredRefreshTtl = this.configService.get<string | number>('REFRESH_TOKEN_TTL');
    this.refreshTokenTtlSeconds = parseRefreshTokenTtlSeconds(configuredRefreshTtl);
  }

  async validateUser(username: string, pass: string): Promise<SafeUser | null> {
    const user = await this.usersService.findByUsername(username);
    if (
      user
      && user.status === 'active'
      && await bcrypt.compare(pass, user.password_hash)
    ) {
      const { password_hash, ...result } = user;
      return result as SafeUser;
    }
    return null;
  }

  private issueAccessToken(
    user: Pick<SafeUser, 'id' | 'username'>,
    sessionId: string,
  ): AccessTokenResult {
    const payload: JwtPayload = {
      username: user.username,
      sub: user.id,
      token_use: 'access',
      sid: sessionId,
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.accessTokenTtlSeconds,
    });
    const decoded = this.jwtService.decode<{ exp?: number }>(accessToken);
    const expiresAtSeconds = typeof decoded?.exp === 'number'
      ? decoded.exp
      : Math.floor(Date.now() / 1000) + this.accessTokenTtlSeconds;

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.accessTokenTtlSeconds,
      expires_at: new Date(expiresAtSeconds * 1000).toISOString(),
    };
  }

  private async createRefreshSession(
    user: Pick<SafeUser, 'id'>,
    clientContext: AuthClientContext,
    repository: Repository<RefreshSession> = this.refreshSessionsRepository,
  ): Promise<RefreshSessionResult> {
    const material = createRefreshTokenMaterial();
    const expiresAt = new Date(
      Date.now() + this.refreshTokenTtlSeconds * 1000,
    );

    const session = repository.create({
      id: material.sessionId,
      user_id: user.id,
      tokenHash: material.tokenHash,
      clientType: clientContext.clientType,
      clientInstanceId: clientContext.clientInstanceId,
      clientName: clientContext.clientName,
      expiresAt,
      revokedAt: null,
      lastUsedAt: null,
    });

    await repository.save(session);

    return {
      refresh_token: material.token,
      refresh_expires_in: this.refreshTokenTtlSeconds,
      refresh_expires_at: expiresAt.toISOString(),
      session_id: material.sessionId,
      client_type: clientContext.clientType,
      client_instance_id: clientContext.clientInstanceId,
      client_name: clientContext.clientName,
    };
  }

  private buildAuthResult(
    user: Pick<SafeUser, 'id' | 'username'>,
    refreshToken: RefreshSessionResult,
  ): AuthResult {
    return {
      ...this.issueAccessToken(user, refreshToken.session_id),
      ...refreshToken,
    };
  }

  async login(
    user: SafeUser,
    clientContext: AuthClientContext = normalizeAuthClientContext({}),
    manager?: EntityManager,
  ): Promise<AuthResult> {
    const refreshToken = await this.createRefreshSession(
      user, clientContext, manager?.getRepository(RefreshSession) ?? this.refreshSessionsRepository,
    );
    return this.buildAuthResult(user, refreshToken);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) {
      throw new UnauthorizedException('Refresh Token 无效或已失效');
    }

    const rotated = await this.dataSource.transaction(async manager => {
      const repository = manager.getRepository(RefreshSession);
      const session = await repository.findOne({
        where: { id: parsed.sessionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!session || session.revokedAt) return null;

      const now = new Date();
      if (session.expiresAt.getTime() <= now.getTime()) {
        session.revokedAt = now;
        await repository.save(session);
        return null;
      }

      if (!matchesRefreshTokenSecret(parsed.secret, session.tokenHash)) {
        session.revokedAt = now;
        await repository.save(session);
        return null;
      }

      const user = await manager.getRepository(User).findOne({
        where: { id: session.user_id },
      });
      if (!user || user.status !== 'active') {
        session.revokedAt = now;
        await repository.save(session);
        return null;
      }

      const material = createRefreshTokenMaterial(session.id);
      session.tokenHash = material.tokenHash;
      session.lastUsedAt = now;
      await repository.save(session);

      const refreshExpiresIn = Math.max(
        1,
        Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000),
      );

      return this.buildAuthResult(user, {
        refresh_token: material.token,
        refresh_expires_in: refreshExpiresIn,
        refresh_expires_at: session.expiresAt.toISOString(),
        session_id: session.id,
        client_type: session.clientType,
        client_instance_id: session.clientInstanceId,
        client_name: session.clientName,
      });
    });

    if (!rotated) {
      throw new UnauthorizedException('Refresh Token 无效或已失效');
    }

    return rotated;
  }

  async listManagedSessions(
    userId: number,
    currentSessionId: string | null,
  ): Promise<ManagedAuthSession[]> {
    const sessions = await this.refreshSessionsRepository.find({
      where: {
        user_id: userId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return sessions
      .map((session) => ({
        session_id: session.id,
        client_type: session.clientType,
        client_instance_id: session.clientInstanceId,
        client_name: session.clientName,
        created_at: session.createdAt.toISOString(),
        last_used_at: session.lastUsedAt?.toISOString() ?? null,
        expires_at: session.expiresAt.toISOString(),
        is_current: currentSessionId === session.id,
      }))
      .sort((left, right) => {
        if (left.is_current !== right.is_current) {
          return left.is_current ? -1 : 1;
        }
        const leftActivity = Date.parse(left.last_used_at ?? left.created_at);
        const rightActivity = Date.parse(right.last_used_at ?? right.created_at);
        return rightActivity - leftActivity;
      });
  }

  async revokeManagedSession(
    userId: number,
    sessionId: string,
    currentSessionId: string | null,
  ): Promise<{ session_id: string; revoked_at: string }> {
    if (!currentSessionId) {
      throw new BadRequestException('当前登录会话缺少 Session 标识，请重新登录后管理设备');
    }

    if (sessionId === currentSessionId) {
      throw new BadRequestException('当前设备请使用退出登录');
    }

    const session = await this.refreshSessionsRepository.findOne({
      where: {
        id: sessionId,
        user_id: userId,
      },
    });

    const now = new Date();
    if (
      !session
      || session.revokedAt
      || session.expiresAt.getTime() <= now.getTime()
    ) {
      throw new NotFoundException('登录会话不存在或已失效');
    }

    session.revokedAt = now;
    await this.refreshSessionsRepository.save(session);

    return {
      session_id: session.id,
      revoked_at: now.toISOString(),
    };
  }

  async logout(
    userId: number,
    currentSessionId: string | null,
    refreshToken?: string,
  ): Promise<{ session_id: string; revoked_at: string }> {
    let targetSessionId = currentSessionId;
    let fallbackSecret: string | null = null;

    if (!targetSessionId) {
      if (!refreshToken) {
        throw new BadRequestException(
          '当前登录会话缺少 Session 标识，请重新登录后再执行服务端登出',
        );
      }

      const parsed = parseRefreshToken(refreshToken);
      if (!parsed) {
        throw new UnauthorizedException('Refresh Token 无效或已失效');
      }
      targetSessionId = parsed.sessionId;
      fallbackSecret = parsed.secret;
    }

    const revoked = await this.dataSource.transaction(async manager => {
      const repository = manager.getRepository(RefreshSession);
      const session = await repository.findOne({
        where: {
          id: targetSessionId,
          user_id: userId,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!session) {
        return null;
      }

      if (
        fallbackSecret
        && !matchesRefreshTokenSecret(fallbackSecret, session.tokenHash)
      ) {
        return null;
      }

      if (!session.revokedAt) {
        session.revokedAt = new Date();
        await repository.save(session);
      }

      return {
        session_id: session.id,
        revoked_at: session.revokedAt.toISOString(),
      };
    });

    if (!revoked) {
      throw new UnauthorizedException('登录会话不存在或已失效');
    }

    return revoked;
  }

  async register(
    username: string,
    email: string,
    password: string,
    clientContext: AuthClientContext = normalizeAuthClientContext({}),
  ): Promise<AuthResult> {
    const existingUser = await this.usersService.findByUsername(username);
    if (existingUser) {
      throw new BadRequestException('用户名已存在');
    }

    const existingEmail = await this.usersService.findByEmail(email);
    if (existingEmail) {
      throw new BadRequestException('邮箱已被注册');
    }

    const hashed = await bcrypt.hash(password, 12);

    return this.dataSource.transaction(async manager => {
      const usersRepository = manager.getRepository(User);
      const refreshRepository = manager.getRepository(RefreshSession);

      const newUser = usersRepository.create({
        username,
        email,
        password_hash: hashed,
      });
      const savedUser = await usersRepository.save(newUser);
      const refreshToken = await this.createRefreshSession(
        savedUser,
        clientContext,
        refreshRepository,
      );

      return this.buildAuthResult(savedUser, refreshToken);
    });
  }
}
