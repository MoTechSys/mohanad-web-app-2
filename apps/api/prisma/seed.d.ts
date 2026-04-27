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
export {};
