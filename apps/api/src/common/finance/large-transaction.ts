import type { Prisma } from '@prisma/client';

export type TxClient = Prisma.TransactionClient;

const SETTING_KEY = 'large_transaction_threshold';
const DEFAULT_THRESHOLD = 50000;

/**
 * Reads the store's configurable large-transaction threshold (Setting key
 * `large_transaction_threshold`, default 50000 — docs/12 §B5/§Q10).
 * Returns a finite positive number; falls back to the default on any miss.
 */
export async function getLargeTxThreshold(db: TxClient, storeId: string): Promise<number> {
  const row = await db.setting
    .findUnique({ where: { storeId_key: { storeId, key: SETTING_KEY } } })
    .catch(() => null);
  const raw = row?.value as unknown;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD;
}

interface FlagArgs {
  storeId: string;
  actorId: string;
  amount: number;
  entityType: string;
  entityId: string;
  /** Short Arabic label for the operation, e.g. "فاتورة بيع" / "شراء" / "مصروف". */
  label: string;
}

/**
 * Golden-design B5/A4: if a financial operation's amount meets or exceeds the
 * store threshold, record a `large_transaction` audit row and broadcast a
 * LARGE_TRANSACTION notification (userId=null → Owner/Manager surface).
 *
 * Call INSIDE the operation's `prisma.$transaction` AFTER the entity exists,
 * so the flag is atomic with the operation. No-op below threshold.
 */
export async function flagIfLargeTransaction(db: TxClient, args: FlagArgs): Promise<boolean> {
  const threshold = await getLargeTxThreshold(db, args.storeId);
  if (!(args.amount >= threshold)) return false;

  await db.auditLog.create({
    data: {
      storeId: args.storeId,
      actorId: args.actorId,
      action: 'large_transaction',
      entityType: args.entityType,
      entityId: args.entityId,
      metadata: { amount: args.amount, threshold, label: args.label },
    },
  });
  await db.notification.create({
    data: {
      storeId: args.storeId,
      userId: null, // broadcast to Owner/Manager
      type: 'LARGE_TRANSACTION',
      title: 'عملية مالية كبيرة',
      body: `${args.label} بمبلغ ${args.amount.toLocaleString('en-US')} يتجاوز حد ${threshold.toLocaleString('en-US')}.`,
      metadata: {
        amount: args.amount,
        threshold,
        entityType: args.entityType,
        entityId: args.entityId,
      },
    },
  });
  return true;
}
