import {
  type CancelExpenseInput,
  type CreateExpenseCategoryInput,
  type CreateExpenseInput,
  type ListExpensesQuery,
  cancelExpenseSchema,
  createExpenseCategorySchema,
  createExpenseSchema,
  listExpensesQuerySchema,
} from '@grocery/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { ExpensesService } from './expenses.service';

@ApiTags('Expenses')
@ApiBearerAuth('access-token')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  // ─── Categories ───────────────────────────────────────────
  @Get('categories')
  @RequirePermission('expense_categories.manage')
  @ApiOperation({ summary: 'قائمة تصنيفات المصاريف' })
  listCategories(@CurrentUser() actor: AuthUser) {
    return this.expenses.listCategories({ storeId: actor.storeId, actorId: actor.id });
  }

  @Post('categories')
  @RequirePermission('expense_categories.manage')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createExpenseCategorySchema))
  @ApiOperation({ summary: 'إضافة تصنيف مصاريف' })
  createCategory(@CurrentUser() actor: AuthUser, @Body() body: CreateExpenseCategoryInput) {
    return this.expenses.createCategory({ storeId: actor.storeId, actorId: actor.id }, body);
  }

  @Delete('categories/:id')
  @RequirePermission('expense_categories.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف تصنيف مصاريف' })
  deleteCategory(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.expenses.deleteCategory({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  // ─── Expenses ─────────────────────────────────────────────
  @Get()
  @RequirePermission('expenses.view')
  @UsePipes(new ZodValidationPipe(listExpensesQuerySchema, 'query'))
  @ApiOperation({ summary: 'قائمة المصاريف' })
  list(@CurrentUser() actor: AuthUser, @Query() query: ListExpensesQuery) {
    return this.expenses.list({ storeId: actor.storeId, actorId: actor.id }, query);
  }

  @Get(':id')
  @RequirePermission('expenses.view')
  @ApiOperation({ summary: 'تفاصيل مصروف' })
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.expenses.findOne({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  @Post()
  @RequirePermission('expenses.create')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createExpenseSchema))
  @ApiOperation({ summary: 'تسجيل مصروف جديد' })
  create(@CurrentUser() actor: AuthUser, @Body() body: CreateExpenseInput) {
    return this.expenses.create({ storeId: actor.storeId, actorId: actor.id }, body);
  }

  @Post(':id/cancel')
  @RequirePermission('expenses.cancel')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(cancelExpenseSchema))
  @ApiOperation({ summary: 'إلغاء مصروف' })
  cancel(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: CancelExpenseInput,
  ) {
    return this.expenses.cancel({ storeId: actor.storeId, actorId: actor.id }, id, body);
  }
}
