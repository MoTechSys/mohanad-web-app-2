/**
 * CustomerTransactionsService — Jest spec.
 *
 * Focus: golden rule #6 (balance read comes from the locked row inside the tx,
 * not the pre-tx fetch) + correct debt/payment math + credit-limit guard.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';

import { CustomerTransactionsService } from '../customer-transactions.service';

const SCOPE = { storeId: 's1', actorId: 'u1', permissions: [] as string[] };

/**
 * Builds a Prisma mock where the in-transaction balance ($queryRawUnsafe FOR
 * UPDATE) returns `lockedBalance`, so we can assert the service computes the
 * new balance from the LOCKED value (not from the pre-tx customer fetch).
 */
function buildPrisma(opts: {
  customer: { currentBalance: number; status?: string; creditLimit?: number | null };
  lockedBalance: number;
}) {
  const customerUpdate = jest.fn().mockResolvedValue({});
  const txCreate = jest.fn().mockResolvedValue({ id: 'tx1' });
  const auditCreate = jest.fn();
  const notifCreate = jest.fn();
  const settingFind = jest.fn().mockResolvedValue({ value: 50000 });

  const tx = {
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ current_balance: opts.lockedBalance }]),
    customer: { update: customerUpdate },
    customerTransaction: { create: txCreate },
    auditLog: { create: auditCreate },
    notification: { create: notifCreate },
    setting: { findUnique: settingFind },
  };

  const prisma = {
    customer: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'c1',
        currentBalance: opts.customer.currentBalance,
        status: opts.customer.status ?? 'ACTIVE',
        creditLimit: opts.customer.creditLimit ?? null,
        name: 'عميل',
      }),
    },
    $transaction: jest.fn().mockImplementation(async (cb: (db: typeof tx) => unknown) => cb(tx)),
  } as unknown as ConstructorParameters<typeof CustomerTransactionsService>[0];

  return { prisma, customerUpdate, txCreate, auditCreate };
}

describe('CustomerTransactionsService.createDebt', () => {
  it('computes new balance from the LOCKED row (not the pre-tx fetch)', async () => {
    // pre-tx fetch says 0, but the locked row says 1000 (a concurrent write landed).
    const { prisma, customerUpdate } = buildPrisma({
      customer: { currentBalance: 0, creditLimit: null },
      lockedBalance: 1000,
    });
    const svc = new CustomerTransactionsService(prisma);
    await svc.createDebt(SCOPE, 'c1', { amount: 500 } as never);
    // 1000 (locked) + 500 = 1500 — proves the lock value is authoritative.
    expect(customerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentBalance: 1500 }) }),
    );
  });

  it('rejects non-positive amounts', async () => {
    const { prisma } = buildPrisma({ customer: { currentBalance: 0 }, lockedBalance: 0 });
    const svc = new CustomerTransactionsService(prisma);
    await expect(svc.createDebt(SCOPE, 'c1', { amount: 0 } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('blocks an over-limit debt without approval', async () => {
    const { prisma } = buildPrisma({
      customer: { currentBalance: 0, creditLimit: 500 },
      lockedBalance: 0,
    });
    const svc = new CustomerTransactionsService(prisma);
    await expect(svc.createDebt(SCOPE, 'c1', { amount: 600 } as never)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('CustomerTransactionsService.createPayment', () => {
  it('subtracts from the LOCKED balance', async () => {
    const { prisma, customerUpdate } = buildPrisma({
      customer: { currentBalance: 0 },
      lockedBalance: 800,
    });
    const svc = new CustomerTransactionsService(prisma);
    await svc.createPayment(SCOPE, 'c1', { amount: 300 } as never);
    expect(customerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentBalance: 500 }) }),
    );
  });
});
