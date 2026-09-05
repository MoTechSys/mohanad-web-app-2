import 'package:flutter/foundation.dart';

import '../../core/errors/domain_exception.dart';
import '../../core/money/money.dart';
import '../../data/ledger_db.dart';
import '../../data/services/document_service.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/documents.dart';
import '../../domain/models/inventory.dart';

/// One line in the cashier cart. Keyed by [productId] (or a synthetic key for
/// ad-hoc items without a product) so re-scanning bumps the quantity.
class CartLine {
  CartLine({
    required this.key,
    this.productId,
    required this.name,
    required this.unit,
    required this.qty,
    required this.unitPrice,
    required this.unitCost,
    this.unitFactor = Qty.one,
    this.barcode,
  });

  final String key;
  final String? productId;
  final String name;

  /// Display unit for this line (حبة / كرتون …).
  final String unit;

  /// Base units per one [unit] — 1 for the base unit, >1 for packs.
  final Qty unitFactor;
  final String? barcode;
  Qty qty;
  Money unitPrice;
  final Money unitCost;

  Money get total => unitPrice.timesQty(qty);

  DocLine toDocLine() => DocLine(
    productId: productId,
    name: name,
    qty: qty,
    unitPrice: unitPrice,
    unitCost: unitCost,
    unitName: productId == null ? null : unit,
    unitFactor: unitFactor,
  );
}

/// Result of feeding a barcode to the cart.
enum ScanOutcome { added, incremented, unknown, ignoredDuplicate, invalid }

/// Cashier cart: pure logic, no widgets. Drives the POS screen and is unit
/// tested independently.
///
/// * Scanning the same barcode twice within [duplicateWindow] is ignored
///   (camera frames repeat) — a deliberate second scan after the window
///   increments the quantity.
/// * Unknown barcodes are reported to the UI which may create the product
///   and call [addProduct].
class CartController extends ChangeNotifier {
  CartController(
    this.db,
    this.documents, {
    this.duplicateWindow = const Duration(milliseconds: 1200),
  });

  final LedgerDb db;
  final DocumentService documents;
  final Duration duplicateWindow;

  final List<CartLine> _lines = [];
  List<CartLine> get lines => List.unmodifiable(_lines);

  Money _discount = Money.zero;
  Money get discount => _discount;

  String? _lastCode;
  DateTime? _lastAt;
  String? _lastKey;

  /// Key of the most recently added/incremented line (for UI highlight).
  String? get lastTouchedKey => _lastKey;

  bool get isEmpty => _lines.isEmpty;
  int get itemCount => _lines.length;
  Qty get totalQty => _lines.fold(Qty.zero, (p, l) => p + l.qty);
  Money get gross => _lines.fold(Money.zero, (p, l) => p + l.total);
  Money get net => gross - _discount;
  Money get estimatedCost =>
      _lines.fold(Money.zero, (p, l) => p + l.unitCost.timesQty(l.qty));

  // ───────────────────────── scanning ─────────────────────────

  /// Feed a raw barcode (camera or HID keyboard). Never throws.
  ScanOutcome scan(String raw, {DateTime? now}) {
    final code = LedgerDb.normalizeBarcode(raw);
    if (code.length < 3) return ScanOutcome.invalid;
    final t = now ?? DateTime.now();
    if (_lastCode == code &&
        _lastAt != null &&
        t.difference(_lastAt!) < duplicateWindow) {
      return ScanOutcome.ignoredDuplicate;
    }
    _lastCode = code;
    _lastAt = t;

    final p = db.productByBarcode(code);
    if (p == null) return ScanOutcome.unknown;
    if (p.status != ProductStatus.active) return ScanOutcome.unknown;
    return addProduct(p);
  }

