import '../../core/errors/domain_exception.dart';
import '../../core/ids/id_gen.dart';
import '../../core/money/money.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/documents.dart';
import '../../domain/models/party.dart';
import '../../domain/models/voucher.dart';
import '../ledger_db.dart';

/// سندات القبض والصرف (المرحلة م2 — طلب أصحاب البقالات).
///
/// * سند قبض من عميل ⇒ يسجل «سداد» في دفتر العميل (ينقص دينه).
/// * سند صرف لمورد ⇒ يسجل دفعة للمورد (مصروف supplierPayment + سطر دفتر).
/// * سند لجهة أخرى (اسم حر) ⇒ سند مستقل: قبض = إيراد نثري، صرف = مصروف.
/// * الترقيم تسلسلي بشري: RV-0001 / PV-0001 — لا يُعاد استخدام رقم أبدًا.
/// * لا حذف: إلغاء بسبب فقط، مع عكس أثر الدفاتر المرتبطة.
class VoucherService {
  VoucherService(this.db);
  final LedgerDb db;

  // ─────────────────────── numbering ───────────────────────

  /// Next sequential number for [type]. Scans existing vouchers (including
  /// cancelled ones) so numbers are never reused even after cancellations.
  String nextVoucherNo(VoucherType type) {
    final prefix = type == VoucherType.receipt ? 'RV-' : 'PV-';
    var maxN = 0;
    for (final v in db.vouchers.values) {
      if (v.type != type) continue;
      final n = int.tryParse(v.voucherNo.replaceFirst(prefix, '')) ?? 0;
      if (n > maxN) maxN = n;
    }
    return '$prefix${(maxN + 1).toString().padLeft(4, '0')}';
  }

  // ─────────────────────── creation ───────────────────────

  /// سند قبض: استلام نقدية.
  /// * [customerId] ⇒ يسدد من دين العميل (سطر دفتر مرتبط).
  /// * [partyNameManual] ⇒ قبض من جهة خارجية بدون دفتر.
  Future<Voucher> createReceipt({
    String? customerId,
    String? partyNameManual,
    required Money amount,
    VoucherMethod method = VoucherMethod.cash,
    String? details,
    DateTime? date,
  }) {
    _requirePositive(amount);
    final customer = _resolveCustomer(customerId, partyNameManual);
    final no = nextVoucherNo(VoucherType.receipt);

    return db.run(() {
      final now = DateTime.now();
      final vid = IdGen.next();
      String? partyTxId;

      if (customer != null) {
        final before = db.customerBalance(customer.id);
        final t = PartyTx(
          id: IdGen.next(),
          partyId: customer.id,
          type: PartyTxType.payment,
          amount: amount,
          balanceBefore: before,
          balanceAfter: before - amount,
          notes: _clean(details) ?? 'سند قبض $no',
          refType: RefType.voucher,
          refId: vid,
          txDate: date ?? now,
          createdAt: now,
        );
        db.putCustomerTx(t);
        partyTxId = t.id;
        if (customer.status == CustomerStatus.gracePeriod &&
            (before - amount) <= Money.zero) {
          db.putCustomer(
            customer.copyWith(status: CustomerStatus.active, clearGrace: true),
          );
        }
      }

      final v = Voucher(
        id: vid,
        voucherNo: no,
        type: VoucherType.receipt,
        amount: amount,
        customerId: customer?.id,
        partyNameManual: customer == null ? _clean(partyNameManual) : null,
        partyTxId: partyTxId,
        method: method,
        details: _clean(details),
        voucherDate: date ?? now,
        createdAt: now,
      );
      db.putVoucher(v);
      db.log(
        action: AuditAction.create,
        entityType: 'voucher',
        entityId: vid,
        summary:
            'سند قبض $no من ${customer?.name ?? partyNameManual ?? 'غير محدد'}: ${amount.format()}',
        newValues: {'no': no, 'amount': amount.minor},
        amount: amount,
      );
      return v;
    });
  }

