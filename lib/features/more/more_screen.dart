import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/money/money.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../data/ledger_db.dart';
import '../../domain/enums/enums.dart';
import '../expenses/expense_sheet.dart';
import '../products/products_screen.dart';
import '../purchases/purchases_screen.dart';
import '../reports/reports_screen.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final db = context.watch<LedgerDb>();
    void go(Widget w) => Navigator.push(context, MaterialPageRoute(builder: (_) => w));
    return Scaffold(
      appBar: AppBar(title: const Text('المزيد')),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(16), children: [
          Card(child: Column(children: [
            ListTile(leading: const Icon(Icons.receipt_long_outlined, color: AppColors.danger), title: const Text('المصروفات'),
                trailing: const Icon(Icons.chevron_left), onTap: () => go(const ExpensesScreen())),
            const Divider(),
            ListTile(leading: const Icon(Icons.inventory_2_outlined, color: AppColors.warning), title: const Text('فواتير المشتريات'),
                trailing: const Icon(Icons.chevron_left), onTap: () => go(const PurchasesScreen())),
            if (db.settings.inventoryEnabled) ...[
              const Divider(),
              ListTile(leading: const Icon(Icons.inventory_outlined, color: AppColors.primaryDark), title: const Text('المنتجات والمخزون'),
                  trailing: const Icon(Icons.chevron_left), onTap: () => go(const ProductsScreen())),
            ],
            const Divider(),
            ListTile(leading: const Icon(Icons.bar_chart, color: AppColors.info), title: const Text('التقارير'),
                trailing: const Icon(Icons.chevron_left), onTap: () => go(const ReportsScreen())),
          ])),
          const SizedBox(height: 12),
          Card(child: Column(children: [
            ListTile(leading: const Icon(Icons.settings_outlined), title: const Text('الإعدادات'),
                trailing: const Icon(Icons.chevron_left), onTap: () => go(const SettingsScreen())),
            const Divider(),
            ListTile(leading: const Icon(Icons.history), title: const Text('سجل التدقيق'),
                subtitle: Text('${db.audit.length} حركة مسجلة'),
                trailing: const Icon(Icons.chevron_left), onTap: () => go(const AuditScreen())),
            const Divider(),
            ListTile(leading: const Icon(Icons.backup_outlined), title: const Text('النسخ الاحتياطي والاستعادة'),
                trailing: const Icon(Icons.chevron_left), onTap: () => go(const BackupScreen())),
          ])),
          const SizedBox(height: 24),
          const Center(child: Text('دفتر البقالة • نسخة 1.0.0 • يعمل محلياً بدون إنترنت',
              style: TextStyle(fontSize: 12, color: AppColors.textMuted))),
        ]),
      ),
    );
  }
}

class ExpensesScreen extends StatelessWidget {
  const ExpensesScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final db = context.watch<LedgerDb>();
    final app = context.read<AppServices>();
    final list = db.expenses.values.toList()..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    final total = list.where((e) => e.isActive && e.isOperating).fold(Money.zero, (p, e) => p + e.amount);
    return Scaffold(
      appBar: AppBar(title: const Text('المصروفات'), actions: [
        Padding(padding: const EdgeInsetsDirectional.only(end: 12),
            child: Center(child: Tag('تشغيلية: ${total.format()}', color: AppColors.danger))),
      ]),
      floatingActionButton: FloatingActionButton.extended(heroTag: 'fab_exp',
          backgroundColor: AppColors.danger, foregroundColor: Colors.white,
          onPressed: () => showFormSheet(context, const ExpenseSheet()),
          icon: const Icon(Icons.add), label: const Text('مصروف')),
      body: SafeArea(child: list.isEmpty
          ? const EmptyState(icon: Icons.receipt_long_outlined, title: 'لا توجد مصروفات')
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
              itemCount: list.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final e = list[i];
                final cat = e.categoryId == null ? null : db.categories[e.categoryId!];
                final linked = e.type == ExpenseType.supplierPayment || e.type == ExpenseType.cashPurchase;
                final color = e.isCancelled ? AppColors.textMuted : linked ? AppColors.info : AppColors.danger;
                return Card(child: ListTile(
                  leading: Icon(linked ? Icons.link : Icons.payments_outlined, color: color),
                  title: Text(cat?.name ?? e.type.label, style: TextStyle(fontWeight: FontWeight.w700,
                      decoration: e.isCancelled ? TextDecoration.lineThrough : null)),
                  subtitle: Text([Fmt.relative(e.expenseDate), if ((e.details ?? '').isNotEmpty) e.details!,
                      if (e.isCancelled) 'ملغى'].join(' • '), style: const TextStyle(fontSize: 11)),
                  trailing: MoneyText(e.amount, color: color),
                  onTap: (e.isCancelled || linked) ? null : () async {
                    final reason = await confirmWithReason(context, title: 'إلغاء المصروف', confirmLabel: 'إلغاء');
                    if (reason == null || !context.mounted) return;
                    await guarded(context, () => app.documents.cancelExpense(e.id, reason), successMessage: 'تم الإلغاء');
                  },
                ));
              })),
    );
  }
}

