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
import '../../domain/enums/enums.dart';
import '../expenses/expense_sheet.dart';
import '../pos/pos_screen.dart';
import '../products/products_screen.dart';
import '../settings/branding_screen.dart';
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
            ListTile(leading: Icon(Icons.qr_code_scanner_rounded, color: context.c.primaryStrong), title: const Text('الكاشير (مسح بالباركود)'),
                subtitle: const Text('بيع سريع بالكاميرا أو الماسح', style: TextStyle(fontSize: 12)),
                trailing: const Icon(Icons.chevron_left),
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PosScreen(), fullscreenDialog: true))),
            const Divider(),
            ListTile(leading: Icon(Icons.receipt_long_outlined, color: context.c.danger), title: Text('المصروفات'),
                trailing: const Icon(Icons.chevron_left), onTap: () => go(const ExpensesScreen())),
            const Divider(),
            ListTile(leading: Icon(Icons.inventory_2_outlined, color: context.c.warning), title: Text('فواتير المشتريات'),
                trailing: const Icon(Icons.chevron_left), onTap: () => go(const PurchasesScreen())),
            if (db.settings.inventoryEnabled) ...[
              const Divider(),
              ListTile(leading: Icon(Icons.inventory_outlined, color: context.c.primaryDark), title: Text('المنتجات والمخزون'),
                  trailing: const Icon(Icons.chevron_left), onTap: () => go(const ProductsScreen())),
            ],
            const Divider(),
            ListTile(leading: Icon(Icons.bar_chart, color: context.c.info), title: Text('التقارير'),
                trailing: const Icon(Icons.chevron_left), onTap: () => go(const ReportsScreen())),
          ])),
          const SizedBox(height: 12),
          Card(child: Column(children: [
            ListTile(leading: const Icon(Icons.settings_outlined), title: const Text('الإعدادات'),
                trailing: const Icon(Icons.chevron_left), onTap: () => go(const SettingsScreen())),
            const Divider(),
            ListTile(leading: Icon(Icons.branding_watermark_outlined, color: context.c.primaryStrong), title: const Text('هوية المحل والطباعة'),
                subtitle: const Text('الشعار، البيان العلوي والسفلي للفواتير والتقارير', style: TextStyle(fontSize: 12)),
                trailing: const Icon(Icons.chevron_left), onTap: () => go(const BrandingScreen())),
            const Divider(),
            ListTile(leading: const Icon(Icons.history), title: const Text('سجل التدقيق'),
                subtitle: Text('${db.audit.length} حركة مسجلة'),
                trailing: const Icon(Icons.chevron_left), onTap: () => go(const AuditScreen())),
            const Divider(),
            ListTile(leading: const Icon(Icons.backup_outlined), title: const Text('النسخ الاحتياطي والاستعادة'),
                trailing: const Icon(Icons.chevron_left), onTap: () => go(const BackupScreen())),
          ])),
          const SizedBox(height: 12),
          Card(child: Column(children: [
            _ThemeModeTile(current: db.settings.themeMode),
            const Divider(),
            ListTile(leading: Icon(Icons.info_outline_rounded, color: context.c.info), title: const Text('حول التطبيق والمطور'),
                subtitle: const Text('معين العباسي • alabbasi.uk', style: TextStyle(fontSize: 12)),
                trailing: const Icon(Icons.chevron_left), onTap: () => go(const AboutScreen())),
          ])),
          const SizedBox(height: 24),
          Center(child: Text('دفتر البقالة • نسخة ${AboutScreen.version} • يعمل محلياً بدون إنترنت',
              style: TextStyle(fontSize: 12, color: context.c.textMuted))),
          const SizedBox(height: 4),
          Center(child: Text('تطوير: معين العباسي',
              style: TextStyle(fontSize: 12, color: context.c.textMuted, fontWeight: FontWeight.w600))),
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
            child: Center(child: Tag('تشغيلية: ${total.format()}', color: context.c.danger))),
      ]),
      floatingActionButton: FloatingActionButton.extended(heroTag: 'fab_exp',
          backgroundColor: context.c.danger, foregroundColor: Colors.white,
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
                final color = e.isCancelled ? context.c.textMuted : linked ? context.c.info : context.c.danger;
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
                  AuditAction.cancel || AuditAction.delete => context.c.danger,
                  AuditAction.create => context.c.primaryDark,
                  _ => context.c.info,
                };
                return ListTile(dense: true,
                    leading: Icon(a.isLargeTx ? Icons.warning_amber_rounded : Icons.circle, size: a.isLargeTx ? 22 : 10,
                        color: a.isLargeTx ? context.c.warning : color),
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
  late AppThemeMode _theme = s0.themeMode;

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
        const SectionTitle('المظهر'),
        SegmentedButton<AppThemeMode>(
          segments: const [
            ButtonSegment(value: AppThemeMode.system, icon: Icon(Icons.brightness_auto_outlined), label: Text('حسب النظام')),
            ButtonSegment(value: AppThemeMode.light, icon: Icon(Icons.light_mode_outlined), label: Text('فاتح')),
            ButtonSegment(value: AppThemeMode.dark, icon: Icon(Icons.dark_mode_outlined), label: Text('داكن')),
          ],
          selected: {_theme},
          onSelectionChanged: (v) => setState(() => _theme = v.first),
        ),
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
      themeMode: _theme,
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
        Text('البيانات محفوظة محلياً على هاتفك فقط. انسخ النسخة الاحتياطية واحفظها في مكان آمن (مثل رسالة لنفسك أو ملاحظات).',
            style: TextStyle(color: context.c.textMuted)),
        const SizedBox(height: 16),
        FilledButton.icon(icon: const Icon(Icons.copy), label: const Text('نسخ النسخة الاحتياطية (JSON)'),
            onPressed: () async {
              final json = app.settings.exportJson();
              await Clipboard.setData(ClipboardData(text: json));
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: Text('تم نسخ ${(json.length / 1024).toStringAsFixed(1)} كيلوبايت إلى الحافظة'),
                  backgroundColor: context.c.primaryDark));
            }),
        const SizedBox(height: 12),
        OutlinedButton.icon(icon: const Icon(Icons.share_outlined), label: const Text('عرض النسخة كنص'),
            onPressed: () => showFormSheet(context, SelectableText(app.settings.exportJson(),
                textDirection: TextDirection.ltr, style: const TextStyle(fontSize: 10, fontFamily: 'monospace')))),
        const SizedBox(height: 32),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(foregroundColor: context.c.danger),
          icon: const Icon(Icons.restore), label: const Text('استعادة من نسخة (يستبدل كل البيانات)'),
          onPressed: () async {
            final ctrl = TextEditingController();
            final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
              title: const Text('استعادة نسخة احتياطية'),
              content: TextField(controller: ctrl, maxLines: 6, textDirection: TextDirection.ltr,
                  decoration: const InputDecoration(hintText: 'الصق محتوى النسخة هنا')),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
                FilledButton(style: FilledButton.styleFrom(backgroundColor: context.c.danger),
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

/// Quick theme switch (persists immediately via SettingsService).
class _ThemeModeTile extends StatelessWidget {
  const _ThemeModeTile({required this.current});
  final AppThemeMode current;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(children: [
        Icon(c.isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded, color: c.warning),
        const SizedBox(width: 16),
        const Expanded(child: Text('المظهر', style: TextStyle(fontSize: 16))),
        SegmentedButton<AppThemeMode>(
          showSelectedIcon: false,
          style: const ButtonStyle(visualDensity: VisualDensity.compact),
          segments: const [
            ButtonSegment(value: AppThemeMode.system, icon: Icon(Icons.brightness_auto_outlined, size: 18), tooltip: 'حسب النظام'),
            ButtonSegment(value: AppThemeMode.light, icon: Icon(Icons.light_mode_outlined, size: 18), tooltip: 'فاتح'),
            ButtonSegment(value: AppThemeMode.dark, icon: Icon(Icons.dark_mode_outlined, size: 18), tooltip: 'داكن'),
          ],
          selected: {current},
          onSelectionChanged: (v) {
            final app = context.read<AppServices>();
            guarded(context, () => app.settings.update(app.db.settings.copyWith(themeMode: v.first)));
          },
        ),
      ]),
    );
  }
}

