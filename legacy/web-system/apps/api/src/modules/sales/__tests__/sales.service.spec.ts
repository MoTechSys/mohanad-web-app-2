/**
 * SalesService — Jest spec.
 *
 * Focus: net = total - discount; CASH sale touches no customer balance;
 * CREDIT sale adds net to the LOCKED customer balance (rule #6) + writes a
 * customer_transaction; create writes an audit row (rule #3).
 */
import { BadRequestException } from '@nestjs/common';

import { SalesService } from '../sales.service';

const SCOPE = { storeId: 's1', actorId: 'u1' };

function buildPrisma(opts: { lockedCustomerBalance?: number } = {}) {
  const saleCreate = jest.fn().mockResolvedValue({
    id: 'sale1',
    saleMode: 'TOTAL_ONLY',
    paymentType: 'CASH',
  });
  const custUpdate = jest.fn().mockResolvedValue({});
  const custTxCreate = jest.fn().mockResolvedValue({ id: 'ctx1' });
  const auditCreate = jest.fn();
  const tx = {
    $queryRawUnsafe: jest
      .fn()
      .mockResolvedValue([{ current_balance: opts.lockedCustomerBalance ?? 0 }]),
    sale: { create: saleCreate },
    customer: { update: custUpdate },
    customerTransaction: { create: custTxCreate },
    product: { findFirst: jest.fn(), update: jest.fn() },
    auditLog: { create: auditCreate },
    notification: { create: jest.fn() },
    setting: { findUnique: jest.fn().mockResolvedValue({ value: 50000 }) },
  };
  const prisma = {
    customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', currentBalance: 0 }) },
    $transaction: jest.fn().mockImplementation(async (cb: (db: typeof tx) => unknown) => cb(tx)),
  } as unknown as ConstructorParameters<typeof SalesService>[0];
  return { prisma, saleCreate, custUpdate, custTxCreate, auditCreate };
}

describe('SalesService.create', () => {
  it('CASH sale: computes net (total-discount), no customer balance change, audited', async () => {
    const { prisma, saleCreate, custUpdate, auditCreate } = buildPrisma();
    const svc = new SalesService(prisma);
    await svc.create(SCOPE, {
      saleMode: 'TOTAL_ONLY',
      paymentType: 'CASH',
      totalAmount: 500,
      discountAmount: 50,
    } as never);
    expect(saleCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ netAmount: 450 }) }),
    );
    expect(custUpdate).not.toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalled();
  });

  it('CREDIT sale: adds net to the LOCKED customer balance + ledger row', async () => {
    const { prisma, custUpdate, custTxCreate } = buildPrisma({ lockedCustomerBalance: 1000 });
    const svc = new SalesService(prisma);
    await svc.create(SCOPE, {
      saleMode: 'TOTAL_ONLY',
      paymentType: 'CREDIT',
      customerId: 'c1',
      totalAmount: 700,
    } as never);
    // 1000 (locked) + 700 = 1700
    expect(custUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentBalance: 1700 }) }),
    );
    expect(custTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'DEBT', amount: 700 }) }),
    );
  });

  it('rejects when net amount would be negative', async () => {
    const { prisma } = buildPrisma();
    const svc = new SalesService(prisma);
    await expect(
      svc.create(SCOPE, {
        saleMode: 'TOTAL_ONLY',
        paymentType: 'CASH',
        totalAmount: 100,
        discountAmount: 200,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
