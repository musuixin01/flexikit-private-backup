import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { createValidationException } from './common/errors/validation-error';
import { API_VERSIONING_OPTIONS } from './common/versioning/api-versioning';
import { isCorsOriginAllowed, parseCorsOriginList } from './common/security/cors-origin-policy';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableVersioning(API_VERSIONING_OPTIONS);
  
  // 全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: createValidationException,
  }));
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  
  // CORS 配置：Web/Tauri 使用固定白名单；Browser Companion 生产环境必须显式配置扩展 Origin
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get('NODE_ENV') || 'development';
  const production = nodeEnv === 'production';
  const webCorsOrigins = production
    ? parseCorsOriginList(configService.get<string>('CORS_ORIGIN') || 'https://flexikit.app')
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://tauri.localhost',
        'tauri://localhost',
      ];
  const extensionCorsOrigins = parseCorsOriginList(
    configService.get<string>('CORS_EXTENSION_ORIGINS'),
  );
  const corsOrigins = new Set([...webCorsOrigins, ...extensionCorsOrigins]);
  const allowDevelopmentExtensionOrigins = !production;

  app.enableCors({
    origin: (origin, callback) => {
      callback(
        null,
        isCorsOriginAllowed(
          origin,
          corsOrigins,
          allowDevelopmentExtensionOrigins,
        ),
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Request-Id', 'X-FlexiKit-Auth-Mode'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400,
  });
  
  const port = configService.get('PORT') || 3001;
  await app.listen(port);
  logger.log('Server running on http://localhost:' + port);
  logger.log('Environment: ' + nodeEnv);
  logger.log(
    'CORS origins: '
      + [...corsOrigins].join(', ')
      + (allowDevelopmentExtensionOrigins ? ', chrome-extension://<development-id>' : ''),
  );
}
bootstrap();
