import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { RefreshSession } from './refresh-session.entity';
import { ExtensionPairing } from './extension-pairing.entity';
import { ExtensionPairingService } from './extension-pairing.service';
import { ExtensionPairingController } from './extension-pairing.controller';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([RefreshSession, ExtensionPairing]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy, ExtensionPairingService],
  controllers: [AuthController, ExtensionPairingController],
  exports: [AuthService],
})
export class AuthModule {}