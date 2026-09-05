import '../../core/money/money.dart';
import '../enums/enums.dart';
import 'serde.dart';

/// A line on a sale or purchase. Prices/costs are *snapshots* taken at the
/// time of the document so later product edits never rewrite history.
///
/// [qty] is expressed in the unit named [unitName] (e.g. 2 كرتون).
/// [unitFactor] converts to the product's base unit for stock purposes:
/// `baseQty = qty × unitFactor`. Legacy rows (no unit fields) default to
/// factor 1 so history is untouched.
class DocLine {
  const DocLine({
    this.productId,
    required this.name,
    required this.qty,
    required this.unitPrice,
    this.unitCost = Money.zero,
    this.unitName,
    this.unitFactor = Qty.one,
  });

  final String? productId;
  final String name;
  final Qty qty;

  /// For sales: selling price. For purchases: purchase cost.
  /// Always per ONE [unitName] (i.e. per pack when a pack is chosen).
  final Money unitPrice;

  /// For sales only: cost snapshot used for accurate COGS (per [unitName]).
  final Money unitCost;

  /// Display unit (حبة / كرتون …). Null = product base unit (legacy).
  final String? unitName;

  /// Base units per one [unitName]. 1 for the base unit itself.
  final Qty unitFactor;

  Money get lineTotal => unitPrice.timesQty(qty);
  Money get lineCost => unitCost.timesQty(qty);

  /// Quantity converted to the product's base unit (for stock moves).
  Qty get baseQty => qty.times(unitFactor);

  /// "2 كرتون" or plain "2" when no unit name is known.
  String qtyLabel() =>
      unitName == null ? qty.format() : '${qty.format()} $unitName';

  Map<String, dynamic> toMap() => {
    'productId': productId,
    'name': name,
    'qty': qty.milli,
    'unitPrice': unitPrice.minor,
    'unitCost': unitCost.minor,
    'unitName': unitName,
    'unitFactor': unitFactor.milli,
  };

  factory DocLine.fromMap(Map<String, dynamic> m) => DocLine(
    productId: Serde.str(m['productId']),
    name: m['name'] as String,
    qty: Serde.qtyReq(m['qty']),
    unitPrice: Serde.moneyReq(m['unitPrice']),
    unitCost: Serde.moneyReq(m['unitCost']),
    unitName: Serde.str(m['unitName']),
    unitFactor: m['unitFactor'] == null
        ? Qty.one
        : Serde.qtyReq(m['unitFactor']),
  );
}

class Sale {
  const Sale({
    required this.id,
    this.customerId,
    required this.mode,
    required this.paymentType,
    required this.grossAmount,
    this.discount = Money.zero,
    required this.netAmount,
    this.costAmount = Money.zero,
    this.details,
    this.invoiceNo,
    required this.saleDate,
    required this.createdAt,
    this.lines = const [],
    this.cancelledAt,
    this.cancelReason,
  });

  final String id;
  final String? customerId;
  final DocMode mode;
  final PaymentType paymentType;
  final Money grossAmount;
  final Money discount;
  final Money netAmount;

  /// Sum of line costs (0 when unknown / total-only).
  final Money costAmount;
  final String? details;
  final String? invoiceNo;
  final DateTime saleDate;
  final DateTime createdAt;
  final List<DocLine> lines;
  final DateTime? cancelledAt;
  final String? cancelReason;

  bool get isCancelled => cancelledAt != null;
  bool get isActive => cancelledAt == null;

  /// Gross profit when cost is known; null otherwise.
  Money? get profit => costAmount.isZero && mode == DocMode.totalOnly
      ? null
      : netAmount - costAmount;

  Sale cancelled(String? reason, DateTime at) => Sale(
    id: id,
    customerId: customerId,
    mode: mode,
    paymentType: paymentType,
    grossAmount: grossAmount,
    discount: discount,
    netAmount: netAmount,
    costAmount: costAmount,
    details: details,
    invoiceNo: invoiceNo,
    saleDate: saleDate,
    createdAt: createdAt,
    lines: lines,
    cancelledAt: at,
    cancelReason: reason,
  );

  Map<String, dynamic> toMap() => {
    'id': id,
    'customerId': customerId,
    'mode': mode.index,
    'paymentType': paymentType.index,
    'grossAmount': grossAmount.minor,
    'discount': discount.minor,
    'netAmount': netAmount.minor,
    'costAmount': costAmount.minor,
    'details': details,
    'invoiceNo': invoiceNo,
    'saleDate': Serde.dt(saleDate),
    'createdAt': Serde.dt(createdAt),
    'lines': lines.map((l) => l.toMap()).toList(),
    'cancelledAt': Serde.dt(cancelledAt),
    'cancelReason': cancelReason,
  };

