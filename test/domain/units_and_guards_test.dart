// Tests for the voice-note requirements (جعبوس1):
//   1. Multi-unit products (كرتون/جوتة/حبة) with base-unit stock.
//   2. Oversell prevention («اشتريت 5 كرتون تجي تبيع 10 ما يقبلش»).
//   3. Below-cost sale warning («أقل من سعر الشراء يدهيلك تحذير»).
//   4. Typo-tolerant Arabic search («لو تغير حرف حرفين يقبل»).
//   5. Purchase invoices update product prices.
import 'package:flutter_test/flutter_test.dart';
import 'package:grocery_ledger/app/app_services.dart';
import 'package:grocery_ledger/core/errors/domain_exception.dart';
import 'package:grocery_ledger/core/money/money.dart';
import 'package:grocery_ledger/core/utils/arabic_text.dart';
import 'package:grocery_ledger/data/kv_backend.dart';
import 'package:grocery_ledger/domain/enums/enums.dart';
import 'package:grocery_ledger/domain/models/documents.dart';
import 'package:grocery_ledger/domain/models/inventory.dart';

Money m(int units) => Money.units(units);

Matcher throwsCode(String code) =>
    throwsA(isA<DomainException>().having((e) => e.code, 'code', code));

void main() {
  late AppServices app;

  setUp(() async {
    app = AppServices.withBackend(MemoryBackend());
    await app.init();
  });

  group('Multi-unit products', () {
    test('pack unit validation: factor must exceed 1, names unique', () async {
      expect(
        () => app.inventory.createProduct(
          name: 'حليب',
          packUnits: [PackUnit(name: 'كرتون', factor: Qty.one)],
        ),
        throwsCode(ErrorCodes.invalidQuantity),
      );
      expect(
        () => app.inventory.createProduct(
          name: 'حليب',
          unit: 'حبة',
          packUnits: [PackUnit(name: 'حبة', factor: Qty.units(24))],
        ),
        throwsCode(ErrorCodes.duplicate),
      );
      expect(
        () => app.inventory.createProduct(
          name: 'حليب',
          packUnits: [
            PackUnit(name: 'كرتون', factor: Qty.units(24)),
            PackUnit(name: 'كرتون', factor: Qty.units(12)),
          ],
        ),
        throwsCode(ErrorCodes.duplicate),
      );
    });

    test('pack units round-trip through serialization', () async {
      final p = await app.inventory.createProduct(
        name: 'حليب بقري',
        unit: 'حبة',
        purchasePrice: m(100),
        salePrice: m(120),
        packUnits: [
          PackUnit(name: 'كرتون', factor: Qty.units(24), salePrice: m(2700)),
        ],
      );
      final restored = Product.fromMap(p.toMap());
      expect(restored.packUnits.length, 1);
      expect(restored.packUnits.first.name, 'كرتون');
      expect(restored.packUnits.first.factor, Qty.units(24));
      expect(restored.packUnits.first.salePrice, m(2700));
      // Derived pack price falls back to base × factor when unset.
      expect(restored.packUnits.first.purchaseOf(m(100)), m(2400));
      expect(restored.allUnits.length, 2);
      expect(restored.allUnits.first.factor, Qty.one);
    });

    test('selling in cartons deducts base units from stock', () async {
      final p = await app.inventory.createProduct(
        name: 'ماء صحة',
        unit: 'قارورة',
        purchasePrice: m(50),
        salePrice: m(70),
        openingQty: Qty.units(60),
        packUnits: [PackUnit(name: 'كرتون', factor: Qty.units(12))],
      );
      await app.documents.createSale(
        paymentType: PaymentType.cash,
        mode: DocMode.detailedItems,
        lines: [
          DocLine(
            productId: p.id,
            name: p.name,
            qty: Qty.units(2), // 2 كرتون
            unitPrice: m(800), // سعر الكرتون
            unitName: 'كرتون',
            unitFactor: Qty.units(12),
          ),
        ],
      );
      // 60 - 2×12 = 36 base units.
      expect(app.db.stockOf(p.id), Qty.units(36));
    });

    test('carton line COGS snapshot = base cost × factor', () async {
      final p = await app.inventory.createProduct(
        name: 'بسكويت',
        unit: 'حبة',
        purchasePrice: m(30),
        salePrice: m(50),
        openingQty: Qty.units(100),
        packUnits: [PackUnit(name: 'كرتون', factor: Qty.units(20))],
      );
      final sale = await app.documents.createSale(
        paymentType: PaymentType.cash,
        mode: DocMode.detailedItems,
        lines: [
          DocLine(
            productId: p.id,
            name: p.name,
            qty: Qty.one,
            unitPrice: m(900),
            unitName: 'كرتون',
            unitFactor: Qty.units(20),
          ),
        ],
      );
      // Cost = 30 × 20 = 600 per carton.
      expect(sale.costAmount, m(600));
      expect(sale.profit, m(300));
    });
  });

  group('Oversell prevention', () {
    Future<Product> seed({int stock = 5}) => app.inventory.createProduct(
      name: 'شاي',
      unit: 'علبة',
      purchasePrice: m(200),
      salePrice: m(250),
      openingQty: Qty.units(stock),
    );

    test('selling more than stock is rejected (default)', () async {
      final p = await seed(stock: 5);
      expect(
        () => app.documents.createSale(
          paymentType: PaymentType.cash,
          mode: DocMode.detailedItems,
          lines: [
            DocLine(
              productId: p.id,
              name: p.name,
              qty: Qty.units(10),
              unitPrice: m(250),
            ),
          ],
        ),
        throwsCode(ErrorCodes.insufficientStock),
      );
      // Nothing was written.
      expect(app.db.sales.length, 0);
      expect(app.db.stockOf(p.id), Qty.units(5));
    });

    test('two lines of the same product are aggregated', () async {
      final p = await seed(stock: 5);
      expect(
        () => app.documents.createSale(
          paymentType: PaymentType.cash,
          mode: DocMode.detailedItems,
          lines: [
            DocLine(
              productId: p.id,
              name: p.name,
              qty: Qty.units(3),
              unitPrice: m(250),
            ),
            DocLine(
              productId: p.id,
              name: p.name,
              qty: Qty.units(3),
              unitPrice: m(250),
            ),
          ],
        ),
        throwsCode(ErrorCodes.insufficientStock),
      );
    });

    test('carton quantities convert before the check', () async {
      final p = await app.inventory.createProduct(
        name: 'عصير',
        unit: 'حبة',
        purchasePrice: m(40),
        salePrice: m(60),
        openingQty: Qty.units(20),
        packUnits: [PackUnit(name: 'كرتون', factor: Qty.units(24))],
      );
      expect(
        () => app.documents.createSale(
          paymentType: PaymentType.cash,
          mode: DocMode.detailedItems,
          lines: [
            DocLine(
              productId: p.id,
              name: p.name,
              qty: Qty.one, // 1 كرتون = 24 > 20 متاح
              unitPrice: m(1400),
              unitName: 'كرتون',
              unitFactor: Qty.units(24),
            ),
          ],
        ),
        throwsCode(ErrorCodes.insufficientStock),
      );
    });

    test('exact stock passes; oversell approval flag bypasses', () async {
      final p = await seed(stock: 5);
      await app.documents.createSale(
        paymentType: PaymentType.cash,
        mode: DocMode.detailedItems,
        lines: [
          DocLine(
            productId: p.id,
            name: p.name,
            qty: Qty.units(5),
            unitPrice: m(250),
          ),
        ],
      );
      expect(app.db.stockOf(p.id), Qty.zero);
      // With explicit approval a second sale may go negative.
      await app.documents.createSale(
        paymentType: PaymentType.cash,
        mode: DocMode.detailedItems,
        approveOversell: true,
        lines: [
          DocLine(
            productId: p.id,
            name: p.name,
            qty: Qty.one,
            unitPrice: m(250),
          ),
        ],
      );
      expect(app.db.stockOf(p.id), -Qty.one);
    });

    test('untracked products are never blocked', () async {
      final p = await app.inventory.createProduct(
        name: 'خضار',
        trackInventory: false,
        salePrice: m(100),
      );
      await app.documents.createSale(
        paymentType: PaymentType.cash,
        mode: DocMode.detailedItems,
        lines: [
          DocLine(
            productId: p.id,
            name: p.name,
            qty: Qty.units(50),
            unitPrice: m(100),
          ),
        ],
      );
      expect(app.db.sales.length, 1);
    });
  });

  group('Below-cost warning', () {
    test('selling below cost throws BELOW_COST until approved', () async {
      final p = await app.inventory.createProduct(
        name: 'سمن',
        purchasePrice: m(500),
        salePrice: m(600),
        openingQty: Qty.units(10),
      );
      expect(
        () => app.documents.createSale(
          paymentType: PaymentType.cash,
          mode: DocMode.detailedItems,
          lines: [
            DocLine(
              productId: p.id,
              name: p.name,
              qty: Qty.one,
              unitPrice: m(400),
            ),
          ],
        ),
        throwsCode(ErrorCodes.belowCost),
      );
      // Approval flag lets it through.
      final s = await app.documents.createSale(
        paymentType: PaymentType.cash,
        mode: DocMode.detailedItems,
        approveBelowCost: true,
        lines: [
          DocLine(
            productId: p.id,
            name: p.name,
            qty: Qty.one,
            unitPrice: m(400),
          ),
        ],
      );
      expect(s.netAmount, m(400));
    });

    test('warning can be disabled in settings', () async {
      await app.settings.update(app.db.settings.copyWith(warnBelowCost: false));
      final p = await app.inventory.createProduct(
        name: 'زيت',
        purchasePrice: m(300),
        salePrice: m(350),
        openingQty: Qty.units(5),
      );
      final s = await app.documents.createSale(
        paymentType: PaymentType.cash,
        mode: DocMode.detailedItems,
        lines: [
          DocLine(
            productId: p.id,
            name: p.name,
            qty: Qty.one,
            unitPrice: m(200),
          ),
        ],
      );
      expect(s.netAmount, m(200));
    });
  });

  group('Purchase price updates', () {
    test('detailed purchase updates product purchase price', () async {
      final p = await app.inventory.createProduct(
        name: 'أرز',
        purchasePrice: m(1000),
        salePrice: m(1200),
      );
      await app.documents.createPurchase(
        paymentType: PaymentType.cash,
        mode: DocMode.detailedItems,
        lines: [
          DocLine(
            productId: p.id,
            name: p.name,
            qty: Qty.units(10),
            unitPrice: m(1100),
          ),
        ],
      );
      expect(app.db.products[p.id]!.purchasePrice, m(1100));
      expect(app.db.stockOf(p.id), Qty.units(10));
    });

    test('carton purchase derives base cost from pack price', () async {
      final p = await app.inventory.createProduct(
        name: 'مياه',
        unit: 'قارورة',
        purchasePrice: m(40),
        salePrice: m(60),
        packUnits: [PackUnit(name: 'كرتون', factor: Qty.units(12))],
      );
      await app.documents.createPurchase(
        paymentType: PaymentType.cash,
        mode: DocMode.detailedItems,
        lines: [
          DocLine(
            productId: p.id,
            name: p.name,
            qty: Qty.units(5), // 5 كراتين
            unitPrice: m(600), // سعر الكرتون
            unitName: 'كرتون',
            unitFactor: Qty.units(12),
          ),
        ],
      );
      // Base cost = 600 / 12 = 50; stock = 5 × 12 = 60.
      expect(app.db.products[p.id]!.purchasePrice, m(50));
      expect(app.db.stockOf(p.id), Qty.units(60));
    });

    test('price update can be disabled in settings', () async {
      await app.settings.update(
        app.db.settings.copyWith(updatePricesFromPurchase: false),
      );
      final p = await app.inventory.createProduct(
        name: 'سكر',
        purchasePrice: m(700),
        salePrice: m(800),
      );
      await app.documents.createPurchase(
        paymentType: PaymentType.cash,
        mode: DocMode.detailedItems,
        lines: [
          DocLine(
            productId: p.id,
            name: p.name,
            qty: Qty.one,
            unitPrice: m(750),
          ),
        ],
      );
      expect(app.db.products[p.id]!.purchasePrice, m(700));
    });
  });

  group('Typo-tolerant Arabic search', () {
    test('normalisation unifies hamza / taa marbuta / yaa', () {
      expect(ArabicText.normalize('أحمَد'), ArabicText.normalize('احمد'));
      expect(ArabicText.normalize('موزة'), ArabicText.normalize('موزه'));
      expect(ArabicText.normalize('مقلى'), ArabicText.normalize('مقلي'));
      expect(ArabicText.normalize('چبن'), ArabicText.normalize('جبن'));
    });

    test('bounded edit distance', () {
      expect(ArabicText.distance('حليب', 'حليب'), 0);
      expect(ArabicText.distance('حليب', 'حليت'), 1);
      expect(ArabicText.distance('abc', 'axc'), 1);
      expect(ArabicText.distance('abc', 'xyz', max: 2), greaterThan(2));
    });

    test('search finds items despite 1-2 letter typos', () async {
      await app.inventory.createProduct(
        name: 'حليب المراعي',
        salePrice: m(120),
      );
      await app.inventory.createProduct(
        name: 'بسكويت أبو ولد',
        salePrice: m(50),
      );
      await app.inventory.createProduct(name: 'شاي الكبوس', salePrice: m(200));

      // Prefix works.
      expect(app.db.searchProducts('حلي').first.name, 'حليب المراعي');
      // Hamza/variant-insensitive.
      expect(app.db.searchProducts('ابو ولد'), isNotEmpty);
      // Typo: «حلبب» (one substitution) still finds milk.
      expect(
        app.db.searchProducts('حلبب').map((p) => p.name),
        contains('حليب المراعي'),
      );
      // Typo: «الكبوص» finds الكبوس.
      expect(
        app.db.searchProducts('الكبوص').map((p) => p.name),
        contains('شاي الكبوس'),
      );
      // Garbage finds nothing.
      expect(app.db.searchProducts('قهوةبن'), isNot(contains('شاي الكبوس')));
    });

    test('exact prefix ranks above fuzzy matches', () async {
      await app.inventory.createProduct(name: 'تونة', salePrice: m(90));
      await app.inventory.createProduct(name: 'تمر', salePrice: m(80));
      final r = app.db.searchProducts('تون');
      expect(r.first.name, 'تونة');
    });
  });

  group('Qty.times', () {
    test('integer multiplication is exact', () {
      expect(Qty.units(2).times(Qty.units(24)), Qty.units(48));
      expect(Qty.units(5).times(Qty.units(12)), Qty.units(60));
    });
    test('fractional quantities round half away from zero', () {
      // 1.5 × 24 = 36
      expect(const Qty(1500).times(Qty.units(24)), Qty.units(36));
      // 0.333 × 3 = 0.999
      expect(const Qty(333).times(Qty.units(3)), const Qty(999));
    });
  });

  group('Barcode lifecycle (v2.2.1)', () {
    test(
      'update: null keeps, empty clears, value sets — and index follows',
      () async {
        final p = await app.inventory.createProduct(
          name: 'شاي',
          barcode: ' ٦٢٩١٠٠١ ', // Arabic digits + spaces → normalised
          salePrice: m(5),
        );
        expect(p.barcode, '6291001');
        expect(app.db.productByBarcode('6291001')?.id, p.id);

        // null → unchanged
        var u = await app.inventory.updateProduct(p.id, name: 'شاي أخضر');
        expect(u.barcode, '6291001');

        // '' → cleared (previously stored '' and left a stale index)
        u = await app.inventory.updateProduct(p.id, barcode: '');
        expect(u.barcode, isNull);
        expect(app.db.productByBarcode('6291001'), isNull);

        // freed barcode can be reused by another product
        final q = await app.inventory.createProduct(
          name: 'قهوة',
          barcode: '6291001',
        );
        expect(app.db.productByBarcode('6291001')?.id, q.id);

        // set to a new value
        u = await app.inventory.updateProduct(p.id, barcode: '7000');
        expect(u.barcode, '7000');
        expect(app.db.productByBarcode('7000')?.id, p.id);
      },
    );

    test('Product.copyWith distinguishes unchanged from clear', () {
      final now = DateTime.now();
      final p = Product(
        id: 'x',
        name: 'n',
        barcode: 'b',
        createdAt: now,
        updatedAt: now,
      );
      expect(p.copyWith(name: 'm').barcode, 'b');
      expect(p.copyWith(barcode: null).barcode, isNull);
      expect(p.copyWith(barcode: 'c').barcode, 'c');
    });
  });
}
