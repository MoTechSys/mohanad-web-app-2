/**
 * large-transaction — Jest spec.
 *
 * Design B5/A4: amounts >= the store threshold (default 50000, configurable via
 * Setting `large_transaction_threshold`) must produce a `large_transaction`
 * audit row + a LARGE_TRANSACTION notification. Below threshold = no-op.
 */
import { type TxClient, flagIfLargeTransaction, getLargeTxThreshold } from '../large-transaction';

const makeTx = (settingValue: unknown) => {
  const auditCreate = jest.fn();
  const notifCreate = jest.fn();
  const tx = {
    setting: {
      findUnique: jest
        .fn()
        .mockResolvedValue(settingValue === undefined ? null : { value: settingValue }),
    },
    auditLog: { create: auditCreate },
    notification: { create: notifCreate },
  } as unknown as TxClient;
  return { tx, auditCreate, notifCreate };
};

const baseArgs = {
  storeId: 's1',
  actorId: 'u1',
  entityType: 'sale',
  entityId: 'sale-1',
  label: 'فاتورة بيع',
};

describe('getLargeTxThreshold', () => {
  it('returns the configured numeric threshold', async () => {
    const { tx } = makeTx(80000);
    expect(await getLargeTxThreshold(tx, 's1')).toBe(80000);
  });
  it('parses a string threshold', async () => {
    const { tx } = makeTx('30000');
    expect(await getLargeTxThreshold(tx, 's1')).toBe(30000);
  });
  it('falls back to 50000 default when unset/invalid', async () => {
    expect(await getLargeTxThreshold(makeTx(undefined).tx, 's1')).toBe(50000);
    expect(await getLargeTxThreshold(makeTx('abc').tx, 's1')).toBe(50000);
  });
});

describe('flagIfLargeTransaction', () => {
  it('flags (audit + notify) when amount >= threshold', async () => {
    const { tx, auditCreate, notifCreate } = makeTx(50000);
    const flagged = await flagIfLargeTransaction(tx, { ...baseArgs, amount: 60000 });
    expect(flagged).toBe(true);
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(notifCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate.mock.calls[0][0].data.action).toBe('large_transaction');
    expect(notifCreate.mock.calls[0][0].data.type).toBe('LARGE_TRANSACTION');
  });

  it('flags exactly at the threshold (>=)', async () => {
    const { tx, auditCreate } = makeTx(50000);
    expect(await flagIfLargeTransaction(tx, { ...baseArgs, amount: 50000 })).toBe(true);
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it('is a no-op below threshold', async () => {
    const { tx, auditCreate, notifCreate } = makeTx(50000);
    expect(await flagIfLargeTransaction(tx, { ...baseArgs, amount: 49999 })).toBe(false);
    expect(auditCreate).not.toHaveBeenCalled();
    expect(notifCreate).not.toHaveBeenCalled();
  });
});
