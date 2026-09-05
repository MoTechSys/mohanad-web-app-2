import '../../core/money/money.dart';
import '../enums/enums.dart';
import 'serde.dart';

/// سند قبض / سند صرف — a formal cash voucher document.
///
/// Append-only like every financial record: cancel (with reason) instead of
/// delete. When linked to a customer/supplier the voucher ALSO writes a
/// ledger row ([partyTxId]) so balances stay derived from one source.
class Voucher {
  const Voucher({
    required this.id,
    required this.voucherNo,
    required this.type,
    required this.amount,
    this.customerId,
    this.supplierId,
    this.partyNameManual,
    this.partyTxId,
    this.expenseId,
    this.method = VoucherMethod.cash,
    this.details,
    required this.voucherDate,
    required this.createdAt,
    this.cancelledAt,
    this.cancelReason,
  });

  final String id;

  /// Sequential human number: «RV-0001» for receipts, «PV-0001» for payments.
  final String voucherNo;
  final VoucherType type;
  final Money amount;

  /// Exactly one of [customerId] / [supplierId] / [partyNameManual] should be
  /// set (manual name = one-off party without a ledger).
  final String? customerId;
  final String? supplierId;
  final String? partyNameManual;

  /// The customer/supplier ledger row this voucher created (for cancel).
  final String? partyTxId;

  /// For payment vouchers to suppliers: the linked Expense row.
  final String? expenseId;
  final VoucherMethod method;
  final String? details;
  final DateTime voucherDate;
  final DateTime createdAt;
  final DateTime? cancelledAt;
  final String? cancelReason;

  bool get isCancelled => cancelledAt != null;
  bool get isActive => cancelledAt == null;

  Voucher cancelled(String? reason, DateTime at) => Voucher(
    id: id,
    voucherNo: voucherNo,
    type: type,
    amount: amount,
    customerId: customerId,
    supplierId: supplierId,
    partyNameManual: partyNameManual,
    partyTxId: partyTxId,
    expenseId: expenseId,
    method: method,
    details: details,
    voucherDate: voucherDate,
    createdAt: createdAt,
    cancelledAt: at,
    cancelReason: reason,
  );

  Map<String, dynamic> toMap() => {
    'id': id,
    'voucherNo': voucherNo,
    'type': type.index,
    'amount': amount.minor,
    'customerId': customerId,
    'supplierId': supplierId,
    'partyNameManual': partyNameManual,
    'partyTxId': partyTxId,
    'expenseId': expenseId,
    'method': method.index,
    'details': details,
    'voucherDate': Serde.dt(voucherDate),
    'createdAt': Serde.dt(createdAt),
    'cancelledAt': Serde.dt(cancelledAt),
    'cancelReason': cancelReason,
  };

  factory Voucher.fromMap(Map<String, dynamic> m) => Voucher(
    id: m['id'] as String,
    voucherNo: (m['voucherNo'] as String?) ?? '',
    type: Serde.enumFrom(VoucherType.values, m['type'], VoucherType.receipt),
    amount: Serde.moneyReq(m['amount']),
    customerId: Serde.str(m['customerId']),
    supplierId: Serde.str(m['supplierId']),
    partyNameManual: Serde.str(m['partyNameManual']),
    partyTxId: Serde.str(m['partyTxId']),
    expenseId: Serde.str(m['expenseId']),
    method: Serde.enumFrom(VoucherMethod.values, m['method'], VoucherMethod.cash),
    details: Serde.str(m['details']),
    voucherDate: Serde.dtReq(m['voucherDate']),
    createdAt: Serde.dtReq(m['createdAt']),
    cancelledAt: Serde.dtFrom(m['cancelledAt']),
    cancelReason: Serde.str(m['cancelReason']),
  );
}
