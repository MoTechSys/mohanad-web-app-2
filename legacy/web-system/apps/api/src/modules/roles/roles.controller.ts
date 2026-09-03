/**
 * RolesController — Phase 2 RBAC.
 *
 * Permissions used:
 *   • roles.view                — list, get one
 *   • roles.create              — POST /roles
 *   • roles.update              — PATCH /roles/:id
 *   • roles.assign_permissions  — PUT /roles/:id/permissions (replace set)
 *   • roles.clone               — POST /roles/clone
 *   • roles.delete              — DELETE /roles/:id
 */

import {
  type CloneRoleInput,
  type CreateRoleInput,
  type SetPermissionsInput,
  type UpdateRoleInput,
  cloneRoleSchema,
  createRoleSchema,
  setPermissionsSchema,
  updateRoleSchema,
} from '@grocery/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { RolesService } from './roles.service';

@ApiTags('Roles')
@ApiBearerAuth('access-token')
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission('roles.view')
  @ApiOperation({ summary: 'قائمة الأدوار (مع عدد الصلاحيات والمستخدمين)' })
  list(@CurrentUser() actor: AuthUser) {
    return this.roles.list({ storeId: actor.storeId });
  }

  @Get(':id')
  @RequirePermission('roles.view')
  @ApiOperation({ summary: 'تفاصيل الدور + قائمة صلاحياته' })
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.roles.findOne({ storeId: actor.storeId }, id);
  }

  @Post()
  @RequirePermission('roles.create')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createRoleSchema))
  @ApiOperation({ summary: 'إنشاء دور جديد + صلاحياته' })
  create(@CurrentUser() actor: AuthUser, @Body() body: CreateRoleInput) {
    return this.roles.create({ storeId: actor.storeId }, body);
  }

  @Patch(':id')
  @RequirePermission('roles.update')
  @UsePipes(new ZodValidationPipe(updateRoleSchema))
  @ApiOperation({ summary: 'تعديل الدور (الأدوار النظامية: الوصف فقط)' })
  update(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() body: UpdateRoleInput) {
    return this.roles.update({ storeId: actor.storeId }, id, body);
  }

  @Put(':id/permissions')
  @RequirePermission('roles.assign_permissions')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(setPermissionsSchema))
  @ApiOperation({ summary: 'استبدال صلاحيات الدور بالكامل' })
  setPermissions(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: SetPermissionsInput,
  ) {
    return this.roles.setPermissions({ storeId: actor.storeId, actorId: actor.id }, id, body);
  }

  @Post('clone')
  @RequirePermission('roles.clone')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(cloneRoleSchema))
  @ApiOperation({ summary: 'استنساخ دور (بأسم/مفتاح جديد، نفس الصلاحيات)' })
  clone(@CurrentUser() actor: AuthUser, @Body() body: CloneRoleInput) {
    return this.roles.clone({ storeId: actor.storeId }, body);
  }

  @Delete(':id')
  @RequirePermission('roles.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف الدور (لا يجوز للأدوار النظامية)' })
  remove(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.roles.remove({ storeId: actor.storeId }, id);
  }
}
