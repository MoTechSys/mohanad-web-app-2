/**
 * DailyIncomeService — Jest spec.
 *
 * Focus: create/approve/cancel run inside a transaction and write an audit row
 * (golden rule #3), and cancel/approve guard against invalid state.
 */
import { ConflictException } from '@nestjs/common';

import { DailyIncomeService } from '../daily-income.service';

const SCOPE = { storeId: 's1', actorId: 'u1' };

function buildPrisma(record?: Record<string, unknown> | null) {
  const auditCreate = jest.fn();
  const tx = {
    dailyIncome: {
      create: jest.fn().mockResolvedValue({ id: 'di1', amount: 1200, source: 'نقدي' }),
      update: jest.fn().mockResolvedValue({ id: 'di1' }),
    },
    auditLog: { create: auditCreate },
  };
  const prisma = {
    dailyIncome: { findFirst: jest.fn().mockResolvedValue(record ?? null) },
    $transaction: jest.fn().mockImplementation(async (cb: (db: typeof tx) => unknown) => cb(tx)),
  } as unknown as ConstructorParameters<typeof DailyIncomeService>[0];
  return { prisma, auditCreate, tx };
}

describe('DailyIncomeService.create', () => {
  it('creates the record and writes an audit log (rule #3)', async () => {
    const { prisma, auditCreate } = buildPrisma();
    const svc = new DailyIncomeService(prisma);
    const row = await svc.create(SCOPE, { amount: 1200, source: 'نقدي' } as never);
    expect(row).toMatchObject({ id: 'di1' });
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate.mock.calls[0][0].data.entityType).toBe('daily_income');
  });
});

describe('DailyIncomeService.approve', () => {
  it('rejects approving a cancelled record', async () => {
    const { prisma } = buildPrisma({ id: 'di1', cancelledAt: new Date(), isApproved: false });
    const svc = new DailyIncomeService(prisma);
    await expect(svc.approve(SCOPE, 'di1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects approving an already-approved record', async () => {
    const { prisma } = buildPrisma({ id: 'di1', cancelledAt: null, isApproved: true });
    const svc = new DailyIncomeService(prisma);
    await expect(svc.approve(SCOPE, 'di1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('approves a valid record + audits', async () => {
    const { prisma, auditCreate } = buildPrisma({
      id: 'di1',
      cancelledAt: null,
      isApproved: false,
    });
    const svc = new DailyIncomeService(prisma);
    await svc.approve(SCOPE, 'di1');
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });
});

describe('DailyIncomeService.cancel', () => {
  it('rejects cancelling an already-cancelled record', async () => {
    const { prisma } = buildPrisma({ id: 'di1', cancelledAt: new Date() });
    const svc = new DailyIncomeService(prisma);
    await expect(svc.cancel(SCOPE, 'di1', { reason: 'x' } as never)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
