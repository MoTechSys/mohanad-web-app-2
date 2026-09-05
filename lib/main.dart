import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'app/app_services.dart';
import 'app/shell.dart';
import 'core/platform/native_bridge.dart';
import 'core/theme/app_theme.dart';
import 'data/kv_backend.dart';
import 'data/ledger_db.dart';
import 'domain/enums/enums.dart';
import 'features/settings/pin_gate.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ar');
  final services = AppServices.withBackend(HiveBackend());
  await services.init();
  // م5: نسخة احتياطية يومية تلقائية (آخر 7) — لا تعطل الإقلاع أبدًا.
  unawaited(services.backup.runDailyBackup());
  // م6: إشعار محلي إذا وُجدت منتجات منتهية/قريبة الانتهاء — لا يعطل الإقلاع.
  unawaited(notifyExpiringProducts(services));
  runApp(GroceryLedgerApp(services: services));
}

/// م6 — إشعار في شريط الإشعارات عند وجود منتجات منتهية أو قريبة الانتهاء.
/// يعمل مرة واحدة عند كل إقلاع، وأي خطأ يُبتلع بصمت.
Future<void> notifyExpiringProducts(AppServices services) async {
  try {
    final list = services.reports.expiringSoon();
    if (list.isEmpty) return;
    final expired = list.where((p) => p.isExpired).length;
    final soon = list.length - expired;
    final parts = <String>[
      if (expired > 0) '$expired منتج منتهي الصلاحية',
      if (soon > 0) '$soon منتج تنتهي صلاحيته خلال 30 يومًا',
    ];
    final names = list.take(3).map((p) => p.name).join('، ');
    await NativeBridge.showNotification(
      id: 1001,
      title: 'تنبيه صلاحية — دفتر البقالة',
      body: '${parts.join(' و')}: $names${list.length > 3 ? '…' : ''}',
    );
  } catch (_) {
    /* لا يعطل الإقلاع */
  }
}

class GroceryLedgerApp extends StatelessWidget {
  const GroceryLedgerApp({super.key, required this.services});
  final AppServices services;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<AppServices>.value(value: services),
        ChangeNotifierProvider<LedgerDb>.value(value: services.db),
      ],
      child: Consumer<LedgerDb>(
        builder: (context, db, _) => MaterialApp(
          title: 'دفتر البقالة',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: switch (db.settings.themeMode) {
            AppThemeMode.system => ThemeMode.system,
            AppThemeMode.light => ThemeMode.light,
            AppThemeMode.dark => ThemeMode.dark,
          },
          locale: const Locale('ar'),
          supportedLocales: const [Locale('ar')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          builder: (context, child) => MediaQuery(
            // م6: خط أكبر لكبار السن وضعاف القراءة (اختياري من الإعدادات).
            data: MediaQuery.of(context).copyWith(
              textScaler: db.settings.largeFont
                  ? const TextScaler.linear(1.15)
                  : TextScaler.noScaling,
            ),
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: child ?? const SizedBox.shrink(),
            ),
          ),
          home: const PinGate(child: AppShell()),
        ),
      ),
    );
  }
}
