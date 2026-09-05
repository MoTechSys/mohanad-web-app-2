import '../../core/money/money.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/documents.dart';
import '../../domain/models/inventory.dart';
import '../../domain/models/party.dart';
import '../ledger_db.dart';

/// Inclusive local-date range `[start, end]` (whole days).
class DateRange {
  DateRange(DateTime start, DateTime end)
    : start = DateTime(start.year, start.month, start.day),
      endExclusive = DateTime(end.year, end.month, end.day + 1);

  final DateTime start;
  final DateTime endExclusive;

  DateTime get end => endExclusive.subtract(const Duration(days: 1));

  bool contains(DateTime d) => !d.isBefore(start) && d.isBefore(endExclusive);

  factory DateRange.today() {
    final n = DateTime.now();
    return DateRange(n, n);
  }
  factory DateRange.thisWeek() {
    final n = DateTime.now();
    // Week starts Saturday (common in the region).
    final daysSinceSat = (n.weekday % 7 + 1) % 7; // Sat=0 … Fri=6
    final start = n.subtract(Duration(days: daysSinceSat));
    return DateRange(start, n);
  }
  factory DateRange.thisMonth() {
    final n = DateTime.now();
    return DateRange(DateTime(n.year, n.month, 1), n);
  }
  factory DateRange.lastDays(int days) {
    final n = DateTime.now();
    return DateRange(n.subtract(Duration(days: days - 1)), n);
  }
}

class PeriodSummary {
  const PeriodSummary({
    required this.range,
    required this.cashSales,
    required this.creditSales,
    required this.salesCount,
    required this.dailyIncome,
    required this.customerPayments,
    this.otherReceipts = Money.zero,
    required this.operatingExpenses,
    required this.cashPurchases,
    required this.creditPurchases,
    required this.supplierPayments,
    required this.cogs,
    required this.manualCogs,
    required this.newDebts,
  });

  final DateRange range;
  final Money cashSales;
  final Money creditSales;
  final int salesCount;
  final Money dailyIncome;
  final Money customerPayments;

  /// سندات قبض لجهات خارجية (بدون عميل) — نقد داخل ليس إيرادًا ولا سدادًا.
  /// v2.2.1: أُدرجت هنا لتتطابق «إجمالي الداخل» مع تقرير Z للوردية.
  final Money otherReceipts;
  final Money operatingExpenses;
  final Money cashPurchases;
  final Money creditPurchases;
  final Money supplierPayments;

  /// COGS from sale-line cost snapshots.
  final Money cogs;
  final Money manualCogs;

  /// Manual debts recorded (not via sales).
  final Money newDebts;

  Money get totalSales => cashSales + creditSales;

  /// All revenue recognised in the period.
  Money get revenue => totalSales + dailyIncome;

  // ── Cash flow ──
  Money get cashIn =>
      cashSales + dailyIncome + customerPayments + otherReceipts;
  Money get cashOut => operatingExpenses + cashPurchases + supplierPayments;
  Money get netCash => cashIn - cashOut;

  // ── Profit ──
  Money profit(ProfitMode mode, {bool cashPurchaseAsCogs = true}) =>
      switch (mode) {
        ProfitMode.accurate => revenue - cogs - manualCogs - operatingExpenses,
        ProfitMode.estimated =>
          revenue -
              (cashPurchaseAsCogs
                  ? cashPurchases + creditPurchases
                  : Money.zero) -
              manualCogs -
              operatingExpenses,
      };
}

class ExpenseByCategory {
  const ExpenseByCategory(this.name, this.total, this.count);
  final String name;
  final Money total;
  final int count;
}

class TopProduct {
  const TopProduct(this.name, this.qty, this.revenue, this.profit);
  final String name;
  final Qty qty;
  final Money revenue;
  final Money profit;
}

class DayPoint {
  const DayPoint(this.day, this.value);
  final DateTime day;
  final Money value;
}

class ReportService {
  ReportService(this.db);
  final LedgerDb db;

