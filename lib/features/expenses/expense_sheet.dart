import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/money/money.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import '../../data/ledger_db.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/documents.dart';

class ExpenseSheet extends StatefulWidget {
  const ExpenseSheet({super.key});

  @override
  State<ExpenseSheet> createState() => _ExpenseSheetState();
}

class _ExpenseSheetState extends State<ExpenseSheet> {
  final _form = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _details = TextEditingController();
  ExpenseCategory? _cat;
  DateTime _date = DateTime.now();
  bool _busy = false;

  @override
  void dispose() {
    _amount.dispose();
    _details.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    final app = context.read<AppServices>();
    final ok = await guarded(
      context,
      () => app.documents.createExpense(
        amount: Money.tryParse(_amount.text)!,
        type: _cat == null ? ExpenseType.other : ExpenseType.normal,
        categoryId: _cat?.id,
        details: _details.text,
        date: _date,
      ),
      successMessage: 'تم تسجيل المصروف',
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context);
  }

  Future<void> _newCategory() async {
    final ctrl = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('فئة مصروف جديدة'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'اسم الفئة'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text),
            child: const Text('إضافة'),
          ),
        ],
      ),
    );
    if (name == null || name.trim().isEmpty || !mounted) return;
    final app = context.read<AppServices>();
    ExpenseCategory? created;
    await guarded(context, () async {
      created = await app.documents.createCategory(name);
    });
    if (created != null && mounted) setState(() => _cat = created);
  }

  @override
  Widget build(BuildContext context) {
    final db = context.watch<LedgerDb>();
    final cats = db.categories.values.where((c) => c.isActive).toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SheetTitle('مصروف جديد'),
          MoneyField(controller: _amount, label: 'المبلغ *', autofocus: true),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final c in cats)
                ChoiceChip(
                  label: Text(c.name),
                  selected: _cat?.id == c.id,
                  onSelected: (_) =>
                      setState(() => _cat = _cat?.id == c.id ? null : c),
                ),
              ActionChip(
                avatar: const Icon(Icons.add, size: 16),
                label: const Text('فئة جديدة'),
                onPressed: _newCategory,
              ),
            ],
          ),
          if (_cat == null)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                'بدون فئة → سيُسجّل كـ "أخرى"',
                style: TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
            ),
          const SizedBox(height: 12),
          DateField(value: _date, onChanged: (d) => setState(() => _date = d)),
          const SizedBox(height: 12),
          TextFormField(
            controller: _details,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'التفاصيل'),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _save,
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            child: const Text('تسجيل المصروف'),
          ),
        ],
      ),
    );
  }
}
