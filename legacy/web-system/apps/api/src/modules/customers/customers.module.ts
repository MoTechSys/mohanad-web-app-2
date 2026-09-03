import { Module } from '@nestjs/common';

import { CustomerTransactionsController } from './customer-transactions.controller';
import { CustomerTransactionsService } from './customer-transactions.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  controllers: [CustomersController, CustomerTransactionsController],
  providers: [CustomersService, CustomerTransactionsService],
  exports: [CustomersService, CustomerTransactionsService],
})
export class CustomersModule {}
