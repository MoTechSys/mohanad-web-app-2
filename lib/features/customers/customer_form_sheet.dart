import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/money/money.dart';
import '../../core/widgets/common.dart';
import '../../domain/models/party.dart';

/// Create / edit customer.
class CustomerFormSheet extends StatefulWidget {
  const CustomerFormSheet({super.key, this.existing});
  final Customer? existing;

  @override
  State<CustomerFormSheet> createState() => _CustomerFormSheetState();
}

class _CustomerFormSheetState extends State<CustomerFormSheet> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _phone = TextEditingController(text: widget.existing?.phone);
  late final _address = TextEditingController(text: widget.existing?.address);
  late final _notes = TextEditingController(text: widget.existing?.notes);
  late final _limit = TextEditingController(
    text: widget.existing?.creditLimit?.toEditable(),
  );
  final _opening = TextEditingController();
  bool _busy = false;

  bool get isEdit => widget.existing != null;

  @override
  void dispose() {
    for (final c in [_name, _phone, _address, _notes, _limit, _opening]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    final app = context.read<AppServices>();
    final limitRaw = _limit.text.trim();
    final limit = limitRaw.isEmpty ? null : Money.tryParse(limitRaw);
    final ok = await guarded(context, () async {
      if (isEdit) {
        await app.parties.updateCustomer(
          widget.existing!.id,
          name: _name.text,
          phone: _phone.text,
          address: _address.text,
          notes: _notes.text,
          creditLimit: limit,
          clearCreditLimit: limitRaw.isEmpty,
        );
      } else {
        final open = _opening.text.trim().isEmpty
            ? Money.zero
            : Money.tryParse(_opening.text) ?? Money.zero;
        await app.parties.createCustomer(
          name: _name.text,
          phone: _phone.text,
          address: _address.text,
          notes: _notes.text,
          creditLimit: limit,
          openingBalance: open,
        );
      }
    }, successMessage: isEdit ? 'تم تحديث العميل' : 'تمت إضافة العميل');
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SheetTitle(isEdit ? 'تعديل عميل' : 'عميل جديد'),
          TextFormField(
            controller: _name,
            autofocus: !isEdit,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: 'الاسم *'),
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'الاسم مطلوب' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            textDirection: TextDirection.ltr,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: 'الهاتف'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _address,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: 'العنوان'),
          ),
          const SizedBox(height: 12),
          MoneyField(
            controller: _limit,
            label: 'حد الائتمان (اختياري)',
            optional: true,
            allowZero: true,
            hint: 'بدون حد',
          ),
          if (!isEdit) ...[
            const SizedBox(height: 12),
            MoneyField(
              controller: _opening,
              label: 'رصيد افتتاحي (دين سابق)',
              optional: true,
              allowZero: true,
              allowNegative: true,
              hint: '0',
            ),
          ],
          const SizedBox(height: 12),
          TextFormField(
            controller: _notes,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'ملاحظات'),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _save,
            child: Text(isEdit ? 'حفظ التعديلات' : 'إضافة'),
          ),
        ],
      ),
    );
  }
}
