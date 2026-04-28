/**
 * UsersController — Phase 2 RBAC.
 *
 * All endpoints require authentication (global JwtAuthGuard) AND a specific
 * permission via `@RequirePermission(...)`.
 *
 * Permissions used:
 *   • users.view             — list, get one, effective-permissions
 *   • users.create           — POST /users
 *   • users.update           — PATCH /users/:id
 *   • users.activate         — POST /users/:id/activate
 *   • users.deactivate       — POST /users/:id/deactivate
 *   • users.reset_password   — POST /users/:id/reset-password
 *   • users.assign_roles     — POST /users/:id/roles
 *   • users.delete           — DELETE /users/:id  (soft delete)
 */

import {
  type AssignRolesInput,
  type CreateUserInput,
  type ListUsersQuery,
  type ResetPasswordInput,
  type UpdateUserInput,
  assignRolesSchema,
  createUserSchema,
  listUsersQuerySchema,
  resetPasswordSchema,
  updateUserSchema,
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
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // ─── List (paginated) ───────────────────────────────────────
  @Get()
  @RequirePermission('users.view')
  @ApiOperation({ summary: 'قائمة المستخدمين (pagination + search + filters)' })
  @UsePipes(new ZodValidationPipe(listUsersQuerySchema, 'query'))
  list(@CurrentUser() actor: AuthUser, @Query() query: ListUsersQuery) {
    return this.users.list({ storeId: actor.storeId, actorId: actor.id }, query);
  }

  // ─── Detail ─────────────────────────────────────────────────
  @Get(':id')
  @RequirePermission('users.view')
  @ApiOperation({ summary: 'تفاصيل مستخدم' })
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.users.findOne({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  // ─── Effective permissions ──────────────────────────────────
  @Get(':id/effective-permissions')
  @RequirePermission('users.view')
  @ApiOperation({ summary: 'الصلاحيات الفعلية (اتحاد كل الأدوار)' })
  async effectivePermissions(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    const permissions = await this.users.effectivePermissions(
      { storeId: actor.storeId, actorId: actor.id },
      id,
    );
    return { userId: id, permissions };
  }

  // ─── Create ─────────────────────────────────────────────────
  @Post()
  @RequirePermission('users.create')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createUserSchema))
  @ApiOperation({ summary: 'إنشاء مستخدم جديد + تعيين الأدوار' })
  create(@CurrentUser() actor: AuthUser, @Body() body: CreateUserInput) {
    return this.users.create({ storeId: actor.storeId, actorId: actor.id }, body);
  }

  // ─── Update profile ─────────────────────────────────────────
  @Patch(':id')
  @RequirePermission('users.update')
  @UsePipes(new ZodValidationPipe(updateUserSchema))
  @ApiOperation({ summary: 'تعديل بيانات المستخدم' })
  update(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() body: UpdateUserInput) {
    return this.users.update({ storeId: actor.storeId, actorId: actor.id }, id, body);
  }

  // ─── Activate ────────────────────────────────────────────────
  @Post(':id/activate')
  @RequirePermission('users.activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تفعيل المستخدم' })
  activate(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.users.activate({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  // ─── Deactivate (revokes all refresh tokens) ────────────────
  @Post(':id/deactivate')
  @RequirePermission('users.deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تعطيل المستخدم — يلغي كل الجلسات' })
  deactivate(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.users.deactivate({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  // ─── Reset password (admin) ─────────────────────────────────
  @Post(':id/reset-password')
  @RequirePermission('users.reset_password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  @ApiOperation({ summary: 'إعادة تعيين كلمة المرور (إداري) — يلغي الجلسات' })
  resetPassword(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: ResetPasswordInput,
  ) {
    return this.users.resetPassword({ storeId: actor.storeId, actorId: actor.id }, id, body);
  }

  // ─── Assign roles (replace) ─────────────────────────────────
  @Post(':id/roles')
  @RequirePermission('users.assign_roles')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(assignRolesSchema))
  @ApiOperation({ summary: 'تعيين أدوار المستخدم (يستبدل القائمة)' })
  assignRoles(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: AssignRolesInput,
  ) {
    return this.users.assignRoles({ storeId: actor.storeId, actorId: actor.id }, id, body);
  }

  // ─── Soft delete ────────────────────────────────────────────
  @Delete(':id')
  @RequirePermission('users.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف المستخدم (soft delete) — يلغي الجلسات' })
  remove(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.users.remove({ storeId: actor.storeId, actorId: actor.id }, id);
  }
}
