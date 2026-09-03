import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Health endpoint — published at `/api/v1/health` after the global
 * prefix is applied. Throttling is skipped so monitors don't get rate limited.
 *
 * Returned shape (raw — the global ResponseFormatInterceptor wraps it):
 *
 *   {
 *     status: 'ok' | 'degraded',
 *     uptimeSeconds: number,
 *     timestamp: string (ISO),
 *     version: string,
 *     database: { status: 'ok' | 'down', latencyMs: number }
 *   }
 */
@ApiTags('Health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness + DB readiness check' })
  @ApiOkResponse({
    description: 'Service status',
    schema: {
      example: {
        data: {
          status: 'ok',
          uptimeSeconds: 12,
          timestamp: '2026-04-27T22:30:00.000Z',
          version: '0.1.0',
          database: { status: 'ok', latencyMs: 3 },
        },
        meta: {
          requestId: '4c…b2',
          timestamp: '2026-04-27T22:30:00.000Z',
          version: '0.1.0',
        },
      },
    },
  })
  async check() {
    const start = Date.now();
    const dbOk = await this.prisma.pingDb();
    const latencyMs = Date.now() - start;
    return {
      status: dbOk ? ('ok' as const) : ('degraded' as const),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION ?? '0.1.0',
      database: { status: dbOk ? ('ok' as const) : ('down' as const), latencyMs },
    };
  }
}
