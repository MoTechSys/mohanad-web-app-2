import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@SkipThrottle() // health دائماً متاح
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
        status: 'ok',
        uptimeSeconds: 12,
        timestamp: '2026-04-27T22:30:00.000Z',
        version: '0.1.0',
        database: 'ok',
      },
    },
  })
  async check() {
    const dbOk = await this.prisma.pingDb();
    return {
      status: dbOk ? 'ok' : 'degraded',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION ?? '0.1.0',
      database: dbOk ? 'ok' : 'down',
    };
  }
}
