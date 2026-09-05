import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/money/money.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../data/ledger_db.dart';
import '../../domain/models/cash_session.dart';

/// ورديات الصندوق (م3): فتح/إغلاق وردية + تقرير Z.
class ShiftsScreen extends StatelessWidget {
  const ShiftsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    context.watch<LedgerDb>();
    final app = context.read<AppServices>();
    final open = app.shifts.openSession;
    final list = app.shifts.all();

    return Scaffold(
      appBar: AppBar(title: const Text('ورديات الصندوق')),
      floatingActionButton: open == null
          ? FloatingActionButton.extended(
              heroTag: 'fab_shift',
              onPressed: () => showFormSheet(context, const OpenShiftSheet()),
              icon: const Icon(Icons.play_arrow_rounded),
              label: const Text('فتح وردية'),
            )
          : FloatingActionButton.extended(
              heroTag: 'fab_shift',
              backgroundColor: context.c.danger,
              foregroundColor: Colors.white,
              onPressed: () =>
                  showFormSheet(context, CloseShiftSheet(session: open)),
              icon: const Icon(Icons.stop_rounded),
              label: const Text('إغلاق الوردية'),
            ),
      body: SafeArea(
        child: list.isEmpty
            ? const EmptyState(
                icon: Icons.point_of_sale_outlined,
                title: 'لا توجد ورديات',
                subtitle:
                    'افتح وردية عند بداية الدوام برصيد الدرج الافتتاحي، وأغلقها بجرد النقد الفعلي',
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (_, i) => _ShiftTile(list[i]),
              ),
      ),
    );
  }
}

