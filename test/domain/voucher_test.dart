import 'package:flutter_test/flutter_test.dart';
import 'package:grocery_ledger/app/app_services.dart';
import 'package:grocery_ledger/core/errors/domain_exception.dart';
import 'package:grocery_ledger/core/money/money.dart';
import 'package:grocery_ledger/data/kv_backend.dart';
import 'package:grocery_ledger/domain/enums/enums.dart';
import 'package:grocery_ledger/domain/models/party.dart';
import 'package:grocery_ledger/domain/models/voucher.dart';

Money m(int units) => Money.units(units);

Matcher throwsCode(String code) =>
    throwsA(predicate((e) => e is DomainException && e.code == code));

void main() {
  late AppServices app;
  late Customer ali;
  late Supplier wholesale;

  setUp(() async {
    app = AppServices.withBackend(MemoryBackend());
    await app.init();
    ali = await app.parties.createCustomer(name: 'علي', phone: '777123456');
    wholesale = await app.parties.createSupplier(name: 'مؤسسة الجملة');
  });

  group('سند قبض (receipt voucher)', () {
    test('sequential numbering RV-0001, RV-0002 … never reused', () async {
      final v1 = await app.vouchers.createReceipt(
        customerId: ali.id,
        amount: m(100),
      );
      final v2 = await app.vouchers.createReceipt(
        customerId: ali.id,
        amount: m(50),
      );
      expect(v1.voucherNo, 'RV-0001');
      expect(v2.voucherNo, 'RV-0002');
      // Cancel v2 then create a new one — number 0002 is NOT reused.
      await app.vouchers.cancelVoucher(v2.id, 'خطأ إدخال');
      final v3 = await app.vouchers.createReceipt(
        customerId: ali.id,
        amount: m(70),
      );
      expect(v3.voucherNo, 'RV-0003');
    });

    test('receipt from customer reduces his debt via ledger row', () async {
      await app.parties.addCustomerDebt(ali.id, m(500), notes: 'بضاعة');
      final v = await app.vouchers.createReceipt(
        customerId: ali.id,
        amount: m(200),
        details: 'دفعة أولى',
      );
      expect(app.db.customerBalance(ali.id), m(300));
      // The ledger row is linked to the voucher.
      final tx = app.db.customerTx[v.partyTxId]!;
      expect(tx.refType, RefType.voucher);
      expect(tx.refId, v.id);
      expect(tx.type, PartyTxType.payment);
      expect(tx.balanceBefore, m(500));
      expect(tx.balanceAfter, m(300));
    });

    test('cancel receipt restores the customer balance exactly', () async {
      await app.parties.addCustomerDebt(ali.id, m(500));
      final v = await app.vouchers.createReceipt(
        customerId: ali.id,
        amount: m(200),
      );
      expect(app.db.customerBalance(ali.id), m(300));
      await app.vouchers.cancelVoucher(v.id, 'مبلغ خاطئ');
      expect(app.db.customerBalance(ali.id), m(500));
      expect(app.db.vouchers[v.id]!.isCancelled, isTrue);
      expect(app.db.vouchers[v.id]!.cancelReason, 'مبلغ خاطئ');
    });

    test('receipt from a one-off party needs a manual name', () async {
      expect(
        () => app.vouchers.createReceipt(amount: m(10)),
        throwsCode(ErrorCodes.invalidAmount),
      );
      final v = await app.vouchers.createReceipt(
        partyNameManual: 'مكتب العقارات',
        amount: m(10),
      );
      expect(v.partyTxId, isNull);
      expect(app.vouchers.partyName(v), 'مكتب العقارات');
    });

    test('rejects zero/negative amounts and unknown customers', () async {
      expect(
        () =>
            app.vouchers.createReceipt(customerId: ali.id, amount: Money.zero),
        throwsCode(ErrorCodes.invalidAmount),
      );
      expect(
        () => app.vouchers.createReceipt(customerId: 'ghost', amount: m(5)),
        throwsCode(ErrorCodes.notFound),
      );
    });
  });

  group('سند صرف (payment voucher)', () {
    test('numbering PV- is independent from RV-', () async {
      await app.vouchers.createReceipt(customerId: ali.id, amount: m(10));
      final p1 = await app.vouchers.createPayment(
        supplierId: wholesale.id,
        amount: m(30),
      );
      expect(p1.voucherNo, 'PV-0001');
    });

    test('payment to supplier settles debt + records expense', () async {
      await app.parties.addSupplierDebt(wholesale.id, m(1000), notes: 'فاتورة');
      final v = await app.vouchers.createPayment(
        supplierId: wholesale.id,
        amount: m(400),
      );
      expect(app.db.supplierBalance(wholesale.id), m(600));
      final e = app.db.expenses[v.expenseId]!;
      expect(e.type, ExpenseType.supplierPayment);
      expect(e.amount, m(400));
      expect(e.isActive, isTrue);
    });

    test(
      'cancel payment reverses BOTH the ledger row and the expense',
      () async {
        await app.parties.addSupplierDebt(wholesale.id, m(1000));
        final v = await app.vouchers.createPayment(
          supplierId: wholesale.id,
          amount: m(400),
        );
        await app.vouchers.cancelVoucher(v.id, 'صرف مكرر');
        expect(app.db.supplierBalance(wholesale.id), m(1000));
        expect(app.db.expenses[v.expenseId]!.isCancelled, isTrue);
      },
    );

    test('payment to one-off party records a general expense', () async {
      final v = await app.vouchers.createPayment(
        partyNameManual: 'ورشة الكهرباء',
        amount: m(150),
        details: 'صيانة ثلاجة',
      );
      final e = app.db.expenses[v.expenseId]!;
      expect(e.type, ExpenseType.other);
      expect(v.partyTxId, isNull);
      expect(app.vouchers.partyName(v), 'ورشة الكهرباء');
    });

    test('cancel requires a reason; double cancel rejected', () async {
      final v = await app.vouchers.createPayment(
        partyNameManual: 'جهة',
        amount: m(10),
      );
      expect(
        () => app.vouchers.cancelVoucher(v.id, '  '),
        throwsCode(ErrorCodes.invalidAmount),
      );
      await app.vouchers.cancelVoucher(v.id, 'سبب');
      expect(
        () => app.vouchers.cancelVoucher(v.id, 'سبب آخر'),
        throwsCode(ErrorCodes.alreadyCancelled),
      );
    });
  });

  group('persistence & backup round-trip', () {
    test('vouchers survive reload from the same backend', () async {
      final backend = MemoryBackend();
      var a = AppServices.withBackend(backend);
      await a.init();
      final c = await a.parties.createCustomer(name: 'سالم');
      await a.parties.addCustomerDebt(c.id, m(300));
      final v = await a.vouchers.createReceipt(
        customerId: c.id,
        amount: m(100),
      );

      // Fresh services over the same storage.
      a = AppServices.withBackend(backend);
      await a.init();
      final loaded = a.db.vouchers[v.id]!;
      expect(loaded.voucherNo, 'RV-0001');
      expect(loaded.amount, m(100));
      expect(a.db.customerBalance(c.id), m(200));
    });

    test('export/import JSON keeps vouchers', () async {
      await app.vouchers.createReceipt(customerId: ali.id, amount: m(55));
      final json = app.settings.exportJson();

      final fresh = AppServices.withBackend(MemoryBackend());
      await fresh.init();
      await fresh.settings.importJson(json);
      expect(fresh.db.vouchers.length, 1);
      expect(fresh.db.vouchers.values.single.amount, m(55));
    });

    test('serialization round-trip preserves every field', () {
      final now = DateTime.now();
      final v = Voucher(
        id: 'v1',
        voucherNo: 'PV-0009',
        type: VoucherType.payment,
        amount: m(750),
        supplierId: 's1',
        partyTxId: 't1',
        expenseId: 'e1',
        method: VoucherMethod.transfer,
        details: 'ملاحظات',
        voucherDate: now,
        createdAt: now,
      );
      final back = Voucher.fromMap(v.toMap());
      expect(back.voucherNo, 'PV-0009');
      expect(back.type, VoucherType.payment);
      expect(back.method, VoucherMethod.transfer);
      expect(back.amount, m(750));
      expect(back.supplierId, 's1');
      expect(back.partyTxId, 't1');
      expect(back.expenseId, 'e1');
      expect(back.isActive, isTrue);
    });
  });
}
