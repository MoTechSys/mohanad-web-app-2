import {
  type CreateProductInput,
  type ListProductsQuery,
  type UpdateProductInput,
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
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
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth('access-token')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermission('products.view')
  @UsePipes(new ZodValidationPipe(listProductsQuerySchema, 'query'))
  @ApiOperation({ summary: 'قائمة المنتجات' })
  list(@CurrentUser() actor: AuthUser, @Query() query: ListProductsQuery) {
    return this.products.list({ storeId: actor.storeId, actorId: actor.id }, query);
  }

  @Get(':id')
  @RequirePermission('products.view')
  @ApiOperation({ summary: 'تفاصيل منتج' })
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.products.findOne({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  @Post()
  @RequirePermission('products.create')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createProductSchema))
  @ApiOperation({ summary: 'إضافة منتج جديد' })
  create(@CurrentUser() actor: AuthUser, @Body() body: CreateProductInput) {
    return this.products.create({ storeId: actor.storeId, actorId: actor.id }, body);
  }

  @Patch(':id')
  @RequirePermission('products.update')
  @UsePipes(new ZodValidationPipe(updateProductSchema))
  @ApiOperation({ summary: 'تعديل بيانات منتج' })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateProductInput,
  ) {
    return this.products.update({ storeId: actor.storeId, actorId: actor.id }, id, body);
  }

  @Delete(':id')
  @RequirePermission('products.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف منتج (soft delete)' })
  remove(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.products.remove({ storeId: actor.storeId, actorId: actor.id }, id);
  }
}
