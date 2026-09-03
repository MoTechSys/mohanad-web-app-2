import 'package:flutter/foundation.dart';

import '../core/ids/id_gen.dart';
import '../core/money/money.dart';
import '../domain/enums/enums.dart';
import '../domain/models/documents.dart';
import '../domain/models/inventory.dart';
import '../domain/models/party.dart';
import '../domain/models/settings.dart';
import 'kv_backend.dart';

/// Box names — never rename (they are on-disk identifiers).
class Boxes {
  Boxes._();
  static const customers = 'customers';
  static const suppliers = 'suppliers';
  static const customerTx = 'customer_tx';
  static const supplierTx = 'supplier_tx';
  static const sales = 'sales';
  static const purchases = 'purchases';
  static const expenses = 'expenses';
  static const categories = 'expense_categories';
  static const dailyIncome = 'daily_income';
  static const products = 'products';
  static const stockMoves = 'stock_moves';
  static const audit = 'audit';
  static const settings = 'settings';

  static const all = [
    customers,
    suppliers,
    customerTx,
    supplierTx,
    sales,
    purchases,
    expenses,
    categories,
    dailyIncome,
    products,
    stockMoves,
    audit,
    settings,
  ];
}

/// In-memory mirror of every collection plus write-through persistence.
///
/// **Source of truth rule:** balances and stock quantities are *derived*
/// from their append-only ledgers, never stored. Caches are invalidated on
/// every write to the corresponding ledger.
///
/// Services must **validate first, mutate second**: all reads/checks happen
/// before the first `put*` call so a rejected operation leaves no trace.
class LedgerDb extends ChangeNotifier {
  LedgerDb(this._backend);

  final KvBackend _backend;
  bool _loaded = false;
  bool get isLoaded => _loaded;

  final Map<String, Customer> customers = {};
  final Map<String, Supplier> suppliers = {};
  final Map<String, PartyTx> customerTx = {};
  final Map<String, PartyTx> supplierTx = {};
  final Map<String, Sale> sales = {};
  final Map<String, Purchase> purchases = {};
  final Map<String, Expense> expenses = {};
  final Map<String, ExpenseCategory> categories = {};
  final Map<String, DailyIncome> dailyIncomes = {};
  final Map<String, Product> products = {};
  final Map<String, StockMove> stockMoves = {};
  final Map<String, AuditEntry> audit = {};
  AppSettings settings = const AppSettings();

  // Derived caches.
  final Map<String, Money> _custBal = {};
  final Map<String, Money> _supBal = {};
  final Map<String, Qty> _stock = {};

  // Pending writes for the current operation.
  final Map<String, Map<String, Map<String, dynamic>>> _pending = {};
  int _depth = 0;

  // ─── Lifecycle ────────────────────────────────────────────
  Future<void> load() async {
    await _backend.open(Boxes.all);
    _hydrate(Boxes.customers, customers, Customer.fromMap);
    _hydrate(Boxes.suppliers, suppliers, Supplier.fromMap);
    _hydrate(Boxes.customerTx, customerTx, PartyTx.fromMap);
    _hydrate(Boxes.supplierTx, supplierTx, PartyTx.fromMap);
    _hydrate(Boxes.sales, sales, Sale.fromMap);
    _hydrate(Boxes.purchases, purchases, Purchase.fromMap);
    _hydrate(Boxes.expenses, expenses, Expense.fromMap);
    _hydrate(Boxes.categories, categories, ExpenseCategory.fromMap);
    _hydrate(Boxes.dailyIncome, dailyIncomes, DailyIncome.fromMap);
    _hydrate(Boxes.products, products, Product.fromMap);
    _barcodeIndex = null;
    _hydrate(Boxes.stockMoves, stockMoves, StockMove.fromMap);
    _hydrate(Boxes.audit, audit, AuditEntry.fromMap);
    final s = _backend.readAll(Boxes.settings)['main'];
    settings = s == null ? const AppSettings() : AppSettings.fromMap(s);
    if (categories.isEmpty) await _seedCategories();
    _loaded = true;
    notifyListeners();
  }

  void _hydrate<T>(
    String box,
    Map<String, T> target,
    T Function(Map<String, dynamic>) from,
  ) {
    target.clear();
    for (final e in _backend.readAll(box).entries) {
      try {
        target[e.key] = from(e.value);
      } catch (err) {
        debugPrint('skip corrupt row $box/${e.key}: $err');
      }
    }
  }

