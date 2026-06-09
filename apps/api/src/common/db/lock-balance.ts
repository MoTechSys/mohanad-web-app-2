import { Prisma } from '@prisma/client';

/**
 * Golden rule #6 (docs/12-agent-memory.md): every balance mutation MUST take
 * a row-level lock on the entity before reading its `current_balance`, so two
 * concurrent transactions cannot both read a stale balance and overwrite each
 * other (lost-update). PostgreSQL `SELECT … FOR UPDATE` blocks the second
 * transaction until the first commits.
 *
 * Usage — INSIDE a `prisma.$transaction(async (db) => { … })` block:
 *
 *   const before = await lockCustomerBalance(db, customerId);
 *   const after  = before + amount;
 *   await db.customer.update({ where: { id: customerId }, data: { currentBalance: after } });
 *
 * The returned number is the authoritative, just-locked balance — always use
 * it (never a value read before the transaction) to compute the new balance.
 */

// Prisma transaction client type (the `db` argument inside $transaction).
export type TxClient = Prisma.TransactionClient;

interface BalanceRow {
  current_balance: Prisma.Decimal | string | number;
}

async function lockBalance(
  db: TxClient,
  table: 'customers' | 'suppliers',
  id: string,
): Promise<number> {
  // Parameterised raw query — table name is from a fixed union (never user
  // input), id is bound as a parameter so this is injection-safe.
  const sql = `SELECT current_balance FROM ${table} WHERE id = $1 FOR UPDATE`;
  const rows = await db.$queryRawUnsafe<BalanceRow[]>(sql, id);
  if (!rows || rows.length === 0) {
    throw new Error(`lockBalance: ${table} row ${id} not found`);
  }
  return Number(rows[0].current_balance);
}

export const lockCustomerBalance = (db: TxClient, id: string): Promise<number> =>
  lockBalance(db, 'customers', id);

export const lockSupplierBalance = (db: TxClient, id: string): Promise<number> =>
  lockBalance(db, 'suppliers', id);
