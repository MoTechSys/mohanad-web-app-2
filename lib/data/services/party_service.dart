import '../../core/errors/domain_exception.dart';
import '../../core/ids/id_gen.dart';
import '../../core/money/money.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/documents.dart';
import '../../domain/models/party.dart';
import '../ledger_db.dart';

/// Customers, suppliers and their append-only ledgers.
class PartyService {
  PartyService(this.db);
  final LedgerDb db;

  // ═══════════════════════ CUSTOMERS ═══════════════════════

  Future<Customer> createCustomer({
    required String name,
    String? phone,
    String? address,
    String? notes,
    Money? creditLimit,
    Money openingBalance = Money.zero,
  }) {
    final n = name.trim();
    if (n.isEmpty) {
      throw const DomainException(ErrorCodes.invalidAmount, 'اسم العميل مطلوب');
    }
    if (creditLimit != null && creditLimit.isNegative) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'سقف الدين لا يمكن أن يكون سالباً',
      );
    }
    return db.run(() {
      final now = DateTime.now();
      final c = Customer(
        id: IdGen.next(),
        name: n,
        phone: _clean(phone),
        address: _clean(address),
        notes: _clean(notes),
        creditLimit: creditLimit,
        openingBalance: openingBalance,
        createdAt: now,
        updatedAt: now,
      );
      db.putCustomer(c);
      if (!openingBalance.isZero) {
        db.putCustomerTx(
          PartyTx(
            id: IdGen.next(),
            partyId: c.id,
            type: PartyTxType.opening,
            amount: openingBalance,
            balanceBefore: Money.zero,
            balanceAfter: openingBalance,
            notes: 'رصيد افتتاحي',
            txDate: now,
            createdAt: now,
          ),
        );
      }
      db.log(
        action: AuditAction.create,
        entityType: 'customer',
        entityId: c.id,
        summary: 'إضافة عميل: $n',
        newValues: {'name': n, 'opening': openingBalance.minor},
      );
      return c;
    });
  }

  Future<Customer> updateCustomer(
    String id, {
    String? name,
    String? phone,
    String? address,
    String? notes,
    Money? creditLimit,
    bool clearCreditLimit = false,
  }) {
    final old = _customer(id);
    if (name != null && name.trim().isEmpty) {
      throw const DomainException(ErrorCodes.invalidAmount, 'اسم العميل مطلوب');
    }
    return db.run(() {
      final c = old.copyWith(
        name: name?.trim(),
        phone: phone?.trim(),
        address: address?.trim(),
        notes: notes?.trim(),
        creditLimit: creditLimit,
        clearCreditLimit: clearCreditLimit,
      );
      db.putCustomer(c);
      db.log(
        action: AuditAction.update,
        entityType: 'customer',
        entityId: id,
        summary: 'تعديل عميل: ${c.name}',
        oldValues: old.toMap(),
        newValues: c.toMap(),
      );
      return c;
    });
  }

  Future<void> setCustomerStatus(
    String id,
    CustomerStatus status, {
    DateTime? graceUntil,
  }) {
    final old = _customer(id);
    if (status == CustomerStatus.gracePeriod) {
      if (graceUntil == null || !graceUntil.isAfter(DateTime.now())) {
        throw const DomainException(
          ErrorCodes.invalidDate,
          'تاريخ انتهاء المهلة يجب أن يكون في المستقبل',
        );
      }
    }
    return db.run(() {
      final c = old.copyWith(
        status: status,
        graceUntil: status == CustomerStatus.gracePeriod ? graceUntil : null,
        clearGrace: status != CustomerStatus.gracePeriod,
      );
      db.putCustomer(c);
      db.log(
        action: AuditAction.update,
        entityType: 'customer',
        entityId: id,
        summary: 'تغيير حالة العميل ${c.name} إلى ${status.label}',
        oldValues: {'status': old.status.index},
        newValues: {'status': status.index},
      );
    });
  }

  Future<void> deleteCustomer(String id) {
    final c = _customer(id);
    if (!db.customerBalance(id).isZero) {
      throw const DomainException(
        ErrorCodes.hasBalance,
        'لا يمكن حذف عميل عليه رصيد. صفّر الحساب أولاً',
      );
    }
    return db.run(() {
      db.putCustomer(c.copyWith(deletedAt: DateTime.now()));
      db.log(
        action: AuditAction.delete,
        entityType: 'customer',
        entityId: id,
        summary: 'حذف عميل: ${c.name}',
      );
    });
  }

  /// Records a debt. Throws `CREDIT_LIMIT_EXCEEDED` unless [approveOverLimit].
  Future<PartyTx> addCustomerDebt(
    String customerId,
    Money amount, {
    String? notes,
    DateTime? date,
    bool approveOverLimit = false,
    RefType refType = RefType.manual,
    String? refId,
  }) {
    final c = _customer(customerId);
    _requirePositive(amount);
    if (c.status == CustomerStatus.frozen) {
      throw const DomainException(
        ErrorCodes.customerFrozen,
        'العميل مجمّد — لا يمكن تسجيل دين',
      );
    }
    final before = db.customerBalance(customerId);
    final after = before + amount;
    checkCreditLimit(c, after, approveOverLimit: approveOverLimit);
    return db.run(() {
      final now = DateTime.now();
      final t = PartyTx(
        id: IdGen.next(),
        partyId: customerId,
        type: PartyTxType.debt,
        amount: amount,
        balanceBefore: before,
        balanceAfter: after,
        notes: _clean(notes),
        refType: refType,
        refId: refId,
        txDate: date ?? now,
        createdAt: now,
      );
      db.putCustomerTx(t);
      db.log(
        action: AuditAction.create,
        entityType: 'customer_tx',
        entityId: t.id,
        summary: 'دين على ${c.name}: ${amount.format()}',
        newValues: {'amount': amount.minor, 'after': after.minor},
        amount: amount,
      );
      return t;
    });
  }

  /// Throws when [after] exceeds the customer's limit and not approved.
  void checkCreditLimit(
    Customer c,
    Money after, {
    required bool approveOverLimit,
  }) {
    final limit = c.creditLimit;
    if (limit != null && after > limit && !approveOverLimit) {
      throw DomainException(
        ErrorCodes.creditLimitExceeded,
        'تجاوز سقف الدين (${limit.format()}) — الرصيد سيصبح ${after.format()}',
        meta: {'limit': limit.minor, 'after': after.minor},
      );
    }
  }

  Future<PartyTx> addCustomerPayment(
    String customerId,
    Money amount, {
    String? notes,
    DateTime? date,
  }) {
    final c = _customer(customerId);
    _requirePositive(amount);
    final before = db.customerBalance(customerId);
    final after = before - amount;
    return db.run(() {
      final now = DateTime.now();
      final t = PartyTx(
        id: IdGen.next(),
        partyId: customerId,
        type: PartyTxType.payment,
        amount: amount,
        balanceBefore: before,
        balanceAfter: after,
        notes: _clean(notes),
        txDate: date ?? now,
        createdAt: now,
      );
      db.putCustomerTx(t);
      if (c.status == CustomerStatus.gracePeriod && after <= Money.zero) {
        db.putCustomer(
          c.copyWith(status: CustomerStatus.active, clearGrace: true),
        );
      }
      db.log(
        action: AuditAction.create,
        entityType: 'customer_tx',
        entityId: t.id,
        summary: 'سداد من ${c.name}: ${amount.format()}',
        newValues: {'amount': amount.minor, 'after': after.minor},
        amount: amount,
      );
      return t;
    });
  }

  Future<PartyTx> addCustomerAdjustment(
    String customerId,
    Money signedAmount, {
    required String reason,
  }) {
    final c = _customer(customerId);
    if (signedAmount.isZero) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'مبلغ التسوية لا يمكن أن يكون صفراً',
      );
    }
    if (reason.trim().isEmpty) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'سبب التسوية مطلوب',
      );
    }
    final before = db.customerBalance(customerId);
    return db.run(() {
      final now = DateTime.now();
      final t = PartyTx(
        id: IdGen.next(),
        partyId: customerId,
        type: PartyTxType.adjustment,
        amount: signedAmount,
        balanceBefore: before,
        balanceAfter: before + signedAmount,
        notes: reason.trim(),
        txDate: now,
        createdAt: now,
      );
      db.putCustomerTx(t);
      db.log(
        action: AuditAction.update,
        entityType: 'customer_tx',
        entityId: t.id,
        summary: 'تسوية حساب ${c.name}: ${signedAmount.format()}',
        newValues: {'amount': signedAmount.minor, 'reason': reason},
      );
      return t;
    });
  }

  /// Writes an adjustment that brings the balance to exactly zero.
  Future<PartyTx?> clearCustomerBalance(String customerId, String reason) {
    final bal = db.customerBalance(customerId);
    if (bal.isZero) return Future.value(null);
    return addCustomerAdjustment(customerId, -bal, reason: reason);
  }

  Future<void> cancelCustomerTx(String txId, String reason) {
    final t = db.customerTx[txId];
    if (t == null) {
      throw const DomainException(ErrorCodes.notFound, 'الحركة غير موجودة');
    }
    _assertCancellable(t, reason);
    if (t.refType != RefType.manual) {
      throw const DomainException(
        ErrorCodes.alreadyCancelled,
        'هذه الحركة مرتبطة بفاتورة — ألغِ الفاتورة نفسها',
      );
    }
    final c = _customer(t.partyId);
    return db.run(() {
      db.putCustomerTx(t.cancelled(reason.trim(), DateTime.now()));
      db.log(
        action: AuditAction.cancel,
        entityType: 'customer_tx',
        entityId: txId,
        summary: 'إلغاء ${t.type.label} (${t.amount.format()}) لـ ${c.name}',
        oldValues: t.toMap(),
        newValues: {'reason': reason},
      );
    });
  }

  // ═══════════════════════ SUPPLIERS ═══════════════════════

  Future<Supplier> createSupplier({
    required String name,
    String? phone,
    String? address,
    String? notes,
    Money openingBalance = Money.zero,
  }) {
    final n = name.trim();
    if (n.isEmpty) {
      throw const DomainException(ErrorCodes.invalidAmount, 'اسم المورد مطلوب');
    }
    return db.run(() {
      final now = DateTime.now();
      final s = Supplier(
        id: IdGen.next(),
        name: n,
        phone: _clean(phone),
        address: _clean(address),
        notes: _clean(notes),
        openingBalance: openingBalance,
        createdAt: now,
        updatedAt: now,
      );
      db.putSupplier(s);
      if (!openingBalance.isZero) {
        db.putSupplierTx(
          PartyTx(
            id: IdGen.next(),
            partyId: s.id,
            type: PartyTxType.opening,
            amount: openingBalance,
            balanceBefore: Money.zero,
            balanceAfter: openingBalance,
            notes: 'رصيد افتتاحي',
            txDate: now,
            createdAt: now,
          ),
        );
      }
      db.log(
        action: AuditAction.create,
        entityType: 'supplier',
        entityId: s.id,
        summary: 'إضافة مورد: $n',
      );
      return s;
    });
  }

  Future<Supplier> updateSupplier(
    String id, {
    String? name,
    String? phone,
    String? address,
    String? notes,
  }) {
    final old = _supplier(id);
    if (name != null && name.trim().isEmpty) {
      throw const DomainException(ErrorCodes.invalidAmount, 'اسم المورد مطلوب');
    }
    return db.run(() {
      final s = old.copyWith(
        name: name?.trim(),
        phone: phone?.trim(),
        address: address?.trim(),
        notes: notes?.trim(),
      );
      db.putSupplier(s);
      db.log(
        action: AuditAction.update,
        entityType: 'supplier',
        entityId: id,
        summary: 'تعديل مورد: ${s.name}',
        oldValues: old.toMap(),
        newValues: s.toMap(),
      );
      return s;
    });
  }

  Future<void> deleteSupplier(String id) {
    final s = _supplier(id);
    if (!db.supplierBalance(id).isZero) {
      throw const DomainException(
        ErrorCodes.hasBalance,
        'لا يمكن حذف مورد له رصيد. سدّد أو سوِّ الحساب أولاً',
      );
    }
    return db.run(() {
      db.putSupplier(s.copyWith(deletedAt: DateTime.now()));
      db.log(
        action: AuditAction.delete,
        entityType: 'supplier',
        entityId: id,
        summary: 'حذف مورد: ${s.name}',
      );
    });
  }

  /// Raises what we owe the supplier (used by credit purchases).
  Future<PartyTx> addSupplierDebt(
    String supplierId,
    Money amount, {
    String? notes,
    DateTime? date,
    RefType refType = RefType.manual,
    String? refId,
  }) {
    final s = _supplier(supplierId);
    _requirePositive(amount);
    final before = db.supplierBalance(supplierId);
    return db.run(() {
      final now = DateTime.now();
      final t = PartyTx(
        id: IdGen.next(),
        partyId: supplierId,
        type: PartyTxType.debt,
        amount: amount,
        balanceBefore: before,
        balanceAfter: before + amount,
        notes: _clean(notes),
        refType: refType,
        refId: refId,
        txDate: date ?? now,
        createdAt: now,
      );
      db.putSupplierTx(t);
      db.log(
        action: AuditAction.create,
        entityType: 'supplier_tx',
        entityId: t.id,
        summary: 'دين للمورد ${s.name}: ${amount.format()}',
        amount: amount,
      );
      return t;
    });
  }

  /// Pays a supplier. **Single path**: always creates an Expense of type
  /// `supplierPayment` plus a linked supplier ledger row, so the payment
  /// appears in cash-flow exactly once.
  Future<Expense> paySupplier(
    String supplierId,
    Money amount, {
    String? notes,
    DateTime? date,
  }) {
    final s = _supplier(supplierId);
    _requirePositive(amount);
    final before = db.supplierBalance(supplierId);
    return db.run(() {
      final now = DateTime.now();
      final e = Expense(
        id: IdGen.next(),
        type: ExpenseType.supplierPayment,
        supplierId: supplierId,
        amount: amount,
        details: _clean(notes) ?? 'دفعة للمورد ${s.name}',
        expenseDate: date ?? now,
        createdAt: now,
      );
      db.putExpense(e);
      db.putSupplierTx(
        PartyTx(
          id: IdGen.next(),
          partyId: supplierId,
          type: PartyTxType.payment,
          amount: amount,
          balanceBefore: before,
          balanceAfter: before - amount,
          notes: _clean(notes),
          refType: RefType.expense,
          refId: e.id,
          txDate: date ?? now,
          createdAt: now,
        ),
      );
      db.log(
        action: AuditAction.create,
        entityType: 'expense',
        entityId: e.id,
        summary: 'دفعة للمورد ${s.name}: ${amount.format()}',
        amount: amount,
      );
      return e;
    });
  }

  Future<PartyTx> addSupplierAdjustment(
    String supplierId,
    Money signedAmount, {
    required String reason,
  }) {
    final s = _supplier(supplierId);
    if (signedAmount.isZero) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'مبلغ التسوية لا يمكن أن يكون صفراً',
      );
    }
    if (reason.trim().isEmpty) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'سبب التسوية مطلوب',
      );
    }
    final before = db.supplierBalance(supplierId);
    return db.run(() {
      final now = DateTime.now();
      final t = PartyTx(
        id: IdGen.next(),
        partyId: supplierId,
        type: PartyTxType.adjustment,
        amount: signedAmount,
        balanceBefore: before,
        balanceAfter: before + signedAmount,
        notes: reason.trim(),
        txDate: now,
        createdAt: now,
      );
      db.putSupplierTx(t);
      db.log(
        action: AuditAction.update,
        entityType: 'supplier_tx',
        entityId: t.id,
        summary: 'تسوية حساب المورد ${s.name}: ${signedAmount.format()}',
      );
      return t;
    });
  }

  Future<void> cancelSupplierTx(String txId, String reason) {
    final t = db.supplierTx[txId];
    if (t == null) {
      throw const DomainException(ErrorCodes.notFound, 'الحركة غير موجودة');
    }
    _assertCancellable(t, reason);
    if (t.refType != RefType.manual) {
      throw const DomainException(
        ErrorCodes.alreadyCancelled,
        'هذه الحركة مرتبطة بفاتورة/مصروف — ألغِ المستند نفسه',
      );
    }
    final s = _supplier(t.partyId);
    return db.run(() {
      db.putSupplierTx(t.cancelled(reason.trim(), DateTime.now()));
      db.log(
        action: AuditAction.cancel,
        entityType: 'supplier_tx',
        entityId: txId,
        summary:
            'إلغاء ${t.type.label} (${t.amount.format()}) للمورد ${s.name}',
        oldValues: t.toMap(),
      );
    });
  }

  // ═══════════════════════ helpers ═══════════════════════

  Customer _customer(String id) {
    final c = db.customers[id];
    if (c == null || c.isDeleted) {
      throw const DomainException(ErrorCodes.notFound, 'العميل غير موجود');
    }
    return c;
  }

  Supplier _supplier(String id) {
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

  void _assertCancellable(PartyTx t, String reason) {
    if (t.isCancelled) {
      throw const DomainException(
        ErrorCodes.alreadyCancelled,
        'الحركة ملغاة مسبقاً',
      );
    }
    if (t.type == PartyTxType.opening) {
      throw const DomainException(
        ErrorCodes.openingProtected,
        'لا يمكن إلغاء الرصيد الافتتاحي',
      );
    }
    if (reason.trim().isEmpty) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'سبب الإلغاء مطلوب',
      );
    }
  }

  static String? _clean(String? s) {
    final t = s?.trim();
    return (t == null || t.isEmpty) ? null : t;
  }
}
