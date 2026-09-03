import '../../core/money/money.dart';
import '../enums/enums.dart';
import 'serde.dart';

/// A customer (owes us) — balance > 0 means the customer is in debt.
class Customer {
  const Customer({
    required this.id,
    required this.name,
    this.phone,
    this.address,
    this.notes,
    this.creditLimit,
    this.openingBalance = Money.zero,
    this.status = CustomerStatus.active,
    this.graceUntil,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
  });

  final String id;
  final String name;
  final String? phone;
  final String? address;
  final String? notes;

  /// `null` = no limit.
  final Money? creditLimit;
  final Money openingBalance;
  final CustomerStatus status;
  final DateTime? graceUntil;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;

  bool get isDeleted => deletedAt != null;

  Customer copyWith({
    String? name,
    String? phone,
    String? address,
    String? notes,
    Money? creditLimit,
    bool clearCreditLimit = false,
    CustomerStatus? status,
    DateTime? graceUntil,
    bool clearGrace = false,
    DateTime? updatedAt,
    DateTime? deletedAt,
  }) => Customer(
    id: id,
    name: name ?? this.name,
    phone: phone ?? this.phone,
    address: address ?? this.address,
    notes: notes ?? this.notes,
    creditLimit: clearCreditLimit ? null : (creditLimit ?? this.creditLimit),
    openingBalance: openingBalance,
    status: status ?? this.status,
    graceUntil: clearGrace ? null : (graceUntil ?? this.graceUntil),
    createdAt: createdAt,
    updatedAt: updatedAt ?? DateTime.now(),
    deletedAt: deletedAt ?? this.deletedAt,
  );

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'phone': phone,
    'address': address,
    'notes': notes,
    'creditLimit': Serde.money(creditLimit),
    'openingBalance': openingBalance.minor,
    'status': status.index,
    'graceUntil': Serde.dt(graceUntil),
    'createdAt': Serde.dt(createdAt),
    'updatedAt': Serde.dt(updatedAt),
    'deletedAt': Serde.dt(deletedAt),
  };

  factory Customer.fromMap(Map<String, dynamic> m) => Customer(
    id: m['id'] as String,
    name: m['name'] as String,
    phone: Serde.str(m['phone']),
    address: Serde.str(m['address']),
    notes: Serde.str(m['notes']),
    creditLimit: Serde.moneyOpt(m['creditLimit']),
    openingBalance: Serde.moneyReq(m['openingBalance']),
    status: Serde.enumFrom(
      CustomerStatus.values,
      m['status'],
      CustomerStatus.active,
    ),
    graceUntil: Serde.dtFrom(m['graceUntil']),
    createdAt: Serde.dtReq(m['createdAt']),
    updatedAt: Serde.dtReq(m['updatedAt']),
    deletedAt: Serde.dtFrom(m['deletedAt']),
  );
}

/// A supplier (we owe them) — balance > 0 means we are in debt to them.
class Supplier {
  const Supplier({
    required this.id,
    required this.name,
    this.phone,
    this.address,
    this.notes,
    this.openingBalance = Money.zero,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
  });

  final String id;
  final String name;
  final String? phone;
  final String? address;
  final String? notes;
  final Money openingBalance;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;

  bool get isDeleted => deletedAt != null;