  /// سند صرف: دفع نقدية.
  /// * [supplierId] ⇒ دفعة تسدد من ديننا للمورد (+Expense مرتبط).
  /// * [partyNameManual] ⇒ صرف لجهة خارجية (يسجل مصروفًا عامًا).
  Future<Voucher> createPayment({
    String? supplierId,
    String? partyNameManual,
    required Money amount,
    VoucherMethod method = VoucherMethod.cash,
    String? details,
    DateTime? date,
  }) {
    _requirePositive(amount);
    final supplier = _resolveSupplier(supplierId, partyNameManual);
    final no = nextVoucherNo(VoucherType.payment);

    return db.run(() {
      final now = DateTime.now();
      final vid = IdGen.next();
      String? partyTxId;

      // The cash-out is always recorded as an Expense so cash-flow reports
      // stay complete (supplierPayment settles debt; other = general outflow).
      final e = Expense(
        id: IdGen.next(),
        type: supplier != null ? ExpenseType.supplierPayment : ExpenseType.other,
        supplierId: supplier?.id,
        amount: amount,
        details: _clean(details) ??
            'سند صرف $no${supplier != null ? ' — ${supplier.name}' : partyNameManual != null ? ' — $partyNameManual' : ''}',
        expenseDate: date ?? now,
        createdAt: now,
      );
      db.putExpense(e);

      if (supplier != null) {
        final before = db.supplierBalance(supplier.id);
        final t = PartyTx(
          id: IdGen.next(),
          partyId: supplier.id,
          type: PartyTxType.payment,
          amount: amount,
          balanceBefore: before,
          balanceAfter: before - amount,
          notes: _clean(details) ?? 'سند صرف $no',
          refType: RefType.voucher,
          refId: vid,
          txDate: date ?? now,
          createdAt: now,
        );
        db.putSupplierTx(t);
        partyTxId = t.id;
      }

      final v = Voucher(
        id: vid,
        voucherNo: no,
        type: VoucherType.payment,
        amount: amount,
        supplierId: supplier?.id,
        partyNameManual: supplier == null ? _clean(partyNameManual) : null,
        partyTxId: partyTxId,
        expenseId: e.id,
        method: method,
        details: _clean(details),
        voucherDate: date ?? now,
        createdAt: now,
      );
      db.putVoucher(v);
      db.log(
        action: AuditAction.create,
        entityType: 'voucher',
        entityId: vid,
        summary:
            'سند صرف $no إلى ${supplier?.name ?? partyNameManual ?? 'غير محدد'}: ${amount.format()}',
        newValues: {'no': no, 'amount': amount.minor},
        amount: amount,
      );
      return v;
    });
  }

  // ─────────────────────── cancel ───────────────────────

  /// إلغاء سند (لا حذف): يعكس سطر الدفتر والمصروف المرتبطين.
  Future<void> cancelVoucher(String id, String reason) {
    final v = db.vouchers[id];
    if (v == null) {
      throw const DomainException(ErrorCodes.notFound, 'السند غير موجود');
    }
    if (v.isCancelled) {
      throw const DomainException(
        ErrorCodes.alreadyCancelled,
        'السند ملغى مسبقًا',
      );
    }
    final r = reason.trim();
    if (r.isEmpty) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'سبب الإلغاء مطلوب',
      );
    }
    return db.run(() {
      final now = DateTime.now();
      db.putVoucher(v.cancelled(r, now));

      // Reverse the linked customer/supplier ledger row.
      final txId = v.partyTxId;
      if (txId != null) {
        final ct = db.customerTx[txId];
        if (ct != null && ct.isActive) {
          db.putCustomerTx(ct.cancelled('إلغاء ${v.voucherNo}', now));
        }
        final st = db.supplierTx[txId];
        if (st != null && st.isActive) {
          db.putSupplierTx(st.cancelled('إلغاء ${v.voucherNo}', now));
        }
      }
      // Reverse the linked expense (payment vouchers).
      final eid = v.expenseId;
      if (eid != null) {
        final e = db.expenses[eid];
        if (e != null && e.isActive) {
          db.putExpense(e.cancelled('إلغاء ${v.voucherNo}', now));
        }
      }
      db.log(
        action: AuditAction.cancel,
        entityType: 'voucher',
        entityId: id,
        summary: 'إلغاء ${v.type.label} ${v.voucherNo} (${v.amount.format()})',
        oldValues: {'no': v.voucherNo, 'amount': v.amount.minor},
        newValues: {'reason': r},
      );
    });
  }

  // ─────────────────────── queries ───────────────────────

  /// Vouchers sorted newest first.
  List<Voucher> all({VoucherType? type}) {
    final list = db.vouchers.values
        .where((v) => type == null || v.type == type)
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return list;
  }

  /// Display name of the voucher's party.
  String partyName(Voucher v) {
    if (v.customerId != null) {
      return db.customers[v.customerId]?.name ?? 'عميل محذوف';
    }
    if (v.supplierId != null) {
      return db.suppliers[v.supplierId]?.name ?? 'مورد محذوف';
    }
    return v.partyNameManual ?? 'غير محدد';
  }

  // ─────────────────────── helpers ───────────────────────

  Customer? _resolveCustomer(String? id, String? manual) {
    if (id == null) {
      if ((manual ?? '').trim().isEmpty) {
        throw const DomainException(
          ErrorCodes.invalidAmount,
          'حدد عميلًا أو اكتب اسم الجهة',
        );
      }
      return null;
    }
    final c = db.customers[id];
    if (c == null || c.isDeleted) {
      throw const DomainException(ErrorCodes.notFound, 'العميل غير موجود');
    }
    return c;
  }

  Supplier? _resolveSupplier(String? id, String? manual) {
    if (id == null) {
      if ((manual ?? '').trim().isEmpty) {
        throw const DomainException(
          ErrorCodes.invalidAmount,
          'حدد موردًا أو اكتب اسم الجهة',
        );
      }
      return null;
    }
    final s = db.suppliers[id];
    if (s == null || s.isDeleted) {
      throw const DomainException(ErrorCodes.notFound, 'المورد غير موجود');
    }
    return s;
  }

  void _requirePositive(Money m) {
    if (!m.isPositive) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'المبلغ يجب أن يكون أكبر من الصفر',
      );
    }
  }

  static String? _clean(String? s) {
    final t = s?.trim();
    return (t == null || t.isEmpty) ? null : t;
  }
}
