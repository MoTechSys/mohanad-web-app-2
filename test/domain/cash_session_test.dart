import 'package:flutter_test/flutter_test.dart';
import 'package:grocery_ledger/app/app_services.dart';
import 'package:grocery_ledger/core/errors/domain_exception.dart';
import 'package:grocery_ledger/core/money/money.dart';
import 'package:grocery_ledger/data/kv_backend.dart';
import 'package:grocery_ledger/domain/enums/enums.dart';

Money m(int units) => Money.units(units);

Matcher throwsCode(String code) =>
    throwsA(isA<DomainException>().having((e) => e.code, 'code', code));

Future<AppServices> boot() async {
  final app = AppServices.withBackend(MemoryBackend());
  await app.init();
  return app;
}

void main() {
  group('ورديات الصندوق (م3)', () {
    test('فتح وردية برقم متسلسل Z-0001 ثم منع وردية ثانية', () async {
      final app = await boot();
      final s = await app.shifts.openShift(
        workerName: 'محمد',
        openingCash: m(5000),
      );
      expect(s.sessionNo, 'Z-0001');
      expect(s.isOpen, isTrue);
      expect(app.shifts.openSession?.id, s.id);

      expect(
        () => app.shifts.openShift(workerName: 'آخر', openingCash: m(0)),
        throwsCode(ErrorCodes.sessionOpen),
      );
    });

    test('اسم العامل مطلوب والافتتاحي لا يكون سالبًا', () async {
      final app = await boot();
      expect(
        () => app.shifts.openShift(workerName: '  ', openingCash: m(1)),
        throwsCode(ErrorCodes.invalidAmount),
      );
      expect(
        () => app.shifts.openShift(workerName: 'س', openingCash: Money(-100)),
        throwsCode(ErrorCodes.invalidAmount),
      );
    });

    test('تقرير Z يجمع النقد الداخل والخارج ويحسب المتوقع', () async {
      final app = await boot();
      final s = await app.shifts.openShift(
        workerName: 'أحمد',
        openingCash: m(10000),
      );

      // بيع نقدي 3000
      await app.documents.createSale(
        paymentType: PaymentType.cash,
        mode: DocMode.totalOnly,
        totalAmount: m(3000),
      );
      // بيع آجل 2000 (لا يدخل الدرج)
      final c = await app.parties.createCustomer(name: 'عميل');
      await app.documents.createSale(
        customerId: c.id,
        paymentType: PaymentType.credit,
        mode: DocMode.totalOnly,
        totalAmount: m(2000),
      );
      // سداد عميل 500 عبر سند قبض
      await app.vouchers.createReceipt(customerId: c.id, amount: m(500));
      // سند قبض خارجي 200
      await app.vouchers.createReceipt(partyNameManual: 'جهة', amount: m(200));
      // مصروف 800
      await app.documents.createExpense(
        type: ExpenseType.other,
        amount: m(800),
        details: 'كهرباء',
      );

      final r = app.shifts.zReport(s);
      expect(r.cashSales, m(3000));
      expect(r.cashSalesCount, 1);
      expect(r.creditSales, m(2000));
      expect(r.customerPayments, m(500));
      expect(r.otherReceipts, m(200));
      expect(r.expenses, m(800));
      // متوقع = 10000 + (3000+500+200) − 800 = 12900
      expect(r.expectedCash, m(12900));
    });

    test('الإغلاق يجمّد المتوقع ويحسب الفرق ويمنع إغلاقًا مزدوجًا', () async {
      final app = await boot();
      final s = await app.shifts.openShift(
        workerName: 'سالم',
        openingCash: m(1000),
      );
      await app.documents.createSale(
        paymentType: PaymentType.cash,
        mode: DocMode.totalOnly,
        totalAmount: m(500),
      );

      final closed = await app.shifts.closeShift(s.id, countedCash: m(1400));
      expect(closed.isOpen, isFalse);
      expect(closed.expectedCash, m(1500));
      expect(closed.difference, Money(-100 * Money.scale)); // عجز 100

      expect(
        () => app.shifts.closeShift(s.id, countedCash: m(1)),
        throwsCode(ErrorCodes.sessionClosed),
      );
      // بعد الإغلاق يمكن فتح وردية جديدة برقم تالٍ
      final s2 = await app.shifts.openShift(
        workerName: 'سالم',
        openingCash: m(1400),
      );
      expect(s2.sessionNo, 'Z-0002');
    });

    test('الحركات خارج نافذة الوردية لا تدخل التقرير', () async {
      final app = await boot();
      // مصروف قبل فتح الوردية
      await app.documents.createExpense(
        type: ExpenseType.other,
        amount: m(999),
        details: 'قديم',
      );
      final s = await app.shifts.openShift(workerName: 'ع', openingCash: m(0));
      final r = app.shifts.zReport(s);
      expect(r.expenses, Money.zero);
      expect(r.expectedCash, Money.zero);
    });

    test(
      'الاستمرارية: الورديات تبقى بعد إعادة التحميل وضمن النسخة الاحتياطية',
      () async {
        final backend = MemoryBackend();
        var app = AppServices.withBackend(backend);
        await app.init();
        final s = await app.shifts.openShift(
          workerName: 'دائم',
          openingCash: m(700),
        );
        await app.shifts.closeShift(s.id, countedCash: m(700));

        // إعادة تحميل من نفس الذاكرة
        app = AppServices.withBackend(backend);
        await app.init();
        expect(app.db.cashSessions.length, 1);
        final loaded = app.db.cashSessions.values.first;
        expect(loaded.sessionNo, 'Z-0001');
        expect(loaded.countedCash, m(700));
        expect(loaded.difference, Money.zero);

        // تصدير/استيراد JSON يحفظ الورديات
        final json = app.settings.exportJson();
        final app2 = AppServices.withBackend(MemoryBackend());
        await app2.init();
        await app2.settings.importJson(json);
        expect(app2.db.cashSessions.length, 1);
        expect(app2.db.cashSessions.values.first.workerName, 'دائم');
      },
    );
  });
}
