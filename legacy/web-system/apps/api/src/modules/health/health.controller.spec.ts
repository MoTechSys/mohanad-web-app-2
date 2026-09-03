import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: { pingDb: async () => true },
        },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('returns ok when DB is up', async () => {
    const res = await controller.check();
    expect(res.status).toBe('ok');
    expect(res.database.status).toBe('ok');
    expect(typeof res.database.latencyMs).toBe('number');
    expect(typeof res.uptimeSeconds).toBe('number');
    expect(typeof res.timestamp).toBe('string');
  });
});
