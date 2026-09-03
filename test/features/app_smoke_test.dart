import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:grocery_ledger/app/app_services.dart';
import 'package:grocery_ledger/core/money/money.dart';
import 'package:grocery_ledger/data/kv_backend.dart';
import 'package:grocery_ledger/domain/enums/enums.dart';
import 'package:grocery_ledger/main.dart';
import 'package:intl/date_symbol_data_local.dart';

Future<AppServices> boot() async {
  await initializeDateFormatting('ar');
  final app = AppServices.withBackend(MemoryBackend());
  await app.init();
  return app;
}

void main() {
  testWidgets('app boots to dashboard with 5 tabs', (tester) async {
    final app = await boot();
    await tester.pumpWidget(GroceryLedgerApp(services: app));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('الرئيسية'), findsOneWidget);
    expect(find.text('العملاء'), findsOneWidget);
    expect(find.text('المبيعات'), findsOneWidget);
    expect(find.text('التجار'), findsOneWidget);
    expect(find.text('المزيد'), findsOneWidget);
    expect(find.text('إجمالي مبيعات اليوم'), findsOneWidget);
  });

  testWidgets('create customer via form and see it in list', (tester) async {
    final app = await boot();
    await tester.pumpWidget(GroceryLedgerApp(services: app));
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.text('العملاء'));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('لا يوجد عملاء بعد'), findsOneWidget);
    await tester.tap(find.text('عميل جديد'));
    await tester.pump(const Duration(seconds: 1));
    await tester.enterText(find.widgetWithText(TextFormField, 'الاسم *'), 'أحمد');
    await tester.enterText(
      find.widgetWithText(TextFormField, 'رصيد افتتاحي (دين سابق)'),
      '150',
    );
    await tester.tap(find.text('إضافة'));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('أحمد'), findsOneWidget);
    expect(find.text('150'), findsOneWidget);
    expect(app.db.activeCustomers.length, 1);
  });

  testWidgets('invalid money input shows validation error', (tester) async {
    final app = await boot();
    await tester.pumpWidget(GroceryLedgerApp(services: app));
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.text('المبيعات'));
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.text('بيع جديد'));
    await tester.pump(const Duration(seconds: 1));
    await tester.enterText(find.widgetWithText(TextFormField, 'المبلغ الإجمالي *'), '0');
    await tester.ensureVisible(find.text('تسجيل البيع'));
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.text('تسجيل البيع'));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('المبلغ يجب أن يكون أكبر من الصفر'), findsOneWidget);
    expect(app.db.sales, isEmpty);
  });

  testWidgets('cash sale reflects on dashboard', (tester) async {
    final app = await boot();
    await app.documents.createSale(
      paymentType: PaymentType.cash,
      totalAmount: Money.units(250),
    );
    await tester.pumpWidget(GroceryLedgerApp(services: app));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('250'), findsWidgets);
  });

  testWidgets('PIN gate blocks until correct code', (tester) async {
    final app = await boot();
    await app.settings.update(app.db.settings.copyWith(pinCode: '1234'));
    await tester.pumpWidget(GroceryLedgerApp(services: app));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('أدخل رمز الدخول'), findsOneWidget);
    for (final d in ['1', '2', '3', '5']) {
      await tester.tap(find.text(d));
      await tester.pump();
    }
    expect(find.text('رمز غير صحيح'), findsOneWidget);
    for (final d in ['1', '2', '3', '4']) {
      await tester.tap(find.text(d));
      await tester.pump();
    }
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('إجمالي مبيعات اليوم'), findsOneWidget);
  });
}
