import 'package:flutter_test/flutter_test.dart';
import 'package:grocery_ledger/app/app_services.dart';
import 'package:grocery_ledger/core/errors/domain_exception.dart';
import 'package:grocery_ledger/core/money/money.dart';
import 'package:grocery_ledger/data/kv_backend.dart';
import 'package:grocery_ledger/data/ledger_db.dart';
import 'package:grocery_ledger/domain/enums/enums.dart';
import 'package:grocery_ledger/domain/models/inventory.dart';
import 'package:grocery_ledger/features/pos/cart_controller.dart';

void main() {
  late AppServices app;
  late CartController cart;
  late Product milk;
  late Product bread;

  setUp(() async {
    app = AppServices.withBackend(MemoryBackend());
    await app.init();
    milk = await app.inventory.createProduct(
      name: 'حليب',
      barcode: '6281000000011',
      purchasePrice: Money.units(400),
      salePrice: Money.units(500),
      openingQty: Qty.units(20),
    );
    bread = await app.inventory.createProduct(
      name: 'خبز',
      purchasePrice: Money.units(50),
      salePrice: Money.units(100),
      trackInventory: false,
    );
    cart = CartController(app.db, app.documents);
  });

  group('barcode index', () {
    test('finds product by barcode, normalising Arabic digits and spaces', () {
      expect(app.db.productByBarcode('6281000000011')?.id, milk.id);
      expect(app.db.productByBarcode(' 6281000000011 ')?.id, milk.id);
      expect(app.db.productByBarcode('٦٢٨١٠٠٠٠٠٠٠١١')?.id, milk.id);
      expect(app.db.productByBarcode('000'), isNull);
    });

    test('index invalidates after product update', () async {
      await app.inventory.updateProduct(milk.id, barcode: '999');
      expect(app.db.productByBarcode('6281000000011'), isNull);
      expect(app.db.productByBarcode('999')?.id, milk.id);
    });

    test('searchProducts prefix-first ordering', () async {
      await app.inventory.createProduct(name: 'شاي حليب', salePrice: Money.units(1));
      final r = app.db.searchProducts('حليب');
      expect(r.first.name, 'حليب');
      expect(r.map((p) => p.name), containsAll(['حليب', 'شاي حليب']));
      expect(app.db.searchProducts('xyz'), isEmpty);
    });
  });

  group('scanning', () {
    test('first scan adds, deliberate second scan increments', () {
      final t0 = DateTime(2025, 1, 1, 10);
      expect(cart.scan('6281000000011', now: t0), ScanOutcome.added);
      expect(cart.scan('6281000000011', now: t0.add(const Duration(seconds: 2))), ScanOutcome.incremented);
      expect(cart.lines.single.qty, Qty.units(2));
      expect(cart.gross, Money.units(1000));
    });

    test('rapid duplicate frames are ignored', () {
      final t0 = DateTime(2025, 1, 1, 10);
      cart.scan('6281000000011', now: t0);
      expect(cart.scan('6281000000011', now: t0.add(const Duration(milliseconds: 300))), ScanOutcome.ignoredDuplicate);
      expect(cart.lines.single.qty, Qty.one);
    });

    test('unknown / invalid / paused product', () async {
      expect(cart.scan('1234567890'), ScanOutcome.unknown);
      expect(cart.scan('12'), ScanOutcome.invalid);
      await app.inventory.updateProduct(milk.id, status: ProductStatus.paused);
      expect(cart.scan('6281000000011', now: DateTime(2030)), ScanOutcome.unknown);
      expect(cart.isEmpty, isTrue);
    });

    test('lastTouchedKey follows the last scan', () {
      cart.addProduct(bread);
      cart.scan('6281000000011');
      expect(cart.lastTouchedKey, milk.id);
    });
  });

  group('editing', () {
    test('qty / price / remove / discount', () {
      cart.addProduct(milk);
      cart.addProduct(bread, qty: Qty.units(3));
      cart.setQty(milk.id, Qty.units(4));
      cart.setUnitPrice(bread.id, Money.units(120));
      expect(cart.gross, Money.units(4 * 500 + 3 * 120));
      cart.decrement(bread.id);
      expect(cart.lines.last.qty, Qty.units(2));
      cart.setDiscount(Money.units(40));
      expect(cart.net, Money.units(2000 + 240 - 40));
      cart.remove(milk.id);
      expect(cart.itemCount, 1);
      // Discount larger than gross is rejected.
      expect(() => cart.setDiscount(Money.units(10000)), throwsA(isA<DomainException>()));
      expect(() => cart.setUnitPrice(bread.id, Money.units(-1)), throwsA(isA<DomainException>()));
    });

    test('decrement to zero removes the line', () {
      cart.addProduct(milk);
      cart.decrement(milk.id);
      expect(cart.isEmpty, isTrue);
    });

    test('ad-hoc lines validate input', () {
      cart.addAdHoc(name: 'خضار', unitPrice: Money.units(250));
      expect(cart.gross, Money.units(250));
      expect(() => cart.addAdHoc(name: ' ', unitPrice: Money.units(1)), throwsA(isA<DomainException>()));
      expect(() => cart.addAdHoc(name: 'x', unitPrice: Money.units(1), qty: Qty.zero), throwsA(isA<DomainException>()));
    });

    test('change calculation', () {
      cart.addProduct(milk);
      expect(cart.changeFor(Money.units(400)), isNull);
      expect(cart.changeFor(Money.units(1000)), Money.units(500));
    });
  });

  group('checkout', () {
    test('cash checkout writes invoice, stock move, COGS, and empties cart', () async {
      cart.scan('6281000000011');
      cart.addProduct(bread, qty: Qty.units(2));
      cart.setDiscount(Money.units(50));
      final sale = await cart.checkout(paymentType: PaymentType.cash);

      expect(cart.isEmpty, isTrue);
      expect(sale.netAmount, Money.units(500 + 200 - 50));
      expect(sale.lines.length, 2);
      expect(app.db.stockOf(milk.id), Qty.units(19));
      // bread does not track inventory → no stock move
      expect(app.db.productMoves(bread.id), isEmpty);
      expect(sale.profit, Money.units(650 - 400 - 100));
    });

    test('credit checkout requires customer and respects limit', () async {
      cart.addProduct(milk);
      expect(
        () => cart.checkout(paymentType: PaymentType.credit),
        throwsA(isA<DomainException>()),
      );
      // cart intact after failure
      expect(cart.itemCount, 1);

      final c = await app.parties.createCustomer(name: 'سعيد', creditLimit: Money.units(300));
      expect(
        () => cart.checkout(paymentType: PaymentType.credit, customerId: c.id),
        throwsA(predicate((e) => e is DomainException && e.code == ErrorCodes.creditLimitExceeded)),
      );
      await cart.checkout(paymentType: PaymentType.credit, customerId: c.id, approveOverLimit: true);
      expect(app.db.customerBalance(c.id), Money.units(500));
    });

    test('empty cart cannot checkout', () {
      expect(() => cart.checkout(paymentType: PaymentType.cash), throwsA(isA<DomainException>()));
    });

    test('cancelling the sale restores stock and balance exactly', () async {
      final c = await app.parties.createCustomer(name: 'نور');
      cart.addProduct(milk, qty: Qty.units(5));
      final before = app.db.stockOf(milk.id);
      final sale = await cart.checkout(paymentType: PaymentType.credit, customerId: c.id);
      expect(app.db.stockOf(milk.id), before - Qty.units(5));
      await app.documents.cancelSale(sale.id, 'خطأ');
      expect(app.db.stockOf(milk.id), before);
      expect(app.db.customerBalance(c.id), Money.zero);
    });
  });

  test('normalizeBarcode', () {
    expect(LedgerDb.normalizeBarcode(' ١٢٣ 456 '), '123456');
    expect(LedgerDb.normalizeBarcode('ABC-1'), 'ABC-1');
  });
}
