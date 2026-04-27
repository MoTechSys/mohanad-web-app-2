/**
 * Bootstrap entry — Grocery System API
 * - Helmet للحماية الأساسية
 * - cookie-parser لـ refresh token (httpOnly cookie)
 * - CORS مع credentials لـ الواجهة (Vite)
 * - Swagger + Scalar UI على /docs و /reference
 * - Pino structured logger
 */

import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import 'reflect-metadata';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // ─── Logger (pino) ─────────────────────────────
  app.useLogger(app.get(Logger));

  // ─── Security ──────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false, // الواجهة منفصلة (Vite)
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());

  // ─── CORS ──────────────────────────────────────
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
  app.enableCors({
    origin: webOrigin.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: ['Idempotency-Key'],
  });

  // ─── Validation ─────────────────────────────────
  // نستخدم nestjs-zod في كل DTOs (يُضاف في المرحلة 2) — لذا لا حاجة لـ ValidationPipe هنا.

  app.setGlobalPrefix('api', { exclude: ['health', 'docs', 'reference'] });

  // ─── OpenAPI / Swagger ─────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Grocery System API')
    .setDescription('نظام إدارة بقالة أونلاين — REST API')
    .setVersion(process.env.APP_VERSION ?? '0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Scalar UI (أنيق وأخف)
  app.use(
    '/reference',
    apiReference({
      spec: { content: document },
      theme: 'purple',
    }),
  );

  // ─── Start ─────────────────────────────────────
  const port = Number.parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');

  const logger = new NestLogger('Bootstrap');
  logger.log(`🚀 API running on http://localhost:${port}`);
  logger.log(`📘 Swagger:  http://localhost:${port}/docs`);
  logger.log(`📗 Scalar:   http://localhost:${port}/reference`);
  logger.log(`❤️  Health:   http://localhost:${port}/health`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ Failed to bootstrap API:', err);
  process.exit(1);
});
