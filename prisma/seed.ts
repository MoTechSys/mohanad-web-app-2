import { ALL_PERMISSION_CODES, SYSTEM_ROLES, describePermission } from '@grocery/shared';
/**
 * Prisma Seed — Foundation
 *
 * Seeds the 8 Foundation models with the minimum data required for the
 * Auth phase (Phase 2):
 *   • Single store
 *   • All permissions (catalog from @grocery/shared)
 *   • System roles (catalog from @grocery/shared)
 *   • Owner user
 *   • Default settings
 *
 * Idempotent — safe to run multiple times.
 *
 * NOTE: This file is informational for Foundation. No `prisma migrate dev`
 * is run during Foundation; the seed becomes effective in Phase 2.
 */
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

  // 2. Permissions
  for (const code of ALL_PERMISSION_CODES) {
    const meta = describePermission(code);
    await prisma.permission.upsert({
      where: { key: code },
      update: { name: meta.nameAr, module: meta.module },
      create: {
        key: code,
        name: meta.nameAr,
        module: meta.module,
        description: meta.description ?? null,
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
    where: { storeId_key: { storeId: store.id, key: 'Owner' } },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: owner.id, roleId: ownerRole.id } },
    update: {},
    create: { userId: owner.id, roleId: ownerRole.id },
  });
  console.info(`  ✓ Owner user: ${owner.username}`);

  // 5. Default settings (key/value)
  const defaultSettings: Array<{ key: string; value: unknown }> = [
    { key: 'default_sale_mode', value: 'hybrid' },
    { key: 'enable_inventory', value: false },
    { key: 'enable_behavior_analysis', value: true },
    { key: 'large_transaction_threshold', value: 50000 },
    { key: 'opening_cash_balance', value: 0 },
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

  console.info('🌱 Done.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
