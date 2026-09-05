import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/errors/domain_exception.dart';
import '../../core/money/money.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import '../../data/ledger_db.dart';

enum PartyTxKind {
  customerDebt,
  customerPayment,
  customerAdjust,
  supplierDebt,
  supplierPayment,
  supplierAdjust,
}

/// Unified sheet for manual ledger entries.
class PartyTxSheet extends StatefulWidget {
  const PartyTxSheet({super.key, required this.partyId, required this.kind});

  const PartyTxSheet.customerDebt(String id, {Key? key})
    : this(key: key, partyId: id, kind: PartyTxKind.customerDebt);
  const PartyTxSheet.customerPayment(String id, {Key? key})
    : this(key: key, partyId: id, kind: PartyTxKind.customerPayment);
  const PartyTxSheet.customerAdjust(String id, {Key? key})
    : this(key: key, partyId: id, kind: PartyTxKind.customerAdjust);
  const PartyTxSheet.supplierDebt(String id, {Key? key})
    : this(key: key, partyId: id, kind: PartyTxKind.supplierDebt);
  const PartyTxSheet.supplierPayment(String id, {Key? key})
    : this(key: key, partyId: id, kind: PartyTxKind.supplierPayment);
  const PartyTxSheet.supplierAdjust(String id, {Key? key})
    : this(key: key, partyId: id, kind: PartyTxKind.supplierAdjust);

  final String partyId;
  final PartyTxKind kind;

  @override
  State<PartyTxSheet> createState() => _PartyTxSheetState();
}

class _PartyTxSheetState extends State<PartyTxSheet> {
  final _form = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _notes = TextEditingController();
  DateTime _date = DateTime.now();
  bool _busy = false;
  bool _increase = true; // for adjustments

  bool get isAdjust =>
      widget.kind == PartyTxKind.customerAdjust ||
      widget.kind == PartyTxKind.supplierAdjust;
  bool get isCustomer =>
      widget.kind == PartyTxKind.customerDebt ||
      widget.kind == PartyTxKind.customerPayment ||
      widget.kind == PartyTxKind.customerAdjust;

  String get title => switch (widget.kind) {
    PartyTxKind.customerDebt => 'تسجيل دين على العميل',
    PartyTxKind.customerPayment => 'تسجيل دفعة من العميل',
    PartyTxKind.customerAdjust => 'تسوية رصيد العميل',
    PartyTxKind.supplierDebt => 'تسجيل مستحق للمورد',
    PartyTxKind.supplierPayment => 'دفعة للمورد',
    PartyTxKind.supplierAdjust => 'تسوية رصيد المورد',
  };

  @override
  void dispose() {
    _amount.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save({bool approveOverLimit = false}) async {
    if (!(_form.currentState?.validate() ?? false)) return;
    final amount = Money.tryParse(_amount.text)!;
    final notes = _notes.text.trim().isEmpty ? null : _notes.text.trim();
    final app = context.read<AppServices>();
    setState(() => _busy = true);
    try {
      switch (widget.kind) {
        case PartyTxKind.customerDebt:
          await app.parties.addCustomerDebt(
            widget.partyId,
            amount,
            notes: notes,
            date: _date,
            approveOverLimit: approveOverLimit,
          );
        case PartyTxKind.customerPayment:
          await app.parties.addCustomerPayment(
            widget.partyId,
            amount,
            notes: notes,
            date: _date,
          );
        case PartyTxKind.customerAdjust:
          await app.parties.addCustomerAdjustment(
            widget.partyId,
            _increase ? amount : -amount,
            reason: notes ?? 'تسوية يدوية',
          );
        case PartyTxKind.supplierDebt:
          await app.parties.addSupplierDebt(
            widget.partyId,
            amount,
            notes: notes,
            date: _date,
          );
        case PartyTxKind.supplierPayment:
          await app.parties.paySupplier(
            widget.partyId,
            amount,
            notes: notes,
            date: _date,
          );
        case PartyTxKind.supplierAdjust:
          await app.parties.addSupplierAdjustment(
            widget.partyId,
            _increase ? amount : -amount,
            reason: notes ?? 'تسوية يدوية',
          );
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('تم الحفظ'),
          backgroundColor: context.c.primaryDark,
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.pop(context);
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
            backgroundColor: context.c.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final db = context.read<LedgerDb>();
    final bal = isCustomer
        ? db.customerBalance(widget.partyId)
        : db.supplierBalance(widget.partyId);
    final name = isCustomer
        ? db.customers[widget.partyId]?.name
        : db.suppliers[widget.partyId]?.name;
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SheetTitle(title),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: context.c.surface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    name ?? '',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                Text(
                  'الرصيد: ${bal.format()}',
                  style: TextStyle(color: context.c.textMuted),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (isAdjust) ...[
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: true, label: Text('زيادة الرصيد (+)')),
                ButtonSegment(value: false, label: Text('تخفيض الرصيد (−)')),
              ],
              selected: {_increase},
              onSelectionChanged: (s) => setState(() => _increase = s.first),
            ),
            const SizedBox(height: 12),
          ],
          MoneyField(controller: _amount, label: 'المبلغ *', autofocus: true),
          if (!isAdjust) ...[
            const SizedBox(height: 12),
            DateField(
              value: _date,
              onChanged: (d) => setState(() => _date = d),
            ),
          ],
          const SizedBox(height: 12),
          TextFormField(
            controller: _notes,
            maxLines: 2,
            decoration: InputDecoration(
              labelText: isAdjust ? 'سبب التسوية *' : 'ملاحظات',
            ),
            validator: isAdjust
                ? (v) => (v == null || v.trim().isEmpty) ? 'السبب مطلوب' : null
                : null,
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _save,
            child: const Text('حفظ'),
          ),
        ],
      ),
    );
  }
}
