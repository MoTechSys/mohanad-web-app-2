import '../../core/errors/domain_exception.dart';
import '../../core/ids/id_gen.dart';
import '../../core/money/money.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/inventory.dart';
import '../ledger_db.dart';

/// Products and the append-only stock ledger.
class InventoryService {
  InventoryService(this.db);
  final LedgerDb db;

  Future<Product> createProduct({
    required String name,
    String? barcode,
    String unit = 'حبة',
    Money purchasePrice = Money.zero,
    Money salePrice = Money.zero,
    Qty minQty = Qty.zero,
    bool trackInventory = true,
    Qty openingQty = Qty.zero,
    List<PackUnit> packUnits = const [],
    DateTime? expiryDate,
  }) {
    final n = name.trim();
    if (n.isEmpty) {
      throw const DomainException(ErrorCodes.invalidAmount, 'اسم المنتج مطلوب');
    }
    if (purchasePrice.isNegative || salePrice.isNegative) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'الأسعار لا يمكن أن تكون سالبة',
      );
    }
    _validatePackUnits(packUnits, unit);
    // Normalised (trimmed, ASCII digits) so scanner/keyboard input matches.
    final bc = barcode == null ? null : LedgerDb.normalizeBarcode(barcode);
    if (bc != null && bc.isNotEmpty) {
      final dup = db.activeProducts.any((p) => p.barcode == bc);
      if (dup) {
        throw const DomainException(
          ErrorCodes.duplicate,
          'الباركود مستخدم لمنتج آخر',
        );
      }
    }
    return db.run(() {
      final now = DateTime.now();
      final p = Product(
        id: IdGen.next(),
        name: n,
        barcode: (bc == null || bc.isEmpty) ? null : bc,
        unit: unit.trim().isEmpty ? 'حبة' : unit.trim(),
        purchasePrice: purchasePrice,
        salePrice: salePrice,
        minQty: minQty,
        trackInventory: trackInventory,
        packUnits: packUnits,
        expiryDate: expiryDate,
        createdAt: now,
        updatedAt: now,
      );
      db.putProduct(p);
      if (trackInventory && !openingQty.isZero) {
        _move(
          p.id,
          StockMoveType.adjustment,
          openingQty,
          notes: 'رصيد افتتاحي',
          now: now,
        );
      }
      db.log(
        action: AuditAction.create,
        entityType: 'product',
        entityId: p.id,
        summary: 'إضافة منتج: $n',
      );
      return p;
    });
  }

  /// [barcode]: `null` = unchanged, `''` (or whitespace) = **clear** the
  /// barcode, anything else = set (must be unique among active products).
  Future<Product> updateProduct(
    String id, {
    String? name,
    String? barcode,
    String? unit,
    Money? purchasePrice,
    Money? salePrice,
    Qty? minQty,
    bool? trackInventory,
    ProductStatus? status,
    List<PackUnit>? packUnits,
    DateTime? expiryDate,
    bool clearExpiry = false,
  }) {
    final old = _product(id);
    if (packUnits != null) {
      _validatePackUnits(packUnits, unit ?? old.unit);
    }
    if (name != null && name.trim().isEmpty) {
      throw const DomainException(ErrorCodes.invalidAmount, 'اسم المنتج مطلوب');
    }
    final bc = barcode == null ? null : LedgerDb.normalizeBarcode(barcode);
    if (bc != null && bc.isNotEmpty) {
      final dup = db.activeProducts.any((p) => p.id != id && p.barcode == bc);
      if (dup) {
        throw const DomainException(
          ErrorCodes.duplicate,
          'الباركود مستخدم لمنتج آخر',
        );
      }
    }
    return db.run(() {
      final p = old.copyWith(
        name: name?.trim(),
        // null → unchanged (sentinel kept); '' → clear; else → set.
        barcode: bc == null ? old.barcode : (bc.isEmpty ? null : bc),
        unit: unit?.trim(),
        purchasePrice: purchasePrice,
        salePrice: salePrice,
        minQty: minQty,
        trackInventory: trackInventory,
        status: status,
        packUnits: packUnits,
        expiryDate: clearExpiry ? null : (expiryDate ?? old.expiryDate),
      );
      db.putProduct(p);
      db.log(
        action: AuditAction.update,
        entityType: 'product',
        entityId: id,
        summary: 'تعديل منتج: ${p.name}',
        oldValues: old.toMap(),
        newValues: p.toMap(),
      );
      return p;
    });
  }

  Future<void> deleteProduct(String id) {
    final p = _product(id);
    return db.run(() {
      db.putProduct(p.copyWith(deletedAt: DateTime.now()));
      db.log(
        action: AuditAction.delete,
        entityType: 'product',
        entityId: id,
        summary: 'حذف منتج: ${p.name}',
      );
    });
  }

  /// Manual stock movement. For [StockMoveType.adjustment], [qty] is the
  /// **new absolute quantity**; for all other types it is the movement size.
  Future<StockMove> manualMove(
    String productId,
    StockMoveType type,
    Qty qty, {
    String? notes,
  }) {
    final p = _product(productId);
    if (type != StockMoveType.adjustment && !qty.isPositive) {
      throw const DomainException(
        ErrorCodes.invalidQuantity,
        'الكمية يجب أن تكون أكبر من الصفر',
      );
    }
    if (type == StockMoveType.adjustment && qty.isNegative) {
      throw const DomainException(
        ErrorCodes.invalidQuantity,
        'الكمية الجديدة لا يمكن أن تكون سالبة',
      );
    }
    final delta = switch (type) {
      StockMoveType.inbound || StockMoveType.returned => qty,
      StockMoveType.outbound || StockMoveType.loss => -qty,
      StockMoveType.adjustment => qty - db.stockOf(productId),
    };
    if (type == StockMoveType.adjustment && delta.isZero) {
      throw const DomainException(
        ErrorCodes.invalidQuantity,
        'الكمية الجديدة مساوية للحالية',
      );
    }
    return db.run(() {
      final m = _move(
        productId,
        type,
        delta,
        notes: notes,
        now: DateTime.now(),
      );
      db.log(
        action: AuditAction.create,
        entityType: 'stock_move',
        entityId: m.id,
        summary: '${type.label} ${p.name}: ${delta.format()} ${p.unit}',
      );
      return m;
    });
  }

  Future<void> cancelMove(String moveId, String reason) {
    final m = db.stockMoves[moveId];
    if (m == null) {
      throw const DomainException(ErrorCodes.notFound, 'الحركة غير موجودة');
    }
    if (m.isCancelled) {
      throw const DomainException(
        ErrorCodes.alreadyCancelled,
        'الحركة ملغاة مسبقاً',
      );
    }
    if (m.refType != RefType.manual) {
      throw const DomainException(
        ErrorCodes.alreadyCancelled,
        'هذه الحركة مرتبطة بفاتورة — ألغِ الفاتورة نفسها',
      );
    }
    if (reason.trim().isEmpty) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'سبب الإلغاء مطلوب',
      );
    }
    final p = _product(m.productId);
    return db.run(() {
      db.putStockMove(m.cancelled(reason.trim(), DateTime.now()));
      db.log(
        action: AuditAction.cancel,
        entityType: 'stock_move',
        entityId: moveId,
        summary: 'إلغاء حركة مخزون ${p.name} (${m.delta.format()})',
      );
    });
  }

  /// Internal: used by document services within their own `db.run`.
  StockMove _move(
    String productId,
    StockMoveType type,
    Qty delta, {
    String? notes,
    RefType refType = RefType.manual,
    String? refId,
    required DateTime now,
  }) {
    final before = db.stockOf(productId);
    final m = StockMove(
      id: IdGen.next(),
      productId: productId,
      type: type,
      delta: delta,
      qtyBefore: before,
      qtyAfter: before + delta,
      refType: refType,
      refId: refId,
      notes: notes,
      moveDate: now,
      createdAt: now,
    );
    db.putStockMove(m);
    return m;
  }

  /// Called by SalesService / PurchasesService (inside their unit of work).
  void applyDocumentMove(
    String productId,
    StockMoveType type,
    Qty delta, {
    required RefType refType,
    required String refId,
    required DateTime now,
    String? notes,
  }) {
    final p = db.products[productId];
    if (p == null || p.isDeleted || !p.trackInventory) return;
    _move(
      productId,
      type,
      delta,
      refType: refType,
      refId: refId,
      now: now,
      notes: notes,
    );
  }

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

  /// Inventory valuation at purchase price.
  Money stockValue() {
    var total = Money.zero;
    for (final p in db.activeProducts) {
      if (!p.trackInventory) continue;
      final q = db.stockOf(p.id);
      if (q.isPositive) total = total + p.purchasePrice.timesQty(q);
    }
    return total;
  }

  Product _product(String id) {
    final p = db.products[id];
    if (p == null || p.isDeleted) {
      throw const DomainException(ErrorCodes.notFound, 'المنتج غير موجود');
    }
    return p;
  }

  /// Pack units must have a name, a factor > 1 base unit, unique names and
  /// must not duplicate the base unit's name.
  void _validatePackUnits(List<PackUnit> units, String baseUnit) {
    final seen = <String>{baseUnit.trim()};
    for (final u in units) {
      final nm = u.name.trim();
      if (nm.isEmpty) {
        throw const DomainException(
          ErrorCodes.invalidAmount,
          'اسم الوحدة مطلوب',
        );
      }
      if (u.factor <= Qty.one) {
        throw DomainException(
          ErrorCodes.invalidQuantity,
          'معامل الوحدة «$nm» يجب أن يكون أكبر من 1',
        );
      }
      if ((u.salePrice?.isNegative ?? false) ||
          (u.purchasePrice?.isNegative ?? false)) {
        throw DomainException(
          ErrorCodes.invalidAmount,
          'أسعار الوحدة «$nm» لا يمكن أن تكون سالبة',
        );
      }
      if (!seen.add(nm)) {
        throw DomainException(ErrorCodes.duplicate, 'اسم الوحدة «$nm» مكرر');
      }
    }
  }
}
