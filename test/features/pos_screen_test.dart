import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:grocery_ledger/app/app_services.dart';
import 'package:grocery_ledger/core/money/money.dart';
import 'package:grocery_ledger/core/platform/native_bridge.dart';
import 'package:grocery_ledger/core/theme/app_theme.dart';
import 'package:grocery_ledger/data/kv_backend.dart';
import 'package:grocery_ledger/domain/enums/enums.dart';
import 'package:grocery_ledger/features/pos/pos_screen.dart';
import 'package:grocery_ledger/main.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

Future<AppServices> boot() async {
  await initializeDateFormatting('ar');
  NativeBridge.spy = (_, _) {};
  final app = AppServices.withBackend(MemoryBackend());
  await app.init();
  await app.inventory.createProduct(
    name: 'حليب',
    barcode: '6281000000011',
    purchasePrice: Money.units(400),
    salePrice: Money.units(500),
    openingQty: Qty.units(10),
  );
  return app;
}

Widget host(AppServices app, {AppThemeMode mode = AppThemeMode.light}) =>
    MultiProvider(
      providers: [
        Provider<AppServices>.value(value: app),
        ChangeNotifierProvider.value(value: app.db),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: mode == AppThemeMode.dark ? ThemeMode.dark : ThemeMode.light,
        home: const Directionality(
          textDirection: TextDirection.rtl,
          child: PosScreen(showCamera: false),
        ),
      ),
    );

void main() {
  testWidgets('POS opens with empty cart and quick picks', (tester) async {
    final app = await boot();
    await tester.pumpWidget(host(app));
    await tester.pumpAndSettle();
    expect(find.text('الكاشير'), findsOneWidget);
    expect(find.text('حليب'), findsWidgets);
    expect(find.text('السلة فارغة'), findsOneWidget);
  });

  testWidgets('typing a barcode + Enter adds the product to the cart',
      (tester) async {
    final app = await boot();
    await tester.pumpWidget(host(app));
    await tester.pumpAndSettle();
    await tester.enterText(
        find.widgetWithText(TextField, 'ابحث بالاسم أو الباركود…'),
        '6281000000011');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    expect(find.text('السلة فارغة'), findsNothing);
    expect(find.text('إتمام البيع'), findsOneWidget);
  });

  testWidgets('dark theme renders POS without errors', (tester) async {
    final app = await boot();
    await tester.pumpWidget(host(app, mode: AppThemeMode.dark));
    await tester.pumpAndSettle();
    expect(find.text('الكاشير'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shell shows cashier FAB and About screen shows developer',
      (tester) async {
    final app = await boot();
    await tester.pumpWidget(GroceryLedgerApp(services: app));
    await tester.pumpAndSettle();
    expect(find.text('الكاشير'), findsWidgets);
    await tester.tap(find.text('المزيد'));
    await tester.pumpAndSettle();
    // م6: «المزيد» شبكة أيقونات — عنوان البلاطة على سطرين
    await tester.scrollUntilVisible(find.text('حول\nالتطبيق'), 200,
        scrollable: find.byType(Scrollable).last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('حول\nالتطبيق'));
    await tester.pumpAndSettle();
    expect(find.text('معين العباسي'), findsOneWidget);
    expect(find.text('alabbasi.uk'), findsOneWidget);
    expect(find.text('+967770941666'), findsOneWidget);
  });

  testWidgets('theme mode persists through settings', (tester) async {
    final app = await boot();
    await app.settings
        .update(app.db.settings.copyWith(themeMode: AppThemeMode.dark));
    await tester.pumpWidget(GroceryLedgerApp(services: app));
    await tester.pumpAndSettle();
    final ctx = tester.element(find.text('الرئيسية'));
    expect(Theme.of(ctx).brightness, Brightness.dark);
  });
}
