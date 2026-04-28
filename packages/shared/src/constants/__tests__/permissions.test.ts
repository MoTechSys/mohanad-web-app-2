import { describe, expect, it } from 'vitest';
import { ALL_PERMISSION_CODES, PERMISSIONS, describePermission } from '../permissions';
import { SYSTEM_ROLES, SYSTEM_ROLE_NAMES } from '../roles';

describe('PERMISSIONS', () => {
  it('exposes the SYSTEM module with expected codes', () => {
    expect(PERMISSIONS.SYSTEM.DASHBOARD_VIEW).toBe('system.dashboard.view');
    expect(PERMISSIONS.SYSTEM.BACKUP_RESTORE).toBe('system.backup.restore');
  });

  it('exposes the USERS module with CRUD codes', () => {
    expect(PERMISSIONS.USERS.VIEW).toBe('users.view');
    expect(PERMISSIONS.USERS.CREATE).toBe('users.create');
    expect(PERMISSIONS.USERS.DELETE).toBe('users.delete');
  });

  it('uses lowercase dot.notation for all codes', () => {
    for (const code of ALL_PERMISSION_CODES) {
      expect(code).toMatch(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/);
    }
  });

  it('contains no duplicate codes', () => {
    const set = new Set(ALL_PERMISSION_CODES);
    expect(set.size).toBe(ALL_PERMISSION_CODES.length);
  });

  it('lists at least 50 permissions (sanity floor)', () => {
    expect(ALL_PERMISSION_CODES.length).toBeGreaterThanOrEqual(50);
  });
});

describe('SYSTEM_ROLES', () => {
  it('defines all six system roles', () => {
    const names = SYSTEM_ROLES.map((r) => r.name);
    expect(names).toContain(SYSTEM_ROLE_NAMES.OWNER);
    expect(names).toContain(SYSTEM_ROLE_NAMES.MANAGER);
    expect(names).toContain(SYSTEM_ROLE_NAMES.SALES_WORKER);
    expect(names).toContain(SYSTEM_ROLE_NAMES.ACCOUNTANT);
    expect(names).toContain(SYSTEM_ROLE_NAMES.PURCHASING_OFFICER);
    expect(names).toContain(SYSTEM_ROLE_NAMES.INVENTORY_OFFICER);
  });

  it('grants the Owner every permission', () => {
    const owner = SYSTEM_ROLES.find((r) => r.name === SYSTEM_ROLE_NAMES.OWNER);
    expect(owner).toBeDefined();
    expect(owner?.permissions.length).toBe(ALL_PERMISSION_CODES.length);
  });

  it('excludes BACKUP_RESTORE, USERS.DELETE and ROLES.DELETE from the Manager', () => {
    const manager = SYSTEM_ROLES.find((r) => r.name === SYSTEM_ROLE_NAMES.MANAGER);
    expect(manager).toBeDefined();
    expect(manager?.permissions).not.toContain(PERMISSIONS.SYSTEM.BACKUP_RESTORE);
    expect(manager?.permissions).not.toContain(PERMISSIONS.USERS.DELETE);
    expect(manager?.permissions).not.toContain(PERMISSIONS.ROLES.DELETE);
  });

  it('every role permission must reference a known permission code', () => {
    const known = new Set(ALL_PERMISSION_CODES);
    for (const role of SYSTEM_ROLES) {
      for (const code of role.permissions) {
        expect(known.has(code)).toBe(true);
      }
    }
  });

  it('role permission lists must contain no duplicates', () => {
    for (const role of SYSTEM_ROLES) {
      const set = new Set(role.permissions);
      expect(set.size).toBe(role.permissions.length);
    }
  });

  it('every role has a non-empty Arabic label', () => {
    for (const role of SYSTEM_ROLES) {
      expect(role.labelAr.length).toBeGreaterThan(0);
    }
  });
});

describe('describePermission', () => {
  it('returns metadata for a known permission code', () => {
    const meta = describePermission(PERMISSIONS.USERS.CREATE);
    expect(meta.code).toBe('users.create');
    expect(meta.module).toBe('users');
    expect(meta.action).toBe('create');
    expect(meta.groupAr.length).toBeGreaterThan(0);
  });

  it('handles dotted action paths (e.g. system.backup.restore)', () => {
    const meta = describePermission(PERMISSIONS.SYSTEM.BACKUP_RESTORE);
    expect(meta.module).toBe('system');
    // action keeps the rest joined by '.'
    expect(meta.action).toBe('backup.restore');
  });

  it('falls back gracefully for an unknown module code', () => {
    const meta = describePermission('mystery.action');
    expect(meta.code).toBe('mystery.action');
    expect(meta.module).toBe('mystery');
    expect(meta.action).toBe('action');
    // unknown module → groupAr defaults to the module slug itself
    expect(meta.groupAr).toBe('mystery');
  });

  it('treats a code without a dot as module + default view action', () => {
    const meta = describePermission('orphan');
    expect(meta.module).toBe('orphan');
    expect(meta.action).toBe('view');
  });

  it('returns a result for every code in ALL_PERMISSION_CODES', () => {
    for (const code of ALL_PERMISSION_CODES) {
      const meta = describePermission(code);
      expect(meta.code).toBe(code);
      expect(meta.module.length).toBeGreaterThan(0);
      expect(meta.groupAr.length).toBeGreaterThan(0);
    }
  });
});