class AuditScreen extends StatelessWidget {
  const AuditScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final db = context.watch<LedgerDb>();
    final list = db.audit.values.toList()..sort((a, b) => b.at.compareTo(a.at));
    return Scaffold(
      appBar: AppBar(title: const Text('سجل التدقيق')),
      body: SafeArea(child: list.isEmpty
          ? const EmptyState(icon: Icons.history, title: 'السجل فارغ')
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length > 500 ? 500 : list.length,
              separatorBuilder: (_, _) => const Divider(),
              itemBuilder: (_, i) {
                final a = list[i];
                final color = switch (a.action) {
                  AuditAction.cancel || AuditAction.delete => AppColors.danger,
                  AuditAction.create => AppColors.primaryDark,
                  _ => AppColors.info,
                };
                return ListTile(dense: true,
                    leading: Icon(a.isLargeTx ? Icons.warning_amber_rounded : Icons.circle, size: a.isLargeTx ? 22 : 10,
                        color: a.isLargeTx ? AppColors.warning : color),
                    title: Text(a.summary),
                    subtitle: Text('${a.action.label} • ${Fmt.dateTime(a.at)}${a.isLargeTx ? ' • معاملة كبيرة' : ''}',
                        style: const TextStyle(fontSize: 11)));
              })),
    );
  }
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _form = GlobalKey<FormState>();
  late final s0 = context.read<LedgerDb>().settings;
  late final _store = TextEditingController(text: s0.storeName);
  late final _owner = TextEditingController(text: s0.ownerName);
  late final _phone = TextEditingController(text: s0.phone);
  late final _cur = TextEditingController(text: s0.currency);
  late final _threshold = TextEditingController(text: s0.largeTxThreshold?.toEditable());
  late final _target = TextEditingController(text: s0.dailyTarget?.toEditable());
  late final _pin = TextEditingController(text: s0.pinCode);
  late bool _inv = s0.inventoryEnabled;
  late bool _cashCogs = s0.cashPurchaseAsCogs;
  late ProfitMode _mode = s0.profitMode;

  @override
  void dispose() {
    for (final c in [_store, _owner, _phone, _cur, _threshold, _target, _pin]) { c.dispose(); }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الإعدادات')),
      body: SafeArea(child: Form(key: _form, child: ListView(padding: const EdgeInsets.all(16), children: [
        const SectionTitle('المحل'),
        TextFormField(controller: _store, decoration: const InputDecoration(labelText: 'اسم المحل *'),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'مطلوب' : null),
        const SizedBox(height: 12),
        TextFormField(controller: _owner, decoration: const InputDecoration(labelText: 'اسم المالك')),
        const SizedBox(height: 12),
        TextFormField(controller: _phone, keyboardType: TextInputType.phone, textDirection: TextDirection.ltr,
            decoration: const InputDecoration(labelText: 'الهاتف')),
        const SizedBox(height: 12),
        TextFormField(controller: _cur, decoration: const InputDecoration(labelText: 'رمز العملة')),
        const SectionTitle('المحاسبة'),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('تفعيل المخزون والمنتجات'),
            value: _inv, onChanged: (v) => setState(() => _inv = v)),
        SegmentedButton<ProfitMode>(
          segments: const [ButtonSegment(value: ProfitMode.accurate, label: Text('ربح دقيق')),
              ButtonSegment(value: ProfitMode.estimated, label: Text('ربح تقديري'))],
          selected: {_mode}, onSelectionChanged: (v) => setState(() => _mode = v.first)),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('اعتبار المشتريات النقدية تكلفة بضاعة'),
            subtitle: const Text('في وضع الربح الدقيق', style: TextStyle(fontSize: 12)),
            value: _cashCogs, onChanged: (v) => setState(() => _cashCogs = v)),
        const SizedBox(height: 8),
        MoneyField(controller: _threshold, label: 'حد المعاملة الكبيرة (تنبيه في السجل)', optional: true, allowZero: true, hint: 'بدون'),
        const SizedBox(height: 12),
        MoneyField(controller: _target, label: 'هدف المبيعات اليومي', optional: true, allowZero: true, hint: 'بدون'),
        const SectionTitle('الأمان'),
        TextFormField(controller: _pin, keyboardType: TextInputType.number, obscureText: true, maxLength: 6,
            textDirection: TextDirection.ltr,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(labelText: 'رمز الدخول PIN (4-6 أرقام، فارغ = بدون)'),
            validator: (v) => (v == null || v.isEmpty || RegExp(r'^\d{4,6}$').hasMatch(v)) ? null : '4 إلى 6 أرقام'),
        const SizedBox(height: 20),
        FilledButton(onPressed: _save, child: const Text('حفظ الإعدادات')),
      ]))),
    );
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    final app = context.read<AppServices>();
    final th = _threshold.text.trim(), tg = _target.text.trim(), pin = _pin.text.trim();
    final s = s0.copyWith(
      storeName: _store.text.trim(), ownerName: _owner.text.trim(), phone: _phone.text.trim(),
      currency: _cur.text.trim(), inventoryEnabled: _inv, profitMode: _mode, cashPurchaseAsCogs: _cashCogs,
      largeTxThreshold: th.isEmpty ? null : Money.tryParse(th), clearLargeTx: th.isEmpty,
      dailyTarget: tg.isEmpty ? null : Money.tryParse(tg), clearDailyTarget: tg.isEmpty,
      pinCode: pin.isEmpty ? null : pin, clearPin: pin.isEmpty,
    );
    final ok = await guarded(context, () => app.settings.update(s), successMessage: 'تم حفظ الإعدادات');
    if (ok && mounted) Navigator.pop(context);
  }
}

