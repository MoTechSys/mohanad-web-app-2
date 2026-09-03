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
import '../../domain/models/documents.dart';
import '../daily_income/daily_income_sheet.dart';
import 'sale_sheet.dart';

/// Sales + daily income tab.
class SalesScreen extends StatefulWidget {
  const SalesScreen({super.key});

  @override
  State<SalesScreen> createState() => _SalesScreenState();
}

enum _Range { today, week, month, all }

class _SalesScreenState extends State<SalesScreen> {
  _Range _range = _Range.today;
  bool _showCancelled = false;

  DateRange? get _dr => switch (_range) {
    _Range.today => DateRange.today(),
    _Range.week => DateRange.thisWeek(),
    _Range.month => DateRange.thisMonth(),
    _Range.all => null,
  };

  @override
  Widget build(BuildContext context) {
    final db = context.watch<LedgerDb>();
    final dr = _dr;
    var sales = db.sales.values
        .where((s) => dr == null || dr.contains(s.saleDate))
        .where((s) => _showCancelled || s.isActive)
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    var incomes = db.dailyIncomes.values
        .where((d) => dr == null || dr.contains(d.incomeDate))
        .where((d) => _showCancelled || d.cancelledAt == null)
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    final activeSales = sales.where((s) => s.isActive);
    final cash = activeSales
        .where((s) => s.paymentType == PaymentType.cash)
        .fold(Money.zero, (p, s) => p + s.netAmount);
    final credit = activeSales
        .where((s) => s.paymentType == PaymentType.credit)
        .fold(Money.zero, (p, s) => p + s.netAmount);
    final daily = incomes
        .where((d) => d.cancelledAt == null)
        .fold(Money.zero, (p, d) => p + d.amount);

    final items = <Object>[...sales, ...incomes]..sort((a, b) {
      final da = a is Sale ? a.createdAt : (a as DailyIncome).createdAt;
      final dbb = b is Sale ? b.createdAt : (b as DailyIncome).createdAt;
      return dbb.compareTo(da);
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('البيع والدخل'),
        actions: [
          IconButton(
            tooltip: _showCancelled ? 'إخفاء الملغاة' : 'إظهار الملغاة',
            icon: Icon(
              _showCancelled ? Icons.visibility_off_outlined : Icons.visibility_outlined,
            ),
            onPressed: () => setState(() => _showCancelled = !_showCancelled),
          ),
        ],
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          FloatingActionButton.small(
            heroTag: 'fab_daily',
            tooltip: 'دخل يومي إجمالي',
            backgroundColor: context.c.infoLight,
            foregroundColor: context.c.info,
            onPressed: () => showFormSheet(context, const DailyIncomeSheet()),
            child: const Icon(Icons.today),
          ),
          const SizedBox(height: 10),
          FloatingActionButton.extended(
            heroTag: 'fab_sale',
            onPressed: () => showFormSheet(context, const SaleSheet()),
            icon: const Icon(Icons.add),
            label: const Text('بيع جديد'),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _chip('اليوم', _Range.today),
                  _chip('هذا الأسبوع', _Range.week),
                  _chip('هذا الشهر', _Range.month),
                  _chip('الكل', _Range.all),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
              child: Row(
                children: [
                  Expanded(
                    child: StatCard(
                      title: 'نقدي',
                      value: cash.format(),
                      color: context.c.primaryDark,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: StatCard(
                      title: 'آجل',
                      value: credit.format(),
                      color: context.c.warning,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: StatCard(
                      title: 'دخل يومي',
                      value: daily.format(),
                      color: context.c.info,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: items.isEmpty
                  ? const EmptyState(
                      icon: Icons.point_of_sale_outlined,
                      title: 'لا توجد مبيعات في هذه الفترة',
                      subtitle: 'اضغط "بيع جديد" لتسجيل فاتورة أو أدخل الدخل اليومي',
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 120),
                      itemCount: items.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (_, i) {
                        final it = items[i];
                        return it is Sale
                            ? SaleTile(sale: it)
                            : _IncomeTile(income: it as DailyIncome);
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip(String label, _Range r) => Padding(
    padding: const EdgeInsetsDirectional.only(end: 8),
    child: ChoiceChip(
      label: Text(label),
      selected: _range == r,
      onSelected: (_) => setState(() => _range = r),
    ),
  );
}

class SaleTile extends StatelessWidget {
  const SaleTile({super.key, required this.sale});
  final Sale sale;

  @override
  Widget build(BuildContext context) {
    final db = context.read<LedgerDb>();
    final s = sale;
    final cust = s.customerId == null ? null : db.customers[s.customerId!];
    final credit = s.paymentType == PaymentType.credit;
    final color = s.isCancelled
        ? context.c.textMuted
        : credit
        ? context.c.warning
        : context.c.primaryDark;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _showDetail(context),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    credit ? Icons.schedule : Icons.payments_outlined,
                    color: color,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          cust?.name ?? (credit ? 'عميل محذوف' : 'بيع نقدي'),
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            decoration: s.isCancelled
                                ? TextDecoration.lineThrough
                                : null,
                          ),
                        ),
                        Text(
                          [
                            Fmt.relative(s.saleDate),
                            if (s.mode == DocMode.detailedItems)
                              '${s.lines.length} صنف',
                            if ((s.invoiceNo ?? '').isNotEmpty) '#${s.invoiceNo}',
                          ].join(' • '),
                          style: TextStyle(
                            fontSize: 11,
                            color: context.c.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      MoneyText(s.netAmount, color: color),
                      Tag(credit ? 'آجل' : 'نقدي', color: color),
                    ],
                  ),
                ],
              ),
              if (s.isCancelled)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: CancelledBanner(reason: s.cancelReason),
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDetail(BuildContext context) {
    final db = context.read<LedgerDb>();
    final app = context.read<AppServices>();
    final s = sale;
    showFormSheet(
      context,
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SheetTitle('تفاصيل فاتورة البيع'),
          _kv(context, 'النوع', s.paymentType.label),
          _kv(context, 'التاريخ', Fmt.dateTime(s.saleDate)),
          if (s.customerId != null)
            _kv(context, 'العميل', db.customers[s.customerId!]?.name ?? '—'),
          if ((s.invoiceNo ?? '').isNotEmpty) _kv(context, 'رقم الفاتورة', s.invoiceNo!),
          if (s.lines.isNotEmpty) ...[
            const Divider(height: 20),
            for (final l in s.lines)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(child: Text(l.name)),
                    Text(
                      '${l.qty.format()} × ${l.unitPrice.format()}',
                      textDirection: TextDirection.ltr,
                      style: TextStyle(color: context.c.textMuted),
                    ),
                    const SizedBox(width: 12),
                    MoneyText(l.lineTotal, bold: false),
                  ],
                ),
              ),
          ],
          const Divider(height: 20),
          _kv(context, 'الإجمالي', s.grossAmount.format()),
          if (s.discount.isPositive) _kv(context, 'الخصم', '- ${s.discount.format()}'),
          _kv(context, 'الصافي', s.netAmount.format(), bold: true),
          if (s.profit != null) ...[
            _kv(context, 'تكلفة البضاعة', s.costAmount.format()),
            _kv(context, 
              'ربح الفاتورة',
              s.profit!.format(),
              color: s.profit!.isNegative ? context.c.danger : context.c.primaryDark,
            ),
          ],
          if ((s.details ?? '').isNotEmpty) _kv(context, 'ملاحظات', s.details!),
          const SizedBox(height: 12),
          if (s.isCancelled)
            CancelledBanner(reason: s.cancelReason)
          else
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(foregroundColor: context.c.danger),
              icon: const Icon(Icons.block),
              label: const Text('إلغاء الفاتورة'),
              onPressed: () async {
                final reason = await confirmWithReason(
                  context,
                  title: 'إلغاء الفاتورة',
                  message: 'سيتم عكس أثرها على الدين والمخزون. تبقى في السجل كملغاة.',
                  confirmLabel: 'إلغاء الفاتورة',
                );
                if (reason == null || !context.mounted) return;
                final ok = await guarded(
                  context,
                  () => app.documents.cancelSale(s.id, reason),
                  successMessage: 'تم إلغاء الفاتورة',
                );
                if (ok && context.mounted) Navigator.pop(context);
              },
            ),
        ],
      ),
    );
  }
}

class _IncomeTile extends StatelessWidget {
  const _IncomeTile({required this.income});
  final DailyIncome income;

  @override
  Widget build(BuildContext context) {
    final d = income;
    final cancelled = d.cancelledAt != null;
    final color = cancelled ? context.c.textMuted : context.c.info;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: cancelled
            ? null
            : () async {
                final reason = await confirmWithReason(
                  context,
                  title: 'إلغاء الدخل اليومي',
                  confirmLabel: 'إلغاء',
                );
                if (reason == null || !context.mounted) return;
                await guarded(
                  context,
                  () => context.read<AppServices>().documents.cancelDailyIncome(
                    d.id,
                    reason,
                  ),
                  successMessage: 'تم الإلغاء',
                );
              },
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.today, color: color),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'دخل يومي إجمالي',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            decoration:
                                cancelled ? TextDecoration.lineThrough : null,
                          ),
                        ),
                        Text(
                          [
                            Fmt.relative(d.incomeDate),
                            if (d.manualCogs != null)
                              'تكلفة ${d.manualCogs!.format()}',
                            if ((d.notes ?? '').isNotEmpty) d.notes!,
                          ].join(' • '),
                          style: TextStyle(
                            fontSize: 11,
                            color: context.c.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  MoneyText(d.amount, color: color),
                ],
              ),
              if (cancelled)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: CancelledBanner(reason: d.cancelReason),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

Widget _kv(BuildContext context, String k, String v, {bool bold = false, Color? color}) => Padding(
  padding: const EdgeInsets.symmetric(vertical: 4),
  child: Row(
    children: [
      Expanded(
        child: Text(k, style: TextStyle(color: context.c.textMuted)),
      ),
      Text(
        v,
        textDirection: TextDirection.ltr,
        style: TextStyle(
          fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
          color: color,
        ),
      ),
    ],
  ),
);