  factory Sale.fromMap(Map<String, dynamic> m) => Sale(
    id: m['id'] as String,
    customerId: Serde.str(m['customerId']),
    mode: Serde.enumFrom(DocMode.values, m['mode'], DocMode.totalOnly),
    paymentType: Serde.enumFrom(
      PaymentType.values,
      m['paymentType'],
      PaymentType.cash,
    ),
    grossAmount: Serde.moneyReq(m['grossAmount']),
    discount: Serde.moneyReq(m['discount']),
    netAmount: Serde.moneyReq(m['netAmount']),
    costAmount: Serde.moneyReq(m['costAmount']),
    details: Serde.str(m['details']),
    invoiceNo: Serde.str(m['invoiceNo']),
    saleDate: Serde.dtReq(m['saleDate']),
    createdAt: Serde.dtReq(m['createdAt']),
    lines: Serde.listOfMaps(m['lines']).map(DocLine.fromMap).toList(),
    cancelledAt: Serde.dtFrom(m['cancelledAt']),
    cancelReason: Serde.str(m['cancelReason']),
  );
}

class Purchase {
  const Purchase({
    required this.id,
    this.supplierId,
    this.supplierNameManual,
    required this.mode,
    required this.paymentType,
    required this.totalAmount,
    this.details,
    this.invoiceNo,
    required this.purchaseDate,
    required this.createdAt,
    this.lines = const [],
    this.cancelledAt,
    this.cancelReason,
  });

  final String id;
  final String? supplierId;
  final String? supplierNameManual;
  final DocMode mode;
  final PaymentType paymentType;
  final Money totalAmount;
  final String? details;
  final String? invoiceNo;
  final DateTime purchaseDate;
  final DateTime createdAt;
  final List<DocLine> lines;
  final DateTime? cancelledAt;
  final String? cancelReason;

  bool get isCancelled => cancelledAt != null;
  bool get isActive => cancelledAt == null;

  Purchase cancelled(String? reason, DateTime at) => Purchase(
    id: id,
    supplierId: supplierId,
    supplierNameManual: supplierNameManual,
    mode: mode,
    paymentType: paymentType,
    totalAmount: totalAmount,
    details: details,
    invoiceNo: invoiceNo,
    purchaseDate: purchaseDate,
    createdAt: createdAt,
    lines: lines,
    cancelledAt: at,
    cancelReason: reason,
  );

  Map<String, dynamic> toMap() => {
    'id': id,
    'supplierId': supplierId,
    'supplierNameManual': supplierNameManual,
    'mode': mode.index,
    'paymentType': paymentType.index,
    'totalAmount': totalAmount.minor,
    'details': details,
    'invoiceNo': invoiceNo,
    'purchaseDate': Serde.dt(purchaseDate),
    'createdAt': Serde.dt(createdAt),
    'lines': lines.map((l) => l.toMap()).toList(),
    'cancelledAt': Serde.dt(cancelledAt),
    'cancelReason': cancelReason,
  };

  factory Purchase.fromMap(Map<String, dynamic> m) => Purchase(
    id: m['id'] as String,
    supplierId: Serde.str(m['supplierId']),
    supplierNameManual: Serde.str(m['supplierNameManual']),
    mode: Serde.enumFrom(DocMode.values, m['mode'], DocMode.totalOnly),
    paymentType: Serde.enumFrom(
      PaymentType.values,
      m['paymentType'],
      PaymentType.cash,
    ),
    totalAmount: Serde.moneyReq(m['totalAmount']),
    details: Serde.str(m['details']),
    invoiceNo: Serde.str(m['invoiceNo']),
    purchaseDate: Serde.dtReq(m['purchaseDate']),
    createdAt: Serde.dtReq(m['createdAt']),
    lines: Serde.listOfMaps(m['lines']).map(DocLine.fromMap).toList(),
    cancelledAt: Serde.dtFrom(m['cancelledAt']),
    cancelReason: Serde.str(m['cancelReason']),
  );
}

class Expense {
  const Expense({
    required this.id,
    required this.type,
    this.categoryId,
    this.supplierId,
    this.purchaseId,
    required this.amount,
    this.details,
    required this.expenseDate,
    required this.createdAt,
    this.cancelledAt,
    this.cancelReason,
  });

