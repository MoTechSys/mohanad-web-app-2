import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:grocery_ledger/app/app_services.dart';
import 'package:grocery_ledger/core/money/money.dart';
import 'package:grocery_ledger/data/export/pdf_exporter.dart';
import 'package:grocery_ledger/data/export/share_service.dart';
import 'package:grocery_ledger/data/kv_backend.dart';
import 'package:grocery_ledger/data/services/report_service.dart';
import 'package:grocery_ledger/domain/enums/enums.dart';
import 'package:grocery_ledger/domain/models/documents.dart';
import 'package:grocery_ledger/domain/models/settings.dart';
import 'package:intl/date_symbol_data_local.dart';

/// Boots an in-memory ledger with a realistic mix of documents so every
/// exporter has something to render.
Future<AppServices> boot() async {
  await initializeDateFormatting('ar');
  final app = AppServices.withBackend(MemoryBackend());
  await app.init();
  await app.settings.update(
    app.db.settings.copyWith(
      storeName: 'بقالة الأمانة',
      ownerName: 'أبو أحمد',
      phone: '770000000',
      address: 'صنعاء - شارع تعز',
      receiptHeader: 'أهلاً بكم في بقالة الأمانة',
      receiptFooter: 'البضاعة المباعة لا ترد ولا تستبدل',
      logoBase64: base64Encode(_tinyPng),
    ),
  );
  final milk = await app.inventory.createProduct(
    name: 'حليب',
    barcode: '6281000000011',
    purchasePrice: Money.units(400),
    salePrice: Money.units(500),
    openingQty: Qty.units(10),
  );
  final bread = await app.inventory.createProduct(
    name: 'خبز',
    purchasePrice: Money.units(50),
    salePrice: Money.units(100),
    openingQty: Qty.units(40),
  );
  final c = await app.parties.createCustomer(
    name: 'محمد علي',
    phone: '771111111',
    openingBalance: Money.units(1000),
  );
  final s = await app.parties.createSupplier(name: 'شركة الألبان');
  await app.documents.createSale(
    paymentType: PaymentType.cash,
    mode: DocMode.detailedItems,
    lines: [
      DocLine(
        productId: milk.id,
        name: milk.name,
        qty: Qty.units(2),
        unitPrice: Money.units(500),
        unitCost: Money.units(400),
      ),
      DocLine(
        productId: bread.id,
        name: bread.name,
        qty: Qty.units(3),
        unitPrice: Money.units(100),
        unitCost: Money.units(50),
      ),
    ],
  );
  await app.documents.createSale(
    customerId: c.id,
    paymentType: PaymentType.credit,
    totalAmount: Money.units(2500),
    details: 'دين آجل',
  );
  await app.parties.addCustomerPayment(c.id, Money.units(500));
  await app.documents.createPurchase(
    supplierId: s.id,
    paymentType: PaymentType.credit,
    totalAmount: Money.units(8000),
  );
  await app.documents.createExpense(amount: Money.units(300), details: 'كهرباء');
  return app;
}

bool isPdf(Uint8List b) =>
    b.length > 100 && utf8.decode(b.sublist(0, 4), allowMalformed: true) == '%PDF';

bool isXlsx(Uint8List b) => b.length > 100 && b[0] == 0x50 && b[1] == 0x4B;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AppSettings branding', () {
    test('round-trips header/footer/logo through toMap/fromMap', () {
      final s = const AppSettings().copyWith(
        storeName: 'بقالة',
        address: 'عدن',
        receiptHeader: 'علوي',
        receiptFooter: 'سفلي',
        logoBase64: 'QUJD',
      );
      final back = AppSettings.fromMap(s.toMap());
      expect(back.address, 'عدن');
      expect(back.receiptHeader, 'علوي');
      expect(back.receiptFooter, 'سفلي');
      expect(back.logoBase64, 'QUJD');
      expect(back.hasLogo, isTrue);
    });

    test('clearLogo removes the logo', () {
      final s = const AppSettings().copyWith(logoBase64: 'QUJD');
      expect(s.hasLogo, isTrue);
      final cleared = s.copyWith(clearLogo: true);
      expect(cleared.hasLogo, isFalse);
      expect(cleared.logoBase64, isNull);
    });
  });

  group('PdfExporter', () {
    test('sale invoice (A4) and receipt (80mm) are valid PDFs', () async {
      final app = await boot();
      final sale = app.db.sales.values.first;
      final inv = await app.pdf.saleInvoice(sale);
      final rec = await app.pdf.saleReceipt(sale);
      expect(isPdf(inv), isTrue);
      expect(isPdf(rec), isTrue);
    });

    test('customer & supplier statements render', () async {
      final app = await boot();
      final c = app.db.activeCustomers.first;
      final s = app.db.activeSuppliers.first;
      expect(isPdf(await app.pdf.customerStatement(c)), isTrue);
      expect(
        isPdf(await app.pdf.customerStatement(c, range: DateRange.thisMonth())),
        isTrue,
      );
      expect(isPdf(await app.pdf.supplierStatement(s)), isTrue);
    });

    test('period (monthly) report and inventory report render', () async {
      final app = await boot();
      final monthly = await app.pdf.periodReport(
        DateRange.thisMonth(),
        title: 'التقرير الشهري',
      );
      expect(isPdf(monthly), isTrue);
      // Empty range must not crash (no data → placeholders).
      final empty = await app.pdf.periodReport(
        DateRange(DateTime(2000, 1, 1), DateTime(2000, 1, 2)),
      );
      expect(isPdf(empty), isTrue);
      expect(isPdf(await app.pdf.inventoryReport()), isTrue);
    });

    test('barcode labels: all sizes, copies, and products without barcode',
        () async {
      final app = await boot();
      final products = app.db.activeProducts.toList();
      expect(products.any((p) => p.barcode == null || p.barcode!.isEmpty),
          isTrue);
      for (final size in LabelSize.values) {
        final bytes =
            await app.pdf.barcodeLabels(products, copies: 3, size: size);
        expect(isPdf(bytes), isTrue, reason: size.name);
      }
    });
  });

  group('ExcelExporter', () {
    test('period, customers and inventory workbooks are xlsx', () async {
      final app = await boot();
      expect(isXlsx(await app.excel.periodWorkbook(DateRange.thisMonth())),
          isTrue);
      expect(isXlsx(await app.excel.customersWorkbook()), isTrue);
      expect(isXlsx(await app.excel.inventoryWorkbook()), isTrue);
    });
  });

  group('ShareService', () {
    tearDown(() => ShareService.spy = null);

    test('safeName sanitises and appends extension', () {
      final n = ShareService.safeName('تقرير / شهر:1', 'pdf');
      expect(n.endsWith('.pdf'), isTrue);
      expect(n.contains('/'), isFalse);
      expect(n.contains(':'), isFalse);
    });

    test('spy intercepts share/print/save', () async {
      final calls = <String>[];
      ShareService.spy = (op, name, bytes) => calls.add('$op:$name:${bytes.length}');
      const svc = ShareService();
      final bytes = Uint8List.fromList([1, 2, 3]);
      await svc.sharePdf(bytes, 'a.pdf');
      await svc.shareExcel(bytes, 'b.xlsx');
      await svc.printPdf(bytes, 'job');
      final path = await svc.saveToDocuments(bytes, 'c.pdf');
      expect(path, 'c.pdf');
      expect(calls, [
        'sharePdf:a.pdf:3',
        'shareExcel:b.xlsx:3',
        'printPdf:job:3',
        'save:c.pdf:3',
      ]);
    });
  });
}

/// 1x1 transparent PNG.
final _tinyPng = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
);
