import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'app/app_services.dart';
import 'app/shell.dart';
import 'core/theme/app_theme.dart';
import 'data/kv_backend.dart';
import 'data/ledger_db.dart';
import 'features/settings/pin_gate.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ar');
  final services = AppServices.withBackend(HiveBackend());
  await services.init();
  runApp(GroceryLedgerApp(services: services));
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
      child: MaterialApp(
        title: 'دفتر البقالة',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        locale: const Locale('ar'),
        supportedLocales: const [Locale('ar')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        home: const PinGate(child: AppShell()),
      ),
    );
  }
}
