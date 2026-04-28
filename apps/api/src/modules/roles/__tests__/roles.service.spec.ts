/**
 * RolesService — Jest spec.
 *
 * Covers: list, findOne, create (key uniqueness + permission validation),
 * update (system role name immutability), setPermissions, clone, remove
 * (system role protection + in-use protection), unknown permissions error.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { RolesService } from '../roles.service';

const SCOPE = { storeId: 'store-1' };

const buildPrismaMock = () => ({
  role: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  permission: {
    findMany: jest.fn(),
  },
  rolePermission: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  userRole: {
    count: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('RolesService', () => {
  let service: RolesService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const m = await Test.createTestingModule({
      providers: [RolesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = m.get(RolesService);
  });

  // ─── list ─────────────────────────────────────────────────
  describe('list', () => {
    it('orders system roles first, then by name asc', async () => {
      prisma.role.findMany.mockResolvedValue([
        {
          id: 'r1',
          key: 'Owner',
          name: 'Owner',
          description: null,
          isSystem: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { rolePermissions: 181, userRoles: 1 },
        },
      ]);
      const r = await service.list(SCOPE);
      expect(r.items).toHaveLength(1);
      expect(r.items[0].permissionsCount).toBe(181);
      expect(r.items[0].usersCount).toBe(1);
      expect(prisma.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
          where: { storeId: 'store-1' },
        }),
      );
    });
  });

  // ─── findOne ──────────────────────────────────────────────
  describe('findOne', () => {
    it('throws ROLE_NOT_FOUND when missing', async () => {
      prisma.role.findFirst.mockResolvedValue(null);
      await expect(service.findOne(SCOPE, 'nope')).rejects.toThrow(NotFoundException);
    });
    it('returns role with permissions array + permissionCodes', async () => {
      prisma.role.findFirst.mockResolvedValue({
        id: 'r1',
        key: 'Owner',
        name: 'Owner',
        description: null,
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { userRoles: 1 },
        rolePermissions: [
          { permission: { key: 'users.view', name: 'View users', module: 'users' } },
          { permission: { key: 'roles.view', name: 'View roles', module: 'roles' } },
        ],
      });
      const r = await service.findOne(SCOPE, 'r1');
      expect(r.permissionCodes).toEqual(['users.view', 'roles.view']);
      expect(r.permissions[0]).toMatchObject({ key: 'users.view', module: 'users' });
    });
  });

  // ─── create ───────────────────────────────────────────────
  describe('create', () => {
    it('throws ROLE_KEY_TAKEN on duplicate key', async () => {
      prisma.role.findFirst.mockResolvedValueOnce({ id: 'dup' });
      await expect(
        service.create(SCOPE, { key: 'cashier', name: 'صراف', permissionCodes: [] } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('throws UNKNOWN_PERMISSIONS when codes do not exist', async () => {
      prisma.role.findFirst.mockResolvedValueOnce(null);
      prisma.permission.findMany.mockResolvedValue([{ id: 'p1', key: 'users.view' }]);
      await expect(
        service.create(SCOPE, {
          key: 'cashier',
          name: 'صراف',
          permissionCodes: ['users.view', 'unknown.code'],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates role with permissions in tx and returns full detail', async () => {
      prisma.role.findFirst
        .mockResolvedValueOnce(null) // dup check
        .mockResolvedValueOnce({
          // findOne after create
          id: 'r-new',
          key: 'cashier',
          name: 'صراف',
          description: null,
          isSystem: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { userRoles: 0 },
          rolePermissions: [
            { permission: { key: 'sales.view', name: 'View sales', module: 'sales' } },
          ],
        });
      prisma.permission.findMany.mockResolvedValue([{ id: 'p1', key: 'sales.view' }]);
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          role: { create: jest.fn().mockResolvedValue({ id: 'r-new' }) },
          rolePermission: { createMany: jest.fn() },
        };
        return cb(tx);
      });
      const r = await service.create(SCOPE, {
        key: 'cashier',
        name: 'صراف',
        permissionCodes: ['sales.view'],
      } as any);
      expect(r.id).toBe('r-new');
      expect(r.permissionCodes).toEqual(['sales.view']);
    });
  });

  // ─── update (system role immutability) ────────────────────
  describe('update', () => {
    it('rejects renaming a system role', async () => {
      prisma.role.findFirst.mockResolvedValue({
        id: 'r1',
        key: 'Owner',
        name: 'Owner',
        isSystem: true,
        isActive: true,
      });
      await expect(service.update(SCOPE, 'r1', { name: 'NewName' } as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows description/isActive changes on a system role', async () => {
      prisma.role.findFirst
        .mockResolvedValueOnce({
          id: 'r1',
          key: 'Owner',
          name: 'Owner',
          isSystem: true,
          isActive: true,
        })
        .mockResolvedValueOnce({
          id: 'r1',
          key: 'Owner',
          name: 'Owner',
          description: 'updated',
          isSystem: true,
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { userRoles: 1 },
          rolePermissions: [],
        });
      prisma.role.update.mockResolvedValue({});
      const r = await service.update(SCOPE, 'r1', {
        description: 'updated',
        isActive: false,
      } as any);
      expect(r.description).toBe('updated');
      // The data passed to update should NOT include `name`
      const data = prisma.role.update.mock.calls[0][0].data;
      expect(data.name).toBeUndefined();
    });
  });

  // ─── setPermissions ───────────────────────────────────────
  describe('setPermissions', () => {
    it('replaces permissions atomically', async () => {
      prisma.role.findFirst
        .mockResolvedValueOnce({ id: 'r1', key: 'k', name: 'n', isSystem: false, isActive: true })
        .mockResolvedValueOnce({
          id: 'r1',
          key: 'k',
          name: 'n',
          description: null,
          isSystem: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { userRoles: 0 },
          rolePermissions: [
            { permission: { key: 'p1', name: 'p1', module: 'm' } },
            { permission: { key: 'p2', name: 'p2', module: 'm' } },
          ],
        });
      prisma.permission.findMany.mockResolvedValue([
        { id: 'P1', key: 'p1' },
        { id: 'P2', key: 'p2' },
      ]);
      const del = jest.fn();
      const cre = jest.fn();
      prisma.$transaction.mockImplementation(async (cb: any) => {
        return cb({ rolePermission: { deleteMany: del, createMany: cre } });
      });
      const r = await service.setPermissions(SCOPE, 'r1', {
        permissionCodes: ['p1', 'p2'],
      } as any);
      expect(del).toHaveBeenCalledWith({ where: { roleId: 'r1' } });
      expect(cre).toHaveBeenCalledWith({
        data: [
          { roleId: 'r1', permissionId: 'P1' },
          { roleId: 'r1', permissionId: 'P2' },
        ],
      });
      expect(r.permissionCodes).toEqual(['p1', 'p2']);
    });
  });

  // ─── clone ────────────────────────────────────────────────
  describe('clone', () => {
    it('copies permissions and creates a new non-system role', async () => {
      prisma.role.findFirst
        .mockResolvedValueOnce({
          id: 'src',
          storeId: 'store-1',
          description: 'src desc',
          rolePermissions: [{ permissionId: 'p1' }, { permissionId: 'p2' }],
        })
        .mockResolvedValueOnce(null) // dup check
        .mockResolvedValueOnce({
          id: 'new',
          key: 'manager_jr',
          name: 'مدير مساعد',
          description: 'src desc',
          isSystem: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { userRoles: 0 },
          rolePermissions: [
            { permission: { key: 'a', name: 'a', module: 'm' } },
            { permission: { key: 'b', name: 'b', module: 'm' } },
          ],
        });
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          role: { create: jest.fn().mockResolvedValue({ id: 'new' }) },
          rolePermission: { createMany: jest.fn() },
        };
        return cb(tx);
      });

      const r = await service.clone(SCOPE, {
        sourceRoleId: 'src',
        key: 'manager_jr',
        name: 'مدير مساعد',
      } as any);
      expect(r.id).toBe('new');
      expect(r.isSystem).toBe(false);
      expect(r.permissionCodes).toEqual(['a', 'b']);
    });

    it('throws ROLE_KEY_TAKEN when destination key exists', async () => {
      prisma.role.findFirst
        .mockResolvedValueOnce({
          id: 'src',
          storeId: 'store-1',
          rolePermissions: [],
        })
        .mockResolvedValueOnce({ id: 'dup' });
      await expect(
        service.clone(SCOPE, { sourceRoleId: 'src', key: 'taken', name: 'X' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── remove (system role protection) ──────────────────────
  describe('remove', () => {
    it('throws SYSTEM_ROLE_UNDELETABLE when role.isSystem', async () => {
      prisma.role.findFirst.mockResolvedValue({ id: 'r', isSystem: true });
      await expect(service.remove(SCOPE, 'r')).rejects.toThrow(ForbiddenException);
    });

    it('throws ROLE_IN_USE when users hold the role', async () => {
      prisma.role.findFirst.mockResolvedValue({ id: 'r', isSystem: false });
      prisma.userRole.count.mockResolvedValue(3);
      await expect(service.remove(SCOPE, 'r')).rejects.toThrow(ConflictException);
    });

    it('deletes role + permissions in a single transaction', async () => {
      prisma.role.findFirst.mockResolvedValue({ id: 'r', isSystem: false });
      prisma.userRole.count.mockResolvedValue(0);
      const rpDel = jest.fn();
      const roleDel = jest.fn();
      prisma.$transaction.mockImplementation(async (cb: any) => {
        return cb({
          rolePermission: { deleteMany: rpDel },
          role: { delete: roleDel },
        });
      });
      const r = await service.remove(SCOPE, 'r');
      expect(rpDel).toHaveBeenCalledWith({ where: { roleId: 'r' } });
      expect(roleDel).toHaveBeenCalledWith({ where: { id: 'r' } });
      expect(r).toEqual({ ok: true });
    });
  });
});
