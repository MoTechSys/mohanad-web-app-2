import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/money/money.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';

/// End-of-day aggregated cash income (for shops that don't itemize sales).
class DailyIncomeSheet extends StatefulWidget {
  const DailyIncomeSheet({super.key});

  @override
  State<DailyIncomeSheet> createState() => _DailyIncomeSheetState();
}

class _DailyIncomeSheetState extends State<DailyIncomeSheet> {
  final _form = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _cogs = TextEditingController();
  final _notes = TextEditingController();
  DateTime _date = DateTime.now();
  bool _busy = false;

  @override
  void dispose() {
    _amount.dispose();
    _cogs.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    final app = context.read<AppServices>();
    final ok = await guarded(
      context,
      () => app.documents.createDailyIncome(
        amount: Money.tryParse(_amount.text)!,
        manualCogs: _cogs.text.trim().isEmpty
            ? null
            : Money.tryParse(_cogs.text),
        notes: _notes.text,
        date: _date,
      ),
      successMessage: 'تم تسجيل الدخل اليومي',
    );
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
          const SheetTitle('دخل يومي إجمالي'),
          const Text(
            'استخدمه لتسجيل إجمالي مبيعات اليوم النقدية دون تفصيل الفواتير.',
            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
          ),
          const SizedBox(height: 14),
          MoneyField(controller: _amount, label: 'إجمالي الدخل *', autofocus: true),
          const SizedBox(height: 12),
          MoneyField(
            controller: _cogs,
            label: 'تكلفة البضاعة المباعة (اختياري)',
            optional: true,
            allowZero: true,
            hint: 'لحساب الربح الدقيق',
          ),
          const SizedBox(height: 12),
          DateField(value: _date, onChanged: (d) => setState(() => _date = d)),
          const SizedBox(height: 12),
          TextFormField(
            controller: _notes,
            decoration: const InputDecoration(labelText: 'ملاحظات'),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _save,
            child: const Text('تسجيل'),
          ),
        ],
      ),
    );
  }
}
