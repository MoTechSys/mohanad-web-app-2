"use strict";
/**
 * Prisma Seed — Foundation
 *
 * يُنشئ بطريقة idempotent:
 *   1. Store واحد بإعدادات افتراضية
 *   2. كل الصلاحيات (~200) من ALL_PERMISSION_CODES
 *   3. الأدوار النظامية من SYSTEM_ROLES + RolePermission
 *   4. مستخدم Owner مع UserRole = Owner
 *   5. ExpenseCategory افتراضية
 *   6. NotificationTemplate افتراضي + CustomerReminderSetting
 *
 * يعتمد على schema الذي يستخدم:
 *   - Permission(key, name, module, description)
 *   - Role(storeId_key unique, name, isSystem, isActive)
 *   - User(username unique)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const shared_1 = require("@grocery/shared");
const prisma = new client_1.PrismaClient();
/** PascalCase → snake_case */
function toRoleKey(name) {
    return name
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .toLowerCase();
}
const DEFAULT_EXPENSE_CATEGORIES = [
    'إيجار',
    'كهرباء',
    'ماء',
    'إنترنت',
    'رواتب',
    'صيانة',
    'مواصلات',
    'تغليف',
    'متفرقات',
];
async function main() {
    console.log('🌱 Starting seed...\n');
    const env = {
        storeName: process.env.SEED_STORE_NAME ?? 'بقالتي',
        currency: process.env.SEED_STORE_CURRENCY ?? 'YER',
        ownerUsername: process.env.SEED_OWNER_USERNAME ?? 'owner',
        ownerPassword: process.env.SEED_OWNER_PASSWORD ?? 'Owner@12345',
        ownerFullName: process.env.SEED_OWNER_FULL_NAME ?? 'مالك المتجر',
        bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
    };
    // ─── 1. Store ────────────────────────────────────
    const existingStore = await prisma.store.findFirst();
    const store = existingStore ??
        (await prisma.store.create({
            data: {
                name: env.storeName,
                currency: env.currency,
            },
        }));
    console.log(`✓ Store: ${store.name} (${store.id})`);
    // ─── 2. Permissions ──────────────────────────────
    console.log(`📋 Seeding ${shared_1.ALL_PERMISSION_CODES.length} permissions...`);
    for (const code of shared_1.ALL_PERMISSION_CODES) {
        const meta = (0, shared_1.describePermission)(code);
        const groupAr = shared_1.PERMISSION_GROUPS_AR[meta.module] ?? meta.module;
        await prisma.permission.upsert({
            where: { key: code },
            update: {
                module: meta.module,
                name: groupAr,
                description: code,
            },
            create: {
                key: code,
                module: meta.module,
                name: groupAr,
                description: code,
            },
        });
    }
    console.log(`✓ Permissions ready: ${shared_1.ALL_PERMISSION_CODES.length}`);
    // ─── 3. Roles + RolePermissions ─────────────────
    console.log('👤 Seeding system roles...');
    const ownerName = shared_1.SYSTEM_ROLE_NAMES.OWNER;
    // امسح ثم أعد إنشاء role_permissions حتى يعكس seed آخر إعداد
    for (const roleSeed of shared_1.SYSTEM_ROLES) {
        const key = toRoleKey(roleSeed.name);
        const isOwner = roleSeed.name === ownerName;
        const role = await prisma.role.upsert({
            where: { storeId_key: { storeId: store.id, key } },
            update: {
                name: roleSeed.labelAr,
                description: roleSeed.description,
                isSystem: isOwner,
                isActive: true,
            },
            create: {
                storeId: store.id,
                key,
                name: roleSeed.labelAr,
                description: roleSeed.description,
                isSystem: isOwner,
                isActive: true,
            },
        });
        await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
        const permRecords = await prisma.permission.findMany({
            where: { key: { in: roleSeed.permissions } },
            select: { id: true },
        });
        if (permRecords.length > 0) {
            await prisma.rolePermission.createMany({
                data: permRecords.map((p) => ({ roleId: role.id, permissionId: p.id })),
                skipDuplicates: true,
            });
        }
        console.log(`  • ${key} (${roleSeed.labelAr}) → ${permRecords.length} permissions`);
    }
    // ─── 4. Owner User ──────────────────────────────
    console.log('👑 Seeding owner user...');
    const ownerKey = toRoleKey(ownerName);
    const ownerRole = await prisma.role.findUnique({
        where: { storeId_key: { storeId: store.id, key: ownerKey } },
    });
    if (!ownerRole)
        throw new Error('Owner role missing — seed corrupted');
    const passwordHash = await bcrypt_1.default.hash(env.ownerPassword, env.bcryptRounds);
    const ownerUser = await prisma.user.upsert({
        where: { username: env.ownerUsername },
        update: { isActive: true },
        create: {
            storeId: store.id,
            username: env.ownerUsername,
            passwordHash,
            fullName: env.ownerFullName,
            isActive: true,
        },
    });
    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: ownerUser.id, roleId: ownerRole.id } },
        update: {},
        create: { userId: ownerUser.id, roleId: ownerRole.id },
    });
    console.log(`✓ Owner user: ${ownerUser.username}`);
    // ─── 5. Expense Categories ──────────────────────
    console.log('💰 Seeding expense categories...');
    for (const name of DEFAULT_EXPENSE_CATEGORIES) {
        await prisma.expenseCategory.upsert({
            where: { storeId_name: { storeId: store.id, name } },
            update: {},
            create: { storeId: store.id, name, isSystem: true },
        });
    }
    console.log(`✓ Expense categories: ${DEFAULT_EXPENSE_CATEGORIES.length}`);
    // ─── 6. Notification Template + Reminder Settings ─
    await prisma.notificationTemplate.upsert({
        where: { storeId_key: { storeId: store.id, key: 'customer_reminder' } },
        update: {},
        create: {
            storeId: store.id,
            key: 'customer_reminder',
            name: 'تذكير سداد',
            body: 'مرحباً {{customerName}}، نُذكّركم بأن لديكم رصيد مستحق بقيمة {{amount}} {{currency}}. شكراً لتعاونكم.',
            channel: 'whatsapp_manual',
            isSystem: true,
        },
    });
    await prisma.customerReminderSetting.upsert({
        where: { storeId: store.id },
        update: {},
        create: {
            storeId: store.id,
            enabled: true,
            daysSinceLastTx: 7,
        },
    });
    console.log('✓ Notification template + reminder settings');
    console.log('\n🎉 Seed complete!');
    console.log('───────────────────────────────────────');
    console.log(`  Store      : ${store.name}`);
    console.log(`  Owner user : ${env.ownerUsername}`);
    console.log(`  Permissions: ${shared_1.ALL_PERMISSION_CODES.length}`);
    console.log(`  Roles      : ${shared_1.SYSTEM_ROLES.length}`);
    console.log('───────────────────────────────────────');
}
main()
    .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map