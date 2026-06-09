/**
 * InventoryService — Jest spec.
 *
 * Focus: stock movement math per type (IN/OUT/ADJUSTMENT), product quantity
 * update, and audit row (rule #3).
 */
import { InventoryService } from '../inventory.service';

const SCOPE = { storeId: 's1', actorId: 'u1' };

function buildPrisma(currentQuantity: number, minQuantity = 5) {
  const productUpdate = jest.fn().mockResolvedValue({});
  const movementCreate = jest
    .fn()
    .mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'mv1', ...args.data }),
    );
  const auditCreate = jest.fn();
  const tx = {
    product: { update: productUpdate },
    stockMovement: { create: movementCreate },
    auditLog: { create: auditCreate },
  };
  const prisma = {
    product: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', currentQuantity, minQuantity }) },
    $transaction: jest.fn().mockImplementation(async (cb: (db: typeof tx) => unknown) => cb(tx)),
  } as unknown as ConstructorParameters<typeof InventoryService>[0];
  return { prisma, productUpdate, movementCreate, auditCreate };
}

describe('InventoryService.createMovement', () => {
  it('IN adds quantity', async () => {
    const { prisma, productUpdate, auditCreate } = buildPrisma(50);
    const svc = new InventoryService(prisma);
    await svc.createMovement(SCOPE, { productId: 'p1', type: 'IN', quantity: 100 } as never);
    expect(productUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentQuantity: 150 }) }),
    );
    expect(auditCreate).toHaveBeenCalled();
  });

  it('OUT subtracts quantity', async () => {
    const { prisma, productUpdate } = buildPrisma(100);
    const svc = new InventoryService(prisma);
    await svc.createMovement(SCOPE, { productId: 'p1', type: 'OUT', quantity: 30 } as never);
    expect(productUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentQuantity: 70 }) }),
    );
  });

  it('ADJUSTMENT sets the quantity to the provided value', async () => {
    const { prisma, productUpdate } = buildPrisma(100);
    const svc = new InventoryService(prisma);
    await svc.createMovement(SCOPE, { productId: 'p1', type: 'ADJUSTMENT', quantity: 42 } as never);
    expect(productUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentQuantity: 42 }) }),
    );
  });

  it('flags low stock when result <= minQuantity', async () => {
    const { prisma } = buildPrisma(10, 5);
    const svc = new InventoryService(prisma);
    const res = (await svc.createMovement(SCOPE, {
      productId: 'p1',
      type: 'OUT',
      quantity: 8,
    } as never)) as { isLowStock: boolean };
    // 10 - 8 = 2 <= 5
    expect(res.isLowStock).toBe(true);
  });
});