  PeriodSummary summary(DateRange r) {
    var cashSales = Money.zero, creditSales = Money.zero, cogs = Money.zero;
    var salesCount = 0;
    for (final s in db.sales.values) {
      if (!s.isActive || !r.contains(s.saleDate)) continue;
      salesCount++;
      if (s.paymentType == PaymentType.cash) {
        cashSales = cashSales + s.netAmount;
      } else {
        creditSales = creditSales + s.netAmount;
      }
      cogs = cogs + s.costAmount;
    }
    var income = Money.zero, manualCogs = Money.zero;
    for (final d in db.dailyIncomes.values) {
      if (!d.isActive || !r.contains(d.incomeDate)) continue;
      income = income + d.amount;
      manualCogs = manualCogs + (d.manualCogs ?? Money.zero);
    }
    var payments = Money.zero, newDebts = Money.zero;
    for (final t in db.customerTx.values) {
      if (!t.isActive || !r.contains(t.txDate)) continue;
      if (t.type == PartyTxType.payment) payments = payments + t.amount;
      if (t.type == PartyTxType.debt && t.refType == RefType.manual) {
        newDebts = newDebts + t.amount;
      }
    }
    var opex = Money.zero, cashPur = Money.zero, supPay = Money.zero;
    for (final e in db.expenses.values) {
      if (!e.isActive || !r.contains(e.expenseDate)) continue;
      switch (e.type) {
        case ExpenseType.normal:
        case ExpenseType.other:
          opex = opex + e.amount;
        case ExpenseType.cashPurchase:
          cashPur = cashPur + e.amount;
        case ExpenseType.supplierPayment:
          supPay = supPay + e.amount;
      }
    }
    var creditPur = Money.zero;
    for (final p in db.purchases.values) {
      if (!p.isActive || !r.contains(p.purchaseDate)) continue;
      if (p.paymentType == PaymentType.credit) {
        creditPur = creditPur + p.totalAmount;
      }
    }
    // سندات قبض من جهات خارجية: سندات العملاء تُعد ضمن customerPayments
    // (لأنها تكتب سطر سداد في الدفتر) فلا تُحسب مرتين.
    var otherRec = Money.zero;
    for (final v in db.vouchers.values) {
      if (!v.isActive || v.type != VoucherType.receipt) continue;
      if (v.customerId != null || !r.contains(v.voucherDate)) continue;
      otherRec = otherRec + v.amount;
    }
    return PeriodSummary(
      range: r,
      cashSales: cashSales,
      creditSales: creditSales,
      salesCount: salesCount,
      dailyIncome: income,
      customerPayments: payments,
      otherReceipts: otherRec,
      operatingExpenses: opex,
      cashPurchases: cashPur,
      creditPurchases: creditPur,
      supplierPayments: supPay,
      cogs: cogs,
      manualCogs: manualCogs,
      newDebts: newDebts,
    );
  }

  /// Total receivables (customers with positive balance).
  ({Money total, int count}) customersDebt() {
    var t = Money.zero;
    var c = 0;
    for (final cu in db.activeCustomers) {
      final b = db.customerBalance(cu.id);
      if (b.isPositive) {
        t = t + b;
        c++;
      }
    }
    return (total: t, count: c);
  }

  /// Total payables (suppliers with positive balance).
  ({Money total, int count}) suppliersDebt() {
    var t = Money.zero;
    var c = 0;
    for (final s in db.activeSuppliers) {
      final b = db.supplierBalance(s.id);
      if (b.isPositive) {
        t = t + b;
        c++;
      }
    }
    return (total: t, count: c);
  }

  List<Customer> topDebtors({int limit = 10}) {
    final l =
        db.activeCustomers
            .where((c) => db.customerBalance(c.id).isPositive)
            .toList()
          ..sort(
            (a, b) => db
                .customerBalance(b.id)
                .minor
                .compareTo(db.customerBalance(a.id).minor),
          );
    return l.length > limit ? l.sublist(0, limit) : l;
  }

  List<Supplier> topSupplierDebts({int limit = 10}) {
    final l =
        db.activeSuppliers
            .where((s) => db.supplierBalance(s.id).isPositive)
            .toList()
          ..sort(
            (a, b) => db
                .supplierBalance(b.id)
                .minor
                .compareTo(db.supplierBalance(a.id).minor),
          );
    return l.length > limit ? l.sublist(0, limit) : l;
  }

  List<Customer> overLimitCustomers() => db.activeCustomers
      .where(
        (c) =>
            c.creditLimit != null && db.customerBalance(c.id) > c.creditLimit!,
      )
      .toList();

