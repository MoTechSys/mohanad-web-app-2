/**
 * RolesService — Phase 2 RBAC backend.
 *
 * Responsibilities:
 *   • CRUD on Roles scoped to the caller's storeId.
 *   • Set permissions on a role (replace whole set, transactional).
 *   • Clone a role (copy name+description+permissions, new key).
 *
 * System role protection:
 *   • `isSystem=true` roles cannot be deleted.
 *   • Their `key` and `name` cannot be changed (only description, permissions,
 *     and isActive may be modified by an authorized user).
 *
 * Conventions:
 *   • All mutations involving permissions are wrapped in `prisma.$transaction`.
 *   • Permission codes are looked up by `key` and validated to exist.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  CloneRoleInput,
  CreateRoleInput,
  SetPermissionsInput,
  UpdateRoleInput,
} from '@grocery/shared';

import { PrismaService } from '../prisma/prisma.service';

interface RoleScope {
  storeId: string;
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List all roles for the store ───────────────────────────
  async list(scope: RoleScope) {
    const roles = await this.prisma.role.findMany({
      where: { storeId: scope.storeId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { rolePermissions: true, userRoles: true },
        },
      },
    });
    return {
      items: roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        isActive: r.isActive,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        permissionsCount: r._count.rolePermissions,
        usersCount: r._count.userRoles,
      })),
    };
  }

  // ─── Find one with permissions ──────────────────────────────
  async findOne(scope: RoleScope, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, storeId: scope.storeId },
      include: {
        rolePermissions: {
          include: { permission: { select: { key: true, name: true, module: true } } },
        },
        _count: { select: { userRoles: true } },
      },
    });
    if (!role) throw new NotFoundException({ message: 'الدور غير موجود', code: 'ROLE_NOT_FOUND' });
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      usersCount: role._count.userRoles,
      permissions: role.rolePermissions.map((rp) => ({
        key: rp.permission.key,
        name: rp.permission.name,
        module: rp.permission.module,
      })),
      permissionCodes: role.rolePermissions.map((rp) => rp.permission.key),
    };
  }

  // ─── Create role + assign permissions ───────────────────────
  async create(scope: RoleScope, input: CreateRoleInput) {
    const dup = await this.prisma.role.findFirst({
      where: { storeId: scope.storeId, key: input.key },
    });
    if (dup) {
      throw new ConflictException({
        message: 'مفتاح الدور مُستخدم مسبقاً',
        code: 'ROLE_KEY_TAKEN',
      });
    }

    const permissionRows = await this.resolvePermissionIds(input.permissionCodes);
    const role = await this.prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          storeId: scope.storeId,
          key: input.key,
          name: input.name,
          description: input.description ?? null,
          isSystem: false,
          isActive: true,
        },
      });
      if (permissionRows.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionRows.map((p) => ({ roleId: created.id, permissionId: p.id })),
        });
      }
      return created;
    });

    return this.findOne(scope, role.id);
  }

  // ─── Update role (system roles: only description/isActive/name=description-only) ──
  async update(scope: RoleScope, id: string, input: UpdateRoleInput) {
    const role = await this.assertRoleExists(scope, id);
    if (role.isSystem) {
      // System roles: only description and isActive may be changed (NOT name/key).
      if (input.name !== undefined && input.name !== role.name) {
        throw new ForbiddenException({
          message: 'لا يمكن تغيير اسم الدور النظامي',
          code: 'SYSTEM_ROLE_IMMUTABLE_NAME',
        });
      }
    }
    await this.prisma.role.update({
      where: { id },
      data: {
        ...(input.name !== undefined && !role.isSystem ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    return this.findOne(scope, id);
  }

  // ─── Set permissions on a role (replace) ────────────────────
  async setPermissions(scope: RoleScope, id: string, input: SetPermissionsInput) {
    await this.assertRoleExists(scope, id);
    const permissionRows = await this.resolvePermissionIds(input.permissionCodes);
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissionRows.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionRows.map((p) => ({ roleId: id, permissionId: p.id })),
        });
      }
    });
    return this.findOne(scope, id);
  }

  // ─── Clone role (system or custom) ──────────────────────────
  async clone(scope: RoleScope, input: CloneRoleInput) {
    const source = await this.prisma.role.findFirst({
      where: { id: input.sourceRoleId, storeId: scope.storeId },
      include: { rolePermissions: true },
    });
    if (!source) {
      throw new NotFoundException({ message: 'الدور الأصلي غير موجود', code: 'ROLE_NOT_FOUND' });
    }
    const dup = await this.prisma.role.findFirst({
      where: { storeId: scope.storeId, key: input.key },
    });
    if (dup) {
      throw new ConflictException({
        message: 'مفتاح الدور مُستخدم مسبقاً',
        code: 'ROLE_KEY_TAKEN',
      });
    }
    const cloned = await this.prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          storeId: scope.storeId,
          key: input.key,
          name: input.name,
          description: input.description ?? source.description,
          isSystem: false, // clones are never system roles
          isActive: true,
        },
      });
      if (source.rolePermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: source.rolePermissions.map((rp) => ({
            roleId: created.id,
            permissionId: rp.permissionId,
          })),
        });
      }
      return created;
    });
    return this.findOne(scope, cloned.id);
  }

  // ─── Delete (only non-system + no users assigned) ───────────
  async remove(scope: RoleScope, id: string) {
    const role = await this.assertRoleExists(scope, id);
    if (role.isSystem) {
      throw new ForbiddenException({
        message: 'لا يمكن حذف الدور النظامي',
        code: 'SYSTEM_ROLE_UNDELETABLE',
      });
    }
    const userCount = await this.prisma.userRole.count({ where: { roleId: id } });
    if (userCount > 0) {
      throw new ConflictException({
        message: `لا يمكن حذف الدور — مستخدم مع ${userCount} مستخدم`,
        code: 'ROLE_IN_USE',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
    });
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════
  //  Internal helpers
  // ═══════════════════════════════════════════════════════════
  private async assertRoleExists(scope: RoleScope, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, storeId: scope.storeId },
      select: {
        id: true,
        key: true,
        name: true,
        isSystem: true,
        isActive: true,
      },
    });
    if (!role) {
      throw new NotFoundException({ message: 'الدور غير موجود', code: 'ROLE_NOT_FOUND' });
    }
    return role;
  }

  /**
   * Resolve an array of permission codes to their DB rows.
   * Throws BadRequestException if any code is unknown — protects against typos.
   */
  private async resolvePermissionIds(codes: string[]): Promise<Array<{ id: string; key: string }>> {
    if (codes.length === 0) return [];
    const unique = Array.from(new Set(codes));
    const rows = await this.prisma.permission.findMany({
      where: { key: { in: unique } },
      select: { id: true, key: true },
    });
    if (rows.length !== unique.length) {
      const found = new Set(rows.map((r) => r.key));
      const missing = unique.filter((c) => !found.has(c));
      throw new BadRequestException({
        message: 'صلاحيات غير معروفة',
        code: 'UNKNOWN_PERMISSIONS',
        errors: missing.map((m) => ({ path: ['permissionCodes'], message: m })),
      });
    }
    return rows;
  }
}
