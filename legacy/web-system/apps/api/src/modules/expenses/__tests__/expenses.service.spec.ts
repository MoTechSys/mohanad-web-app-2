/**
 * ExpensesService — Jest spec.
 *
 * Focus: NORMAL expense touches no supplier balance; SUPPLIER_PAYMENT reduces
 * the supplier's debt from the LOCKED balance (rule #6) + writes a PAYMENT
 * supplier_transaction. Both write an audit row (rule #3).
 */
import { ExpensesService } from '../expenses.service';

const SCOPE = { storeId: 's1', actorId: 'u1' };

function buildPrisma(opts: { lockedSupplierBalance?: number } = {}) {
  const supplierUpdate = jest.fn().mockResolvedValue({});
  const supplierTxCreate = jest.fn().mockResolvedValue({ id: 'stx1' });
  const auditCreate = jest.fn();
  const tx = {
    $queryRawUnsafe: jest
      .fn()
      .mockResolvedValue([{ current_balance: opts.lockedSupplierBalance ?? 0 }]),
    supplier: {
      findFirst: jest.fn().mockResolvedValue({ id: 'sup1', currentBalance: 0 }),
      update: supplierUpdate,
    },
    expense: { create: jest.fn().mockResolvedValue({ id: 'exp1' }) },
    supplierTransaction: { create: supplierTxCreate },
    auditLog: { create: auditCreate },
    notification: { create: jest.fn() },
    setting: { findUnique: jest.fn().mockResolvedValue({ value: 50000 }) },
  };
  const prisma = {
    expense: { findFirst: jest.fn().mockResolvedValue({ id: 'exp1', type: 'NORMAL' }) },
    $transaction: jest.fn().mockImplementation(async (cb: (db: typeof tx) => unknown) => cb(tx)),
  } as unknown as ConstructorParameters<typeof ExpensesService>[0];
  return { prisma, supplierUpdate, supplierTxCreate, auditCreate };
}

describe('ExpensesService.create', () => {
  it('NORMAL expense: no supplier balance change, audited', async () => {
    const { prisma, supplierUpdate, supplierTxCreate, auditCreate } = buildPrisma();
    const svc = new ExpensesService(prisma);
    await svc.create(SCOPE, { type: 'NORMAL', amount: 120 } as never);
    expect(supplierUpdate).not.toHaveBeenCalled();
    expect(supplierTxCreate).not.toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalled();
  });

  it('SUPPLIER_PAYMENT: reduces LOCKED supplier balance + PAYMENT ledger', async () => {
    const { prisma, supplierUpdate, supplierTxCreate } = buildPrisma({
      lockedSupplierBalance: 1000,
    });
    const svc = new ExpensesService(prisma);
    await svc.create(SCOPE, {
      type: 'SUPPLIER_PAYMENT',
      amount: 400,
      supplierId: 'sup1',
    } as never);
    // 1000 (locked) - 400 = 600
    expect(supplierUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentBalance: 600 }) }),
    );
    expect(supplierTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'PAYMENT', amount: 400 }) }),
    );
  });
});