  Future<void> _seedCategories() async {
    const names = ['كهرباء', 'إيجار', 'رواتب', 'نقل', 'مستلزمات', 'أخرى'];
    for (final n in names) {
      final c = ExpenseCategory(id: IdGen.next(), name: n);
      categories[c.id] = c;
      _stage(Boxes.categories, c.id, c.toMap());
    }
    await flush();
  }

  Future<void> wipeAll({bool seedDefaults = true}) async {
    await _backend.clearAll();
    _pending.clear();
    _barcodeIndex = null;
    for (final m in [
      customers,
      suppliers,
      customerTx,
      supplierTx,
      sales,
      purchases,
      expenses,
      categories,
      dailyIncomes,
      products,
      stockMoves,
      audit,
    ]) {
      m.clear();
    }
    settings = const AppSettings();
    _custBal.clear();
    _supBal.clear();
    _stock.clear();
    if (seedDefaults) await _seedCategories();
    notifyListeners();
  }

  // ─── Unit of work ─────────────────────────────────────────
  /// Runs [body] then flushes all staged writes and notifies listeners once.
  Future<T> run<T>(T Function() body) async {
    _depth++;
    try {
      final r = body();
      if (_depth == 1) await flush();
      return r;
    } finally {
      _depth--;
      if (_depth == 0) notifyListeners();
    }
  }

  void _stage(String box, String id, Map<String, dynamic> row) {
    _pending.putIfAbsent(box, () => {})[id] = row;
  }

  @visibleForTesting
  Future<void> flush() async {
    if (_pending.isEmpty) return;
    // Write ledgers before head documents so a crash between writes never
    // leaves a document whose balance/stock effects are missing.
    const order = [
      Boxes.customerTx,
      Boxes.supplierTx,
      Boxes.stockMoves,
      Boxes.expenses,
      Boxes.sales,
      Boxes.purchases,
      Boxes.dailyIncome,
      Boxes.customers,
      Boxes.suppliers,
      Boxes.products,
      Boxes.categories,
      Boxes.audit,
      Boxes.settings,
    ];
    for (final box in order) {
      final rows = _pending[box];
      if (rows != null) await _backend.writeMany(box, rows);
    }
    _pending.clear();
  }

  // ─── Writers (memory + staged persistence) ────────────────
  void putCustomer(Customer c) {
    customers[c.id] = c;
    _stage(Boxes.customers, c.id, c.toMap());
  }

  void putSupplier(Supplier s) {
    suppliers[s.id] = s;
    _stage(Boxes.suppliers, s.id, s.toMap());
  }

  void putCustomerTx(PartyTx t) {
    customerTx[t.id] = t;
    _custBal.remove(t.partyId);
    _stage(Boxes.customerTx, t.id, t.toMap());
  }

  void putSupplierTx(PartyTx t) {
    supplierTx[t.id] = t;
    _supBal.remove(t.partyId);
    _stage(Boxes.supplierTx, t.id, t.toMap());
  }

  void putSale(Sale s) {
    sales[s.id] = s;
    _stage(Boxes.sales, s.id, s.toMap());
  }

  void putPurchase(Purchase p) {
    purchases[p.id] = p;
    _stage(Boxes.purchases, p.id, p.toMap());
  }

  void putExpense(Expense e) {
    expenses[e.id] = e;
    _stage(Boxes.expenses, e.id, e.toMap());
  }

  void putCategory(ExpenseCategory c) {
    categories[c.id] = c;
    _stage(Boxes.categories, c.id, c.toMap());
  }

  void putDailyIncome(DailyIncome d) {
    dailyIncomes[d.id] = d;
    _stage(Boxes.dailyIncome, d.id, d.toMap());
  }

  void putProduct(Product p) {
    products[p.id] = p;
    _barcodeIndex = null;
    _stage(Boxes.products, p.id, p.toMap());
  }

  Map<String, Product>? _barcodeIndex;

  /// O(1) lookup used by the cashier. Barcodes are normalised (trimmed) and
  /// the index is rebuilt lazily after any product write.
  Product? productByBarcode(String raw) {
    final code = normalizeBarcode(raw);
    if (code.isEmpty) return null;
    final idx = _barcodeIndex ??= {
      for (final p in activeProducts)
        if (p.barcode != null && p.barcode!.isNotEmpty) p.barcode!: p,
    };
    return idx[code];
  }

