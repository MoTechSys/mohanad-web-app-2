import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/money/money.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../data/ledger_db.dart';
import '../../data/services/report_service.dart';
import '../../domain/enums/enums.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});
  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  DateRange _r = DateRange.thisMonth();
  String _label = 'هذا الشهر';

  @override
  Widget build(BuildContext context) {
    final db = context.watch<LedgerDb>();
    final rep = context.read<AppServices>().reports;
    final s = db.settings;
    final sum = rep.summary(_r);
    final accurate = sum.profit(ProfitMode.accurate, cashPurchaseAsCogs: s.cashPurchaseAsCogs);
    final estimated = sum.profit(ProfitMode.estimated, cashPurchaseAsCogs: s.cashPurchaseAsCogs);
    final cats = rep.expensesByCategory(_r);
    final top = rep.topProducts(_r, limit: 5);
    final days = rep.dailyRevenue(_r);
    final maxDay = days.fold(0, (m, d) => d.value.minor > m ? d.value.minor : m);

    return Scaffold(
      appBar: AppBar(title: const Text('التقارير')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          children: [
            SizedBox(
              height: 40,
              child: ListView(scrollDirection: Axis.horizontal, children: [
                _chip('اليوم', DateRange.today()),
                _chip('هذا الأسبوع', DateRange.thisWeek()),
                _chip('هذا الشهر', DateRange.thisMonth()),
                _chip('آخر 90 يوم', DateRange.lastDays(90)),
                _chip('آخر سنة', DateRange.lastDays(365)),
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: 8),
                  child: ActionChip(
                    avatar: const Icon(Icons.date_range, size: 16),
                    label: const Text('فترة مخصصة'),
                    onPressed: () async {
                      final p = await showDateRangePicker(context: context,
                          firstDate: DateTime(2015), lastDate: DateTime.now().add(const Duration(days: 1)));
                      if (p != null) setState(() { _r = DateRange(p.start, p.end); _label = 'مخصص'; });
                    },
                  ),
                ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text('$_label: ${Fmt.date(_r.start)} → ${Fmt.date(_r.end)}',
                  style: TextStyle(color: context.c.textMuted, fontSize: 12)),
            ),
            const SectionTitle('الأرباح والخسائر'),
            Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(children: [
              _row('مبيعات نقدية', sum.cashSales),
              _row('مبيعات آجلة', sum.creditSales),
              _row('دخل يومي إجمالي', sum.dailyIncome),
              const Divider(),
              _row('إجمالي الإيرادات', sum.revenue, bold: true),
              _row('تكلفة البضاعة (فواتير مفصّلة)', -sum.cogs),
              _row('تكلفة البضاعة (يدوية)', -sum.manualCogs),
              if (s.cashPurchaseAsCogs) _row('مشتريات نقدية (كتكلفة)', -sum.cashPurchases),
              _row('مصروفات تشغيلية', -sum.operatingExpenses),
              const Divider(),
              _row('صافي الربح الدقيق', accurate, bold: true,
                  color: accurate.isNegative ? context.c.danger : context.c.primaryDark),
              _row('صافي الربح التقديري (كل المشتريات)', estimated,
                  color: estimated.isNegative ? context.c.danger : context.c.info),
              const SizedBox(height: 6),
              Text('الدقيق = الإيرادات − تكلفة البضاعة المباعة − المصروفات. التقديري يخصم كل المشتريات (نقدي + آجل) كتكلفة.',
                  style: TextStyle(fontSize: 11, color: context.c.textMuted)),
            ]))),
            const SectionTitle('التدفق النقدي'),
            Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(children: [
              _row('مبيعات نقدية', sum.cashSales),
              _row('دخل يومي', sum.dailyIncome),
              _row('دفعات من العملاء', sum.customerPayments),
              _row('إجمالي الداخل', sum.cashIn, bold: true, color: context.c.primaryDark),
              const Divider(),
              _row('مصروفات', -sum.operatingExpenses),
              _row('مشتريات نقدية', -sum.cashPurchases),
              _row('دفعات للموردين', -sum.supplierPayments),
              _row('إجمالي الخارج', -sum.cashOut, bold: true, color: context.c.danger),
              const Divider(),
              _row('صافي الكاش', sum.netCash, bold: true,
                  color: sum.netCash.isNegative ? context.c.danger : context.c.info),
            ]))),
            const SectionTitle('الديون'),
            Row(children: [
              Expanded(child: StatCard(title: 'ديون جديدة بالفترة', value: sum.newDebts.format(), color: context.c.warning)),
              const SizedBox(width: 8),
              Expanded(child: StatCard(title: 'إجمالي ديون العملاء', value: rep.customersDebt().total.format(), color: context.c.danger)),
              const SizedBox(width: 8),
              Expanded(child: StatCard(title: 'مستحقات التجار', value: rep.suppliersDebt().total.format(), color: context.c.info)),
            ]),
            if (days.isNotEmpty && days.length <= 92) ...[
              const SectionTitle('الإيراد اليومي'),
              Card(child: Padding(padding: const EdgeInsets.all(14), child: SizedBox(
                height: 120,
                child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  for (final d in days)
                    Expanded(child: Tooltip(
                      message: '${Fmt.date(d.day)}: ${d.value.format()}',
                      child: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 1),
                        height: maxDay == 0 ? 2 : (110 * d.value.minor / maxDay).clamp(2, 110).toDouble(),
                        decoration: BoxDecoration(color: context.c.primary, borderRadius: BorderRadius.circular(3)),
                      ),
                    )),
                ]),
              ))),
            ],
            if (cats.isNotEmpty) ...[
              const SectionTitle('المصروفات حسب الفئة'),
              Card(child: Column(children: [
                for (final c in cats)
                  ListTile(dense: true, title: Text(c.name), subtitle: Text('${c.count} عملية'),
                      trailing: MoneyText(c.total, color: context.c.danger)),
              ])),
            ],
            if (top.isNotEmpty) ...[
              const SectionTitle('أكثر المنتجات مبيعاً'),
              Card(child: Column(children: [
                for (final p in top)
                  ListTile(dense: true, title: Text(p.name), subtitle: Text('كمية ${p.qty.format()} • ربح ${p.profit.format()}'),
                      trailing: MoneyText(p.revenue)),
              ])),
            ],
          ],
        ),
      ),
    );
  }

  Widget _chip(String label, DateRange r) => Padding(
    padding: const EdgeInsetsDirectional.only(end: 8),
    child: ChoiceChip(label: Text(label), selected: _label == label,
        onSelected: (_) => setState(() { _r = r; _label = label; })),
  );

  Widget _row(String k, Money v, {bool bold = false, Color? color}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(children: [
      Expanded(child: Text(k, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
          color: bold ? context.c.text : context.c.textMuted))),
      MoneyText(v, signed: v.isNegative, color: color, bold: bold, size: bold ? 16 : 14),
    ]),
  );
}