  List<ExpenseByCategory> expensesByCategory(DateRange r) {
    final totals = <String, Money>{};
    final counts = <String, int>{};
    for (final e in db.expenses.values) {
      if (!e.isActive || !e.isOperating || !r.contains(e.expenseDate)) continue;
      final name = e.categoryId == null
          ? 'بدون تصنيف'
          : (db.categories[e.categoryId]?.name ?? 'بدون تصنيف');
      totals[name] = (totals[name] ?? Money.zero) + e.amount;
      counts[name] = (counts[name] ?? 0) + 1;
    }
    final out =
        totals.entries
            .map((e) => ExpenseByCategory(e.key, e.value, counts[e.key]!))
            .toList()
          ..sort((a, b) => b.total.minor.compareTo(a.total.minor));
    return out;
  }

  List<TopProduct> topProducts(DateRange r, {int limit = 10}) {
    final qty = <String, Qty>{};
    final rev = <String, Money>{};
    final prof = <String, Money>{};
    for (final s in db.sales.values) {
      if (!s.isActive || !r.contains(s.saleDate)) continue;
      for (final l in s.lines) {
        final k = l.productId ?? l.name;
        qty[k] = (qty[k] ?? Qty.zero) + l.qty;
        rev[k] = (rev[k] ?? Money.zero) + l.lineTotal;
        prof[k] = (prof[k] ?? Money.zero) + (l.lineTotal - l.lineCost);
      }
    }
    final out =
        qty.keys
            .map(
              (k) => TopProduct(
                db.products[k]?.name ?? k,
                qty[k]!,
                rev[k]!,
                prof[k]!,
              ),
            )
            .toList()
          ..sort((a, b) => b.revenue.minor.compareTo(a.revenue.minor));
    return out.length > limit ? out.sublist(0, limit) : out;
  }

  /// Daily revenue series for charts.
  List<DayPoint> dailyRevenue(DateRange r) {
    final map = <DateTime, Money>{};
    for (
      var d = r.start;
      d.isBefore(r.endExclusive);
      d = d.add(const Duration(days: 1))
    ) {
      map[d] = Money.zero;
    }
    void add(DateTime dt, Money m) {
      final k = DateTime(dt.year, dt.month, dt.day);
      if (map.containsKey(k)) map[k] = map[k]! + m;
    }

    for (final s in db.sales.values) {
      if (s.isActive && r.contains(s.saleDate)) add(s.saleDate, s.netAmount);
    }
    for (final d in db.dailyIncomes.values) {
      if (d.isActive && r.contains(d.incomeDate)) add(d.incomeDate, d.amount);
    }
    return map.entries.map((e) => DayPoint(e.key, e.value)).toList();
  }

  List<Sale> salesIn(DateRange r) =>
      db.sales.values.where((s) => r.contains(s.saleDate)).toList()
        ..sort((a, b) => b.saleDate.compareTo(a.saleDate));

  List<Purchase> purchasesIn(DateRange r) =>
      db.purchases.values.where((p) => r.contains(p.purchaseDate)).toList()
        ..sort((a, b) => b.purchaseDate.compareTo(a.purchaseDate));

  List<Expense> expensesIn(DateRange r) =>
      db.expenses.values.where((e) => r.contains(e.expenseDate)).toList()
        ..sort((a, b) => b.expenseDate.compareTo(a.expenseDate));

  List<Product> lowStock() =>
      db.activeProducts
          .where(
            (p) =>
                p.trackInventory &&
                p.status == ProductStatus.active &&
                db.stockOf(p.id) <= p.minQty,
          )
          .toList()
        ..sort(
          (a, b) => db.stockOf(a.id).milli.compareTo(db.stockOf(b.id).milli),
        );

  /// المنتجات التي قاربت (أو تجاوزت) انتهاء الصلاحية خلال [days] يومًا.
  /// تشمل المنتهية فعلًا (daysToExpiry سالب) — مرتبة من الأقرب انتهاءً.
  List<Product> expiringSoon({int days = 30}) =>
      db.activeProducts
          .where(
            (p) =>
                p.status == ProductStatus.active &&
                p.expiryDate != null &&
                p.daysToExpiry! <= days,
          )
          .toList()
        ..sort((a, b) => a.expiryDate!.compareTo(b.expiryDate!));

  /// المنتجات المنتهية صلاحيتها فعلًا.
  List<Product> expiredProducts() =>
      expiringSoon(days: 0).where((p) => p.isExpired).toList();
}
