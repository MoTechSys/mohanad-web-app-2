import 'dart:typed_data';

import 'package:excel/excel.dart';

import '../../core/money/money.dart';
import '../../core/utils/formatters.dart';
import '../ledger_db.dart';
import '../services/report_service.dart';

/// Excel (.xlsx) workbook exports. Amounts are written as real numbers so the
/// owner can sum/filter them in Excel / Google Sheets.
class ExcelExporter {
  ExcelExporter(this.db, this.reports);
  final LedgerDb db;
  final ReportService reports;

  static double _n(Money m) => m.minor / Money.scale;
  static double _q(Qty q) => q.milli / Qty.scale;

  CellStyle get _head => CellStyle(
    bold: true,
    backgroundColorHex: ExcelColor.fromHexString('#1B5E3F'),
    fontColorHex: ExcelColor.white,
    horizontalAlign: HorizontalAlign.Center,
  );
  CellStyle get _bold => CellStyle(bold: true);

  void _sheet(
    Excel x,
    String name,
    List<String> headers,
    List<List<CellValue>> rows, {
    List<CellValue>? totals,
  }) {
    final s = x[name];
    s.isRTL = true;
    s.appendRow([TextCellValue(db.settings.storeName)]);
    s.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: 0)).cellStyle =
        _bold;
    s.appendRow([
      TextCellValue('تاريخ التصدير: ${Fmt.dateTime(DateTime.now())}'),
    ]);
    s.appendRow([]);
    s.appendRow([for (final h in headers) TextCellValue(h)]);
    final hr = s.maxRows - 1;
    for (var i = 0; i < headers.length; i++) {
      s
              .cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: hr))
              .cellStyle =
          _head;
      s.setColumnWidth(i, i == 1 ? 28 : 16);
    }
    for (final r in rows) {
      s.appendRow(r);
    }
    if (totals != null) {
      s.appendRow(totals);
      final tr = s.maxRows - 1;
      for (var i = 0; i < totals.length; i++) {
        s
                .cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: tr))
                .cellStyle =
            _bold;
      }
    }
  }

  /// Full period workbook: summary + sales + purchases + expenses + debts + stock.
  Future<Uint8List> periodWorkbook(DateRange r) async {
    final x = Excel.createExcel();
    final s = reports.summary(r);
    final st = db.settings;

    _sheet(
      x,
      'الملخص',
      ['البند', 'القيمة'],
      [
        [
          TextCellValue('الفترة'),
          TextCellValue('${Fmt.date(r.start)} — ${Fmt.date(r.end)}'),
        ],
        [TextCellValue('مبيعات نقدية'), DoubleCellValue(_n(s.cashSales))],
        [TextCellValue('مبيعات آجلة'), DoubleCellValue(_n(s.creditSales))],
        [TextCellValue('دخل يومي'), DoubleCellValue(_n(s.dailyIncome))],
        [TextCellValue('إجمالي الإيرادات'), DoubleCellValue(_n(s.revenue))],
        [TextCellValue('عدد الفواتير'), IntCellValue(s.salesCount)],
        [
          TextCellValue('مقبوضات العملاء'),
          DoubleCellValue(_n(s.customerPayments)),
        ],
        [
          TextCellValue('مصروفات تشغيلية'),
          DoubleCellValue(_n(s.operatingExpenses)),
        ],
        [TextCellValue('مشتريات نقدية'), DoubleCellValue(_n(s.cashPurchases))],
        [TextCellValue('مشتريات آجلة'), DoubleCellValue(_n(s.creditPurchases))],
        [
          TextCellValue('دفعات الموردين'),
          DoubleCellValue(_n(s.supplierPayments)),
        ],
        [
          TextCellValue('تكلفة البضاعة المباعة'),
          DoubleCellValue(_n(s.cogs + s.manualCogs)),
        ],
        [
          TextCellValue('صافي الربح'),
          DoubleCellValue(
            _n(
              s.profit(
                st.profitMode,
                cashPurchaseAsCogs: st.cashPurchaseAsCogs,
              ),
            ),
          ),
        ],
        [TextCellValue('كاش داخل'), DoubleCellValue(_n(s.cashIn))],
        [TextCellValue('كاش خارج'), DoubleCellValue(_n(s.cashOut))],
        [TextCellValue('صافي الكاش'), DoubleCellValue(_n(s.netCash))],
      ],
    );
    x.delete('Sheet1');

    final sales = reports.salesIn(r).toList()
      ..sort((a, b) => a.saleDate.compareTo(b.saleDate));
    _sheet(
      x,
      'المبيعات',
      [
        'التاريخ',
        'العميل',
        'رقم الفاتورة',
        'الدفع',
        'المجموع',
        'الخصم',
        'الصافي',
        'التكلفة',
        'الحالة',
        'ملاحظات',
      ],
      [
        for (final v in sales)
          [
            TextCellValue(Fmt.dateTime(v.saleDate)),
            TextCellValue(
              v.customerId == null
                  ? 'نقدي'
                  : (db.customers[v.customerId!]?.name ?? '—'),
            ),
            TextCellValue(v.invoiceNo ?? ''),
            TextCellValue(v.paymentType.label),
            DoubleCellValue(_n(v.grossAmount)),
            DoubleCellValue(_n(v.discount)),
            DoubleCellValue(_n(v.netAmount)),
            DoubleCellValue(_n(v.costAmount)),
            TextCellValue(v.isActive ? 'نشطة' : 'ملغاة'),
            TextCellValue(v.details ?? ''),
          ],
      ],
      totals: [
        TextCellValue('الإجمالي (النشطة)'),
        TextCellValue(''),
        TextCellValue(''),
        TextCellValue(''),
        TextCellValue(''),
        TextCellValue(''),
        DoubleCellValue(_n(s.totalSales)),
      ],
    );

    final lines = <List<CellValue>>[];
    for (final v in sales.where((v) => v.isActive)) {
      for (final l in v.lines) {
        lines.add([
          TextCellValue(Fmt.date(v.saleDate)),
          TextCellValue(l.name),
          TextCellValue(
            l.productId == null
                ? ''
                : (db.products[l.productId!]?.barcode ?? ''),
          ),
          DoubleCellValue(_q(l.qty)),
          TextCellValue(
            l.unitName ??
                (l.productId == null
                    ? ''
                    : (db.products[l.productId!]?.unit ?? '')),
          ),
          DoubleCellValue(_n(l.unitPrice)),
          DoubleCellValue(_n(l.lineTotal)),
          DoubleCellValue(_n(l.unitCost.timesQty(l.qty))),
        ]);
      }
    }
    _sheet(x, 'أصناف المبيعات', [
      'التاريخ',
      'الصنف',
      'الباركود',
      'الكمية',
      'الوحدة',
      'سعر الوحدة',
      'الإجمالي',
      'التكلفة',
    ], lines);

    final purchases = reports.purchasesIn(r).toList()
      ..sort((a, b) => a.purchaseDate.compareTo(b.purchaseDate));
    _sheet(
      x,
      'المشتريات',
      [
        'التاريخ',
        'المورد',
        'رقم الفاتورة',
        'الدفع',
        'المبلغ',
        'الحالة',
        'ملاحظات',
      ],
      [
        for (final v in purchases)
          [
            TextCellValue(Fmt.dateTime(v.purchaseDate)),
            TextCellValue(
              v.supplierId == null
                  ? (v.supplierNameManual ?? '')
                  : (db.suppliers[v.supplierId!]?.name ?? '—'),
            ),
            TextCellValue(v.invoiceNo ?? ''),
            TextCellValue(v.paymentType.label),
            DoubleCellValue(_n(v.totalAmount)),
            TextCellValue(v.isActive ? 'نشطة' : 'ملغاة'),
            TextCellValue(v.details ?? ''),
          ],
      ],
    );

    final expenses = reports.expensesIn(r).toList()
      ..sort((a, b) => a.expenseDate.compareTo(b.expenseDate));
    _sheet(
      x,
      'المصروفات',
      ['التاريخ', 'النوع', 'الفئة', 'المورد', 'المبلغ', 'الحالة', 'البيان'],
      [
        for (final v in expenses)
          [
            TextCellValue(Fmt.dateTime(v.expenseDate)),
            TextCellValue(v.type.label),
            TextCellValue(
              v.categoryId == null
                  ? ''
                  : (db.categories[v.categoryId!]?.name ?? ''),
            ),
            TextCellValue(
              v.supplierId == null
                  ? ''
                  : (db.suppliers[v.supplierId!]?.name ?? ''),
            ),
            DoubleCellValue(_n(v.amount)),
            TextCellValue(v.isActive ? 'نشط' : 'ملغى'),
            TextCellValue(v.details ?? ''),
          ],
      ],
    );

    final incomes =
        db.dailyIncomes.values.where((d) => r.contains(d.incomeDate)).toList()
          ..sort((a, b) => a.incomeDate.compareTo(b.incomeDate));
    _sheet(
      x,
      'الدخل اليومي',
      ['التاريخ', 'المبلغ', 'تكلفة يدوية', 'الحالة', 'ملاحظات'],
      [
        for (final v in incomes)
          [
            TextCellValue(Fmt.date(v.incomeDate)),
            DoubleCellValue(_n(v.amount)),
            v.manualCogs == null
                ? TextCellValue('')
                : DoubleCellValue(_n(v.manualCogs!)),
            TextCellValue(v.cancelledAt == null ? 'نشط' : 'ملغى'),
            TextCellValue(v.notes ?? ''),
          ],
      ],
    );

    _customersSheet(x);
    _suppliersSheet(x);
    _stockSheet(x);
    return Uint8List.fromList(x.save()!);
  }

  /// Customers with balances + full transaction ledger.
  Future<Uint8List> customersWorkbook() async {
    final x = Excel.createExcel();
    _customersSheet(x);
    x.delete('Sheet1');
    final tx = db.customerTx.values.toList()
      ..sort((a, b) => a.txDate.compareTo(b.txDate));
    _sheet(
      x,
      'حركات العملاء',
      [
        'التاريخ',
        'العميل',
        'النوع',
        'المبلغ',
        'الرصيد قبل',
        'الرصيد بعد',
        'الحالة',
        'ملاحظات',
      ],
      [
        for (final t in tx)
          [
            TextCellValue(Fmt.dateTime(t.txDate)),
            TextCellValue(db.customers[t.partyId]?.name ?? '—'),
            TextCellValue(t.type.label),
            DoubleCellValue(_n(t.signedDelta)),
            DoubleCellValue(_n(t.balanceBefore)),
            DoubleCellValue(_n(t.balanceAfter)),
            TextCellValue(t.isActive ? 'نشطة' : 'ملغاة'),
            TextCellValue(t.notes ?? ''),
          ],
      ],
    );
    return Uint8List.fromList(x.save()!);
  }

  Future<Uint8List> inventoryWorkbook() async {
    final x = Excel.createExcel();
    _stockSheet(x);
    x.delete('Sheet1');
    final moves = db.stockMoves.values.toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    _sheet(
      x,
      'حركات المخزون',
      [
        'التاريخ',
        'الصنف',
        'النوع',
        'التغير',
        'قبل',
        'بعد',
        'الحالة',
        'ملاحظات',
      ],
      [
        for (final m in moves)
          [
            TextCellValue(Fmt.dateTime(m.moveDate)),
            TextCellValue(db.products[m.productId]?.name ?? '—'),
            TextCellValue(m.type.name),
            DoubleCellValue(_q(m.delta)),
            DoubleCellValue(_q(m.qtyBefore)),
            DoubleCellValue(_q(m.qtyAfter)),
            TextCellValue(m.cancelledAt == null ? 'نشطة' : 'ملغاة'),
            TextCellValue(m.notes ?? ''),
          ],
      ],
    );
    return Uint8List.fromList(x.save()!);
  }

  void _customersSheet(Excel x) {
    final cs = db.activeCustomers.toList()
      ..sort(
        (a, b) => db
            .customerBalance(b.id)
            .minor
            .compareTo(db.customerBalance(a.id).minor),
      );
    _sheet(
      x,
      'العملاء',
      [
        'الاسم',
        'الهاتف',
        'العنوان',
        'الرصيد (دين)',
        'حد الائتمان',
        'الحالة',
        'ملاحظات',
      ],
      [
        for (final c in cs)
          [
            TextCellValue(c.name),
            TextCellValue(c.phone ?? ''),
            TextCellValue(c.address ?? ''),
            DoubleCellValue(_n(db.customerBalance(c.id))),
            c.creditLimit == null
                ? TextCellValue('')
                : DoubleCellValue(_n(c.creditLimit!)),
            TextCellValue(c.status.label),
            TextCellValue(c.notes ?? ''),
          ],
      ],
      totals: [
        TextCellValue('الإجمالي'),
        TextCellValue(''),
        TextCellValue(''),
        DoubleCellValue(
          _n(cs.fold(Money.zero, (p, c) => p + db.customerBalance(c.id))),
        ),
      ],
    );
  }

  void _suppliersSheet(Excel x) {
    final ss = db.activeSuppliers.toList();
    _sheet(
      x,
      'الموردون',
      ['الاسم', 'الهاتف', 'المستحق له'],
      [
        for (final s in ss)
          [
            TextCellValue(s.name),
            TextCellValue(s.phone ?? ''),
            DoubleCellValue(_n(db.supplierBalance(s.id))),
          ],
      ],
      totals: [
        TextCellValue('الإجمالي'),
        TextCellValue(''),
        DoubleCellValue(
          _n(ss.fold(Money.zero, (p, s) => p + db.supplierBalance(s.id))),
        ),
      ],
    );
  }

  void _stockSheet(Excel x) {
    final ps = db.activeProducts.toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    var value = Money.zero;
    final rows = <List<CellValue>>[];
    for (final p in ps) {
      final q = db.stockOf(p.id);
      final v = p.purchasePrice.timesQty(q);
      value += v;
      rows.add([
        TextCellValue(p.name),
        TextCellValue(p.barcode ?? ''),
        TextCellValue(p.unit),
        DoubleCellValue(_q(q)),
        DoubleCellValue(_q(p.minQty)),
        DoubleCellValue(_n(p.purchasePrice)),
        DoubleCellValue(_n(p.salePrice)),
        DoubleCellValue(_n(v)),
        TextCellValue(p.trackInventory && q <= p.minQty ? 'ناقص' : ''),
      ]);
    }
    _sheet(
      x,
      'المخزون',
      [
        'الصنف',
        'الباركود',
        'الوحدة',
        'الكمية',
        'حد النقص',
        'سعر الشراء',
        'سعر البيع',
        'القيمة',
        'تنبيه',
      ],
      rows,
      totals: [
        TextCellValue('الإجمالي'),
        TextCellValue(''),
        TextCellValue(''),
        TextCellValue(''),
        TextCellValue(''),
        TextCellValue(''),
        TextCellValue(''),
        DoubleCellValue(_n(value)),
      ],
    );
  }
}
