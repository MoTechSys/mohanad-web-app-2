/**
 * Prisma Seed — Phase 2 (Auth + RBAC)
 *
 * Seeds the foundation models with everything required for authentication:
 *   1. Default Store (env: SEED_STORE_NAME)
 *   2. All permissions (>50) from @grocery/shared
 *   3. Six system roles (Owner, Manager, SalesWorker, Accountant,
 *                       PurchasingOfficer, InventoryOfficer)
 *   4. Owner user (env: SEED_OWNER_USERNAME / SEED_OWNER_PASSWORD)
 *   5. Default Settings (locale, timezone, large_tx_threshold,
 *                        opening_cash_balance, …)
 *
 * Strictly idempotent: every operation is an upsert, so running the seed
 * multiple times converges to the same state without duplicates.
 */
import {
  ALL_PERMISSION_CODES,
  DEFAULT_SETTINGS,
  SYSTEM_ROLES,
  SYSTEM_ROLE_NAMES,
  describePermission,
} from '@grocery/shared';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const STORE_NAME = process.env.SEED_STORE_NAME ?? 'بقالتي';
const OWNER_USERNAME = process.env.SEED_OWNER_USERNAME ?? 'owner';
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? 'Owner@12345';
const OWNER_FULLNAME = process.env.SEED_OWNER_FULLNAME ?? 'مالك المتجر';
const BCRYPT_ROUNDS = 12;

async function main(): Promise<void> {
  console.info('🌱 Seeding Foundation data…');

  // 1. Store
  const store = await prisma.store.upsert({
    where: { id: 'foundation-store' },
    update: { name: STORE_NAME },
    create: {
      id: 'foundation-store',
      name: STORE_NAME,
      currency: 'YER',
    },
  });
  console.info(`  ✓ Store: ${store.name}`);

  // 2. Permissions (>50, from @grocery/shared)
  for (const code of ALL_PERMISSION_CODES) {
    const meta = describePermission(code);
    await prisma.permission.upsert({
      where: { key: code },
      update: { name: meta.labelAr, module: meta.module },
      create: {
        key: code,
        name: meta.labelAr,
        module: meta.module,
        description: `${meta.groupAr} — ${meta.action}`,
      },
    });
  }
  console.info(`  ✓ Permissions seeded: ${ALL_PERMISSION_CODES.length}`);

  // 3. Roles + role permissions
  for (const roleSeed of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { storeId_key: { storeId: store.id, key: roleSeed.name } },
      update: {
        name: roleSeed.labelAr,
        description: roleSeed.description,
        isSystem: true,
        isActive: true,
      },
      create: {
        storeId: store.id,
        key: roleSeed.name,
        name: roleSeed.labelAr,
        description: roleSeed.description,
        isSystem: true,
        isActive: true,
      },
    });

    // Reset role permissions to match seed
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const permissions = await prisma.permission.findMany({
      where: { key: { in: roleSeed.permissions } },
    });
    if (permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
    console.info(`  ✓ Role ${role.key}: ${permissions.length} perms`);
  }

  // 4. Owner user
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, BCRYPT_ROUNDS);
  const owner = await prisma.user.upsert({
    where: { username: OWNER_USERNAME },
    update: { fullName: OWNER_FULLNAME, isActive: true },
    create: {
      storeId: store.id,
      username: OWNER_USERNAME,
      passwordHash,
      fullName: OWNER_FULLNAME,
      isActive: true,
    },
  });

  const ownerRole = await prisma.role.findUniqueOrThrow({
    where: { storeId_key: { storeId: store.id, key: SYSTEM_ROLE_NAMES.OWNER } },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: owner.id, roleId: ownerRole.id } },
    update: {},
    create: { userId: owner.id, roleId: ownerRole.id },
  });
  console.info(`  ✓ Owner user: ${owner.username}`);

  // 5. Default settings (key/value)
  const defaultSettings: Array<{ key: string; value: unknown }> = [
    // Localization
    { key: 'locale', value: 'ar' },
    { key: 'timezone', value: 'Asia/Aden' },
    { key: 'currency', value: DEFAULT_SETTINGS.CURRENCY },
    // Sales / Inventory
    { key: 'default_sale_mode', value: 'hybrid' },
    { key: 'enable_inventory', value: DEFAULT_SETTINGS.INVENTORY_ENABLED },
    { key: 'enable_behavior_analysis', value: true },
    // Financial thresholds (rationale: docs/12-agent-memory.md §15 Q10)
    { key: 'large_transaction_threshold', value: DEFAULT_SETTINGS.LARGE_TRANSACTION_THRESHOLD },
    { key: 'opening_cash_balance', value: DEFAULT_SETTINGS.OPENING_CASH_BALANCE },
    // Notifications
    { key: 'whatsapp_country_code', value: '967' },
  ];
  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where: { storeId_key: { storeId: store.id, key: s.key } },
      update: { value: s.value as never },
      create: { storeId: store.id, key: s.key, value: s.value as never },
    });
  }
  console.info(`  ✓ Settings seeded: ${defaultSettings.length}`);

  // 6. Final summary (visible in CI logs / DoD evidence)
  const counts = {
    stores: await prisma.store.count(),
    permissions: await prisma.permission.count(),
    roles: await prisma.role.count(),
    rolePermissions: await prisma.rolePermission.count(),
    users: await prisma.user.count(),
    userRoles: await prisma.userRole.count(),
    settings: await prisma.setting.count(),
  };
  console.info('🌱 Done. Final counts:', counts);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
