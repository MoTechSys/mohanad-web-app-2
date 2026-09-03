/**
 * SupplierTransactionsService — Jest spec.
 *
 * Focus: golden rule #6 (locked balance) + payment reduces supplier debt +
 * cancel reverses the original signed delta.
 */
import { BadRequestException } from '@nestjs/common';

import { SupplierTransactionsService } from '../supplier-transactions.service';

const SCOPE = { storeId: 's1', actorId: 'u1' };

function buildPrisma(opts: { lockedBalance: number; original?: Record<string, unknown> }) {
  const supplierUpdate = jest.fn().mockResolvedValue({});
  const tx = {
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ current_balance: opts.lockedBalance }]),
    supplier: { update: supplierUpdate },
    supplierTransaction: {
      create: jest.fn().mockResolvedValue({ id: 'stx1' }),
      update: jest.fn().mockResolvedValue({ id: 'stx1' }),
    },
    auditLog: { create: jest.fn() },
    notification: { create: jest.fn() },
    setting: { findUnique: jest.fn().mockResolvedValue({ value: 50000 }) },
  };
  const prisma = {
    supplier: {
      findFirst: jest.fn().mockResolvedValue({ id: 'sup1', currentBalance: 0, name: 'مورد' }),
    },
    supplierTransaction: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          opts.original ?? { id: 'stx0', type: 'PAYMENT', amount: 200, cancelledAt: null },
        ),
    },
    $transaction: jest.fn().mockImplementation(async (cb: (db: typeof tx) => unknown) => cb(tx)),
  } as unknown as ConstructorParameters<typeof SupplierTransactionsService>[0];
  return { prisma, supplierUpdate };
}

describe('SupplierTransactionsService.createPayment', () => {
  it('reduces supplier debt using the locked balance', async () => {
    const { prisma, supplierUpdate } = buildPrisma({ lockedBalance: 2000 });
    const svc = new SupplierTransactionsService(prisma);
    await svc.createPayment(SCOPE, 'sup1', { amount: 700 } as never);
    // 2000 - 700 = 1300
    expect(supplierUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentBalance: 1300 }) }),
    );
  });

  it('rejects non-positive payment', async () => {
    const { prisma } = buildPrisma({ lockedBalance: 2000 });
    const svc = new SupplierTransactionsService(prisma);
    await expect(svc.createPayment(SCOPE, 'sup1', { amount: 0 } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('SupplierTransactionsService.cancel', () => {
  it('reverses a PAYMENT (adds the amount back) from the locked balance', async () => {
    // original PAYMENT of 200 → cancel adds 200 back.
    const { prisma, supplierUpdate } = buildPrisma({
      lockedBalance: 1000,
      original: { id: 'stx0', type: 'PAYMENT', amount: 200, cancelledAt: null },
    });
    const svc = new SupplierTransactionsService(prisma);
    await svc.cancel(SCOPE, 'sup1', 'stx0', { reason: 'خطأ مدخل' } as never);
    expect(supplierUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentBalance: 1200 }) }),
    );
  });
});