class BackupScreen extends StatelessWidget {
  const BackupScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final app = context.read<AppServices>();
    return Scaffold(
      appBar: AppBar(title: const Text('النسخ الاحتياطي')),
      body: SafeArea(child: ListView(padding: const EdgeInsets.all(16), children: [
        const Text('البيانات محفوظة محلياً على هاتفك فقط. انسخ النسخة الاحتياطية واحفظها في مكان آمن (مثل رسالة لنفسك أو ملاحظات).',
            style: TextStyle(color: AppColors.textMuted)),
        const SizedBox(height: 16),
        FilledButton.icon(icon: const Icon(Icons.copy), label: const Text('نسخ النسخة الاحتياطية (JSON)'),
            onPressed: () async {
              final json = app.settings.exportJson();
              await Clipboard.setData(ClipboardData(text: json));
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: Text('تم نسخ ${(json.length / 1024).toStringAsFixed(1)} كيلوبايت إلى الحافظة'),
                  backgroundColor: AppColors.primaryDark));
            }),
        const SizedBox(height: 12),
        OutlinedButton.icon(icon: const Icon(Icons.share_outlined), label: const Text('عرض النسخة كنص'),
            onPressed: () => showFormSheet(context, SelectableText(app.settings.exportJson(),
                textDirection: TextDirection.ltr, style: const TextStyle(fontSize: 10, fontFamily: 'monospace')))),
        const SizedBox(height: 32),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger),
          icon: const Icon(Icons.restore), label: const Text('استعادة من نسخة (يستبدل كل البيانات)'),
          onPressed: () async {
            final ctrl = TextEditingController();
            final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
              title: const Text('استعادة نسخة احتياطية'),
              content: TextField(controller: ctrl, maxLines: 6, textDirection: TextDirection.ltr,
                  decoration: const InputDecoration(hintText: 'الصق محتوى النسخة هنا')),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
                FilledButton(style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
                    onPressed: () => Navigator.pop(ctx, true), child: const Text('استعادة')),
              ],
            ));
            if (ok != true || !context.mounted) return;
            final text = ctrl.text.trim().isEmpty
                ? (await Clipboard.getData('text/plain'))?.text ?? ''
                : ctrl.text;
            if (!context.mounted) return;
            await guarded(context, () => app.settings.importJson(text), successMessage: 'تمت الاستعادة بنجاح');
          },
        ),
      ])),
    );
  }
}
