/**
 * Bootstrap entry — Grocery System API
 *
 *   • Helmet (basic security)
 *   • cookie-parser (Phase 2 refresh-token cookie)
 *   • CORS with credentials
 *   • Global prefix /api/v1
 *   • Scalar API reference  → /api/v1/docs
 *   • OpenAPI JSON          → /api/v1/docs-json
 *   • Pino structured logger
 *   • Graceful shutdown hooks (SIGTERM/SIGINT)
 */

import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import 'reflect-metadata';

import { AppModule } from './app.module';

const API_PREFIX = 'api/v1';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // ─── Logger (pino) ─────────────────────────────
  app.useLogger(app.get(Logger));

  // ─── Security ──────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false, // Frontend served separately by Vite/Vercel.
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
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['Idempotency-Key', 'X-Request-Id'],
  });

  // ─── Global prefix ─────────────────────────────
  app.setGlobalPrefix(API_PREFIX);

  // ─── OpenAPI / Scalar ──────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Grocery System API')
    .setDescription('نظام إدارة بقالة أونلاين — REST API (v1)')
    .setVersion(process.env.APP_VERSION ?? '0.1.0')
    .addServer(`/${API_PREFIX}`)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);

  // Expose JSON spec at /api/v1/docs-json (no UI). Use a small handler so we
  // don't depend on Swagger UI assets — Scalar is the primary doc UI.
  const jsonPath = `/${API_PREFIX}/docs-json`;
  app.use(jsonPath, (_req: unknown, res: { json: (b: unknown) => unknown }) => {
    res.json(document);
  });

  // Scalar (Modern, lightweight UI).
  app.use(
    `/${API_PREFIX}/docs`,
    apiReference({
      spec: { url: jsonPath },
      theme: 'purple',
    }),
  );

  // ─── Graceful shutdown ─────────────────────────
  app.enableShutdownHooks();

  // ─── Start ─────────────────────────────────────
  const port = Number.parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');

  const logger = new NestLogger('Bootstrap');
  logger.log(`🚀 API running on http://localhost:${port}/${API_PREFIX}`);
  logger.log(`📘 Docs (Scalar): http://localhost:${port}/${API_PREFIX}/docs`);
  logger.log(`📄 OpenAPI JSON:  http://localhost:${port}/${API_PREFIX}/docs-json`);
  logger.log(`❤️  Health:        http://localhost:${port}/${API_PREFIX}/health`);
}

bootstrap().catch((err) => {
  console.error('❌ Failed to bootstrap API:', err);
  process.exit(1);
});