  /// Adds one unit of [p] or bumps its quantity if already in the cart.
  /// Pass [packUnit] to sell by the pack (كرتون/جوتة…) — pack lines are
  /// kept separate from base-unit lines of the same product.
  ScanOutcome addProduct(Product p, {Qty qty = Qty.one, PackUnit? packUnit}) {
    final key = packUnit == null ? p.id : '${p.id}§${packUnit.name}';
    final i = _lines.indexWhere((l) => l.key == key);
    if (i >= 0) {
      _lines[i].qty = _lines[i].qty + qty;
      _lastKey = _lines[i].key;
      notifyListeners();
      return ScanOutcome.incremented;
    }
    final line = CartLine(
      key: key,
      productId: p.id,
      name: p.name,
      unit: packUnit?.name ?? p.unit,
      unitFactor: packUnit?.factor ?? Qty.one,
      barcode: p.barcode,
      qty: qty,
      unitPrice: packUnit?.saleOf(p.salePrice) ?? p.salePrice,
      unitCost: packUnit?.purchaseOf(p.purchasePrice) ?? p.purchasePrice,
    );
    _lines.add(line);
    _lastKey = line.key;
    notifyListeners();
    return ScanOutcome.added;
  }

  /// Ad-hoc line for items without a product record (e.g. loose goods).
  void addAdHoc({
    required String name,
    required Money unitPrice,
    Qty qty = Qty.one,
    String unit = 'حبة',
  }) {
    final n = name.trim();
    if (n.isEmpty) {
      throw const DomainException(ErrorCodes.invalidAmount, 'اسم الصنف مطلوب');
    }
    if (unitPrice.isNegative) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'السعر لا يمكن أن يكون سالباً',
      );
    }
    if (!qty.isPositive) {
      throw const DomainException(
        ErrorCodes.invalidQuantity,
        'الكمية يجب أن تكون أكبر من الصفر',
      );
    }
    final line = CartLine(
      key: 'adhoc:${DateTime.now().microsecondsSinceEpoch}:${_lines.length}',
      name: n,
      unit: unit,
      qty: qty,
      unitPrice: unitPrice,
      unitCost: Money.zero,
    );
    _lines.add(line);
    _lastKey = line.key;
    notifyListeners();
  }

  // ───────────────────────── editing ─────────────────────────

  void setQty(String key, Qty qty) {
    final l = _byKey(key);
    if (!qty.isPositive) {
      remove(key);
      return;
    }
    l.qty = qty;
    notifyListeners();
  }

  void increment(String key) => setQty(key, _byKey(key).qty + Qty.one);

  void decrement(String key) => setQty(key, _byKey(key).qty - Qty.one);

  void setUnitPrice(String key, Money price) {
    if (price.isNegative) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'السعر لا يمكن أن يكون سالباً',
      );
    }
    _byKey(key).unitPrice = price;
    notifyListeners();
  }

  void remove(String key) {
    _lines.removeWhere((l) => l.key == key);
    if (_lastKey == key) _lastKey = null;
    notifyListeners();
  }

  void setDiscount(Money d) {
    if (d.isNegative) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'الخصم لا يمكن أن يكون سالباً',
      );
    }
    if (d > gross) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'الخصم أكبر من الإجمالي',
      );
    }
    _discount = d;
    notifyListeners();
  }

  void clear() {
    _lines.clear();
    _discount = Money.zero;
    _lastKey = null;
    _lastCode = null;
    _lastAt = null;
    notifyListeners();
  }

  /// Change due for a cash payment; null if [paid] < net.
  Money? changeFor(Money paid) => paid < net ? null : paid - net;

  // ───────────────────────── checkout ─────────────────────────

  /// Persists the sale atomically (invoice + stock + customer debt) and
  /// empties the cart on success. Throws [DomainException] on validation
  /// failure (cart stays intact so the cashier can fix and retry).
  Future<Sale> checkout({
    required PaymentType paymentType,
    String? customerId,
    String? details,
    bool approveOverLimit = false,
    bool approveOversell = false,
    bool approveBelowCost = false,
  }) async {
    if (_lines.isEmpty) {
      throw const DomainException(ErrorCodes.itemsRequired, 'السلة فارغة');
    }
    final sale = await documents.createSale(
      customerId: customerId,
      paymentType: paymentType,
      mode: DocMode.detailedItems,
      lines: _lines.map((l) => l.toDocLine()).toList(),
      discount: _discount,
      details: details,
      approveOverLimit: approveOverLimit,
      approveOversell: approveOversell,
      approveBelowCost: approveBelowCost,
    );
    clear();
    return sale;
  }

  CartLine _byKey(String key) => _lines.firstWhere(
    (l) => l.key == key,
    orElse: () =>
        throw const DomainException(ErrorCodes.notFound, 'السطر غير موجود'),
  );
}
