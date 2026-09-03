import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/errors/domain_exception.dart';
import '../../core/money/money.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/line_items_editor.dart';
import '../../data/ledger_db.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/documents.dart';
import '../../domain/models/party.dart';

/// New sale: quick total or detailed items; cash or credit.
class SaleSheet extends StatefulWidget {
  const SaleSheet({super.key, this.initialCustomerId});
  final String? initialCustomerId;

  @override
  State<SaleSheet> createState() => _SaleSheetState();
}

class _SaleSheetState extends State<SaleSheet> {
  final _form = GlobalKey<FormState>();
  final _total = TextEditingController();
  final _discount = TextEditingController();
  final _details = TextEditingController();
  final _invoice = TextEditingController();
  DocMode _mode = DocMode.totalOnly;
  PaymentType _pay = PaymentType.cash;
  Customer? _customer;
  List<DocLine> _lines = const [];
  DateTime _date = DateTime.now();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final id = widget.initialCustomerId;
    if (id != null) {
      _customer = context.read<LedgerDb>().customers[id];
      _pay = PaymentType.credit;
    }
  }

  @override
  void dispose() {
    for (final c in [_total, _discount, _details, _invoice]) {
      c.dispose();
    }
    super.dispose();
  }

  Money get _gross => _mode == DocMode.totalOnly
      ? (Money.tryParse(_total.text) ?? Money.zero)
      : _lines.fold(Money.zero, (p, l) => p + l.lineTotal);
  Money get _disc => Money.tryParse(_discount.text) ?? Money.zero;
  Money get _net => _gross - _disc;

  Future<void> _save({bool approveOverLimit = false}) async {
    if (!(_form.currentState?.validate() ?? false)) return;
    if (_mode == DocMode.detailedItems && _lines.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('أضف صنفاً واحداً على الأقل')),
      );
      return;
    }
    final app = context.read<AppServices>();
    setState(() => _busy = true);
    try {
      await app.documents.createSale(
        customerId: _customer?.id,
        paymentType: _pay,
        mode: _mode,
        totalAmount: _mode == DocMode.totalOnly ? _gross : null,
        lines: _lines,
        discount: _disc,
        details: _details.text,
        invoiceNo: _invoice.text,
        date: _date,
        approveOverLimit: approveOverLimit,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _pay == PaymentType.cash
                ? 'تم تسجيل بيع نقدي بمبلغ ${_net.format()}'
                : 'تم تسجيل بيع آجل على ${_customer?.name} بمبلغ ${_net.format()}',
          ),
          backgroundColor: AppColors.primaryDark,
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.pop(context, true);
    } on DomainException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      if (e.code == ErrorCodes.creditLimitExceeded) {
        final ok = await confirm(
          context,
          title: 'تجاوز حد الائتمان',
          message: '${e.message}\nهل تريد الموافقة على تجاوز الحد؟',
          confirmLabel: 'موافقة والمتابعة',
          destructive: true,
        );
        if (ok && mounted) await _save(approveOverLimit: true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final db = context.read<LedgerDb>();
    final customers = db.activeCustomers.toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SheetTitle('فاتورة بيع جديدة'),
          SegmentedButton<PaymentType>(
            segments: const [
              ButtonSegment(
                value: PaymentType.cash,
                icon: Icon(Icons.payments_outlined),
                label: Text('نقدي'),
              ),
              ButtonSegment(
                value: PaymentType.credit,
                icon: Icon(Icons.schedule),
                label: Text('آجل (دين)'),
              ),
            ],
            selected: {_pay},
            onSelectionChanged: (s) => setState(() => _pay = s.first),
          ),
          const SizedBox(height: 12),
          SegmentedButton<DocMode>(
            segments: const [
              ButtonSegment(value: DocMode.totalOnly, label: Text('مبلغ إجمالي')),
              ButtonSegment(
                value: DocMode.detailedItems,
                label: Text('أصناف مفصّلة'),
              ),
            ],
            selected: {_mode},
            onSelectionChanged: (s) => setState(() => _mode = s.first),
          ),
          const SizedBox(height: 14),
          PickerField<Customer>(
            label: _pay == PaymentType.credit ? 'العميل *' : 'العميل (اختياري)',
            items: customers,
            labelOf: (c) => c.name,
            subtitleOf: (c) => 'الرصيد: ${db.customerBalance(c.id).format()}',
            value: _customer,
            onChanged: (c) => setState(() => _customer = c),
            validator: (_) => _pay == PaymentType.credit && _customer == null
                ? 'يجب اختيار عميل للبيع الآجل'
                : null,
          ),
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
              onChanged: (l) => setState(() => _lines = l),
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: MoneyField(
                  controller: _discount,
                  label: 'خصم',
                  optional: true,
                  allowZero: true,
                  hint: '0',
                  onChanged: (_) => setState(() {}),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextFormField(
                  controller: _invoice,
                  textDirection: TextDirection.ltr,
                  decoration: const InputDecoration(labelText: 'رقم الفاتورة'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          DateField(value: _date, onChanged: (d) => setState(() => _date = d)),
          const SizedBox(height: 12),
          TextFormField(
            controller: _details,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'تفاصيل / ملاحظات'),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'الصافي المستحق',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                MoneyText(
                  _net,
                  size: 22,
                  color: _net.isNegative ? AppColors.danger : AppColors.primaryDark,
                  currency: db.settings.currency,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _busy ? null : _save,
            icon: const Icon(Icons.check),
            label: Text(_pay == PaymentType.cash ? 'تسجيل البيع' : 'تسجيل الدين'),
          ),
        ],
      ),
    );
  }
}