  Supplier copyWith({
    String? name,
    String? phone,
    String? address,
    String? notes,
    DateTime? updatedAt,
    DateTime? deletedAt,
  }) => Supplier(
    id: id,
    name: name ?? this.name,
    phone: phone ?? this.phone,
    address: address ?? this.address,
    notes: notes ?? this.notes,
    openingBalance: openingBalance,
    createdAt: createdAt,
    updatedAt: updatedAt ?? DateTime.now(),
    deletedAt: deletedAt ?? this.deletedAt,
  );

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'phone': phone,
    'address': address,
    'notes': notes,
    'openingBalance': openingBalance.minor,
    'createdAt': Serde.dt(createdAt),
    'updatedAt': Serde.dt(updatedAt),
    'deletedAt': Serde.dt(deletedAt),
  };

  factory Supplier.fromMap(Map<String, dynamic> m) => Supplier(
    id: m['id'] as String,
    name: m['name'] as String,
    phone: Serde.str(m['phone']),
    address: Serde.str(m['address']),
    notes: Serde.str(m['notes']),
    openingBalance: Serde.moneyReq(m['openingBalance']),
    createdAt: Serde.dtReq(m['createdAt']),
    updatedAt: Serde.dtReq(m['updatedAt']),
    deletedAt: Serde.dtFrom(m['deletedAt']),
  );
}

/// One row in a party's append-only ledger (customer or supplier).
///
/// Sign convention for [amount]:
///   * `debt`       : always positive, increases balance
///   * `payment`    : always positive, decreases balance
///   * `adjustment` : signed, added to balance
///   * `opening`    : signed, added to balance
///
/// [signedDelta] is the effect on the balance.
class PartyTx {
  const PartyTx({
    required this.id,
    required this.partyId,
    required this.type,
    required this.amount,
    required this.balanceBefore,
    required this.balanceAfter,
    this.notes,
    this.refType = RefType.manual,
    this.refId,
    required this.txDate,
    required this.createdAt,
    this.cancelledAt,
    this.cancelReason,
  });

  final String id;
  final String partyId;
  final PartyTxType type;
  final Money amount;
  final Money balanceBefore;
  final Money balanceAfter;
  final String? notes;
  final RefType refType;
  final String? refId;
  final DateTime txDate;
  final DateTime createdAt;
  final DateTime? cancelledAt;
  final String? cancelReason;

  bool get isCancelled => cancelledAt != null;
  bool get isActive => cancelledAt == null;

  /// Effect on the balance (positive raises debt).
  Money get signedDelta => switch (type) {
    PartyTxType.debt => amount,
    PartyTxType.payment => -amount,
    PartyTxType.adjustment => amount,
    PartyTxType.opening => amount,
  };

  PartyTx cancelled(String reason, DateTime at) => PartyTx(
    id: id,
    partyId: partyId,
    type: type,
    amount: amount,
    balanceBefore: balanceBefore,
    balanceAfter: balanceAfter,
    notes: notes,
    refType: refType,
    refId: refId,
    txDate: txDate,
    createdAt: createdAt,
    cancelledAt: at,
    cancelReason: reason,
  );

  Map<String, dynamic> toMap() => {
    'id': id,
    'partyId': partyId,
    'type': type.index,
    'amount': amount.minor,
    'balanceBefore': balanceBefore.minor,
    'balanceAfter': balanceAfter.minor,
    'notes': notes,
    'refType': refType.index,
    'refId': refId,
    'txDate': Serde.dt(txDate),
    'createdAt': Serde.dt(createdAt),
    'cancelledAt': Serde.dt(cancelledAt),
    'cancelReason': cancelReason,
  };

  factory PartyTx.fromMap(Map<String, dynamic> m) => PartyTx(
    id: m['id'] as String,
    partyId: m['partyId'] as String,
    type: Serde.enumFrom(PartyTxType.values, m['type'], PartyTxType.adjustment),
    amount: Serde.moneyReq(m['amount']),
    balanceBefore: Serde.moneyReq(m['balanceBefore']),
    balanceAfter: Serde.moneyReq(m['balanceAfter']),
    notes: Serde.str(m['notes']),
    refType: Serde.enumFrom(RefType.values, m['refType'], RefType.manual),
    refId: Serde.str(m['refId']),
    txDate: Serde.dtReq(m['txDate']),
    createdAt: Serde.dtReq(m['createdAt']),
    cancelledAt: Serde.dtFrom(m['cancelledAt']),
    cancelReason: Serde.str(m['cancelReason']),
  );
}
