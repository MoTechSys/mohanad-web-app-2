/**
 * ReportsService — Phase 6 (P6-2).
 * لوحة التحكم والتقارير المالية.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ReportScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** لوحة تحكم اليوم: مبيعات + مصاريف + إيرادات + مستحقات */
  async dashboard(scope: ReportScope) {
    const { storeId } = scope;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [sales, expenses, dailyIncome, customersDebt, suppliersDebt] =
      await this.prisma.$transaction([
        // إجمالي مبيعات اليوم
        this.prisma.sale.aggregate({
          where: { storeId, cancelledAt: null, saleDate: { gte: today, lt: tomorrow } },
          _sum: { netAmount: true },
          _count: true,
        }),
        // إجمالي مصاريف اليوم
        this.prisma.expense.aggregate({
          where: { storeId, cancelledAt: null, expenseDate: { gte: today, lt: tomorrow } },
          _sum: { amount: true },
          _count: true,
        }),
        // إيرادات يومية اليوم
        this.prisma.dailyIncome.aggregate({
          where: { storeId, cancelledAt: null, incomeDate: { gte: today, lt: tomorrow } },
          _sum: { amount: true },
          _count: true,
        }),
        // إجمالي ديون العملاء (currentBalance > 0)
        this.prisma.customer.aggregate({
          where: { storeId, deletedAt: null, currentBalance: { gt: 0 } },
          _sum: { currentBalance: true },
          _count: true,
        }),
        // إجمالي ديون التجار (currentBalance > 0)
        this.prisma.supplier.aggregate({
          where: { storeId, deletedAt: null, currentBalance: { gt: 0 } },
          _sum: { currentBalance: true },
          _count: true,
        }),
      ]);

    const salesToday = Number(sales._sum.netAmount ?? 0);
    const expensesToday = Number(expenses._sum.amount ?? 0);
    const incomesToday = Number(dailyIncome._sum.amount ?? 0);
    const netToday = salesToday + incomesToday - expensesToday;

    return {
      today: {
        sales: { total: salesToday, count: sales._count },
        expenses: { total: expensesToday, count: expenses._count },
        income: { total: incomesToday, count: dailyIncome._count },
        net: netToday,
      },
      outstanding: {
        customersDebt: {
          total: Number(customersDebt._sum.currentBalance ?? 0),
          count: customersDebt._count,
        },
        suppliersDebt: {
          total: Number(suppliersDebt._sum.currentBalance ?? 0),
          count: suppliersDebt._count,
        },
      },
    };
  }

  /** ملخص يومي لفترة محددة */
  async dailySummary(scope: ReportScope, dateFrom: Date, dateTo: Date) {
    const { storeId } = scope;
    const [sales, expenses, incomes] = await this.prisma.$transaction([
      this.prisma.sale.groupBy({
        by: ['paymentType'],
        where: { storeId, cancelledAt: null, saleDate: { gte: dateFrom, lte: dateTo } },
        orderBy: { paymentType: 'asc' },
        _sum: { netAmount: true },
        _count: true,
      }),
      this.prisma.expense.groupBy({
        by: ['type'],
        where: { storeId, cancelledAt: null, expenseDate: { gte: dateFrom, lte: dateTo } },
        orderBy: { type: 'asc' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.dailyIncome.aggregate({
        where: { storeId, cancelledAt: null, incomeDate: { gte: dateFrom, lte: dateTo } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const totalSales = sales.reduce((s, g) => s + Number(g._sum?.netAmount ?? 0), 0);
    const cashSales = sales.find((g) => g.paymentType === 'CASH')?._sum?.netAmount ?? 0;
    const creditSales = sales.find((g) => g.paymentType === 'CREDIT')?._sum?.netAmount ?? 0;
    const totalExpenses = expenses.reduce((s, g) => s + Number(g._sum?.amount ?? 0), 0);
    const totalIncome = Number(incomes._sum.amount ?? 0);

    return {
      period: { from: dateFrom, to: dateTo },
      sales: {
        total: totalSales,
        cash: Number(cashSales),
        credit: Number(creditSales),
        count: sales.reduce((s, g) => s + Number(g._count ?? 0), 0),
      },
      expenses: {
        total: totalExpenses,
        count: expenses.reduce((s, g) => s + Number(g._count ?? 0), 0),
        byType: expenses.map((g) => ({
          type: g.type,
          total: Number(g._sum?.amount ?? 0),
          count: Number(g._count ?? 0),
        })),
      },
      income: { total: totalIncome, count: incomes._count ?? 0 },
      net: totalSales + totalIncome - totalExpenses,
    };
  }

  /** أعلى العملاء مديونية */
  async topDebtors(scope: ReportScope, limit = 10) {
    return this.prisma.customer.findMany({
      where: { storeId: scope.storeId, deletedAt: null, currentBalance: { gt: 0 } },
      orderBy: { currentBalance: 'desc' },
      take: limit,
      select: { id: true, name: true, phone: true, currentBalance: true, creditLimit: true },
    });
  }

  /** أعلى التجار مديونية */
  async topSupplierDebts(scope: ReportScope, limit = 10) {
    return this.prisma.supplier.findMany({
      where: { storeId: scope.storeId, deletedAt: null, currentBalance: { gt: 0 } },
      orderBy: { currentBalance: 'desc' },
      take: limit,
      select: { id: true, name: true, phone: true, currentBalance: true },
    });
  }

  /** أكثر المنتجات مبيعاً */
  async topProducts(scope: ReportScope, dateFrom: Date, dateTo: Date, limit = 10) {
    const grouped = await this.prisma.saleItem.groupBy({
      by: ['productId', 'nameSnapshot'],
      where: {
        sale: {
          storeId: scope.storeId,
          cancelledAt: null,
          saleDate: { gte: dateFrom, lte: dateTo },
        },
      },
      _sum: { quantity: true, totalPrice: true },
      _count: true,
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: limit,
    });
    return grouped.map((g) => ({
      productId: g.productId,
      name: g.nameSnapshot,
      totalQty: Number(g._sum.quantity ?? 0),
      totalRevenue: Number(g._sum.totalPrice ?? 0),
      invoices: g._count,
    }));
  }
}
