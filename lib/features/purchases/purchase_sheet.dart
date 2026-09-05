import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/money/money.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/line_items_editor.dart';
import '../../data/ledger_db.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/documents.dart';
import '../../domain/models/party.dart';

class PurchaseSheet extends StatefulWidget {
  const PurchaseSheet({super.key, this.initialSupplierId});
  final String? initialSupplierId;

  @override
  State<PurchaseSheet> createState() => _PurchaseSheetState();
}

class _PurchaseSheetState extends State<PurchaseSheet> {
  final _form = GlobalKey<FormState>();
  final _total = TextEditingController();
  final _manualName = TextEditingController();
  final _details = TextEditingController();
  final _invoice = TextEditingController();
  DocMode _mode = DocMode.totalOnly;
  PaymentType _pay = PaymentType.cash;
  Supplier? _supplier;
  List<DocLine> _lines = const [];
  DateTime _date = DateTime.now();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialSupplierId != null) {
      _supplier = context.read<LedgerDb>().suppliers[widget.initialSupplierId!];
      _pay = PaymentType.credit;
    }
  }

  @override
  void dispose() {
    for (final c in [_total, _manualName, _details, _invoice]) {
      c.dispose();
    }
    super.dispose();
  }

  Money get _sum => _mode == DocMode.totalOnly
      ? (Money.tryParse(_total.text) ?? Money.zero)
      : _lines.fold(Money.zero, (p, l) => p + l.lineTotal);

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    if (_mode == DocMode.detailedItems && _lines.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('أضف صنفاً واحداً على الأقل')),
      );
      return;
    }
    setState(() => _busy = true);
    final app = context.read<AppServices>();
    final ok = await guarded(
      context,
      () => app.documents.createPurchase(
        supplierId: _supplier?.id,
        supplierNameManual: _manualName.text,
        paymentType: _pay,
        mode: _mode,
        totalAmount: _mode == DocMode.totalOnly ? _sum : null,
        lines: _lines,
        details: _details.text,
        invoiceNo: _invoice.text,
        date: _date,
      ),
      successMessage: _pay == PaymentType.cash
          ? 'تم تسجيل شراء نقدي (مصروف) بمبلغ ${_sum.format()}'
          : 'تم تسجيل مستحق على ${_supplier?.name} بمبلغ ${_sum.format()}',
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final db = context.read<LedgerDb>();
    final suppliers = db.activeSuppliers.toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SheetTitle('فاتورة شراء جديدة'),
          SegmentedButton<PaymentType>(
            segments: const [
              ButtonSegment(value: PaymentType.cash, label: Text('نقدي')),
              ButtonSegment(
                value: PaymentType.credit,
                label: Text('آجل (على المورد)'),
              ),
            ],
            selected: {_pay},
            onSelectionChanged: (s) => setState(() => _pay = s.first),
          ),
          const SizedBox(height: 12),
          SegmentedButton<DocMode>(
            segments: const [
              ButtonSegment(
                value: DocMode.totalOnly,
                label: Text('مبلغ إجمالي'),
              ),
              ButtonSegment(
                value: DocMode.detailedItems,
                label: Text('أصناف (يرفع المخزون)'),
              ),
            ],
            selected: {_mode},
            onSelectionChanged: (s) => setState(() => _mode = s.first),
          ),
          const SizedBox(height: 14),
          PickerField<Supplier>(
            label: _pay == PaymentType.credit ? 'المورد *' : 'المورد (اختياري)',
            items: suppliers,
            labelOf: (s) => s.name,
            subtitleOf: (s) => 'المستحق: ${db.supplierBalance(s.id).format()}',
            value: _supplier,
            onChanged: (s) => setState(() => _supplier = s),
            validator: (_) => _pay == PaymentType.credit && _supplier == null
                ? 'يجب اختيار مورد للشراء الآجل'
                : null,
          ),
          if (_supplier == null && _pay == PaymentType.cash) ...[
            const SizedBox(height: 12),
            TextFormField(
              controller: _manualName,
              decoration: const InputDecoration(
                labelText: 'اسم المورد (نص حر)',
              ),
            ),
          ],
          const SizedBox(height: 12),
          if (_mode == DocMode.totalOnly)
            MoneyField(
              controller: _total,
              label: 'المبلغ الإجمالي *',
              autofocus: true,
              onChanged: (_) => setState(() {}),
            )
          else
            LineItemsEditor(
              lines: _lines,
              forPurchase: true,
              onChanged: (l) => setState(() => _lines = l),
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _invoice,
                  textDirection: TextDirection.ltr,
                  decoration: const InputDecoration(labelText: 'رقم الفاتورة'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DateField(
                  value: _date,
                  onChanged: (d) => setState(() => _date = d),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _details,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'تفاصيل'),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: context.c.warningLight,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'إجمالي الفاتورة',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                MoneyText(
                  _sum,
                  size: 22,
                  color: context.c.warning,
                  currency: db.settings.currency,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _busy ? null : _save,
            style: FilledButton.styleFrom(backgroundColor: context.c.warning),
            icon: const Icon(Icons.check),
            label: const Text('تسجيل الشراء'),
          ),
        ],
      ),
    );
  }
}
