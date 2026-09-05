import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:grocery_ledger/app/app_services.dart';
import 'package:grocery_ledger/core/money/money.dart';
import 'package:grocery_ledger/core/platform/native_bridge.dart';
import 'package:grocery_ledger/core/theme/app_theme.dart';
import 'package:grocery_ledger/data/kv_backend.dart';
import 'package:grocery_ledger/features/vouchers/vouchers_screen.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

Future<AppServices> boot() async {
  await initializeDateFormatting('ar');
  NativeBridge.spy = (_, _) {};
  final app = AppServices.withBackend(MemoryBackend());
  await app.init();
  return app;
}

Widget host(AppServices app, Widget child) => MultiProvider(
  providers: [
    Provider<AppServices>.value(value: app),
    ChangeNotifierProvider.value(value: app.db),
  ],
  child: MaterialApp(
    theme: AppTheme.light(),
    home: Directionality(textDirection: TextDirection.rtl, child: child),
  ),
);

void main() {
  testWidgets('vouchers screen shows empty state then lists a voucher', (
    tester,
  ) async {
    final app = await boot();
    await tester.pumpWidget(host(app, const VouchersScreen()));
    await tester.pumpAndSettle();
    expect(find.text('لا توجد سندات'), findsOneWidget);

    await app.vouchers.createReceipt(
      partyNameManual: 'أحمد',
      amount: Money.units(500),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('RV-0001'), findsOneWidget);
    expect(find.textContaining('أحمد'), findsOneWidget);
  });

  testWidgets('create a receipt via the form for a manual party', (
    tester,
  ) async {
    final app = await boot();
    await tester.pumpWidget(host(app, const VouchersScreen()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('سند جديد'));
    await tester.pumpAndSettle();

    // طرف خارجي
    await tester.tap(find.byType(SwitchListTile));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextFormField, 'استلمنا من (الاسم)'),
      'صالح',
    );
    await tester.enterText(find.widgetWithText(TextFormField, 'المبلغ'), '750');
    await tester.tap(find.text('حفظ السند'));
    await tester.pumpAndSettle();

    expect(app.vouchers.all().length, 1);
    expect(app.vouchers.all().first.amount, Money.units(750));
    expect(find.textContaining('RV-0001'), findsOneWidget);
  });

  testWidgets('filter separates receipts from payments', (tester) async {
    final app = await boot();
    await app.vouchers.createReceipt(
      partyNameManual: 'قبض١',
      amount: Money.units(100),
    );
    await app.vouchers.createPayment(
      partyNameManual: 'صرف١',
      amount: Money.units(200),
    );

    await tester.pumpWidget(host(app, const VouchersScreen()));
    await tester.pumpAndSettle();
    expect(find.textContaining('RV-'), findsOneWidget);
    expect(find.textContaining('PV-'), findsOneWidget);

    await tester.tap(find.text('قبض'));
    await tester.pumpAndSettle();
    expect(find.textContaining('RV-'), findsOneWidget);
    expect(find.textContaining('PV-'), findsNothing);
  });

  group('SMS templates', () {
    test('credit sale message includes amount and total debt', () async {
      final app = await boot();
      final msg = app.sms.creditSaleMessage(
        saleAmount: Money.units(500),
        totalDebt: Money.units(1500),
      );
      expect(msg, contains('500'));
      expect(msg, contains('1,500'));
      expect(msg, contains('إجمالي الدين'));
    });

    test('receipt message shows remaining or full settlement', () async {
      final app = await boot();
      final partial = app.sms.receiptMessage(
        paid: Money.units(300),
        remaining: Money.units(200),
      );
      expect(partial, contains('المتبقي عليكم'));
      final full = app.sms.receiptMessage(
        paid: Money.units(300),
        remaining: Money.zero,
      );
      expect(full, contains('سداد كامل'));
    });

    test('notifyVoucher sends the customer paid + remaining', () async {
      final app = await boot();
      final c = await app.parties.createCustomer(
        name: 'سمير',
        phone: '777123456',
        openingBalance: Money.units(1000),
      );
      final v = await app.vouchers.createReceipt(
        customerId: c.id,
        amount: Money.units(400),
      );

      String? sentTo, sentText;
      app.sms.sender = (n, t) async {
        sentTo = n;
        sentText = t;
        return true;
      };
      final ok = await app.sms.notifyVoucher(v);
      expect(ok, isTrue);
      expect(sentTo, '777123456');
      expect(sentText, contains('400'));
      expect(sentText, contains('600')); // المتبقي
    });

    test('reminder is skipped when there is no debt or phone', () async {
      final app = await boot();
      final noPhone = await app.parties.createCustomer(
        name: 'بدون رقم',
        openingBalance: Money.units(100),
      );
      app.sms.sender = (_, _) async => true;
      expect(await app.sms.sendReminder(noPhone.id), isFalse);

      final noDebt = await app.parties.createCustomer(
        name: 'مسدد',
        phone: '777000000',
      );
      expect(await app.sms.sendReminder(noDebt.id), isFalse);
    });
  });
}