  /// Strips whitespace and converts Arabic-Indic digits to ASCII so a scanner
  /// or keyboard in any locale yields the same key.
  static String normalizeBarcode(String raw) {
    final b = StringBuffer();
    for (final r in raw.trim().runes) {
      if (r >= 0x0660 && r <= 0x0669) {
        b.writeCharCode(0x30 + (r - 0x0660));
      } else if (r >= 0x06F0 && r <= 0x06F9) {
        b.writeCharCode(0x30 + (r - 0x06F0));
      } else if (r != 0x20) {
        b.writeCharCode(r);
      }
    }
    return b.toString();
  }

  void putStockMove(StockMove m) {
    stockMoves[m.id] = m;
    _stock.remove(m.productId);
    _stage(Boxes.stockMoves, m.id, m.toMap());
  }

  void putSettings(AppSettings s) {
    settings = s;
    _stage(Boxes.settings, 'main', s.toMap());
  }

  void putAudit(AuditEntry e) {
    audit[e.id] = e;
    _stage(Boxes.audit, e.id, e.toMap());
  }

  void log({
    required AuditAction action,
    required String entityType,
    required String entityId,
    required String summary,
    Map<String, dynamic>? oldValues,
    Map<String, dynamic>? newValues,
    Money? amount,
  }) {
    final threshold = settings.largeTxThreshold;
    final large = threshold != null && amount != null && amount.abs >= threshold;
    final e = AuditEntry(
      id: IdGen.next(),
      action: action,
      entityType: entityType,
      entityId: entityId,
      summary: summary,
      oldValues: oldValues,
      newValues: newValues,
      at: DateTime.now(),
      isLargeTx: large,
    );
    putAudit(e);
  }

  // ─── Derived state ────────────────────────────────────────
  Money customerBalance(String id) => _custBal.putIfAbsent(id, () {
    var b = Money.zero;
    for (final t in customerTx.values) {
      if (t.partyId == id && t.isActive) b = b + t.signedDelta;
    }
    return b;
  });

  Money supplierBalance(String id) => _supBal.putIfAbsent(id, () {
    var b = Money.zero;
    for (final t in supplierTx.values) {
      if (t.partyId == id && t.isActive) b = b + t.signedDelta;
    }
    return b;
  });

  Qty stockOf(String productId) => _stock.putIfAbsent(productId, () {
    var q = Qty.zero;
    for (final m in stockMoves.values) {
      if (m.productId == productId && m.isActive) q = q + m.delta;
    }
    return q;
  });

  Iterable<Customer> get activeCustomers =>
      customers.values.where((c) => !c.isDeleted);
  Iterable<Supplier> get activeSuppliers =>
      suppliers.values.where((s) => !s.isDeleted);
  Iterable<Product> get activeProducts =>
      products.values.where((p) => !p.isDeleted);

  /// Name/barcode search for the cashier (case-insensitive, prefix-first).
  List<Product> searchProducts(String query, {int limit = 30}) {
    final q = query.trim().toLowerCase();
    final sellable = activeProducts.where(
      (p) => p.status == ProductStatus.active,
    );
    if (q.isEmpty) {
      return sellable.toList()..sort((a, b) => a.name.compareTo(b.name));
    }
    final code = normalizeBarcode(q);
    final starts = <Product>[];
    final contains = <Product>[];
    for (final p in sellable) {
      final n = p.name.toLowerCase();
      if (n.startsWith(q) || (p.barcode ?? '').startsWith(code)) {
        starts.add(p);
      } else if (n.contains(q) || (p.barcode ?? '').contains(code)) {
        contains.add(p);
      }
    }
    starts.sort((a, b) => a.name.compareTo(b.name));
    contains.sort((a, b) => a.name.compareTo(b.name));
    return [...starts, ...contains].take(limit).toList();
  }

  List<PartyTx> customerStatement(String id) =>
      customerTx.values.where((t) => t.partyId == id).toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

  List<PartyTx> supplierStatement(String id) =>
      supplierTx.values.where((t) => t.partyId == id).toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

  List<StockMove> productMoves(String id) =>
      stockMoves.values.where((m) => m.productId == id).toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

  Future<void> dispose_() => _backend.close();
}
