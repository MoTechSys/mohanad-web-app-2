/**
 * PurchasesService — Jest spec.
 *
 * Locks in the reconciled accounting rule (docs/12 §C#2, updated 2026-06-09):
 *   • CREDIT purchase → supplier debt += total (from LOCKED balance, rule #6)
 *   • CASH   purchase → creates Expense(CASH_PURCHASE), no supplier debt change
 */
import { PurchasesService } from '../purchases.service';

const SCOPE = { storeId: 's1', actorId: 'u1' };

function buildPrisma(opts: { lockedSupplierBalance?: number } = {}) {
  const supplierUpdate = jest.fn().mockResolvedValue({});
  const supplierTxCreate = jest.fn().mockResolvedValue({ id: 'stx1' });
  const expenseCreate = jest.fn().mockResolvedValue({ id: 'exp1' });
  const tx = {
    $queryRawUnsafe: jest
      .fn()
      .mockResolvedValue([{ current_balance: opts.lockedSupplierBalance ?? 0 }]),
    purchase: { create: jest.fn().mockResolvedValue({ id: 'pur1' }) },
    purchaseItem: { createMany: jest.fn() },
    supplier: { update: supplierUpdate },
    supplierTransaction: { create: supplierTxCreate },
    expense: { create: expenseCreate },
    auditLog: { create: jest.fn() },
    notification: { create: jest.fn() },
    setting: { findUnique: jest.fn().mockResolvedValue({ value: 50000 }) },
  };
  const prisma = {
    supplier: { findFirst: jest.fn().mockResolvedValue({ id: 'sup1', currentBalance: 0 }) },
    purchase: { findFirst: jest.fn().mockResolvedValue({ id: 'pur1', paymentType: 'CASH' }) },
    $transaction: jest.fn().mockImplementation(async (cb: (db: typeof tx) => unknown) => cb(tx)),
  } as unknown as ConstructorParameters<typeof PurchasesService>[0];
  return { prisma, supplierUpdate, supplierTxCreate, expenseCreate };
}

describe('PurchasesService.create', () => {
  it('CREDIT: adds total to LOCKED supplier balance + ledger, no expense', async () => {
    const { prisma, supplierUpdate, supplierTxCreate, expenseCreate } = buildPrisma({
      lockedSupplierBalance: 500,
    });
    const svc = new PurchasesService(prisma);
    await svc.create(SCOPE, {
      supplierId: 'sup1',
      purchaseMode: 'TOTAL_ONLY',
      paymentType: 'CREDIT',
      totalAmount: 2000,
    } as never);
    // 500 (locked) + 2000 = 2500
    expect(supplierUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentBalance: 2500 }) }),
    );
    expect(supplierTxCreate).toHaveBeenCalled();
    expect(expenseCreate).not.toHaveBeenCalled();
  });

  it('CASH: creates Expense(CASH_PURCHASE), no supplier debt change (C#2)', async () => {
    const { prisma, supplierUpdate, expenseCreate } = buildPrisma();
    const svc = new PurchasesService(prisma);
    await svc.create(SCOPE, {
      purchaseMode: 'TOTAL_ONLY',
      paymentType: 'CASH',
      totalAmount: 800,
    } as never);
    expect(expenseCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'CASH_PURCHASE' }) }),
    );
    expect(supplierUpdate).not.toHaveBeenCalled();
  });
});