class _ShiftTile extends StatelessWidget {
  const _ShiftTile(this.s);
  final CashSession s;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final diff = s.difference;
    final diffColor = diff == null || diff.isZero
        ? c.primaryStrong
        : diff.isPositive
        ? c.info
        : c.danger;
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: (s.isOpen ? c.primaryStrong : c.textMuted)
              .withValues(alpha: 0.12),
          child: Icon(
            s.isOpen ? Icons.play_arrow_rounded : Icons.check_rounded,
            color: s.isOpen ? c.primaryStrong : c.textMuted,
          ),
        ),
        title: Text(
          '${s.sessionNo} • ${s.workerName}',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          [
            'فتح: ${Fmt.dateTime(s.openedAt)}',
            if (s.closedAt != null) 'إغلاق: ${Fmt.dateTime(s.closedAt!)}',
            if (s.isOpen) 'مفتوحة الآن',
          ].join(' • '),
          style: const TextStyle(fontSize: 11),
        ),
        trailing: diff == null
            ? Tag('افتتاحي ${s.openingCash.format()}', color: c.info)
            : Tag(
                diff.isZero ? 'مطابق' : 'فرق ${diff.format()}',
                color: diffColor,
              ),
        onTap: () => _showReport(context, s),
      ),
    );
  }

  void _showReport(BuildContext context, CashSession s) {
    final app = context.read<AppServices>();
    final r = app.shifts.zReport(s);
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SheetTitle('تقرير الوردية ${s.sessionNo}'),
              _row(ctx, 'العامل', s.workerName),
              _row(ctx, 'الرصيد الافتتاحي', s.openingCash.format()),
              const Divider(),
              _row(
                ctx,
                'مبيعات نقدية (${r.cashSalesCount})',
                r.cashSales.format(),
              ),
              _row(ctx, 'سدادات عملاء', r.customerPayments.format()),
              if (r.otherReceipts.isPositive)
                _row(ctx, 'مقبوضات أخرى', r.otherReceipts.format()),
              if (r.dailyIncome.isPositive)
                _row(ctx, 'دخل يومي إجمالي', r.dailyIncome.format()),
              _row(ctx, 'إجمالي الداخل', r.cashIn.format(), bold: true),
              _row(
                ctx,
                'مصروفات ومدفوعات (${r.expensesCount})',
                r.expenses.format(),
              ),
              const Divider(),
              _row(
                ctx,
                'النقد المتوقع بالدرج',
                r.expectedCash.format(),
                bold: true,
              ),
              if (s.countedCash != null) ...[
                _row(ctx, 'النقد المعدود', s.countedCash!.format(), bold: true),
                _row(
                  ctx,
                  s.difference!.isZero
                      ? 'الفرق (مطابق)'
                      : s.difference!.isPositive
                      ? 'الفرق (زيادة)'
                      : 'الفرق (عجز)',
                  s.difference!.format(),
                  bold: true,
                ),
              ],
              _row(
                ctx,
                'مبيعات آجلة (لا تدخل الدرج)',
                '${r.creditSales.format()} (${r.creditSalesCount})',
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () async {
                  Navigator.pop(ctx);
                  await guarded(context, () async {
                    final bytes = await app.pdf.zReport80(r);
                    await app.share.printPdf(bytes, 'تقرير-${s.sessionNo}');
                  });
                },
                icon: const Icon(Icons.print_outlined),
                label: const Text('طباعة تقرير Z (80mm)'),
              ),
              const SizedBox(height: 6),
              OutlinedButton.icon(
                onPressed: () async {
                  Navigator.pop(ctx);
                  await guarded(context, () async {
                    final bytes = await app.pdf.zReport80(r);
                    await app.share.sharePdf(bytes, 'تقرير-${s.sessionNo}.pdf');
                  });
                },
                icon: const Icon(Icons.share_outlined),
                label: const Text('مشاركة PDF'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(
    BuildContext context,
    String label,
    String value, {
    bool bold = false,
  }) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
          ),
        ),
        Text(
          value,
          textDirection: TextDirection.ltr,
          style: TextStyle(
            fontSize: bold ? 15 : 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

/// نموذج فتح وردية.
class OpenShiftSheet extends StatefulWidget {
  const OpenShiftSheet({super.key});
  @override
  State<OpenShiftSheet> createState() => _OpenShiftSheetState();
}

class _OpenShiftSheetState extends State<OpenShiftSheet> {
  final _form = GlobalKey<FormState>();
  final _worker = TextEditingController();
  final _opening = TextEditingController();
  final _notes = TextEditingController();

  @override
  void dispose() {
    _worker.dispose();
    _opening.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _form,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SheetTitle('فتح وردية جديدة'),
          TextFormField(
            controller: _worker,
            autofocus: true,
            decoration: const InputDecoration(labelText: 'اسم العامل *'),
            validator: (v) =>
                (v ?? '').trim().isEmpty ? 'اسم العامل مطلوب' : null,
          ),
          const SizedBox(height: 12),
          MoneyField(
            controller: _opening,
            label: 'الرصيد الافتتاحي بالدرج',
            allowZero: true,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _notes,
            decoration: const InputDecoration(labelText: 'ملاحظات (اختياري)'),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () async {
              if (!_form.currentState!.validate()) return;
              final app = context.read<AppServices>();
              final ok = await guarded(
                context,
                () => app.shifts.openShift(
                  workerName: _worker.text,
                  openingCash: Money.tryParse(_opening.text) ?? Money.zero,
                  notes: _notes.text,
                ),
                successMessage: 'تم فتح الوردية',
              );
              if (ok && context.mounted) Navigator.pop(context);
            },
            icon: const Icon(Icons.play_arrow_rounded),
            label: const Text('فتح الوردية'),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

/// نموذج إغلاق وردية بجرد فعلي — يعرض «المتوقع» الحي قبل التأكيد.
class CloseShiftSheet extends StatefulWidget {
  const CloseShiftSheet({super.key, required this.session});
  final CashSession session;

  @override
  State<CloseShiftSheet> createState() => _CloseShiftSheetState();
}

class _CloseShiftSheetState extends State<CloseShiftSheet> {
  final _form = GlobalKey<FormState>();
  final _counted = TextEditingController();
  final _notes = TextEditingController();
  Money? _entered;

  @override
  void dispose() {
    _counted.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.read<AppServices>();
    final r = app.shifts.zReport(widget.session);
    final expected = r.expectedCash;
    final diff = _entered == null ? null : _entered! - expected;
    final c = context.c;

    return Form(
      key: _form,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SheetTitle('إغلاق الوردية ${widget.session.sessionNo}'),
          Card(
            color: c.primaryStrong.withValues(alpha: 0.08),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'النقد المتوقع بالدرج',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    expected.format(),
                    textDirection: TextDirection.ltr,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          MoneyField(
            controller: _counted,
            label: 'النقد المعدود فعليًا *',
            allowZero: true,
            autofocus: true,
            onChanged: (m) => setState(() => _entered = m),
          ),
          if (diff != null && !diff.isZero)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                diff.isPositive
                    ? 'زيادة بالدرج: ${diff.format()}'
                    : 'عجز بالدرج: ${diff.abs.format()}',
                style: TextStyle(
                  color: diff.isPositive ? c.info : c.danger,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _notes,
            decoration: const InputDecoration(
              labelText: 'ملاحظات الإغلاق (اختياري)',
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: c.danger),
            onPressed: () async {
              if (!_form.currentState!.validate()) return;
              final counted = Money.tryParse(_counted.text) ?? Money.zero;
              final sure = await confirm(
                context,
                title: 'تأكيد إغلاق الوردية',
                message:
                    'المعدود: ${counted.format()} — المتوقع: ${expected.format()}. الإغلاق نهائي ولا يمكن التراجع.',
                confirmLabel: 'إغلاق نهائي',
                destructive: true,
              );
              if (!sure || !context.mounted) return;
              CashSession? closed;
              final ok = await guarded(context, () async {
                closed = await app.shifts.closeShift(
                  widget.session.id,
                  countedCash: counted,
                  notes: _notes.text,
                );
              }, successMessage: 'تم إغلاق الوردية');
              if (ok && context.mounted) {
                Navigator.pop(context);
                if (closed != null) _offerPrint(closed!);
              }
            },
            icon: const Icon(Icons.stop_rounded),
            label: const Text('إغلاق الوردية'),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  void _offerPrint(CashSession s) {
    final app = context.read<AppServices>();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'أُغلقت ${s.sessionNo} — معدود ${s.countedCash!.format()}',
        ),
        action: SnackBarAction(
          label: 'طباعة Z',
          onPressed: () async {
            final bytes = await app.pdf.zReport80(app.shifts.zReport(s));
            await app.share.printPdf(bytes, 'تقرير-${s.sessionNo}');
          },
        ),
      ),
    );
  }
}
