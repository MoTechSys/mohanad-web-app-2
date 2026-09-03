import 'package:flutter_test/flutter_test.dart';
import 'package:grocery_ledger/app/app_services.dart';
import 'package:grocery_ledger/core/errors/domain_exception.dart';
import 'package:grocery_ledger/core/money/money.dart';
import 'package:grocery_ledger/data/kv_backend.dart';
import 'package:grocery_ledger/data/services/report_service.dart';
import 'package:grocery_ledger/domain/enums/enums.dart';
import 'package:grocery_ledger/domain/models/documents.dart';
import 'package:grocery_ledger/domain/models/settings.dart';

Money m(int units) => Money.units(units);

Matcher throwsCode(String code) => throwsA(
  isA<DomainException>().having((e) => e.code, 'code', code),
);

void main() {
  late AppServices app;

  setUp(() async {
    app = AppServices.withBackend(MemoryBackend());
    await app.init();
  });

  group('Customer ledger', () {
    test('opening balance creates protected OPENING row', () async {
      final c = await app.parties.createCustomer(
        name: 'أحمد',
        openingBalance: m(500),
      );
      expect(app.db.customerBalance(c.id), m(500));
      final st = app.db.customerStatement(c.id);
      expect(st.single.type, PartyTxType.opening);
      expect(
        () => app.parties.cancelCustomerTx(st.single.id, 'x'),
        throwsCode(ErrorCodes.openingProtected),
      );
    });

    test('debt → payment → balance is derived from ledger', () async {
      final c = await app.parties.createCustomer(name: 'سالم');
      await app.parties.addCustomerDebt(c.id, m(300));
      await app.parties.addCustomerDebt(c.id, m(200));
      await app.parties.addCustomerPayment(c.id, m(150));
      expect(app.db.customerBalance(c.id), m(350));
      final st = app.db.customerStatement(c.id);
      expect(st.length, 3);
      // snapshots consistent
      final byTime = st.reversed.toList();
      expect(byTime[0].balanceBefore, Money.zero);
      expect(byTime[0].balanceAfter, m(300));
      expect(byTime[1].balanceAfter, m(500));
      expect(byTime[2].balanceAfter, m(350));
    });

    test('cancel reverses effect without deleting the row', () async {
      final c = await app.parties.createCustomer(name: 'x');
      final d = await app.parties.addCustomerDebt(c.id, m(100));
      await app.parties.addCustomerPayment(c.id, m(30));
      await app.parties.cancelCustomerTx(d.id, 'خطأ إدخال');
      expect(app.db.customerBalance(c.id), m(-30));
      expect(app.db.customerStatement(c.id).length, 2);
      expect(app.db.customerTx[d.id]!.isCancelled, isTrue);
      expect(
        () => app.parties.cancelCustomerTx(d.id, 'again'),
        throwsCode(ErrorCodes.alreadyCancelled),
      );
    });

    test('rejects zero / negative amounts', () async {
      final c = await app.parties.createCustomer(name: 'x');
      expect(
        () => app.parties.addCustomerDebt(c.id, Money.zero),
        throwsCode(ErrorCodes.invalidAmount),
      );
      expect(
        () => app.parties.addCustomerPayment(c.id, m(-5)),
        throwsCode(ErrorCodes.invalidAmount),
      );
      expect(
        () => app.parties.addCustomerAdjustment(c.id, Money.zero, reason: 'r'),
        throwsCode(ErrorCodes.invalidAmount),
      );
    });

    test('credit limit blocks unless approved', () async {
      final c = await app.parties.createCustomer(
        name: 'x',
        creditLimit: m(1000),
      );
      await app.parties.addCustomerDebt(c.id, m(900));
      expect(
        () => app.parties.addCustomerDebt(c.id, m(200)),
        throwsCode(ErrorCodes.creditLimitExceeded),
      );
      expect(app.db.customerBalance(c.id), m(900), reason: 'no partial write');
      await app.parties.addCustomerDebt(c.id, m(200), approveOverLimit: true);
      expect(app.db.customerBalance(c.id), m(1100));
      expect(app.reports.overLimitCustomers().single.id, c.id);
    });

    test('frozen customer cannot take debt but can pay', () async {
      final c = await app.parties.createCustomer(name: 'x');
      await app.parties.addCustomerDebt(c.id, m(100));
      await app.parties.setCustomerStatus(c.id, CustomerStatus.frozen);
      expect(
        () => app.parties.addCustomerDebt(c.id, m(1)),
        throwsCode(ErrorCodes.customerFrozen),
      );
      await app.parties.addCustomerPayment(c.id, m(100));
      expect(app.db.customerBalance(c.id), Money.zero);
    });

    test('grace period clears automatically when paid off', () async {
      final c = await app.parties.createCustomer(name: 'x');
      await app.parties.addCustomerDebt(c.id, m(100));
      await app.parties.setCustomerStatus(
        c.id,
        CustomerStatus.gracePeriod,
        graceUntil: DateTime.now().add(const Duration(days: 7)),
      );
      await app.parties.addCustomerPayment(c.id, m(100));
      expect(app.db.customers[c.id]!.status, CustomerStatus.active);
      expect(app.db.customers[c.id]!.graceUntil, isNull);
    });

    test('clearBalance writes exact offsetting adjustment', () async {
      final c = await app.parties.createCustomer(name: 'x');
      await app.parties.addCustomerDebt(c.id, m(777));
      await app.parties.clearCustomerBalance(c.id, 'تصفير');
      expect(app.db.customerBalance(c.id), Money.zero);
    });

    test('cannot delete customer with balance', () async {
      final c = await app.parties.createCustomer(name: 'x');
      await app.parties.addCustomerDebt(c.id, m(10));
      expect(
        () => app.parties.deleteCustomer(c.id),
        throwsCode(ErrorCodes.hasBalance),
      );
    });
  });

  group('Supplier ledger', () {
    test('credit purchase raises debt, payment lowers it', () async {
      final s = await app.parties.createSupplier(name: 'مورد');
      await app.documents.createPurchase(
        supplierId: s.id,
        paymentType: PaymentType.credit,
        totalAmount: m(5000),
      );
      expect(app.db.supplierBalance(s.id), m(5000));
      final e = await app.parties.paySupplier(s.id, m(2000));
      expect(app.db.supplierBalance(s.id), m(3000));
      expect(e.type, ExpenseType.supplierPayment);
      // single cash-flow path: exactly one expense row
      expect(
        app.db.expenses.values
            .where((x) => x.type == ExpenseType.supplierPayment)
            .length,
        1,
      );
    });

    test('cancel supplier payment reverses ledger', () async {
      final s = await app.parties.createSupplier(name: 'م', openingBalance: m(1000));
      final e = await app.parties.paySupplier(s.id, m(400));
      expect(app.db.supplierBalance(s.id), m(600));
      await app.documents.cancelExpense(e.id, 'خطأ');
      expect(app.db.supplierBalance(s.id), m(1000));
    });

    test('linked ledger rows cannot be cancelled directly', () async {
      final s = await app.parties.createSupplier(name: 'م');
      await app.documents.createPurchase(
        supplierId: s.id,
        paymentType: PaymentType.credit,
        totalAmount: m(100),
      );
      final tx = app.db.supplierStatement(s.id).single;
      expect(
        () => app.parties.cancelSupplierTx(tx.id, 'x'),
        throwsCode(ErrorCodes.alreadyCancelled),
      );
    });
  });

  group('Sales', () {
    test('credit sale creates linked DEBT; cancel reverses', () async {
      final c = await app.parties.createCustomer(name: 'x');
      final sale = await app.documents.createSale(
        customerId: c.id,
        paymentType: PaymentType.credit,
        totalAmount: m(250),
        discount: m(50),
      );
      expect(sale.netAmount, m(200));
      expect(app.db.customerBalance(c.id), m(200));
      await app.documents.cancelSale(sale.id, 'مرتجع');
      expect(app.db.customerBalance(c.id), Money.zero);
      expect(app.db.sales[sale.id]!.isCancelled, isTrue);
      expect(app.db.customerStatement(c.id).single.isCancelled, isTrue);
    });

    test('cash sale does not touch customer balance', () async {
      final c = await app.parties.createCustomer(name: 'x');
      await app.documents.createSale(
        customerId: c.id,
        paymentType: PaymentType.cash,
        totalAmount: m(99),
      );
      expect(app.db.customerBalance(c.id), Money.zero);
    });

    test('credit sale requires customer & respects frozen/limit', () async {
      expect(
        () => app.documents.createSale(
          paymentType: PaymentType.credit,
          totalAmount: m(10),
        ),
        throwsCode(ErrorCodes.customerRequired),
      );
      final c = await app.parties.createCustomer(name: 'x', creditLimit: m(50));
      expect(
        () => app.documents.createSale(
          customerId: c.id,
          paymentType: PaymentType.credit,
          totalAmount: m(60),
        ),
        throwsCode(ErrorCodes.creditLimitExceeded),
      );
      expect(app.db.sales, isEmpty, reason: 'validation before write');
    });

    test('discount > gross rejected', () async {
      expect(
        () => app.documents.createSale(
          paymentType: PaymentType.cash,
          totalAmount: m(10),
          discount: m(20),
        ),
        throwsCode(ErrorCodes.negativeNet),
      );
    });

    test('detailed sale: totals, COGS snapshot, stock out', () async {
      final p = await app.inventory.createProduct(
        name: 'سكر',
        purchasePrice: m(4),
        salePrice: m(5),
        openingQty: Qty.units(20),
      );
      final sale = await app.documents.createSale(
        paymentType: PaymentType.cash,
        mode: DocMode.detailedItems,
        lines: [
          DocLine(productId: p.id, name: 'سكر', qty: Qty.units(3), unitPrice: m(5)),
          const DocLine(name: 'كيس', qty: Qty(2000), unitPrice: Money(50)),
        ],
      );
      expect(sale.grossAmount, m(16)); // 15 + 1.00
      expect(sale.costAmount, m(12)); // 3 × 4 (unknown line = 0 cost)
      expect(sale.profit, m(4));
      expect(app.db.stockOf(p.id), Qty.units(17));
      await app.documents.cancelSale(sale.id, null);
      expect(app.db.stockOf(p.id), Qty.units(20));
    });

    test('duplicate invoice number rejected', () async {
      await app.documents.createSale(
        paymentType: PaymentType.cash,
        totalAmount: m(1),
        invoiceNo: 'A1',
      );
      expect(
        () => app.documents.createSale(
          paymentType: PaymentType.cash,
          totalAmount: m(1),
          invoiceNo: 'A1',
        ),
        throwsCode(ErrorCodes.duplicate),
      );
    });
  });

  group('Purchases', () {
    test('cash purchase creates linked expense; cancel cascades', () async {
      final pur = await app.documents.createPurchase(
        paymentType: PaymentType.cash,
        totalAmount: m(700),
      );
      final exp = app.db.expenses.values.single;
      expect(exp.type, ExpenseType.cashPurchase);
      expect(exp.purchaseId, pur.id);
      expect(
        () => app.documents.cancelExpense(exp.id, 'x'),
        throwsCode(ErrorCodes.alreadyCancelled),
        reason: 'must cancel via purchase',
      );
      await app.documents.cancelPurchase(pur.id, 'x');
      expect(app.db.expenses[exp.id]!.isCancelled, isTrue);
    });

    test('detailed purchase raises stock and updates cost', () async {
      final p = await app.inventory.createProduct(name: 'أرز', purchasePrice: m(10));
      final pur = await app.documents.createPurchase(
        paymentType: PaymentType.cash,
        mode: DocMode.detailedItems,
        lines: [
          DocLine(productId: p.id, name: 'أرز', qty: Qty.units(10), unitPrice: m(12)),
        ],
      );
      expect(pur.totalAmount, m(120));
      expect(app.db.stockOf(p.id), Qty.units(10));
      expect(app.db.products[p.id]!.purchasePrice, m(12));
      await app.documents.cancelPurchase(pur.id, null);
      expect(app.db.stockOf(p.id), Qty.zero);
    });

    test('credit purchase requires supplier', () async {
      expect(
        () => app.documents.createPurchase(
          paymentType: PaymentType.credit,
          totalAmount: m(1),
        ),
        throwsCode(ErrorCodes.supplierRequired),
      );
    });
  });

  group('Inventory', () {
    test('manual moves and adjustment semantics', () async {
      final p = await app.inventory.createProduct(name: 'x', openingQty: Qty.units(5));
      await app.inventory.manualMove(p.id, StockMoveType.inbound, Qty.units(5));
      await app.inventory.manualMove(p.id, StockMoveType.loss, Qty.units(2));
      expect(app.db.stockOf(p.id), Qty.units(8));
      // adjustment = set absolute
      await app.inventory.manualMove(p.id, StockMoveType.adjustment, Qty.units(20));
      expect(app.db.stockOf(p.id), Qty.units(20));
      final last = app.db.productMoves(p.id).first;
      expect(last.delta, Qty.units(12));
      await app.inventory.cancelMove(last.id, 'x');
      expect(app.db.stockOf(p.id), Qty.units(8));
    });

    test('low stock and valuation', () async {
      final p = await app.inventory.createProduct(
        name: 'x',
        purchasePrice: m(3),
        minQty: Qty.units(5),
        openingQty: Qty.units(4),
      );
      expect(app.inventory.lowStock().single.id, p.id);
      expect(app.inventory.stockValue(), m(12));
    });

    test('duplicate barcode rejected', () async {
      await app.inventory.createProduct(name: 'a', barcode: '111');
      expect(
        () => app.inventory.createProduct(name: 'b', barcode: '111'),
        throwsCode(ErrorCodes.duplicate),
      );
    });
  });

  group('Reports', () {
    test('period summary, cash flow and profit modes', () async {
      final c = await app.parties.createCustomer(name: 'c');
      final s = await app.parties.createSupplier(name: 's');
      final p = await app.inventory.createProduct(
        name: 'p',
        purchasePrice: m(6),
        salePrice: m(10),
        openingQty: Qty.units(100),
      );
      // revenue
      await app.documents.createSale(
        paymentType: PaymentType.cash,
        mode: DocMode.detailedItems,
        lines: [DocLine(productId: p.id, name: 'p', qty: Qty.units(10), unitPrice: m(10))],
      ); // 100 cash, cogs 60
      await app.documents.createSale(
        customerId: c.id,
        paymentType: PaymentType.credit,
        totalAmount: m(50),
      ); // 50 credit
      await app.documents.createDailyIncome(amount: m(30));
      await app.parties.addCustomerPayment(c.id, m(20));
      // costs
      await app.documents.createExpense(amount: m(15)); // opex
      await app.documents.createPurchase(
        paymentType: PaymentType.cash,
        totalAmount: m(40),
      ); // cash purchase
      await app.documents.createPurchase(
        supplierId: s.id,
        paymentType: PaymentType.credit,
        totalAmount: m(200),
      );
      await app.parties.paySupplier(s.id, m(70));

      final r = app.reports.summary(DateRange.today());
      expect(r.cashSales, m(100));
      expect(r.creditSales, m(50));
      expect(r.dailyIncome, m(30));
      expect(r.revenue, m(180));
      expect(r.customerPayments, m(20));
      expect(r.operatingExpenses, m(15));
      expect(r.cashPurchases, m(40));
      expect(r.creditPurchases, m(200));
      expect(r.supplierPayments, m(70));
      expect(r.cogs, m(60));

      // cash flow: in = 100 + 30 + 20 = 150 ; out = 15 + 40 + 70 = 125
      expect(r.cashIn, m(150));
      expect(r.cashOut, m(125));
      expect(r.netCash, m(25));

      // accurate profit = 180 − 60 − 15 = 105
      expect(r.profit(ProfitMode.accurate), m(105));
      // estimated = 180 − (40+200) − 15 = −75
      expect(r.profit(ProfitMode.estimated), m(-75));
      expect(
        r.profit(ProfitMode.estimated, cashPurchaseAsCogs: false),
        m(165),
      );

      expect(app.reports.customersDebt().total, m(30));
      expect(app.reports.suppliersDebt().total, m(130));
      expect(app.reports.topProducts(DateRange.today()).single.profit, m(40));
    });

    test('cancelled documents are excluded', () async {
      final s = await app.documents.createSale(
        paymentType: PaymentType.cash,
        totalAmount: m(100),
      );
      await app.documents.cancelSale(s.id, null);
      expect(app.reports.summary(DateRange.today()).totalSales, Money.zero);
    });
  });

  group('Audit & settings', () {
    test('large transaction flagged when threshold set', () async {
      await app.settings.update(
        const AppSettings(largeTxThreshold: Money(500000)),
      );
      await app.documents.createSale(
        paymentType: PaymentType.cash,
        totalAmount: m(6000),
      );
      expect(app.db.audit.values.where((a) => a.isLargeTx).length, 1);
    });

    test('pin validation', () async {
      expect(
        () => app.settings.update(const AppSettings(pinCode: '12')),
        throwsCode(ErrorCodes.invalidAmount),
      );
      await app.settings.update(const AppSettings(pinCode: '1234'));
      expect(app.db.settings.pinCode, '1234');
    });

    test('export → wipe → import restores balances exactly', () async {
      final c = await app.parties.createCustomer(name: 'c', openingBalance: m(10));
      await app.parties.addCustomerDebt(c.id, m(5));
      final p = await app.inventory.createProduct(name: 'p', openingQty: Qty.units(7));
      final json = app.settings.exportJson();

      await app.db.wipeAll();
      expect(app.db.customers, isEmpty);

      await app.settings.importJson(json);
      expect(app.db.customerBalance(c.id), m(15));
      expect(app.db.stockOf(p.id), Qty.units(7));
      expect(app.db.categories.length, 6, reason: 'no duplicate seeding');
    });

    test('import of garbage fails without wiping', () async {
      await app.parties.createCustomer(name: 'keep');
      expect(
        () => app.settings.importJson('{not json'),
        throwsCode(ErrorCodes.invalidAmount),
      );
      expect(app.db.customers.length, 1);
    });
  });

  group('Persistence round-trip', () {
    test('reload from backend yields identical derived state', () async {
      final backend = MemoryBackend();
      final a1 = AppServices.withBackend(backend);
      await a1.init();
      final c = await a1.parties.createCustomer(name: 'c');
      await a1.parties.addCustomerDebt(c.id, m(120));
      final p = await a1.inventory.createProduct(name: 'p', openingQty: const Qty(1500));
      await a1.documents.createSale(
        customerId: c.id,
        paymentType: PaymentType.credit,
        mode: DocMode.detailedItems,
        lines: [DocLine(productId: p.id, name: 'p', qty: const Qty(500), unitPrice: m(8))],
      );

      final a2 = AppServices.withBackend(backend);
      await a2.init();
      expect(a2.db.customerBalance(c.id), m(124));
      expect(a2.db.stockOf(p.id), const Qty(1000));
      expect(a2.db.sales.values.single.lines.single.qty, const Qty(500));
    });
  });
}
