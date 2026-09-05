import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/money/money.dart';
import '../../core/platform/native_bridge.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../data/ledger_db.dart';
import '../../data/services/backup_service.dart';
import '../../domain/enums/enums.dart';
import '../expenses/expense_sheet.dart';
import '../pos/pos_screen.dart';
import '../products/products_screen.dart';
import '../settings/branding_screen.dart';
import '../purchases/purchases_screen.dart';
import '../reports/reports_screen.dart';
import '../shifts/shifts_screen.dart';
import '../vouchers/vouchers_screen.dart';

/// م6 — «المزيد» كشبكة أيقونات كبيرة ملوّنة: أوضح لأصحاب المحلات الذين
/// لا يقرؤون جيدًا (الأيقونة واللون هما الدليل، والنص مساعد فقط).
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final db = context.watch<LedgerDb>();
    final c = context.c;
    void go(Widget w) =>
        Navigator.push(context, MaterialPageRoute(builder: (_) => w));

    final tiles = <_GridItem>[
      if (!db.settings.hideScanner)
        _GridItem(
          'الكاشير',
          Icons.qr_code_scanner_rounded,
          c.primaryStrong,
          () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => const PosScreen(),
              fullscreenDialog: true,
            ),
          ),
        ),
      _GridItem(
        'التقارير',
        Icons.bar_chart_rounded,
        c.info,
        () => go(const ReportsScreen()),
      ),
      if (db.settings.inventoryEnabled)
        _GridItem(
          'المنتجات\nوالمخزون',
          Icons.inventory_2_rounded,
          c.primaryDark,
          () => go(const ProductsScreen()),
        ),
      _GridItem(
        'فواتير\nالمشتريات',
        Icons.shopping_cart_rounded,
        c.warning,
        () => go(const PurchasesScreen()),
      ),
      _GridItem(
        'المصروفات',
        Icons.payments_rounded,
        c.danger,
        () => go(const ExpensesScreen()),
      ),
      _GridItem(
        'السندات',
        Icons.receipt_rounded,
        c.primaryStrong,
        () => go(const VouchersScreen()),
      ),
      _GridItem(
        'الورديات\n(تقرير Z)',
        Icons.point_of_sale_rounded,
        c.info,
        () => go(const ShiftsScreen()),
      ),
      _GridItem(
        'النسخ\nالاحتياطي',
        Icons.backup_rounded,
        c.primaryDark,
        () => go(const BackupScreen()),
      ),
      _GridItem(
        'الإعدادات',
        Icons.settings_rounded,
        c.textMuted,
        () => go(const SettingsScreen()),
      ),
      _GridItem(
        'هوية المحل\nوالطباعة',
        Icons.storefront_rounded,
        c.warning,
        () => go(const BrandingScreen()),
      ),
      _GridItem(
        'سجل\nالتدقيق',
        Icons.history_rounded,
        c.info,
        () => go(const AuditScreen()),
      ),
      _GridItem(
        'حول\nالتطبيق',
        Icons.info_rounded,
        c.primaryStrong,
        () => go(const AboutScreen()),
      ),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('المزيد')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.95,
              children: [for (final t in tiles) _GridTile(t)],
            ),
            const SizedBox(height: 12),
            Card(child: _ThemeModeTile(current: db.settings.themeMode)),
            const SizedBox(height: 24),
            Center(
              child: Text(
                'دفتر البقالة • نسخة ${AboutScreen.version} • يعمل محلياً بدون إنترنت',
                style: TextStyle(fontSize: 12, color: context.c.textMuted),
              ),
            ),
            const SizedBox(height: 4),
            Center(
              child: Text(
                'تطوير: معين العباسي',
                style: TextStyle(
                  fontSize: 12,
                  color: context.c.textMuted,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GridItem {
  const _GridItem(this.label, this.icon, this.color, this.onTap);
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
}

class _GridTile extends StatelessWidget {
  const _GridTile(this.item);
  final _GridItem item;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: item.onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: item.color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(item.icon, color: item.color, size: 30),
            ),
            const SizedBox(height: 8),
            Text(
              item.label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                height: 1.25,
              ),
            ),
          ],
        ),
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
    final list = db.expenses.values.toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    final total = list
        .where((e) => e.isActive && e.isOperating)
        .fold(Money.zero, (p, e) => p + e.amount);
    return Scaffold(
      appBar: AppBar(
        title: const Text('المصروفات'),
        actions: [
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 12),
            child: Center(
              child: Tag('تشغيلية: ${total.format()}', color: context.c.danger),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'fab_exp',
        backgroundColor: context.c.danger,
        foregroundColor: Colors.white,
        onPressed: () => showFormSheet(context, const ExpenseSheet()),
        icon: const Icon(Icons.add),
        label: const Text('مصروف'),
      ),
      body: SafeArea(
        child: list.isEmpty
            ? const EmptyState(
                icon: Icons.receipt_long_outlined,
                title: 'لا توجد مصروفات',
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final e = list[i];
                  final cat = e.categoryId == null
                      ? null
                      : db.categories[e.categoryId!];
                  final linked =
                      e.type == ExpenseType.supplierPayment ||
                      e.type == ExpenseType.cashPurchase;
                  final color = e.isCancelled
                      ? context.c.textMuted
                      : linked
                      ? context.c.info
                      : context.c.danger;
                  return Card(
                    child: ListTile(
                      leading: Icon(
                        linked ? Icons.link : Icons.payments_outlined,
                        color: color,
                      ),
                      title: Text(
                        cat?.name ?? e.type.label,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          decoration: e.isCancelled
                              ? TextDecoration.lineThrough
                              : null,
                        ),
                      ),
                      subtitle: Text(
                        [
                          Fmt.relative(e.expenseDate),
                          if ((e.details ?? '').isNotEmpty) e.details!,
                          if (e.isCancelled) 'ملغى',
                        ].join(' • '),
                        style: const TextStyle(fontSize: 11),
                      ),
                      trailing: MoneyText(e.amount, color: color),
                      onTap: (e.isCancelled || linked)
                          ? null
                          : () async {
                              final reason = await confirmWithReason(
                                context,
                                title: 'إلغاء المصروف',
                                confirmLabel: 'إلغاء',
                              );
                              if (reason == null || !context.mounted) return;
                              await guarded(
                                context,
                                () => app.documents.cancelExpense(e.id, reason),
                                successMessage: 'تم الإلغاء',
                              );
                            },
                    ),
                  );
                },
              ),
      ),
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
      body: SafeArea(
        child: list.isEmpty
            ? const EmptyState(icon: Icons.history, title: 'السجل فارغ')
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: list.length > 500 ? 500 : list.length,
                separatorBuilder: (_, _) => const Divider(),
                itemBuilder: (_, i) {
                  final a = list[i];
                  final color = switch (a.action) {
                    AuditAction.cancel ||
                    AuditAction.delete => context.c.danger,
                    AuditAction.create => context.c.primaryDark,
                    _ => context.c.info,
                  };
                  return ListTile(
                    dense: true,
                    leading: Icon(
                      a.isLargeTx ? Icons.warning_amber_rounded : Icons.circle,
                      size: a.isLargeTx ? 22 : 10,
                      color: a.isLargeTx ? context.c.warning : color,
                    ),
                    title: Text(a.summary),
                    subtitle: Text(
                      '${a.action.label} • ${Fmt.dateTime(a.at)}${a.isLargeTx ? ' • معاملة كبيرة' : ''}',
                      style: const TextStyle(fontSize: 11),
                    ),
                  );
                },
              ),
      ),
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
  late final _threshold = TextEditingController(
    text: s0.largeTxThreshold?.toEditable(),
  );
  late final _target = TextEditingController(
    text: s0.dailyTarget?.toEditable(),
  );
  late final _pin = TextEditingController(text: s0.pinCode);
  late bool _inv = s0.inventoryEnabled;
  late bool _cashCogs = s0.cashPurchaseAsCogs;
  late bool _blockOversell = s0.blockOversell;
  late bool _warnBelowCost = s0.warnBelowCost;
  late bool _updatePrices = s0.updatePricesFromPurchase;
  late bool _hideScanner = s0.hideScanner;
  late bool _largeFont = s0.largeFont;
  late ProfitMode _mode = s0.profitMode;
  late AppThemeMode _theme = s0.themeMode;

  @override
  void dispose() {
    for (final c in [_store, _owner, _phone, _cur, _threshold, _target, _pin]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الإعدادات')),
      body: SafeArea(
        child: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const SectionTitle('المحل'),
              TextFormField(
                controller: _store,
                decoration: const InputDecoration(labelText: 'اسم المحل *'),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'مطلوب' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _owner,
                decoration: const InputDecoration(labelText: 'اسم المالك'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                textDirection: TextDirection.ltr,
                decoration: const InputDecoration(labelText: 'الهاتف'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _cur,
                decoration: const InputDecoration(labelText: 'رمز العملة'),
              ),
              const SectionTitle('المظهر'),
              SegmentedButton<AppThemeMode>(
                segments: const [
                  ButtonSegment(
                    value: AppThemeMode.system,
                    icon: Icon(Icons.brightness_auto_outlined),
                    label: Text('حسب النظام'),
                  ),
                  ButtonSegment(
                    value: AppThemeMode.light,
                    icon: Icon(Icons.light_mode_outlined),
                    label: Text('فاتح'),
                  ),
                  ButtonSegment(
                    value: AppThemeMode.dark,
                    icon: Icon(Icons.dark_mode_outlined),
                    label: Text('داكن'),
                  ),
                ],
                selected: {_theme},
                onSelectionChanged: (v) => setState(() => _theme = v.first),
              ),
              const SectionTitle('تبسيط الواجهة'),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('إخفاء ماسح الباركود (الكاميرا)'),
                subtitle: const Text(
                  'للمحلات التي لا تستخدم باركود — يختفي الماسح من الكاشير والمنتجات',
                  style: TextStyle(fontSize: 12),
                ),
                value: _hideScanner,
                onChanged: (v) => setState(() => _hideScanner = v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('خط أكبر'),
                subtitle: const Text(
                  'يكبّر كل نصوص التطبيق — مفيد لكبار السن وضعاف القراءة',
                  style: TextStyle(fontSize: 12),
                ),
                value: _largeFont,
                onChanged: (v) => setState(() => _largeFont = v),
              ),
              const SectionTitle('المحاسبة'),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('تفعيل المخزون والمنتجات'),
                value: _inv,
                onChanged: (v) => setState(() => _inv = v),
              ),
              SegmentedButton<ProfitMode>(
                segments: const [
                  ButtonSegment(
                    value: ProfitMode.accurate,
                    label: Text('ربح دقيق'),
                  ),
                  ButtonSegment(
                    value: ProfitMode.estimated,
                    label: Text('ربح تقديري'),
                  ),
                ],
                selected: {_mode},
                onSelectionChanged: (v) => setState(() => _mode = v.first),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('اعتبار المشتريات النقدية تكلفة بضاعة'),
                subtitle: const Text(
                  'في وضع الربح الدقيق',
                  style: TextStyle(fontSize: 12),
                ),
                value: _cashCogs,
                onChanged: (v) => setState(() => _cashCogs = v),
              ),
              if (_inv) ...[
                const SectionTitle('ضوابط البيع'),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('منع البيع بأكثر من المخزون'),
                  subtitle: const Text(
                    'اشتريت 5 كرتون؟ لن يُقبل بيع 10 — إيقافه يحوّله إلى تنبيه مع تأكيد',
                    style: TextStyle(fontSize: 12),
                  ),
                  value: _blockOversell,
                  onChanged: (v) => setState(() => _blockOversell = v),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('تنبيه عند البيع بأقل من التكلفة'),
                  subtitle: const Text(
                    'يطلب تأكيداً قبل إتمام بيع خاسر',
                    style: TextStyle(fontSize: 12),
                  ),
                  value: _warnBelowCost,
                  onChanged: (v) => setState(() => _warnBelowCost = v),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('تحديث أسعار المنتجات من فاتورة الشراء'),
                  subtitle: const Text(
                    'عند إدخال مشتريات مفصّلة تُحدّث أسعار الشراء تلقائياً',
                    style: TextStyle(fontSize: 12),
                  ),
                  value: _updatePrices,
                  onChanged: (v) => setState(() => _updatePrices = v),
                ),
              ],
              const SizedBox(height: 8),
              MoneyField(
                controller: _threshold,
                label: 'حد المعاملة الكبيرة (تنبيه في السجل)',
                optional: true,
                allowZero: true,
                hint: 'بدون',
              ),
              const SizedBox(height: 12),
              MoneyField(
                controller: _target,
                label: 'هدف المبيعات اليومي',
                optional: true,
                allowZero: true,
                hint: 'بدون',
              ),
              const SectionTitle('الأمان'),
              TextFormField(
                controller: _pin,
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 6,
                textDirection: TextDirection.ltr,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(
                  labelText: 'رمز الدخول PIN (4-6 أرقام، فارغ = بدون)',
                ),
                validator: (v) =>
                    (v == null || v.isEmpty || RegExp(r'^\d{4,6}$').hasMatch(v))
                    ? null
                    : '4 إلى 6 أرقام',
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _save,
                child: const Text('حفظ الإعدادات'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    final app = context.read<AppServices>();
    final th = _threshold.text.trim(),
        tg = _target.text.trim(),
        pin = _pin.text.trim();
    final s = s0.copyWith(
      storeName: _store.text.trim(),
      ownerName: _owner.text.trim(),
      phone: _phone.text.trim(),
      currency: _cur.text.trim(),
      inventoryEnabled: _inv,
      profitMode: _mode,
      cashPurchaseAsCogs: _cashCogs,
      blockOversell: _blockOversell,
      warnBelowCost: _warnBelowCost,
      updatePricesFromPurchase: _updatePrices,
      hideScanner: _hideScanner,
      largeFont: _largeFont,
      themeMode: _theme,
      largeTxThreshold: th.isEmpty ? null : Money.tryParse(th),
      clearLargeTx: th.isEmpty,
      dailyTarget: tg.isEmpty ? null : Money.tryParse(tg),
      clearDailyTarget: tg.isEmpty,
      pinCode: pin.isEmpty ? null : pin,
      clearPin: pin.isEmpty,
    );
    final ok = await guarded(
      context,
      () => app.settings.update(s),
      successMessage: 'تم حفظ الإعدادات',
    );
    if (ok && mounted) Navigator.pop(context);
  }
}

class BackupScreen extends StatefulWidget {
  const BackupScreen({super.key});
  @override
  State<BackupScreen> createState() => _BackupScreenState();
}

class _BackupScreenState extends State<BackupScreen> {
  List<File> _backups = const [];
  String? _folder;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final app = context.read<AppServices>();
      final dir = await app.backup.backupDir();
      final files = await app.backup.allBackups();
      if (mounted) {
        setState(() {
          _backups = files;
          _folder = dir.path;
        });
      }
    } catch (_) {
      /* غير متاح على هذه المنصة */
    }
  }

  Future<void> _backupNow() async {
    final app = context.read<AppServices>();
    setState(() => _busy = true);
    final f = await app.backup.backupNow();
    if (!mounted) return;
    setState(() => _busy = false);
    await _load();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          f == null ? 'تعذّر إنشاء النسخة' : 'تم حفظ نسخة اليوم بنجاح',
        ),
        backgroundColor: f == null ? context.c.danger : context.c.primaryDark,
      ),
    );
  }

  /// م6 — نافذة الاستعادة الفورية: تفتح مباشرة بقائمة كل النسخ المتاحة
  /// (بالتاريخ والحجم) والمستخدم يختار أيها يستعيد.
  Future<void> _openRestorePicker() async {
    final app = context.read<AppServices>();
    final files = await app.backup.allBackups();
    if (!mounted) return;
    if (files.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'لا توجد نسخ على الجهاز — يمكنك اللصق من الحافظة بالأسفل',
          ),
        ),
      );
      return;
    }
    final picked = await showModalBottomSheet<File>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SheetTitle('اختر النسخة التي تريد استعادتها'),
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(ctx).size.height * 0.55,
                ),
                child: ListView(
                  shrinkWrap: true,
                  children: [for (final f in files) _backupTilePick(ctx, f)],
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (picked == null || !mounted) return;
    await _restoreFrom(picked);
  }

  Widget _backupTilePick(BuildContext ctx, File f) {
    final name = f.uri.pathSegments.last;
    final date = BackupService.dateOf(name) ?? '';
    int size = 0;
    try {
      size = f.lengthSync();
    } catch (_) {}
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(
          Icons.history_rounded,
          color: ctx.c.primaryStrong,
          size: 28,
        ),
        title: Text(
          'نسخة $date',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          '${BackupService.sizeLabel(size)} • $name',
          textDirection: TextDirection.ltr,
          style: const TextStyle(fontSize: 11),
        ),
        trailing: const Icon(Icons.restore_rounded),
        onTap: () => Navigator.pop(ctx, f),
      ),
    );
  }

  /// v2.2.1 — تنبيه إضافي عند الاستعادة أثناء وردية مفتوحة: الوردية الحالية
  /// وكل حركاتها ستُستبدل بمحتوى النسخة — يُفضل إغلاقها (تقرير Z) أولًا.
  String _openShiftWarning(AppServices app) {
    final s = app.shifts.openSession;
    if (s == null) return '';
    return '\n\n⚠️ توجد وردية مفتوحة (${s.sessionNo} — ${s.workerName}). '
        'ستُفقد مع حركاتها إن لم تكن ضمن النسخة. يُنصح بإغلاقها أولًا.';
  }

  Future<void> _restoreFrom(File f) async {
    final app = context.read<AppServices>();
    final name = f.uri.pathSegments.last;
    final ok = await confirm(
      context,
      title: 'استعادة نسخة احتياطية',
      message:
          'سيُستبدل كل بياناتك الحالية بمحتوى:\n$name\nهل أنت متأكد؟'
          '${_openShiftWarning(app)}',
      destructive: true,
    );
    if (!ok || !mounted) return;
    try {
      final txt = await app.backup.readBackup(f);
      if (!mounted) return;
      await guarded(
        context,
        () => app.settings.importJson(txt),
        successMessage: 'تمت الاستعادة بنجاح',
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('تعذّرت قراءة النسخة: $e'),
          backgroundColor: context.c.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.read<AppServices>();
    final c = context.c;
    return Scaffold(
      appBar: AppBar(title: const Text('النسخ الاحتياطي والاستعادة')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // بطاقة تعريفية بنمط واتساب
            Card(
              color: c.primarySoft,
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.cloud_done_rounded, color: c.primaryStrong),
                        const SizedBox(width: 8),
                        const Expanded(
                          child: Text(
                            'نسخ تلقائي يومي — مثل واتساب',
                            style: TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'يحفظ التطبيق نسخة مضغوطة كل يوم تلقائياً ويحتفظ بآخر ${BackupService.keepLast} نسخ '
                      'في مجلد ظاهر يمكنك الوصول إليه من مدير الملفات:',
                      style: TextStyle(
                        fontSize: 12.5,
                        color: c.text,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    if (_folder != null)
                      Text(
                        _folder!,
                        textDirection: TextDirection.ltr,
                        style: TextStyle(
                          fontSize: 10.5,
                          fontFamily: 'monospace',
                          color: c.textMuted,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    icon: _busy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.backup_rounded),
                    label: const Text('نسخ احتياطي الآن'),
                    onPressed: _busy ? null : _backupNow,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(foregroundColor: c.danger),
                    icon: const Icon(Icons.restore_rounded),
                    label: const Text('استعادة نسخة'),
                    onPressed: _openRestorePicker,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            const SectionTitle('النسخ المتاحة على الجهاز'),
            if (_backups.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  'لا توجد نسخ بعد — اضغط «نسخ احتياطي الآن» لإنشاء أول نسخة.',
                  style: TextStyle(color: c.textMuted),
                ),
              )
            else
              for (final f in _backups) _backupCard(f),
            const SizedBox(height: 24),
            // خيارات متقدمة (JSON) — تبقى للحالات الخاصة والنسخ القديمة
            ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: Text(
                'خيارات متقدمة (نص JSON)',
                style: TextStyle(fontSize: 14, color: c.textMuted),
              ),
              children: [
                OutlinedButton.icon(
                  icon: const Icon(Icons.copy),
                  label: const Text('نسخ البيانات كنص إلى الحافظة'),
                  onPressed: () async {
                    final json = app.settings.exportJson();
                    await Clipboard.setData(ClipboardData(text: json));
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          'تم نسخ ${(json.length / 1024).toStringAsFixed(1)} كيلوبايت إلى الحافظة',
                        ),
                        backgroundColor: c.primaryDark,
                      ),
                    );
                  },
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(foregroundColor: c.danger),
                  icon: const Icon(Icons.paste_rounded),
                  label: const Text('استعادة من نص ملصوق'),
                  onPressed: () async {
                    final ctrl = TextEditingController();
                    final warn = _openShiftWarning(app).trim();
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('استعادة من نص'),
                        content: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (warn.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Text(
                                  warn,
                                  style: TextStyle(
                                    color: c.danger,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            TextField(
                              controller: ctrl,
                              maxLines: 6,
                              textDirection: TextDirection.ltr,
                              decoration: const InputDecoration(
                                hintText:
                                    'الصق محتوى النسخة هنا (أو اتركه فارغاً لأخذه من الحافظة)',
                              ),
                            ),
                          ],
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(ctx, false),
                            child: const Text('إلغاء'),
                          ),
                          FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: c.danger,
                            ),
                            onPressed: () => Navigator.pop(ctx, true),
                            child: const Text('استعادة'),
                          ),
                        ],
                      ),
                    );
                    if (ok != true || !context.mounted) return;
                    final text = ctrl.text.trim().isEmpty
                        ? (await Clipboard.getData('text/plain'))?.text ?? ''
                        : ctrl.text;
                    if (!context.mounted) return;
                    await guarded(
                      context,
                      () => app.settings.importJson(text),
                      successMessage: 'تمت الاستعادة بنجاح',
                    );
                  },
                ),
                const SizedBox(height: 8),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _backupCard(File f) {
    final app = context.read<AppServices>();
    final name = f.uri.pathSegments.last;
    final date = BackupService.dateOf(name) ?? '';
    final isLegacy = name.endsWith('.json');
    int size = 0;
    try {
      size = f.lengthSync();
    } catch (_) {}
    return Card(
      margin: const EdgeInsets.only(bottom: 6),
      child: ListTile(
        dense: true,
        leading: Icon(
          isLegacy ? Icons.description_outlined : Icons.archive_rounded,
          color: isLegacy ? context.c.textMuted : context.c.primaryStrong,
        ),
        title: Text(
          'نسخة $date',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
        subtitle: Text(
          '${BackupService.sizeLabel(size)}${isLegacy ? ' • صيغة قديمة' : ' • مضغوطة'}',
          style: const TextStyle(fontSize: 11),
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              tooltip: 'مشاركة (واتساب/درايف)',
              icon: const Icon(Icons.share_outlined, size: 20),
              onPressed: () => app.share.shareFile(
                f,
                text: 'نسخة احتياطية — دفتر البقالة ($date)',
                mimeType: isLegacy ? 'application/json' : 'application/gzip',
              ),
            ),
            IconButton(
              tooltip: 'استعادة من هذه النسخة',
              icon: Icon(Icons.restore, size: 20, color: context.c.danger),
              onPressed: () => _restoreFrom(f),
            ),
          ],
        ),
      ),
    );
  }
}

