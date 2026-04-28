/**
 * PermissionsService — read-only catalog of all permissions seeded in DB.
 *
 * Permissions are the source of truth for the role editor UI. They are NEVER
 * created/updated/deleted at runtime — they are seeded by `prisma/seed.ts`
 * from `packages/shared/src/constants/permissions.ts`.
 *
 * The endpoint returns permissions grouped by `module` for the role editor
 * tree view (Arabic labels via the seeded `name` field).
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export interface PermissionDto {
  key: string;
  name: string;
  module: string;
  description: string | null;
}

export interface PermissionGroupDto {
  module: string;
  permissions: PermissionDto[];
}

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(): Promise<{
    items: PermissionDto[];
    groups: PermissionGroupDto[];
    total: number;
  }> {
    const rows = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { key: 'asc' }],
      select: { key: true, name: true, module: true, description: true },
    });
    const items: PermissionDto[] = rows.map((r) => ({
      key: r.key,
      name: r.name,
      module: r.module,
      description: r.description,
    }));

    // Group by module preserving insertion order
    const grouped = new Map<string, PermissionDto[]>();
    for (const p of items) {
      const arr = grouped.get(p.module) ?? [];
      arr.push(p);
      grouped.set(p.module, arr);
    }
    const groups: PermissionGroupDto[] = Array.from(grouped.entries()).map(([module, perms]) => ({
      module,
      permissions: perms,
    }));

    return { items, groups, total: items.length };
  }
}
