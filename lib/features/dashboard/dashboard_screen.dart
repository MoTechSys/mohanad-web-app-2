import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../data/ledger_db.dart';
import '../../data/services/report_service.dart';
import '../customers/customer_detail_screen.dart';
import '../daily_income/daily_income_sheet.dart';
import '../expenses/expense_sheet.dart';
import '../products/products_screen.dart';
import '../purchases/purchase_sheet.dart';
import '../reports/reports_screen.dart';
import '../sales/sale_sheet.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final db = context.watch<LedgerDb>();
    final app = context.read<AppServices>();
    final rep = app.reports;
    final today = rep.summary(DateRange.today());
    final month = rep.summary(DateRange.thisMonth());
    final s = db.settings;
    final cur = s.currency;
    final debtors = rep.topDebtors(limit: 5);
    final lowStock = s.inventoryEnabled ? rep.lowStock() : const [];
    final overLimit = rep.overLimitCustomers();
    final totalDebt = rep.customersDebt().total;
    final totalSupplierDebt = rep.suppliersDebt().total;
    final profitToday = today.profit(
      s.profitMode,
      cashPurchaseAsCogs: s.cashPurchaseAsCogs,
    );

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(s.storeName),
            Text(
              '${Fmt.dayName(DateTime.now())} ${Fmt.date(DateTime.now())}',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'التقارير',
            icon: const Icon(Icons.bar_chart),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ReportsScreen()),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          children: [
            // Hero card
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primaryDark, AppColors.primary],
                  begin: Alignment.topRight,
                  end: Alignment.bottomLeft,
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'إجمالي مبيعات اليوم',
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    Fmt.money(today.revenue, currency: cur),
                    textDirection: TextDirection.ltr,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (s.dailyTarget != null && s.dailyTarget!.isPositive) ...[
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: LinearProgressIndicator(
                        minHeight: 8,
                        value: (today.revenue.minor / s.dailyTarget!.minor)
                            .clamp(0.0, 1.0),
                        backgroundColor: Colors.white24,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'الهدف اليومي: ${Fmt.money(s.dailyTarget!, currency: cur)}',
                      style: const TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ],
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      _heroStat('نقدي', today.cashSales.format()),
                      _heroStat('آجل', today.creditSales.format()),
                      _heroStat('دخل يومي', today.dailyIncome.format()),
                      _heroStat('عدد الفواتير', '${today.salesCount}'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            // Quick actions
            Row(
              children: [
                _quick(
                  context,
                  'بيع',
                  Icons.add_shopping_cart,
                  AppColors.primaryDark,
                  () => showFormSheet(context, const SaleSheet()),
                ),
                _quick(
                  context,
                  'دخل يومي',
                  Icons.today,
                  AppColors.info,
                  () => showFormSheet(context, const DailyIncomeSheet()),
                ),
                _quick(
                  context,
                  'مصروف',
                  Icons.payments_outlined,
                  AppColors.danger,
                  () => showFormSheet(context, const ExpenseSheet()),
                ),
                _quick(
                  context,
                  'شراء',
                  Icons.inventory_2_outlined,
                  AppColors.warning,
                  () => showFormSheet(context, const PurchaseSheet()),
                ),
              ],
            ),
            const SectionTitle('اليوم'),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.9,
              children: [
                StatCard(
                  title: 'مقبوضات (كاش داخل)',
                  value: today.cashIn.format(),
                  icon: Icons.arrow_downward,
                  color: AppColors.primaryDark,
                ),
                StatCard(
                  title: 'مدفوعات (كاش خارج)',
                  value: today.cashOut.format(),
                  icon: Icons.arrow_upward,
                  color: AppColors.danger,
                ),
                StatCard(
                  title: 'صافي الكاش',
                  value: today.netCash.format(),
                  icon: Icons.account_balance_wallet_outlined,
                  color: today.netCash.isNegative
                      ? AppColors.danger
                      : AppColors.info,
                ),
                StatCard(
                  title: 'الربح (${s.profitMode.label})',
                  value: profitToday.format(),
                  icon: Icons.trending_up,
                  color: profitToday.isNegative
                      ? AppColors.danger
                      : AppColors.primaryDark,
                ),
              ],
            ),
            const SectionTitle('هذا الشهر'),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.9,
              children: [
                StatCard(
                  title: 'إيرادات الشهر',
                  value: month.revenue.format(),
                  icon: Icons.show_chart,
                ),
                StatCard(
                  title: 'مصروفات الشهر',
                  value: month.operatingExpenses.format(),
                  icon: Icons.receipt_long_outlined,
                  color: AppColors.danger,
                ),
                StatCard(
                  title: 'ديون العملاء',
                  value: totalDebt.format(),
                  icon: Icons.people_outline,
                  color: AppColors.warning,
                  subtitle: '${db.activeCustomers.length} عميل',
                ),
                StatCard(
                  title: 'مستحقات التجار',
                  value: totalSupplierDebt.format(),
                  icon: Icons.local_shipping_outlined,
                  color: AppColors.info,
                  subtitle: '${db.activeSuppliers.length} مورد',
                ),
              ],
            ),
            if (overLimit.isNotEmpty || lowStock.isNotEmpty) ...[
              const SectionTitle('تنبيهات'),
              if (overLimit.isNotEmpty)
                _alert(
                  context,
                  Icons.warning_amber_rounded,
                  AppColors.warning,
                  '${overLimit.length} عميل تجاوز حد الائتمان',
                  null,
                ),
              if (lowStock.isNotEmpty)
                _alert(
                  context,
                  Icons.inventory_outlined,
                  AppColors.danger,
                  '${lowStock.length} منتج وصل حد النقص',
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ProductsScreen()),
                  ),
                ),
            ],
            if (debtors.isNotEmpty) ...[
              const SectionTitle('أكبر المدينين'),
              Card(
                child: Column(
                  children: [
                    for (final c in debtors)
                      ListTile(
                        dense: true,
                        leading: CircleAvatar(
                          backgroundColor: AppColors.warningLight,
                          child: Text(
                            c.name.characters.first,
                            style: const TextStyle(
                              color: AppColors.warning,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        title: Text(c.name),
                        trailing: MoneyText(
                          db.customerBalance(c.id),
                          color: AppColors.danger,
                        ),
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => CustomerDetailScreen(customerId: c.id),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _heroStat(String label, String value) => Expanded(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: Colors.white70, fontSize: 11),
        ),
        FittedBox(
          child: Text(
            value,
            textDirection: TextDirection.ltr,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    ),
  );

  Widget _quick(
    BuildContext context,
    String label,
    IconData icon,
    Color color,
    VoidCallback onTap,
  ) => Expanded(
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: [
              Icon(icon, color: color),
              const SizedBox(height: 6),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );

  Widget _alert(
    BuildContext context,
    IconData icon,
    Color color,
    String text,
    VoidCallback? onTap,
  ) => Card(
    child: ListTile(
      leading: Icon(icon, color: color),
      title: Text(text, style: const TextStyle(fontWeight: FontWeight.w600)),
      trailing: onTap == null ? null : const Icon(Icons.chevron_left),
      onTap: onTap,
    ),
  );
}
