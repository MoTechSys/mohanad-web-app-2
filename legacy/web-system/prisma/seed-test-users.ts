/**
 * Test users seed — Phase 2 P2-5.
 *
 * Creates one test user per non-Owner system role for E2E testing of
 * permission-based UI/API behavior.  All users:
 *   • belong to the first store (the same store the main `seed.ts` creates).
 *   • use bcrypt-hashed passwords (12 rounds).
 *   • are upserted (idempotent — safe to re-run any number of times).
 *
 * Run with:  pnpm db:seed:test-users
 *
 * Default password for ALL test users:  Test@12345
 *
 * NOTE: Owner is intentionally skipped because the main seed already
 * creates an Owner user (`owner` / `Owner@12345`).
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

import { SYSTEM_ROLE_NAMES } from '../packages/shared/src/constants/roles';

const prisma = new PrismaClient();

interface TestUserSeed {
  username: string;
  fullName: string;
  roleKey: string;
}

const TEST_USERS: TestUserSeed[] = [
  { username: 'manager', fullName: 'مدير', roleKey: SYSTEM_ROLE_NAMES.MANAGER },
  { username: 'sales', fullName: 'بائع', roleKey: SYSTEM_ROLE_NAMES.SALES_WORKER },
  { username: 'accountant', fullName: 'محاسب', roleKey: SYSTEM_ROLE_NAMES.ACCOUNTANT },
  {
    username: 'purchasing',
    fullName: 'مسؤول مشتريات',
    roleKey: SYSTEM_ROLE_NAMES.PURCHASING_OFFICER,
  },
  { username: 'inventory', fullName: 'مسؤول مخزون', roleKey: SYSTEM_ROLE_NAMES.INVENTORY_OFFICER },
];

const TEST_PASSWORD = 'Test@12345';
const BCRYPT_ROUNDS = 12;

async function main(): Promise<void> {
  const store = await prisma.store.findFirst({ where: {}, orderBy: { createdAt: 'asc' } });
  if (!store) {
    throw new Error('No store found — run `pnpm db:seed` first.');
  }
  console.log(`📦 Using store: ${store.name} (${store.id})`);

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, BCRYPT_ROUNDS);
  const created: Array<{ username: string; role: string }> = [];

  for (const seed of TEST_USERS) {
    const role = await prisma.role.findUnique({
      where: { storeId_key: { storeId: store.id, key: seed.roleKey } },
    });
    if (!role) {
      console.warn(`⚠️  Skip ${seed.username}: role ${seed.roleKey} not found`);
      continue;
    }

    const user = await prisma.user.upsert({
      where: { username: seed.username },
      create: {
        storeId: store.id,
        username: seed.username,
        passwordHash,
        fullName: seed.fullName,
        isActive: true,
      },
      update: {
        passwordHash,
        fullName: seed.fullName,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Idempotent role assignment (composite unique key).
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {},
    });

    created.push({ username: user.username, role: seed.roleKey });
  }

  console.log(`\n✅ Test users ready (${created.length}):`);
  for (const u of created) console.log(`   • ${u.username.padEnd(12)} → ${u.role}`);
  console.log(`\n🔑 Password for all test users: ${TEST_PASSWORD}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Test-users seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
