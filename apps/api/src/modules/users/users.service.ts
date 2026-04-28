/**
 * UsersService — Phase 2 RBAC backend.
 *
 * Responsibilities:
 *   • CRUD on Users scoped to the caller's storeId.
 *   • Assign / replace roles (transactional).
 *   • Reset password (admin) — revokes all refresh tokens for the user.
 *   • Activate / deactivate — deactivation revokes all refresh tokens
 *     atomically inside the same Prisma transaction.
 *   • effective-permissions — union of permission codes from all assigned
 *     active roles; used by the frontend for `PermissionGate`.
 *
 * Conventions:
 *   • All money/state-changing operations are wrapped in `prisma.$transaction`.
 *   • Soft-delete via `deletedAt`; we filter `deletedAt: null` on reads.
 *   • Pagination defaults: page=1, limit=20.
 */

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import type {
  AssignRolesInput,
  CreateUserInput,
  ListUsersQuery,
  ResetPasswordInput,
  UpdateUserInput,
} from '@grocery/shared';

import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_ROUNDS = 12;

interface UserScope {
  /** storeId from the authenticated user (multi-store isolation). */
  storeId: string;
  /** acting user id — used for self-protection (cannot self-deactivate). */
  actorId: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List with pagination + search + filters ────────────────
  async list(scope: UserScope, query: ListUsersQuery) {
    const { page, limit, search, sortBy, sortDir, isActive, roleId } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      deletedAt: null,
      ...(typeof isActive === 'boolean' ? { isActive } : {}),
      ...(roleId ? { userRoles: { some: { roleId } } } : {}),
      ...(search
        ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' } },
              { fullName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const orderBy = sortBy ? { [sortBy]: sortDir } : { createdAt: sortDir };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          username: true,
          fullName: true,
          phone: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          userRoles: { select: { role: { select: { id: true, key: true, name: true } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        ...u,
        roles: u.userRoles.map((ur) => ur.role),
        userRoles: undefined,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Find one (full detail) ─────────────────────────────────
  async findOne(scope: UserScope, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, storeId: scope.storeId, deletedAt: null },
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            assignedAt: true,
            role: { select: { id: true, key: true, name: true, isSystem: true } },
          },
        },
      },
    });
    if (!user)
      throw new NotFoundException({ message: 'المستخدم غير موجود', code: 'USER_NOT_FOUND' });
    return {
      ...user,
      roles: user.userRoles.map((ur) => ({ ...ur.role, assignedAt: ur.assignedAt })),
      userRoles: undefined,
    };
  }

  // ─── Effective permissions (union) ──────────────────────────
  async effectivePermissions(scope: UserScope, userId: string): Promise<string[]> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, storeId: scope.storeId, deletedAt: null },
      select: {
        userRoles: {
          select: {
            role: {
              select: {
                isActive: true,
                rolePermissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        },
      },
    });
    if (!user)
      throw new NotFoundException({ message: 'المستخدم غير موجود', code: 'USER_NOT_FOUND' });
    const set = new Set<string>();
    for (const ur of user.userRoles) {
      if (!ur.role.isActive) continue;
      for (const rp of ur.role.rolePermissions) set.add(rp.permission.key);
    }
    return Array.from(set).sort();
  }

  // ─── Create user (with role assignment) ─────────────────────
  async create(scope: UserScope, input: CreateUserInput) {
    // username uniqueness (global per Prisma schema's @unique)
    const existing = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (existing) {
      throw new ConflictException({
        message: 'اسم المستخدم مُستخدم مسبقاً',
        code: 'USERNAME_TAKEN',
      });
    }
    // verify all roles belong to this store
    const roleCount = await this.prisma.role.count({
      where: { id: { in: input.roleIds }, storeId: scope.storeId },
    });
    if (roleCount !== input.roleIds.length) {
      throw new NotFoundException({ message: 'دور غير موجود', code: 'ROLE_NOT_FOUND' });
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          storeId: scope.storeId,
          username: input.username,
          passwordHash,
          fullName: input.fullName,
          phone: input.phone ?? null,
          isActive: input.isActive,
        },
      });
      await tx.userRole.createMany({
        data: input.roleIds.map((roleId) => ({ userId: user.id, roleId })),
      });
      return user;
    });

    return this.findOne(scope, created.id);
  }

  // ─── Update profile ─────────────────────────────────────────
  async update(scope: UserScope, id: string, input: UpdateUserInput) {
    await this.assertExists(scope, id);
    await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    return this.findOne(scope, id);
  }

  // ─── Reset password (admin) ─────────────────────────────────
  async resetPassword(scope: UserScope, id: string, input: ResetPasswordInput) {
    await this.assertExists(scope, id);
    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      });
      // revoke all refresh tokens — force re-login
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { ok: true };
  }

  // ─── Assign roles (replace set) ─────────────────────────────
  async assignRoles(scope: UserScope, id: string, input: AssignRolesInput) {
    await this.assertExists(scope, id);
    const roleCount = await this.prisma.role.count({
      where: { id: { in: input.roleIds }, storeId: scope.storeId },
    });
    if (roleCount !== input.roleIds.length) {
      throw new NotFoundException({ message: 'دور غير موجود', code: 'ROLE_NOT_FOUND' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: input.roleIds.map((roleId) => ({ userId: id, roleId })),
      });
    });
    return this.findOne(scope, id);
  }

  // ─── Activate ────────────────────────────────────────────────
  async activate(scope: UserScope, id: string) {
    await this.assertExists(scope, id);
    await this.prisma.user.update({
      where: { id },
      data: { isActive: true, failedLoginAttempts: 0, lockedUntil: null },
    });
    return this.findOne(scope, id);
  }

  // ─── Deactivate (revokes all refresh tokens atomically) ────
  async deactivate(scope: UserScope, id: string) {
    if (id === scope.actorId) {
      throw new ConflictException({
        message: 'لا يمكنك تعطيل حسابك',
        code: 'CANNOT_SELF_DEACTIVATE',
      });
    }
    await this.assertExists(scope, id);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { isActive: false } });
      // Revoke all active refresh tokens in the SAME transaction
      const r = await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return r.count;
    });
    return { ok: true, refreshTokensRevoked: result };
  }

  // ─── Soft-delete ────────────────────────────────────────────
  async remove(scope: UserScope, id: string) {
    if (id === scope.actorId) {
      throw new ConflictException({
        message: 'لا يمكنك حذف حسابك',
        code: 'CANNOT_SELF_DELETE',
      });
    }
    await this.assertExists(scope, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { ok: true };
  }

  // ─── Helper ─────────────────────────────────────────────────
  private async assertExists(scope: UserScope, id: string): Promise<void> {
    const found = await this.prisma.user.findFirst({
      where: { id, storeId: scope.storeId, deletedAt: null },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException({ message: 'المستخدم غير موجود', code: 'USER_NOT_FOUND' });
    }
  }
}