/// About / developer credit screen.
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  static const version = '2.0.0';
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
        child: ListView(padding: const EdgeInsets.all(16), children: [
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
            child: Column(children: [
              Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
                ),
                child: const Icon(Icons.storefront_rounded, color: Colors.white, size: 46),
              ),
              const SizedBox(height: 14),
              const Text('دفتر البقالة',
                  style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('النسخة $version • يعمل محلياً 100% بدون إنترنت',
                  style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ]),
          ),
          const SizedBox(height: 16),
          const SectionTitle('المطوّر'),
          Card(
            child: Column(children: [
              ListTile(
                leading: CircleAvatar(
                  backgroundColor: c.primarySoft,
                  child: Icon(Icons.person_rounded, color: c.primaryStrong),
                ),
                title: const Text(developer, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                subtitle: const Text('تصميم وتطوير النظام'),
              ),
              const Divider(height: 1),
              ListTile(
                leading: Icon(Icons.language_rounded, color: c.info),
                title: const Text(website, textDirection: TextDirection.ltr,
                    style: TextStyle(fontWeight: FontWeight.w700)),
                subtitle: const Text('الموقع الإلكتروني'),
                trailing: const Icon(Icons.open_in_new_rounded, size: 18),
                onTap: () => NativeBridge.openUrl(websiteUrl),
                onLongPress: () => _copy(context, websiteUrl),
              ),
              const Divider(height: 1),
              ListTile(
                leading: Icon(Icons.phone_rounded, color: c.primaryStrong),
                title: const Text(phone, textDirection: TextDirection.ltr,
                    style: TextStyle(fontWeight: FontWeight.w700)),
                subtitle: const Text('اتصال مباشر • اضغط مطولاً للنسخ'),
                trailing: const Icon(Icons.call_rounded, size: 18),
                onTap: () => NativeBridge.dial(phone),
                onLongPress: () => _copy(context, phone),
              ),
            ]),
          ),
          const SectionTitle('عن النظام'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _bullet(c, Icons.qr_code_scanner_rounded, 'كاشير بالباركود عبر كاميرا الهاتف أو ماسح خارجي، مع صوت واهتزاز لكل قراءة.'),
                _bullet(c, Icons.account_balance_wallet_rounded, 'دفاتر حركات لا تُعدَّل ولا تُحذف؛ الأرصدة والمخزون تُشتق منها دائماً.'),
                _bullet(c, Icons.people_alt_rounded, 'حسابات العملاء (الديون) والتجار مع حدود ائتمان وتجميد.'),
                _bullet(c, Icons.inventory_2_rounded, 'مخزون بتكلفة متوسط متحرك وتنبيهات نقص.'),
                _bullet(c, Icons.lock_rounded, 'بياناتك على جهازك فقط، مع نسخ احتياطي واستعادة ورمز PIN.'),
              ]),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text('© ${DateTime.now().year} $developer — جميع الحقوق محفوظة',
                style: TextStyle(fontSize: 12, color: c.textMuted)),
          ),
        ]),
      ),
    );
  }

  static void _copy(BuildContext context, String text) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم النسخ')));
  }

  Widget _bullet(AppPalette c, IconData icon, String text) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, size: 20, color: c.primaryStrong),
      const SizedBox(width: 10),
      Expanded(child: Text(text, style: TextStyle(fontSize: 13, height: 1.5, color: c.text))),
    ]),
  );
}
