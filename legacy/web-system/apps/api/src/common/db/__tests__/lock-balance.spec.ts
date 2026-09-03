/**
 * lock-balance — Jest spec.
 *
 * Golden rule #6: balance reads inside a money transaction must use
 * `SELECT … FOR UPDATE`. These tests assert the helper issues that exact
 * locking query (parameterised) and returns the numeric balance.
 */
import { type TxClient, lockCustomerBalance, lockSupplierBalance } from '../lock-balance';

const makeTx = (rows: unknown): { tx: TxClient; calls: Array<{ sql: string; id: unknown }> } => {
  const calls: Array<{ sql: string; id: unknown }> = [];
  const tx = {
    $queryRawUnsafe: (sql: string, id: unknown) => {
      calls.push({ sql, id });
      return Promise.resolve(rows);
    },
  } as unknown as TxClient;
  return { tx, calls };
};

describe('lockCustomerBalance / lockSupplierBalance', () => {
  it('issues SELECT … FOR UPDATE on customers and returns the balance', async () => {
    const { tx, calls } = makeTx([{ current_balance: '150.50' }]);
    const bal = await lockCustomerBalance(tx, 'cust-1');
    expect(bal).toBe(150.5);
    expect(calls[0].sql).toContain('FROM customers');
    expect(calls[0].sql).toContain('FOR UPDATE');
    expect(calls[0].id).toBe('cust-1');
  });

  it('issues SELECT … FOR UPDATE on suppliers and returns the balance', async () => {
    const { tx, calls } = makeTx([{ current_balance: 2000 }]);
    const bal = await lockSupplierBalance(tx, 'sup-1');
    expect(bal).toBe(2000);
    expect(calls[0].sql).toContain('FROM suppliers');
    expect(calls[0].sql).toContain('FOR UPDATE');
  });

  it('throws when the row is missing', async () => {
    const { tx } = makeTx([]);
    await expect(lockCustomerBalance(tx, 'nope')).rejects.toThrow(/not found/);
  });
});
