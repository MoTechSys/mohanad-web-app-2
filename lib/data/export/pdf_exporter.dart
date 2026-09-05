import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../core/money/money.dart';
import '../../core/utils/formatters.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/documents.dart';
import '../../domain/models/inventory.dart';
import '../../domain/models/party.dart';
import '../ledger_db.dart';
import '../../core/utils/tafqit.dart';
import '../../domain/models/cash_session.dart';
import '../../domain/models/voucher.dart';
import '../services/report_service.dart';
import 'pdf_theme.dart';

/// Builds branded PDFs: invoices, receipts, statements, reports, labels.
class PdfExporter {
  PdfExporter(this.db, this.reports);
  final LedgerDb db;
  final ReportService reports;

  Future<PdfBrand> _brand() => PdfBrand.load(db.settings);

  // ───────────────────────────── Invoice ─────────────────────────────

  /// A4 sales invoice (works for both total-only and detailed sales).
  Future<Uint8List> saleInvoice(Sale sale) async {
    final b = await _brand();
    final doc = b.document();
    final customer = sale.customerId == null
        ? null
        : db.customers[sale.customerId!];
    final lines = sale.lines;
    doc.addPage(
      b.page(
        title: 'فاتورة بيع',
        subtitle:
            'رقم: ${sale.invoiceNo ?? sale.id.substring(0, 8).toUpperCase()}',
        build: (ctx) => [
          _metaBlock(b, [
            ('التاريخ', Fmt.dateTime(sale.saleDate)),
            ('طريقة الدفع', sale.paymentType.label),
            ('العميل', customer?.name ?? 'عميل نقدي'),
            if (customer?.phone != null) ('هاتف العميل', customer!.phone!),
            if (sale.cancelledAt != null)
              ('الحالة', 'ملغاة — ${sale.cancelReason ?? ''}'),
          ]),
          pw.SizedBox(height: 10),
          if (lines.isNotEmpty)
            b.table(
              headers: const ['#', 'الصنف', 'الكمية', 'سعر الوحدة', 'الإجمالي'],
              aligns: [
                pw.Alignment.center,
                pw.Alignment.centerRight,
                pw.Alignment.center,
                pw.Alignment.center,
                pw.Alignment.center,
              ],
              widths: {
                0: const pw.FixedColumnWidth(24),
                1: const pw.FlexColumnWidth(3),
                2: const pw.FlexColumnWidth(1),
                3: const pw.FlexColumnWidth(1.4),
                4: const pw.FlexColumnWidth(1.4),
              },
              rows: [
                for (var i = 0; i < lines.length; i++)
                  [
                    '${i + 1}',
                    lines[i].name,
                    lines[i].qtyLabel(),
                    lines[i].unitPrice.format(),
                    lines[i].lineTotal.format(),
                  ],
              ],
            )
          else
            pw.Container(
              padding: const pw.EdgeInsets.all(10),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: PdfBrand.line),
              ),
              child: pw.Text(sale.details ?? 'بيع إجمالي'),
            ),
          pw.SizedBox(height: 12),
          _totals(b, [
            ('المجموع', b.money(sale.grossAmount)),
            if (sale.discount.isPositive)
              ('الخصم', '- ${b.money(sale.discount)}'),
            ('الصافي', b.money(sale.netAmount)),
            if (customer != null && sale.paymentType == PaymentType.credit)
              ('رصيد العميل الحالي', b.money(db.customerBalance(customer.id))),
          ]),
          if ((sale.details ?? '').isNotEmpty && lines.isNotEmpty) ...[
            pw.SizedBox(height: 8),
            pw.Text('ملاحظات: ${sale.details}', style: b.small),
          ],
        ],
      ),
    );
    return doc.save();
  }

  /// Narrow 80mm thermal-style receipt.
  Future<Uint8List> saleReceipt(Sale sale) async {
    final b = await _brand();
    final doc = b.document();
    final customer = sale.customerId == null
        ? null
        : db.customers[sale.customerId!];
    const fmt = PdfPageFormat(
      80 * PdfPageFormat.mm,
      double.infinity,
      marginAll: 4 * PdfPageFormat.mm,
    );
    doc.addPage(
      pw.Page(
        pageFormat: fmt,
        textDirection: pw.TextDirection.rtl,
        build: (_) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.stretch,
          children: [
            if (b.logo != null)
              pw.Center(
                child: pw.SizedBox(height: 40, child: pw.Image(b.logo!)),
              ),
            pw.Center(
              child: pw.Text(
                b.settings.storeName,
                style: pw.TextStyle(
                  fontSize: 14,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
            ),
            if ((b.settings.receiptHeader ?? '').isNotEmpty)
              pw.Center(
                child: pw.Text(
                  b.settings.receiptHeader!,
                  style: const pw.TextStyle(fontSize: 8),
                ),
              ),
            if ((b.settings.phone ?? '').isNotEmpty)
              pw.Center(
                child: pw.Text(
                  b.settings.phone!,
                  style: const pw.TextStyle(fontSize: 8),
                ),
              ),
            pw.Divider(),
            pw.Text(
              'فاتورة: ${sale.invoiceNo ?? sale.id.substring(0, 8).toUpperCase()}',
              style: const pw.TextStyle(fontSize: 8),
            ),
            pw.Text(
              'التاريخ: ${Fmt.dateTime(sale.saleDate)}',
              style: const pw.TextStyle(fontSize: 8),
            ),
            pw.Text(
              'العميل: ${customer?.name ?? 'نقدي'} • ${sale.paymentType.label}',
              style: const pw.TextStyle(fontSize: 8),
            ),
            pw.Divider(),
            for (final l in sale.lines) ...[
              pw.Text(l.name, style: const pw.TextStyle(fontSize: 9)),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    '${l.qtyLabel()} × ${l.unitPrice.format()}',
                    style: const pw.TextStyle(fontSize: 8),
                  ),
                  pw.Text(
                    l.lineTotal.format(),
                    style: const pw.TextStyle(fontSize: 9),
                  ),
                ],
              ),
            ],
            if (sale.lines.isEmpty)
              pw.Text(
                sale.details ?? 'بيع إجمالي',
                style: const pw.TextStyle(fontSize: 9),
              ),
            pw.Divider(),
            if (sale.discount.isPositive)
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [pw.Text('الخصم'), pw.Text(sale.discount.format())],
              ),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text(
                  'الصافي',
                  style: pw.TextStyle(
                    fontWeight: pw.FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
                pw.Text(
                  b.money(sale.netAmount),
                  style: pw.TextStyle(
                    fontWeight: pw.FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            if (customer != null && sale.paymentType == PaymentType.credit)
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    'الرصيد الحالي',
                    style: const pw.TextStyle(fontSize: 8),
                  ),
                  pw.Text(
                    b.money(db.customerBalance(customer.id)),
                    style: const pw.TextStyle(fontSize: 8),
                  ),
                ],
              ),
            pw.Divider(),
            if ((b.settings.receiptFooter ?? '').isNotEmpty)
              pw.Center(
                child: pw.Text(
                  b.settings.receiptFooter!,
                  style: const pw.TextStyle(fontSize: 8),
                ),
              ),
            pw.SizedBox(height: 4),
            pw.Center(
              child: pw.BarcodeWidget(
                barcode: pw.Barcode.code128(),
                data: sale.invoiceNo ?? sale.id.substring(0, 12),
                height: 28,
                drawText: false,
              ),
            ),
          ],
        ),
      ),
    );
    return doc.save();
  }

  // ───────────────────────── Customer statement ─────────────────────────

  Future<Uint8List> customerStatement(Customer c, {DateRange? range}) async {
    final b = await _brand();
    final doc = b.document();
    var txs =
        db.customerTx.values
            .where((t) => t.partyId == c.id && t.isActive)
            .toList()
          ..sort((a, b) => a.txDate.compareTo(b.txDate));
    if (range != null) {
      txs = txs.where((t) => range.contains(t.txDate)).toList();
    }
    final debt = txs
        .where((t) => t.signedDelta.isPositive)
        .fold(Money.zero, (p, t) => p + t.signedDelta);
    final paid = txs
        .where((t) => !t.signedDelta.isPositive && !t.signedDelta.isZero)
        .fold(Money.zero, (p, t) => p + t.signedDelta.abs);
    doc.addPage(
      b.page(
        title: 'كشف حساب عميل',
        subtitle: range == null
            ? 'كامل الفترة'
            : '${Fmt.date(range.start)} — ${Fmt.date(range.end)}',
        build: (ctx) => [
          _metaBlock(b, [
            ('العميل', c.name),
            if (c.phone != null) ('الهاتف', c.phone!),
            if (c.address != null) ('العنوان', c.address!),
            ('الرصيد الحالي', b.money(db.customerBalance(c.id))),
            if (c.creditLimit != null) ('حد الائتمان', b.money(c.creditLimit!)),
            ('الحالة', c.status.label),
          ]),
          pw.SizedBox(height: 10),
          b.table(
            headers: const [
              'التاريخ',
              'النوع',
              'البيان',
              'مدين (دين)',
              'دائن (سداد)',
              'الرصيد',
            ],
            aligns: [
              pw.Alignment.center,
              pw.Alignment.center,
              pw.Alignment.centerRight,
              pw.Alignment.center,
              pw.Alignment.center,
              pw.Alignment.center,
            ],
            widths: {2: const pw.FlexColumnWidth(2.4)},
            rows: [
              for (final t in txs)
                [
                  Fmt.date(t.txDate),
                  t.type.label,
                  t.notes ?? _refLabel(t),
                  t.signedDelta.isPositive ? t.signedDelta.format() : '',
                  t.signedDelta.isPositive || t.signedDelta.isZero
                      ? ''
                      : t.signedDelta.abs.format(),
                  t.balanceAfter.format(),
                ],
            ],
            totals: [
              '',
              '',
              'الإجمالي',
              debt.format(),
              paid.format(),
              db.customerBalance(c.id).format(),
            ],
          ),
        ],
      ),
    );
    return doc.save();
  }

  Future<Uint8List> supplierStatement(Supplier s, {DateRange? range}) async {
    final b = await _brand();
    final doc = b.document();
    var txs =
        db.supplierTx.values
            .where((t) => t.partyId == s.id && t.isActive)
            .toList()
          ..sort((a, b) => a.txDate.compareTo(b.txDate));
    if (range != null) {
      txs = txs.where((t) => range.contains(t.txDate)).toList();
    }
    doc.addPage(
      b.page(
        title: 'كشف حساب مورد',
        subtitle: range == null
            ? 'كامل الفترة'
            : '${Fmt.date(range.start)} — ${Fmt.date(range.end)}',
        build: (ctx) => [
          _metaBlock(b, [
            ('المورد', s.name),
            if (s.phone != null) ('الهاتف', s.phone!),
            ('المستحق له حالياً', b.money(db.supplierBalance(s.id))),
          ]),
          pw.SizedBox(height: 10),
          b.table(
            headers: const [
              'التاريخ',
              'النوع',
              'البيان',
              'لنا عليه / له علينا',
              'الرصيد',
            ],
            aligns: [
              pw.Alignment.center,
              pw.Alignment.center,
              pw.Alignment.centerRight,
              pw.Alignment.center,
              pw.Alignment.center,
            ],
            widths: {2: const pw.FlexColumnWidth(2.4)},
            rows: [
              for (final t in txs)
                [
                  Fmt.date(t.txDate),
                  t.type.label,
                  t.notes ?? _refLabel(t),
                  t.signedDelta.format(),
                  t.balanceAfter.format(),
                ],
            ],
          ),
        ],
      ),
    );
    return doc.save();
  }

  // ───────────────────────────── Period report ─────────────────────────────

  /// Monthly / custom-range financial report.
  Future<Uint8List> periodReport(DateRange r, {String? title}) async {
    final b = await _brand();
    final doc = b.document();
    final s = reports.summary(r);
    final st = db.settings;
    final profit = s.profit(
      st.profitMode,
      cashPurchaseAsCogs: st.cashPurchaseAsCogs,
    );
    final byCat = reports.expensesByCategory(r);
    final top = reports.topProducts(r, limit: 15);
    final debtors = reports.topDebtors(limit: 15);
    final daily = reports.dailyRevenue(r);
    final sales = reports.salesIn(r).where((x) => x.isActive).toList()
      ..sort((a, b) => a.saleDate.compareTo(b.saleDate));
    final purchases = reports.purchasesIn(r).where((x) => x.isActive).toList()
      ..sort((a, b) => a.purchaseDate.compareTo(b.purchaseDate));
    final expenses =
        reports
            .expensesIn(r)
            .where((x) => x.isActive && x.type == ExpenseType.normal)
            .toList()
          ..sort((a, b) => a.expenseDate.compareTo(b.expenseDate));

    doc.addPage(
      b.page(
        title: title ?? 'تقرير الفترة',
        subtitle: '${Fmt.date(r.start)} — ${Fmt.date(r.end)}',
        build: (ctx) => [
          pw.Text('الملخص المالي', style: b.h2),
          pw.SizedBox(height: 6),
          b.kpis([
            ('إجمالي الإيرادات', b.money(s.revenue)),
            ('مبيعات نقدية', b.money(s.cashSales)),
            ('مبيعات آجلة', b.money(s.creditSales)),
            ('دخل يومي مجمّع', b.money(s.dailyIncome)),
            ('عدد الفواتير', '${s.salesCount}'),
            ('مقبوضات من العملاء', b.money(s.customerPayments)),
            ('مقبوضات أخرى (سندات)', b.money(s.otherReceipts)),
            ('مصروفات تشغيلية', b.money(s.operatingExpenses)),
            ('مشتريات نقدية', b.money(s.cashPurchases)),
            ('مشتريات آجلة', b.money(s.creditPurchases)),
            ('دفعات للموردين', b.money(s.supplierPayments)),
            ('تكلفة البضاعة المباعة', b.money(s.cogs + s.manualCogs)),
            (
              'صافي الربح (${st.profitMode == ProfitMode.accurate ? 'دقيق' : 'تقديري'})',
              b.money(profit),
            ),
          ]),
          pw.SizedBox(height: 10),
          pw.Text('التدفق النقدي', style: b.h2),
          pw.SizedBox(height: 6),
          b.kpis([
            ('كاش داخل', b.money(s.cashIn)),
            ('كاش خارج', b.money(s.cashOut)),
            ('صافي الكاش', b.money(s.netCash)),
          ]),
          pw.SizedBox(height: 12),
          if (daily.isNotEmpty) ...[
            pw.Text('الإيراد اليومي', style: b.h2),
            pw.SizedBox(height: 6),
            _barChart(b, daily),
            pw.SizedBox(height: 12),
          ],
          if (top.isNotEmpty) ...[
            pw.Text('أكثر الأصناف مبيعاً', style: b.h2),
            pw.SizedBox(height: 6),
            b.table(
              headers: const ['الصنف', 'الكمية', 'الإيراد', 'الربح'],
              aligns: [
                pw.Alignment.centerRight,
                pw.Alignment.center,
                pw.Alignment.center,
                pw.Alignment.center,
              ],
              widths: {0: const pw.FlexColumnWidth(2.5)},
              rows: [
                for (final t in top)
                  [
                    t.name,
                    t.qty.format(),
                    t.revenue.format(),
                    t.profit.format(),
                  ],
              ],
            ),
            pw.SizedBox(height: 12),
          ],
          if (byCat.isNotEmpty) ...[
            pw.Text('المصروفات حسب الفئة', style: b.h2),
            pw.SizedBox(height: 6),
            b.table(
              headers: const ['الفئة', 'عدد', 'الإجمالي'],
              aligns: [
                pw.Alignment.centerRight,
                pw.Alignment.center,
                pw.Alignment.center,
              ],
              widths: {0: const pw.FlexColumnWidth(3)},
              rows: [
                for (final e in byCat) [e.name, '${e.count}', e.total.format()],
              ],
              totals: [
                'الإجمالي',
                '${byCat.fold(0, (p, e) => p + e.count)}',
                s.operatingExpenses.format(),
              ],
            ),
            pw.SizedBox(height: 12),
          ],
          if (debtors.isNotEmpty) ...[
            pw.Text('أرصدة العملاء (الديون)', style: b.h2),
            pw.SizedBox(height: 6),
            b.table(
              headers: const ['العميل', 'الهاتف', 'الرصيد', 'الحالة'],
              aligns: [
                pw.Alignment.centerRight,
                pw.Alignment.center,
                pw.Alignment.center,
                pw.Alignment.center,
              ],
              widths: {0: const pw.FlexColumnWidth(2.5)},
              rows: [
                for (final c in debtors)
                  [
                    c.name,
                    c.phone ?? '—',
                    db.customerBalance(c.id).format(),
                    c.status.label,
                  ],
              ],
              totals: [
                'الإجمالي',
                '',
                debtors
                    .fold(Money.zero, (p, c) => p + db.customerBalance(c.id))
                    .format(),
                '',
              ],
            ),
            pw.SizedBox(height: 12),
          ],
          if (sales.isNotEmpty) ...[
            pw.Text('سجل المبيعات', style: b.h2),
            pw.SizedBox(height: 6),
            b.table(
              headers: const [
                'التاريخ',
                'الفاتورة',
                'العميل',
                'الدفع',
                'الصافي',
              ],
              aligns: [
                pw.Alignment.center,
                pw.Alignment.center,
                pw.Alignment.centerRight,
                pw.Alignment.center,
                pw.Alignment.center,
              ],
              widths: {2: const pw.FlexColumnWidth(2.2)},
              rows: [
                for (final x in sales)
                  [
                    Fmt.date(x.saleDate),
                    x.invoiceNo ?? x.id.substring(0, 6).toUpperCase(),
                    x.customerId == null
                        ? 'نقدي'
                        : (db.customers[x.customerId!]?.name ?? '—'),
                    x.paymentType.label,
                    x.netAmount.format(),
                  ],
              ],
              totals: [
                '',
                '',
                'الإجمالي',
                '${sales.length} فاتورة',
                s.totalSales.format(),
              ],
            ),
            pw.SizedBox(height: 12),
          ],
          if (purchases.isNotEmpty) ...[
            pw.Text('سجل المشتريات', style: b.h2),
            pw.SizedBox(height: 6),
            b.table(
              headers: const ['التاريخ', 'المورد', 'الدفع', 'المبلغ'],
              aligns: [
                pw.Alignment.center,
                pw.Alignment.centerRight,
                pw.Alignment.center,
                pw.Alignment.center,
              ],
              widths: {1: const pw.FlexColumnWidth(2.5)},
              rows: [
                for (final x in purchases)
                  [
                    Fmt.date(x.purchaseDate),
                    x.supplierId == null
                        ? (x.supplierNameManual ?? '—')
                        : (db.suppliers[x.supplierId!]?.name ?? '—'),
                    x.paymentType.label,
                    x.totalAmount.format(),
                  ],
              ],
              totals: [
                '',
                'الإجمالي',
                '',
                (s.cashPurchases + s.creditPurchases).format(),
              ],
            ),
            pw.SizedBox(height: 12),
          ],
          if (expenses.isNotEmpty) ...[
            pw.Text('سجل المصروفات التشغيلية', style: b.h2),
            pw.SizedBox(height: 6),
            b.table(
              headers: const ['التاريخ', 'الفئة', 'البيان', 'المبلغ'],
              aligns: [
                pw.Alignment.center,
                pw.Alignment.center,
                pw.Alignment.centerRight,
                pw.Alignment.center,
              ],
              widths: {2: const pw.FlexColumnWidth(2.5)},
              rows: [
                for (final x in expenses)
                  [
                    Fmt.date(x.expenseDate),
                    x.categoryId == null
                        ? '—'
                        : (db.categories[x.categoryId!]?.name ?? '—'),
                    x.details ?? '',
                    x.amount.format(),
                  ],
              ],
              totals: ['', '', 'الإجمالي', s.operatingExpenses.format()],
            ),
          ],
        ],
      ),
    );
    return doc.save();
  }

  // ─────────────────────── Monthly profit report (م6) ───────────────────────

  /// تقرير أرباح مركّز للفترة (شهري عادة): إيرادات، تكلفة، مجمل الربح،
  /// مصروفات، صافي الربح بالوضعين، أرباح الأصناف، والإيراد اليومي.
  Future<Uint8List> monthlyProfitReport(DateRange r, {String? title}) async {
    final b = await _brand();
    final doc = b.document();
    final s = reports.summary(r);
    final st = db.settings;
    final accurate = s.profit(
      ProfitMode.accurate,
      cashPurchaseAsCogs: st.cashPurchaseAsCogs,
    );
    final estimated = s.profit(
      ProfitMode.estimated,
      cashPurchaseAsCogs: st.cashPurchaseAsCogs,
    );
    final cogs = s.cogs + s.manualCogs;
    final gross = s.revenue - cogs;
    final byCat = reports.expensesByCategory(r);
    final top = reports.topProducts(r, limit: 15)
      ..sort((a, b) => b.profit.minor.compareTo(a.profit.minor));
    final daily = reports.dailyRevenue(r);

    doc.addPage(
      b.page(
        title: title ?? 'تقرير الأرباح الشهري',
        subtitle: '${Fmt.date(r.start)} — ${Fmt.date(r.end)}',
        build: (ctx) => [
          pw.Text('ملخص الأرباح', style: b.h2),
          pw.SizedBox(height: 6),
          b.kpis([
            ('إجمالي الإيرادات', b.money(s.revenue)),
            ('تكلفة البضاعة المباعة', b.money(cogs)),
            ('مجمل الربح', b.money(gross)),
            ('المصروفات التشغيلية', b.money(s.operatingExpenses)),
            ('صافي الربح (دقيق)', b.money(accurate)),
            ('صافي الربح (تقديري)', b.money(estimated)),
          ]),
          pw.SizedBox(height: 10),
          pw.Text('مؤشرات إضافية', style: b.h2),
          pw.SizedBox(height: 6),
          b.kpis([
            ('عدد الفواتير', '${s.salesCount}'),
            ('مبيعات نقدية', b.money(s.cashSales)),
            ('مبيعات آجلة', b.money(s.creditSales)),
            ('مقبوضات العملاء', b.money(s.customerPayments)),
            ('صافي الكاش', b.money(s.netCash)),
            ('دخل يومي مجمّع', b.money(s.dailyIncome)),
          ]),
          pw.SizedBox(height: 12),
          if (daily.isNotEmpty) ...[
            pw.Text('الإيراد اليومي', style: b.h2),
            pw.SizedBox(height: 6),
            _barChart(b, daily),
            pw.SizedBox(height: 12),
          ],
          if (top.isNotEmpty) ...[
            pw.Text('أعلى الأصناف ربحاً', style: b.h2),
            pw.SizedBox(height: 6),
            b.table(
              headers: const ['الصنف', 'الكمية', 'الإيراد', 'الربح'],
              aligns: [
                pw.Alignment.centerRight,
                pw.Alignment.center,
                pw.Alignment.center,
                pw.Alignment.center,
              ],
              widths: {0: const pw.FlexColumnWidth(2.5)},
              rows: [
                for (final t in top)
                  [
                    t.name,
                    t.qty.format(),
                    t.revenue.format(),
                    t.profit.format(),
                  ],
              ],
            ),
            pw.SizedBox(height: 12),
          ],
          if (byCat.isNotEmpty) ...[
            pw.Text('المصروفات حسب الفئة', style: b.h2),
            pw.SizedBox(height: 6),
            b.table(
              headers: const ['الفئة', 'عدد', 'الإجمالي'],
              aligns: [
                pw.Alignment.centerRight,
                pw.Alignment.center,
                pw.Alignment.center,
              ],
              widths: {0: const pw.FlexColumnWidth(3)},
              rows: [
                for (final e in byCat) [e.name, '${e.count}', e.total.format()],
              ],
              totals: [
                'الإجمالي',
                '${byCat.fold(0, (p, e) => p + e.count)}',
                s.operatingExpenses.format(),
              ],
            ),
          ],
        ],
      ),
    );
    return doc.save();
  }

  // ───────────────────────────── Inventory ─────────────────────────────

  Future<Uint8List> inventoryReport() async {
    final b = await _brand();
    final doc = b.document();
    final products = db.activeProducts.toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    var value = Money.zero;
    final rows = <List<String>>[];
    for (final p in products) {
      final q = db.stockOf(p.id);
      final v = p.purchasePrice.timesQty(q);
      value += v;
      rows.add([
        p.name,
        p.barcode ?? '—',
        p.unit,
        q.format(),
        p.purchasePrice.format(),
        p.salePrice.format(),
        v.format(),
        (p.trackInventory && q <= p.minQty) ? 'ناقص' : '',
      ]);
    }
    doc.addPage(
      b.page(
        title: 'تقرير المخزون',
        subtitle: Fmt.date(DateTime.now()),
        format: PdfPageFormat.a4.landscape,
        build: (ctx) => [
          b.kpis([
            ('عدد الأصناف', '${products.length}'),
            ('قيمة المخزون (بالتكلفة)', b.money(value)),
            ('أصناف ناقصة', '${reports.lowStock().length}'),
          ]),
          pw.SizedBox(height: 10),
          b.table(
            headers: const [
              'الصنف',
              'الباركود',
              'الوحدة',
              'الكمية',
              'تكلفة',
              'بيع',
              'القيمة',
              'تنبيه',
            ],
            aligns: [
              pw.Alignment.centerRight,
              pw.Alignment.center,
              pw.Alignment.center,
              pw.Alignment.center,
              pw.Alignment.center,
              pw.Alignment.center,
              pw.Alignment.center,
              pw.Alignment.center,
            ],
            widths: {
              0: const pw.FlexColumnWidth(2.5),
              1: const pw.FlexColumnWidth(1.6),
            },
            rows: rows,
            totals: ['الإجمالي', '', '', '', '', '', value.format(), ''],
          ),
        ],
      ),
    );
    return doc.save();
  }

  // ───────────────────────────── Barcode labels ─────────────────────────────

  /// Sheet of price labels (name + barcode + price). [copies] per product.
  /// If a product has no barcode, a Code-128 of its id is generated so it can
  /// still be scanned (the id-code is also indexed by the cashier).
  Future<Uint8List> barcodeLabels(
    List<Product> products, {
    int copies = 1,
    LabelSize size = LabelSize.medium,
  }) async {
    final b = await _brand();
    final doc = b.document();
    final items = <Product>[
      for (final p in products)
        for (var i = 0; i < copies; i++) p,
    ];
    final cols = size.columns;
    final w = (PdfPageFormat.a4.availableWidth - 40) / cols;
    final h = size.height;
    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        textDirection: pw.TextDirection.rtl,
        margin: const pw.EdgeInsets.all(20),
        build: (ctx) => [
          pw.Wrap(
            spacing: 0,
            runSpacing: 0,
            children: [
              for (final p in items)
                pw.Container(
                  width: w,
                  height: h,
                  padding: const pw.EdgeInsets.all(5),
                  decoration: pw.BoxDecoration(
                    border: pw.Border.all(color: PdfBrand.line, width: 0.4),
                  ),
                  child: pw.Column(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text(
                        b.settings.storeName,
                        style: const pw.TextStyle(
                          fontSize: 7,
                          color: PdfBrand.muted,
                        ),
                        maxLines: 1,
                      ),
                      pw.Text(
                        p.name,
                        style: pw.TextStyle(
                          fontSize: size.nameSize,
                          fontWeight: pw.FontWeight.bold,
                        ),
                        maxLines: 1,
                        textAlign: pw.TextAlign.center,
                      ),
                      pw.Expanded(
                        child: pw.BarcodeWidget(
                          barcode: _barcodeFor(p.barcode),
                          data: _codeData(p),
                          drawText: true,
                          textStyle: const pw.TextStyle(fontSize: 6.5),
                        ),
                      ),
                      pw.SizedBox(height: 2),
                      pw.Text(
                        '${p.salePrice.format()} ${b.settings.currency}',
                        style: pw.TextStyle(
                          fontSize: size.priceSize,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfBrand.primary,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
    return doc.save();
  }

  static String _codeData(Product p) {
    final c = p.barcode ?? '';
    return c.isNotEmpty
        ? c
        : 'GL${p.id.replaceAll('-', '').substring(0, 10).toUpperCase()}';
  }

  static pw.Barcode _barcodeFor(String? code) {
    final c = code ?? '';
    final digits = RegExp(r'^\d+$').hasMatch(c);
    if (digits && c.length == 13 && pw.Barcode.ean13().isValid(c)) {
      return pw.Barcode.ean13();
    }
    if (digits && c.length == 8 && pw.Barcode.ean8().isValid(c)) {
      return pw.Barcode.ean8();
    }
    if (digits && c.length == 12 && pw.Barcode.upcA().isValid(c)) {
      return pw.Barcode.upcA();
    }
    return pw.Barcode.code128();
  }

  // ───────────────────────────── helpers ─────────────────────────────

  String _refLabel(PartyTx t) => switch (t.refType) {
    RefType.sale => 'فاتورة بيع',
    RefType.purchase => 'فاتورة شراء',
    RefType.expense => 'دفعة',
    RefType.voucher => 'سند',
    _ => t.type.label,
  };

  // ───────────────────────────── Vouchers ─────────────────────────────

  /// سند قبض/صرف رسمي — A5 أفقي بتصميم مستندي معتمد:
  /// ترويسة المحل، رقم تسلسلي، المبلغ رقمًا وكتابة (تفقيط)، وخانات توقيع.
  Future<Uint8List> voucherA5(Voucher v, {required String partyName}) async {
    final b = await _brand();
    final doc = b.document();
    final isReceipt = v.type == VoucherType.receipt;
    final accent = isReceipt
        ? PdfBrand.primary
        : const PdfColor.fromInt(0xFFB3541E);
    const fmt = PdfPageFormat(
      210 * PdfPageFormat.mm,
      148 * PdfPageFormat.mm,
      marginAll: 10 * PdfPageFormat.mm,
    );
    doc.addPage(
      pw.Page(
        pageFormat: fmt,
        textDirection: pw.TextDirection.rtl,
        build: (_) => pw.Container(
          decoration: pw.BoxDecoration(
            border: pw.Border.all(color: accent, width: 1.2),
            borderRadius: pw.BorderRadius.circular(8),
          ),
          padding: const pw.EdgeInsets.all(14),
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.stretch,
            children: [
              // ── Header: store identity + voucher No/date ──
              pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(b.settings.storeName, style: b.h1),
                        if ((b.settings.ownerName ?? '').isNotEmpty)
                          pw.Text(b.settings.ownerName!, style: b.small),
                        if ((b.settings.phone ?? '').isNotEmpty)
                          pw.Text('هاتف: ${b.settings.phone}', style: b.small),
                      ],
                    ),
                  ),
                  if (b.logo != null)
                    pw.SizedBox(height: 46, child: pw.Image(b.logo!)),
                  pw.SizedBox(width: 10),
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.end,
                    children: [
                      pw.Container(
                        padding: const pw.EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 6,
                        ),
                        decoration: pw.BoxDecoration(
                          color: accent,
                          borderRadius: pw.BorderRadius.circular(6),
                        ),
                        child: pw.Text(
                          v.type.label,
                          style: pw.TextStyle(
                            color: PdfColors.white,
                            fontSize: 15,
                            fontWeight: pw.FontWeight.bold,
                          ),
                        ),
                      ),
                      pw.SizedBox(height: 4),
                      pw.Text('رقم: ${v.voucherNo}', style: b.bold),
                      pw.Text(
                        'التاريخ: ${Fmt.date(v.voucherDate)}',
                        style: b.small,
                      ),
                    ],
                  ),
                ],
              ),
              pw.Divider(color: accent),
              pw.SizedBox(height: 6),
              // ── Amount box (digits) ──
              pw.Row(
                children: [
                  pw.Expanded(
                    child: _voucherField(
                      b,
                      isReceipt
                          ? 'استلمنا من السيد/السادة'
                          : 'صرفنا إلى السيد/السادة',
                      partyName,
                    ),
                  ),
                  pw.SizedBox(width: 8),
                  pw.Container(
                    padding: const pw.EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: pw.BoxDecoration(
                      border: pw.Border.all(color: accent, width: 1),
                      borderRadius: pw.BorderRadius.circular(6),
                    ),
                    child: pw.Column(
                      children: [
                        pw.Text('المبلغ', style: b.small),
                        pw.Text(
                          b.money(v.amount),
                          style: pw.TextStyle(
                            fontSize: 16,
                            fontWeight: pw.FontWeight.bold,
                            color: accent,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              pw.SizedBox(height: 6),
              _voucherField(
                b,
                'المبلغ كتابةً',
                tafqit(
                  v.amount.minor ~/ Money.scale,
                  currency: b.settings.currency,
                ),
              ),
              pw.SizedBox(height: 6),
              _voucherField(
                b,
                'وذلك مقابل',
                v.details ??
                    (isReceipt ? 'سداد دفعة من الحساب' : 'دفعة من الحساب'),
              ),
              pw.SizedBox(height: 6),
              pw.Row(
                children: [
                  pw.Expanded(
                    child: _voucherField(b, 'طريقة الدفع', v.method.label),
                  ),
                  if (v.isCancelled) ...[
                    pw.SizedBox(width: 8),
                    pw.Expanded(
                      child: pw.Container(
                        padding: const pw.EdgeInsets.all(6),
                        decoration: pw.BoxDecoration(
                          border: pw.Border.all(color: PdfColors.red, width: 1),
                        ),
                        child: pw.Text(
                          'ملغى — ${v.cancelReason ?? ''}',
                          style: const pw.TextStyle(
                            color: PdfColors.red,
                            fontSize: 10,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              pw.Spacer(),
              // ── Signatures ──
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  _signature(b, isReceipt ? 'توقيع المستلم' : 'توقيع الصارف'),
                  _signature(b, isReceipt ? 'توقيع الدافع' : 'توقيع المستلم'),
                  _signature(b, 'المحاسب'),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    return doc.save();
  }

  /// سند حراري 80mm للطابعات الصغيرة.
  Future<Uint8List> voucherReceipt80(
    Voucher v, {
    required String partyName,
  }) async {
    final b = await _brand();
    final doc = b.document();
    final isReceipt = v.type == VoucherType.receipt;
    const fmt = PdfPageFormat(
      80 * PdfPageFormat.mm,
      double.infinity,
      marginAll: 4 * PdfPageFormat.mm,
    );
    doc.addPage(
      pw.Page(
        pageFormat: fmt,
        textDirection: pw.TextDirection.rtl,
        build: (_) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.stretch,
          children: [
            if (b.logo != null)
              pw.Center(
                child: pw.SizedBox(height: 36, child: pw.Image(b.logo!)),
              ),
            pw.Center(
              child: pw.Text(
                b.settings.storeName,
                style: pw.TextStyle(
                  fontSize: 13,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
            ),
            if ((b.settings.phone ?? '').isNotEmpty)
              pw.Center(
                child: pw.Text(
                  b.settings.phone!,
                  style: const pw.TextStyle(fontSize: 8),
                ),
              ),
            pw.Divider(),
            pw.Center(
              child: pw.Text(
                v.type.label,
                style: pw.TextStyle(
                  fontSize: 12,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
            ),
            pw.SizedBox(height: 2),
            pw.Text(
              'رقم: ${v.voucherNo}',
              style: const pw.TextStyle(fontSize: 9),
            ),
            pw.Text(
              'التاريخ: ${Fmt.dateTime(v.voucherDate)}',
              style: const pw.TextStyle(fontSize: 9),
            ),
            pw.Text(
              '${isReceipt ? 'من' : 'إلى'}: $partyName',
              style: const pw.TextStyle(fontSize: 9),
            ),
            pw.Text(
              'طريقة الدفع: ${v.method.label}',
              style: const pw.TextStyle(fontSize: 9),
            ),
            pw.Divider(),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text(
                  'المبلغ',
                  style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                ),
                pw.Text(
                  b.money(v.amount),
                  style: pw.TextStyle(
                    fontSize: 13,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
              ],
            ),
            pw.SizedBox(height: 2),
            pw.Text(
              tafqit(
                v.amount.minor ~/ Money.scale,
                currency: b.settings.currency,
              ),
              style: const pw.TextStyle(fontSize: 8),
            ),
            if ((v.details ?? '').isNotEmpty) ...[
              pw.SizedBox(height: 2),
              pw.Text(
                'مقابل: ${v.details}',
                style: const pw.TextStyle(fontSize: 8.5),
              ),
            ],
            if (v.isCancelled)
              pw.Center(
                child: pw.Text(
                  '*** ملغى — ${v.cancelReason ?? ''} ***',
                  style: const pw.TextStyle(fontSize: 9, color: PdfColors.red),
                ),
              ),
            pw.Divider(),
            pw.SizedBox(height: 18),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text(
                  'التوقيع: ____________',
                  style: const pw.TextStyle(fontSize: 8.5),
                ),
                pw.Text(
                  'دفتر البقالة',
                  style: const pw.TextStyle(
                    fontSize: 7.5,
                    color: PdfBrand.muted,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
    return doc.save();
  }

  /// تقرير Z لوردية صندوق — إيصال حراري 80mm (يصلح أيضًا للطباعة العادية).
  Future<Uint8List> zReport80(ZReport r) async {
    final b = await _brand();
    final doc = b.document();
    final s = r.session;
    const fmt = PdfPageFormat(
      80 * PdfPageFormat.mm,
      double.infinity,
      marginAll: 4 * PdfPageFormat.mm,
    );

    pw.Widget line(
      String label,
      String value, {
      bool bold = false,
      PdfColor? color,
    }) => pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 1),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(
            label,
            style: pw.TextStyle(
              fontSize: 9,
              fontWeight: bold ? pw.FontWeight.bold : null,
            ),
          ),
          pw.Text(
            value,
            style: pw.TextStyle(
              fontSize: bold ? 11 : 9.5,
              fontWeight: pw.FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );

    final diff = s.difference;
    doc.addPage(
      pw.Page(
        pageFormat: fmt,
        textDirection: pw.TextDirection.rtl,
        build: (_) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.stretch,
          children: [
            if (b.logo != null)
              pw.Center(
                child: pw.SizedBox(height: 36, child: pw.Image(b.logo!)),
              ),
            pw.Center(
              child: pw.Text(
                b.settings.storeName,
                style: pw.TextStyle(
                  fontSize: 13,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
            ),
            pw.Divider(),
            pw.Center(
              child: pw.Text(
                'تقرير الوردية ${s.sessionNo}',
                style: pw.TextStyle(
                  fontSize: 12,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
            ),
            pw.SizedBox(height: 2),
            pw.Text(
              'العامل: ${s.workerName}',
              style: const pw.TextStyle(fontSize: 9),
            ),
            pw.Text(
              'من: ${Fmt.dateTime(s.openedAt)}',
              style: const pw.TextStyle(fontSize: 9),
            ),
            pw.Text(
              'إلى: ${Fmt.dateTime(r.until)}${s.isOpen ? ' (ما تزال مفتوحة)' : ''}',
              style: const pw.TextStyle(fontSize: 9),
            ),
            pw.Divider(),
            line('الرصيد الافتتاحي', b.money(s.openingCash), bold: true),
            pw.SizedBox(height: 3),
            pw.Text(
              'النقد الداخل',
              style: pw.TextStyle(
                fontSize: 9.5,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            line('مبيعات نقدية (${r.cashSalesCount})', b.money(r.cashSales)),
            line('سدادات عملاء', b.money(r.customerPayments)),
            if (r.otherReceipts.isPositive)
              line('مقبوضات أخرى', b.money(r.otherReceipts)),
            if (r.dailyIncome.isPositive)
              line('دخل يومي إجمالي', b.money(r.dailyIncome)),
            line('إجمالي الداخل', b.money(r.cashIn), bold: true),
            pw.SizedBox(height: 3),
            pw.Text(
              'النقد الخارج',
              style: pw.TextStyle(
                fontSize: 9.5,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            line('مصروفات ومدفوعات (${r.expensesCount})', b.money(r.expenses)),
            pw.Divider(),
            line('النقد المتوقع بالدرج', b.money(r.expectedCash), bold: true),
            if (s.countedCash != null) ...[
              line('النقد المعدود', b.money(s.countedCash!), bold: true),
              line(
                diff!.isZero
                    ? 'الفرق (مطابق)'
                    : diff.isPositive
                    ? 'الفرق (زيادة)'
                    : 'الفرق (عجز)',
                b.money(diff),
                bold: true,
                color: diff.isZero
                    ? null
                    : diff.isPositive
                    ? PdfColors.green800
                    : PdfColors.red,
              ),
            ],
            pw.SizedBox(height: 3),
            pw.Text(
              'معلومة: مبيعات آجلة (${r.creditSalesCount}) بقيمة ${b.money(r.creditSales)} — لا تدخل الدرج.',
              style: const pw.TextStyle(fontSize: 7.5, color: PdfBrand.muted),
            ),
            if ((s.closeNotes ?? '').isNotEmpty)
              pw.Text(
                'ملاحظات: ${s.closeNotes}',
                style: const pw.TextStyle(fontSize: 8),
              ),
            pw.Divider(),
            pw.SizedBox(height: 16),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text(
                  'توقيع العامل: ________',
                  style: const pw.TextStyle(fontSize: 8.5),
                ),
                pw.Text(
                  'توقيع المالك: ________',
                  style: const pw.TextStyle(fontSize: 8.5),
                ),
              ],
            ),
          ],
        ),
      ),
    );
    return doc.save();
  }

  pw.Widget _voucherField(PdfBrand b, String label, String value) =>
      pw.Container(
        padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: pw.BoxDecoration(
          color: PdfBrand.zebra,
          borderRadius: pw.BorderRadius.circular(5),
        ),
        child: pw.Row(
          children: [
            pw.Text('$label: ', style: b.small),
            pw.Expanded(
              child: pw.Text(value, style: b.bold.copyWith(fontSize: 10.5)),
            ),
          ],
        ),
      );

  pw.Widget _signature(PdfBrand b, String title) => pw.Column(
    children: [
      pw.Container(width: 110, height: 0.8, color: PdfBrand.muted),
      pw.SizedBox(height: 3),
      pw.Text(title, style: b.small),
    ],
  );

  pw.Widget _metaBlock(PdfBrand b, List<(String, String)> items) =>
      pw.Container(
        padding: const pw.EdgeInsets.all(8),
        decoration: pw.BoxDecoration(
          color: PdfBrand.zebra,
          borderRadius: pw.BorderRadius.circular(6),
        ),
        child: pw.Wrap(
          spacing: 18,
          runSpacing: 4,
          children: [
            for (final (k, v) in items)
              pw.Row(
                mainAxisSize: pw.MainAxisSize.min,
                children: [
                  pw.Text('$k: ', style: b.small),
                  pw.Text(v, style: b.bold.copyWith(fontSize: 9.5)),
                ],
              ),
          ],
        ),
      );

  pw.Widget _totals(PdfBrand b, List<(String, String)> items) => pw.Row(
    mainAxisAlignment: pw.MainAxisAlignment.start,
    children: [
      pw.Container(
        width: 230,
        padding: const pw.EdgeInsets.all(8),
        decoration: pw.BoxDecoration(
          border: pw.Border.all(color: PdfBrand.primary, width: 0.8),
          borderRadius: pw.BorderRadius.circular(6),
        ),
        child: pw.Column(
          children: [
            for (var i = 0; i < items.length; i++)
              pw.Padding(
                padding: const pw.EdgeInsets.symmetric(vertical: 2),
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text(
                      items[i].$1,
                      style: i == items.length - 1 || items[i].$1 == 'الصافي'
                          ? b.bold
                          : null,
                    ),
                    pw.Text(
                      items[i].$2,
                      style: items[i].$1 == 'الصافي'
                          ? b.bold.copyWith(
                              fontSize: 13,
                              color: PdfBrand.primary,
                            )
                          : null,
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    ],
  );

  pw.Widget _barChart(PdfBrand b, List<DayPoint> pts) {
    final max = pts.fold(0, (m, p) => p.value.minor > m ? p.value.minor : m);
    if (max == 0) return pw.SizedBox();
    return pw.Container(
      height: 110,
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.end,
        children: [
          for (final p in pts)
            pw.Expanded(
              child: pw.Padding(
                padding: const pw.EdgeInsets.symmetric(horizontal: 1),
                child: pw.Column(
                  mainAxisAlignment: pw.MainAxisAlignment.end,
                  children: [
                    pw.Container(
                      height: 90 * p.value.minor / max,
                      color: PdfBrand.primary,
                    ),
                    pw.SizedBox(height: 2),
                    if (pts.length <= 31)
                      pw.Text(
                        '${p.day.day}',
                        style: const pw.TextStyle(
                          fontSize: 6,
                          color: PdfBrand.muted,
                        ),
                      ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

enum LabelSize {
  small(4, 62, 8, 9),
  medium(3, 80, 9.5, 11),
  large(2, 100, 11, 13);

  const LabelSize(this.columns, this.height, this.nameSize, this.priceSize);
  final int columns;
  final double height;
  final double nameSize;
  final double priceSize;

  String get label => switch (this) {
    small => 'صغير (4 في الصف)',
    medium => 'متوسط (3 في الصف)',
    large => 'كبير (2 في الصف)',
  };
}