/// Quick theme switch (persists immediately via SettingsService).
class _ThemeModeTile extends StatelessWidget {
  const _ThemeModeTile({required this.current});
  final AppThemeMode current;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        children: [
          Icon(
            c.isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
            color: c.warning,
          ),
          const SizedBox(width: 16),
          const Expanded(child: Text('المظهر', style: TextStyle(fontSize: 16))),
          SegmentedButton<AppThemeMode>(
            showSelectedIcon: false,
            style: const ButtonStyle(visualDensity: VisualDensity.compact),
            segments: const [
              ButtonSegment(
                value: AppThemeMode.system,
                icon: Icon(Icons.brightness_auto_outlined, size: 18),
                tooltip: 'حسب النظام',
              ),
              ButtonSegment(
                value: AppThemeMode.light,
                icon: Icon(Icons.light_mode_outlined, size: 18),
                tooltip: 'فاتح',
              ),
              ButtonSegment(
                value: AppThemeMode.dark,
                icon: Icon(Icons.dark_mode_outlined, size: 18),
                tooltip: 'داكن',
              ),
            ],
            selected: {current},
            onSelectionChanged: (v) {
              final app = context.read<AppServices>();
              guarded(
                context,
                () => app.settings.update(
                  app.db.settings.copyWith(themeMode: v.first),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

/// About / developer credit screen.
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  static const version = '2.2.1';
  static const developer = 'معين العباسي';
  static const website = 'alabbasi.uk';
  static const websiteUrl = 'https://alabbasi.uk';
  static const phone = '+967770941666';

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(title: const Text('حول التطبيق')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [c.primaryDark, c.primary],
                  begin: Alignment.topRight,
                  end: Alignment.bottomLeft,
                ),
                borderRadius: BorderRadius.circular(22),
              ),
              child: Column(
                children: [
                  Container(
                    width: 84,
                    height: 84,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.35),
                      ),
                    ),
                    child: const Icon(
                      Icons.storefront_rounded,
                      color: Colors.white,
                      size: 46,
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'دفتر البقالة',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'النسخة $version • يعمل محلياً 100% بدون إنترنت',
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const SectionTitle('المطوّر'),
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: CircleAvatar(
                      backgroundColor: c.primarySoft,
                      child: Icon(Icons.person_rounded, color: c.primaryStrong),
                    ),
                    title: const Text(
                      developer,
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                    subtitle: const Text('تصميم وتطوير النظام'),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: Icon(Icons.language_rounded, color: c.info),
                    title: const Text(
                      website,
                      textDirection: TextDirection.ltr,
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: const Text('الموقع الإلكتروني'),
                    trailing: const Icon(Icons.open_in_new_rounded, size: 18),
                    onTap: () => NativeBridge.openUrl(websiteUrl),
                    onLongPress: () => _copy(context, websiteUrl),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: Icon(Icons.phone_rounded, color: c.primaryStrong),
                    title: const Text(
                      phone,
                      textDirection: TextDirection.ltr,
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: const Text('اتصال مباشر • اضغط مطولاً للنسخ'),
                    trailing: const Icon(Icons.call_rounded, size: 18),
                    onTap: () => NativeBridge.dial(phone),
                    onLongPress: () => _copy(context, phone),
                  ),
                ],
              ),
            ),
            const SectionTitle('عن النظام'),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _bullet(
                      c,
                      Icons.qr_code_scanner_rounded,
                      'كاشير بالباركود عبر كاميرا الهاتف أو ماسح خارجي، مع صوت واهتزاز لكل قراءة.',
                    ),
                    _bullet(
                      c,
                      Icons.account_balance_wallet_rounded,
                      'دفاتر حركات لا تُعدَّل ولا تُحذف؛ الأرصدة والمخزون تُشتق منها دائماً.',
                    ),
                    _bullet(
                      c,
                      Icons.people_alt_rounded,
                      'حسابات العملاء (الديون) والتجار مع حدود ائتمان وتجميد.',
                    ),
                    _bullet(
                      c,
                      Icons.inventory_2_rounded,
                      'مخزون بتكلفة متوسط متحرك وتنبيهات نقص.',
                    ),
                    _bullet(
                      c,
                      Icons.lock_rounded,
                      'بياناتك على جهازك فقط، مع نسخ احتياطي واستعادة ورمز PIN.',
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Center(
              child: Text(
                '© ${DateTime.now().year} $developer — جميع الحقوق محفوظة',
                style: TextStyle(fontSize: 12, color: c.textMuted),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static void _copy(BuildContext context, String text) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('تم النسخ')));
  }

  Widget _bullet(AppPalette c, IconData icon, String text) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: c.primaryStrong),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: TextStyle(fontSize: 13, height: 1.5, color: c.text),
          ),
        ),
      ],
    ),
  );
}
