/**
 * UsersService — Jest spec.
 *
 * Covers: list, findOne, create (uniqueness + role check), assignRoles,
 * deactivate (revokes refresh tokens in same tx), self-deactivation guard,
 * resetPassword, soft delete, effectivePermissions (union of active roles).
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users.service';

import bcrypt from 'bcrypt';

const SCOPE = { storeId: 'store-1', actorId: 'actor-1' };

const buildPrismaMock = () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  role: {
    count: jest.fn(),
  },
  refreshToken: {
    updateMany: jest.fn(),
  },
  userRole: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const m = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = m.get(UsersService);
  });

  // ─── list ─────────────────────────────────────────────────
  describe('list', () => {
    it('paginates with defaults page=1, limit=20', async () => {
      prisma.$transaction.mockResolvedValue([
        [
          {
            id: 'u1',
            username: 'u1',
            fullName: 'User One',
            phone: null,
            isActive: true,
            lastLoginAt: null,
            createdAt: new Date(),
            userRoles: [{ role: { id: 'r1', key: 'Owner', name: 'Owner' } }],
          },
        ],
        1,
      ]);
      const res = await service.list(SCOPE, {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortDir: 'desc',
      } as any);
      expect(res.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(res.items[0].roles).toEqual([{ id: 'r1', key: 'Owner', name: 'Owner' }]);
    });
  });

  // ─── findOne ──────────────────────────────────────────────
  describe('findOne', () => {
    it('throws USER_NOT_FOUND when none found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.findOne(SCOPE, 'nope')).rejects.toThrow(NotFoundException);
    });
    it('shapes the result with roles array', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        username: 'u1',
        userRoles: [
          {
            assignedAt: new Date(),
            role: { id: 'r1', key: 'Owner', name: 'Owner', isSystem: true },
          },
        ],
      });
      const r = await service.findOne(SCOPE, 'u1');
      expect(r.roles[0]).toMatchObject({ id: 'r1', isSystem: true });
    });
  });

  // ─── create ───────────────────────────────────────────────
  describe('create', () => {
    it('throws USERNAME_TAKEN when username already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'taken' });
      await expect(
        service.create(SCOPE, {
          username: 'mariam',
          password: 'Mariam@12345',
          fullName: 'Mariam',
          phone: null,
          isActive: true,
          roleIds: ['r1'],
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ROLE_NOT_FOUND when one of the roles is not in store', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.count.mockResolvedValue(0);
      await expect(
        service.create(SCOPE, {
          username: 'mariam',
          password: 'Mariam@12345',
          fullName: 'Mariam',
          phone: null,
          isActive: true,
          roleIds: ['r1'],
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('hashes password (bcrypt 12 rounds) and creates user + roles in tx', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.count.mockResolvedValue(1);
      const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          user: { create: jest.fn().mockResolvedValue({ id: 'new-id' }) },
          userRole: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
        };
        return cb(tx);
      });
      // findOne after create
      prisma.user.findFirst.mockResolvedValue({
        id: 'new-id',
        username: 'mariam',
        userRoles: [
          {
            assignedAt: new Date(),
            role: { id: 'r1', key: 'SalesWorker', name: 'SW', isSystem: true },
          },
        ],
      });

      const r = await service.create(SCOPE, {
        username: 'mariam',
        password: 'Mariam@12345',
        fullName: 'Mariam',
        phone: null,
        isActive: true,
        roleIds: ['r1'],
      } as any);
      expect(hashSpy).toHaveBeenCalledWith('Mariam@12345', 12);
      expect(r.id).toBe('new-id');
    });
  });

  // ─── deactivate ───────────────────────────────────────────
  describe('deactivate', () => {
    it('throws CANNOT_SELF_DEACTIVATE when actor === target', async () => {
      await expect(service.deactivate(SCOPE, SCOPE.actorId)).rejects.toThrow(ConflictException);
    });

    it('revokes refresh tokens in the SAME transaction', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'other' });
      const txUserUpdate = jest.fn().mockResolvedValue({});
      const txTokenUpdate = jest.fn().mockResolvedValue({ count: 4 });
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          user: { update: txUserUpdate },
          refreshToken: { updateMany: txTokenUpdate },
        };
        return cb(tx);
      });
      const r = await service.deactivate(SCOPE, 'other');
      expect(txUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'other' }, data: { isActive: false } }),
      );
      expect(txTokenUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'other', revokedAt: null } }),
      );
      expect(r.refreshTokensRevoked).toBe(4);
    });
  });

  // ─── resetPassword ────────────────────────────────────────
  describe('resetPassword', () => {
    it('hashes new password (12 rounds) + revokes sessions', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u' });
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('h' as never);
      const userUpdate = jest.fn();
      const tokenUpdate = jest.fn().mockResolvedValue({ count: 2 });
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          user: { update: userUpdate },
          refreshToken: { updateMany: tokenUpdate },
        };
        return cb(tx);
      });
      const r = await service.resetPassword(SCOPE, 'u', { newPassword: 'New@12345' } as any);
      expect(bcrypt.hash).toHaveBeenCalledWith('New@12345', 12);
      expect(r).toEqual({ ok: true });
      expect(userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
        }),
      );
    });
  });

  // ─── assignRoles ──────────────────────────────────────────
  describe('assignRoles', () => {
    it('replaces all roles in a single transaction', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u' });
      prisma.role.count.mockResolvedValue(2);
      const del = jest.fn();
      const cre = jest.fn();
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = { userRole: { deleteMany: del, createMany: cre } };
        return cb(tx);
      });
      // findOne after assign
      prisma.user.findFirst.mockResolvedValue({
        id: 'u',
        username: 'u',
        userRoles: [
          { assignedAt: new Date(), role: { id: 'r1', key: 'k', name: 'n', isSystem: false } },
        ],
      });
      await service.assignRoles(SCOPE, 'u', { roleIds: ['r1', 'r2'] } as any);
      expect(del).toHaveBeenCalledWith({ where: { userId: 'u' } });
      expect(cre).toHaveBeenCalledWith({
        data: [
          { userId: 'u', roleId: 'r1' },
          { userId: 'u', roleId: 'r2' },
        ],
      });
    });
  });

  // ─── effectivePermissions ─────────────────────────────────
  describe('effectivePermissions', () => {
    it('returns union of permission keys from ACTIVE roles only', async () => {
      prisma.user.findFirst.mockResolvedValue({
        userRoles: [
          {
            role: {
              isActive: true,
              rolePermissions: [{ permission: { key: 'a' } }, { permission: { key: 'b' } }],
            },
          },
          {
            role: {
              isActive: false, // skipped
              rolePermissions: [{ permission: { key: 'skipped' } }],
            },
          },
          {
            role: {
              isActive: true,
              rolePermissions: [
                { permission: { key: 'b' } }, // dedup
                { permission: { key: 'c' } },
              ],
            },
          },
        ],
      });
      const r = await service.effectivePermissions(SCOPE, 'u');
      expect(r).toEqual(['a', 'b', 'c']);
    });

    it('throws USER_NOT_FOUND when user is missing', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.effectivePermissions(SCOPE, 'nope')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── soft delete ──────────────────────────────────────────
  describe('remove (soft delete)', () => {
    it('throws CANNOT_SELF_DELETE when removing self', async () => {
      await expect(service.remove(SCOPE, SCOPE.actorId)).rejects.toThrow(ConflictException);
    });
    it('marks deletedAt + revokes refresh tokens', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u' });
      const userUpd = jest.fn();
      const tokUpd = jest.fn().mockResolvedValue({ count: 1 });
      prisma.$transaction.mockImplementation(async (cb: any) => {
        return cb({
          user: { update: userUpd },
          refreshToken: { updateMany: tokUpd },
        });
      });
      const r = await service.remove(SCOPE, 'u');
      expect(r).toEqual({ ok: true });
      expect(userUpd).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
        }),
      );
      expect(tokUpd).toHaveBeenCalled();
    });
  });
});
