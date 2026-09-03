import '../../core/money/money.dart';
import '../enums/enums.dart';
import 'serde.dart';

class Product {
  const Product({
    required this.id,
    required this.name,
    this.barcode,
    this.unit = 'حبة',
    this.purchasePrice = Money.zero,
    this.salePrice = Money.zero,
    this.minQty = Qty.zero,
    this.trackInventory = true,
    this.status = ProductStatus.active,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
  });

  final String id;
  final String name;
  final String? barcode;
  final String unit;
  final Money purchasePrice;
  final Money salePrice;
  final Qty minQty;
  final bool trackInventory;
  final ProductStatus status;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;

  bool get isDeleted => deletedAt != null;

  /// Unit margin using current prices (informational only).
  Money get unitMargin => salePrice - purchasePrice;

  Product copyWith({
    String? name,
    String? barcode,
    String? unit,
    Money? purchasePrice,
    Money? salePrice,
    Qty? minQty,
    bool? trackInventory,
    ProductStatus? status,
    DateTime? updatedAt,
    DateTime? deletedAt,
  }) => Product(
    id: id,
    name: name ?? this.name,
    barcode: barcode ?? this.barcode,
    unit: unit ?? this.unit,
    purchasePrice: purchasePrice ?? this.purchasePrice,
    salePrice: salePrice ?? this.salePrice,
    minQty: minQty ?? this.minQty,
    trackInventory: trackInventory ?? this.trackInventory,
    status: status ?? this.status,
    createdAt: createdAt,
    updatedAt: updatedAt ?? DateTime.now(),
    deletedAt: deletedAt ?? this.deletedAt,
  );

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'barcode': barcode,
    'unit': unit,
    'purchasePrice': purchasePrice.minor,
    'salePrice': salePrice.minor,
    'minQty': minQty.milli,
    'trackInventory': trackInventory,
    'status': status.index,
    'createdAt': Serde.dt(createdAt),
    'updatedAt': Serde.dt(updatedAt),
    'deletedAt': Serde.dt(deletedAt),
  };

  factory Product.fromMap(Map<String, dynamic> m) => Product(
    id: m['id'] as String,
    name: m['name'] as String,
    barcode: Serde.str(m['barcode']),
    unit: (m['unit'] as String?) ?? 'حبة',
    purchasePrice: Serde.moneyReq(m['purchasePrice']),
    salePrice: Serde.moneyReq(m['salePrice']),
    minQty: Serde.qtyReq(m['minQty']),
    trackInventory: (m['trackInventory'] as bool?) ?? true,
    status: Serde.enumFrom(
      ProductStatus.values,
      m['status'],
      ProductStatus.active,
    ),
    createdAt: Serde.dtReq(m['createdAt']),
    updatedAt: Serde.dtReq(m['updatedAt']),
    deletedAt: Serde.dtFrom(m['deletedAt']),
  );
}

/// Append-only stock ledger row. [delta] is the signed quantity change.
class StockMove {
  const StockMove({
    required this.id,
    required this.productId,
    required this.type,
    required this.delta,
    required this.qtyBefore,
    required this.qtyAfter,
    this.refType = RefType.manual,
    this.refId,
    this.notes,
    required this.moveDate,
    required this.createdAt,
    this.cancelledAt,
    this.cancelReason,
  });

  final String id;
  final String productId;
  final StockMoveType type;
  final Qty delta;
  final Qty qtyBefore;
  final Qty qtyAfter;
  final RefType refType;
  final String? refId;
  final String? notes;
  final DateTime moveDate;
  final DateTime createdAt;
  final DateTime? cancelledAt;
  final String? cancelReason;

  bool get isCancelled => cancelledAt != null;
  bool get isActive => cancelledAt == null;

  StockMove cancelled(String? reason, DateTime at) => StockMove(
    id: id,
    productId: productId,
    type: type,
    delta: delta,
    qtyBefore: qtyBefore,
    qtyAfter: qtyAfter,
    refType: refType,
    refId: refId,
    notes: notes,
    moveDate: moveDate,
    createdAt: createdAt,
    cancelledAt: at,
    cancelReason: reason,
  );

  Map<String, dynamic> toMap() => {
    'id': id,
    'productId': productId,
    'type': type.index,
    'delta': delta.milli,
    'qtyBefore': qtyBefore.milli,
    'qtyAfter': qtyAfter.milli,
    'refType': refType.index,
    'refId': refId,
    'notes': notes,
    'moveDate': Serde.dt(moveDate),
    'createdAt': Serde.dt(createdAt),
    'cancelledAt': Serde.dt(cancelledAt),
    'cancelReason': cancelReason,
  };

  factory StockMove.fromMap(Map<String, dynamic> m) => StockMove(
    id: m['id'] as String,
    productId: m['productId'] as String,
    type: Serde.enumFrom(
      StockMoveType.values,
      m['type'],
      StockMoveType.adjustment,
    ),
    delta: Serde.qtyReq(m['delta']),
    qtyBefore: Serde.qtyReq(m['qtyBefore']),
    qtyAfter: Serde.qtyReq(m['qtyAfter']),
    refType: Serde.enumFrom(RefType.values, m['refType'], RefType.manual),
    refId: Serde.str(m['refId']),
    notes: Serde.str(m['notes']),
    moveDate: Serde.dtReq(m['moveDate']),
    createdAt: Serde.dtReq(m['createdAt']),
    cancelledAt: Serde.dtFrom(m['cancelledAt']),
    cancelReason: Serde.str(m['cancelReason']),
  );
}