  final String id;
  final ExpenseType type;
  final String? categoryId;
  final String? supplierId;

  /// Set when auto-created from a cash purchase.
  final String? purchaseId;
  final Money amount;
  final String? details;
  final DateTime expenseDate;
  final DateTime createdAt;
  final DateTime? cancelledAt;
  final String? cancelReason;

  bool get isCancelled => cancelledAt != null;
  bool get isActive => cancelledAt == null;

  /// Operating expenses reduce profit. Supplier payments settle a liability
  /// and cash purchases are inventory/COGS — neither is an operating expense.
  bool get isOperating =>
      type == ExpenseType.normal || type == ExpenseType.other;

  Expense cancelled(String? reason, DateTime at) => Expense(
    id: id,
    type: type,
    categoryId: categoryId,
    supplierId: supplierId,
    purchaseId: purchaseId,
    amount: amount,
    details: details,
    expenseDate: expenseDate,
    createdAt: createdAt,
    cancelledAt: at,
    cancelReason: reason,
  );

  Map<String, dynamic> toMap() => {
    'id': id,
    'type': type.index,
    'categoryId': categoryId,
    'supplierId': supplierId,
    'purchaseId': purchaseId,
    'amount': amount.minor,
    'details': details,
    'expenseDate': Serde.dt(expenseDate),
    'createdAt': Serde.dt(createdAt),
    'cancelledAt': Serde.dt(cancelledAt),
    'cancelReason': cancelReason,
  };

  factory Expense.fromMap(Map<String, dynamic> m) => Expense(
    id: m['id'] as String,
    type: Serde.enumFrom(ExpenseType.values, m['type'], ExpenseType.normal),
    categoryId: Serde.str(m['categoryId']),
    supplierId: Serde.str(m['supplierId']),
    purchaseId: Serde.str(m['purchaseId']),
    amount: Serde.moneyReq(m['amount']),
    details: Serde.str(m['details']),
    expenseDate: Serde.dtReq(m['expenseDate']),
    createdAt: Serde.dtReq(m['createdAt']),
    cancelledAt: Serde.dtFrom(m['cancelledAt']),
    cancelReason: Serde.str(m['cancelReason']),
  );
}

class ExpenseCategory {
  const ExpenseCategory({
    required this.id,
    required this.name,
    this.isActive = true,
  });
  final String id;
  final String name;
  final bool isActive;

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'isActive': isActive,
  };
  factory ExpenseCategory.fromMap(Map<String, dynamic> m) => ExpenseCategory(
    id: m['id'] as String,
    name: m['name'] as String,
    isActive: (m['isActive'] as bool?) ?? true,
  );
}

/// Lump-sum daily income (cash drawer total) for shops that do not record
/// every sale individually.
class DailyIncome {
  const DailyIncome({
    required this.id,
    required this.amount,
    this.manualCogs,
    this.notes,
    required this.incomeDate,
    required this.createdAt,
    this.cancelledAt,
    this.cancelReason,
  });

  final String id;
  final Money amount;
  final Money? manualCogs;
  final String? notes;
  final DateTime incomeDate;
  final DateTime createdAt;
  final DateTime? cancelledAt;
  final String? cancelReason;

  bool get isCancelled => cancelledAt != null;
  bool get isActive => cancelledAt == null;

  DailyIncome cancelled(String? reason, DateTime at) => DailyIncome(
    id: id,
    amount: amount,
    manualCogs: manualCogs,
    notes: notes,
    incomeDate: incomeDate,
    createdAt: createdAt,
    cancelledAt: at,
    cancelReason: reason,
  );

  Map<String, dynamic> toMap() => {
    'id': id,
    'amount': amount.minor,
    'manualCogs': Serde.money(manualCogs),
    'notes': notes,
    'incomeDate': Serde.dt(incomeDate),
    'createdAt': Serde.dt(createdAt),
    'cancelledAt': Serde.dt(cancelledAt),
    'cancelReason': cancelReason,
  };

  factory DailyIncome.fromMap(Map<String, dynamic> m) => DailyIncome(
    id: m['id'] as String,
    amount: Serde.moneyReq(m['amount']),
    manualCogs: Serde.moneyOpt(m['manualCogs']),
    notes: Serde.str(m['notes']),
    incomeDate: Serde.dtReq(m['incomeDate']),
    createdAt: Serde.dtReq(m['createdAt']),
    cancelledAt: Serde.dtFrom(m['cancelledAt']),
    cancelReason: Serde.str(m['cancelReason']),
  );
}
