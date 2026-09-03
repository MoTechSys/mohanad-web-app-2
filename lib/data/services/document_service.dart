import '../../core/errors/domain_exception.dart';
import '../../core/ids/id_gen.dart';
import '../../core/money/money.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/documents.dart';
import '../../domain/models/party.dart';
import '../ledger_db.dart';
import 'inventory_service.dart';
import 'party_service.dart';

/// Sales, purchases, expenses and daily income.
///
/// Every operation validates fully **before** the first write, then applies
/// all side effects (party ledger, stock ledger, linked expense, audit) in a
/// single unit of work so the books always balance.
class DocumentService {
  DocumentService(this.db, this.parties, this.inventory);
  final LedgerDb db;
  final PartyService parties;
  final InventoryService inventory;

  // ═══════════════════════ SALES ═══════════════════════

  Future<Sale> createSale({
    String? customerId,
    required PaymentType paymentType,
    DocMode mode = DocMode.totalOnly,
    Money? totalAmount,
    List<DocLine> lines = const [],
    Money discount = Money.zero,
    String? details,
    String? invoiceNo,
    DateTime? date,
    bool approveOverLimit = false,
  }) {
    // ── validate ──
    if (discount.isNegative) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'الخصم لا يمكن أن يكون سالباً',
      );
    }
    final Money gross;
    var cost = Money.zero;
    List<DocLine> finalLines = const [];
    if (mode == DocMode.detailedItems) {
      if (lines.isEmpty) {
        throw const DomainException(
          ErrorCodes.itemsRequired,
          'يجب إضافة صنف واحد على الأقل',
        );
      }
      finalLines = lines.map(_snapshotSaleLine).toList();
      var g = Money.zero;
      for (final l in finalLines) {
        if (!l.qty.isPositive) {
          throw const DomainException(
            ErrorCodes.invalidQuantity,
            'كمية الصنف يجب أن تكون أكبر من الصفر',
          );
        }
        if (l.unitPrice.isNegative) {
          throw const DomainException(
            ErrorCodes.invalidAmount,
            'سعر الصنف لا يمكن أن يكون سالباً',
          );
        }
        g = g + l.lineTotal;
        cost = cost + l.lineCost;
      }
      gross = g;
    } else {
      if (totalAmount == null || !totalAmount.isPositive) {
        throw const DomainException(
          ErrorCodes.invalidAmount,
          'المبلغ يجب أن يكون أكبر من الصفر',
        );
      }
      gross = totalAmount;
    }
    final net = gross - discount;
    if (net.isNegative) {
      throw const DomainException(
        ErrorCodes.negativeNet,
        'الخصم أكبر من قيمة الفاتورة',
      );
    }
    Customer? customer;
    if (customerId != null) {
      customer = db.customers[customerId];
      if (customer == null || customer.isDeleted) {
        throw const DomainException(ErrorCodes.notFound, 'العميل غير موجود');
      }
    }
    if (paymentType == PaymentType.credit) {
      if (customer == null) {
        throw const DomainException(
          ErrorCodes.customerRequired,
          'البيع الآجل يتطلب تحديد العميل',
        );
      }
      if (customer.status == CustomerStatus.frozen) {
        throw const DomainException(
          ErrorCodes.customerFrozen,
          'العميل مجمّد — لا يمكن البيع بالأجل',
        );
      }
      parties.checkCreditLimit(
        customer,
        db.customerBalance(customer.id) + net,
        approveOverLimit: approveOverLimit,
      );
    }
    final inv = invoiceNo?.trim();
    if (inv != null && inv.isNotEmpty) {
      final dup = db.sales.values.any((s) => s.isActive && s.invoiceNo == inv);
      if (dup) {
        throw const DomainException(
          ErrorCodes.duplicate,
          'رقم الفاتورة مستخدم مسبقاً',
        );
      }
    }

    // ── apply ──
    return db.run(() {
      final now = DateTime.now();
      final sale = Sale(
        id: IdGen.next(),
        customerId: customerId,
        mode: mode,
        paymentType: paymentType,
        grossAmount: gross,
        discount: discount,
        netAmount: net,
        costAmount: cost,
        details: _clean(details),
        invoiceNo: (inv == null || inv.isEmpty) ? null : inv,
        saleDate: date ?? now,
        createdAt: now,
        lines: finalLines,
      );
      db.putSale(sale);

      if (paymentType == PaymentType.credit && !net.isZero) {
        final before = db.customerBalance(customer!.id);
        db.putCustomerTx(
          PartyTx(
            id: IdGen.next(),
            partyId: customer.id,
            type: PartyTxType.debt,
            amount: net,
            balanceBefore: before,
            balanceAfter: before + net,
            notes: 'فاتورة بيع${sale.invoiceNo != null ? ' #${sale.invoiceNo}' : ''}',
            refType: RefType.sale,
            refId: sale.id,
            txDate: sale.saleDate,
            createdAt: now,
          ),
        );
      }
      for (final l in finalLines) {
        if (l.productId != null) {
          inventory.applyDocumentMove(
            l.productId!,
            StockMoveType.outbound,
            -l.qty,
            refType: RefType.sale,
            refId: sale.id,
            now: now,
            notes: 'بيع',
          );
        }
      }
      db.log(
        action: AuditAction.create,
        entityType: 'sale',
        entityId: sale.id,
        summary:
            'فاتورة بيع ${paymentType.label}${customer != null ? ' — ${customer.name}' : ''}: ${net.format()}',
        newValues: {'net': net.minor, 'mode': mode.index},
        amount: net,
      );
      return sale;
    });
  }

  DocLine _snapshotSaleLine(DocLine l) {
    if (l.productId == null) return l;
    final p = db.products[l.productId];
    if (p == null) return l;
    return DocLine(
      productId: l.productId,
      name: l.name.trim().isEmpty ? p.name : l.name,
      qty: l.qty,
      unitPrice: l.unitPrice,
      unitCost: l.unitCost.isZero ? p.purchasePrice : l.unitCost,
    );
  }

  Future<void> cancelSale(String id, String? reason) {
    final sale = db.sales[id];
    if (sale == null) {
      throw const DomainException(ErrorCodes.notFound, 'الفاتورة غير موجودة');
    }
    if (sale.isCancelled) {
      throw const DomainException(
        ErrorCodes.alreadyCancelled,
        'الفاتورة ملغاة مسبقاً',
      );
    }
    return db.run(() {
      final now = DateTime.now();
      db.putSale(sale.cancelled(_clean(reason), now));
      // Reverse the debt: cancel the linked ledger row (keeps history).
      for (final t in db.customerTx.values.toList()) {
        if (t.refType == RefType.sale && t.refId == id && t.isActive) {
          db.putCustomerTx(t.cancelled('إلغاء فاتورة بيع', now));
        }
      }
      for (final m in db.stockMoves.values.toList()) {
        if (m.refType == RefType.sale && m.refId == id && m.isActive) {
          db.putStockMove(m.cancelled('إلغاء فاتورة بيع', now));
        }
      }
      db.log(
        action: AuditAction.cancel,
        entityType: 'sale',
        entityId: id,
        summary: 'إلغاء فاتورة بيع (${sale.netAmount.format()})',
        oldValues: {'net': sale.netAmount.minor},
        newValues: {'reason': reason},
      );
    });
  }

  // ═══════════════════════ PURCHASES ═══════════════════════

  Future<Purchase> createPurchase({
    String? supplierId,
    String? supplierNameManual,
    required PaymentType paymentType,
    DocMode mode = DocMode.totalOnly,
    Money? totalAmount,
    List<DocLine> lines = const [],
    String? details,
    String? invoiceNo,
    DateTime? date,
  }) {
    final Money total;
    List<DocLine> finalLines = const [];
    if (mode == DocMode.detailedItems) {
      if (lines.isEmpty) {
        throw const DomainException(
          ErrorCodes.itemsRequired,
          'يجب إضافة صنف واحد على الأقل',
        );
      }
      var t = Money.zero;
      for (final l in lines) {
        if (!l.qty.isPositive) {
          throw const DomainException(
            ErrorCodes.invalidQuantity,
            'كمية الصنف يجب أن تكون أكبر من الصفر',
          );
        }
        if (l.unitPrice.isNegative) {
          throw const DomainException(
            ErrorCodes.invalidAmount,
            'تكلفة الصنف لا يمكن أن تكون سالبة',
          );
        }
        t = t + l.lineTotal;
      }
      total = t;
      finalLines = lines;
    } else {
      if (totalAmount == null || !totalAmount.isPositive) {
        throw const DomainException(
          ErrorCodes.invalidAmount,
          'المبلغ يجب أن يكون أكبر من الصفر',
        );
      }
      total = totalAmount;
    }
    Supplier? supplier;
    if (supplierId != null) {
      supplier = db.suppliers[supplierId];
      if (supplier == null || supplier.isDeleted) {
        throw const DomainException(ErrorCodes.notFound, 'المورد غير موجود');
      }
    }
    if (paymentType == PaymentType.credit && supplier == null) {
      throw const DomainException(
        ErrorCodes.supplierRequired,
        'الشراء الآجل يتطلب تحديد المورد',
      );
    }

    return db.run(() {
      final now = DateTime.now();
      final p = Purchase(
        id: IdGen.next(),
        supplierId: supplierId,
        supplierNameManual: _clean(supplierNameManual),
        mode: mode,
        paymentType: paymentType,
        totalAmount: total,
        details: _clean(details),
        invoiceNo: _clean(invoiceNo),
        purchaseDate: date ?? now,
        createdAt: now,
        lines: finalLines,
      );
      db.putPurchase(p);

      if (paymentType == PaymentType.credit) {
        final before = db.supplierBalance(supplier!.id);
        db.putSupplierTx(
          PartyTx(
            id: IdGen.next(),
            partyId: supplier.id,
            type: PartyTxType.debt,
            amount: total,
            balanceBefore: before,
            balanceAfter: before + total,
            notes: 'شراء آجل${p.invoiceNo != null ? ' #${p.invoiceNo}' : ''}',
            refType: RefType.purchase,
            refId: p.id,
            txDate: p.purchaseDate,
            createdAt: now,
          ),
        );
      } else {
        db.putExpense(
          Expense(
            id: IdGen.next(),
            type: ExpenseType.cashPurchase,
            supplierId: supplierId,
            purchaseId: p.id,
            amount: total,
            details:
                _clean(details) ??
                'شراء نقدي${supplier != null ? ' — ${supplier.name}' : ''}',
            expenseDate: p.purchaseDate,
            createdAt: now,
          ),
        );
      }
      // Fix for legacy gap: detailed purchases DO raise stock.
      for (final l in finalLines) {
        if (l.productId != null) {
          inventory.applyDocumentMove(
            l.productId!,
            StockMoveType.inbound,
            l.qty,
            refType: RefType.purchase,
            refId: p.id,
            now: now,
            notes: 'شراء',
          );
          // Keep last purchase cost current for future COGS snapshots.
          final prod = db.products[l.productId];
          if (prod != null && !prod.isDeleted && prod.purchasePrice != l.unitPrice) {
            db.putProduct(prod.copyWith(purchasePrice: l.unitPrice));
          }
        }
      }
      db.log(
        action: AuditAction.create,
        entityType: 'purchase',
        entityId: p.id,
        summary:
            'فاتورة شراء ${paymentType.label}${supplier != null ? ' — ${supplier.name}' : ''}: ${total.format()}',
        amount: total,
      );
      return p;
    });
  }

  Future<void> cancelPurchase(String id, String? reason) {
    final p = db.purchases[id];
    if (p == null) {
      throw const DomainException(ErrorCodes.notFound, 'الفاتورة غير موجودة');
    }
    if (p.isCancelled) {
      throw const DomainException(
        ErrorCodes.alreadyCancelled,
        'الفاتورة ملغاة مسبقاً',
      );
    }
    return db.run(() {
      final now = DateTime.now();
      db.putPurchase(p.cancelled(_clean(reason), now));
      for (final t in db.supplierTx.values.toList()) {
        if (t.refType == RefType.purchase && t.refId == id && t.isActive) {
          db.putSupplierTx(t.cancelled('إلغاء فاتورة شراء', now));
        }
      }
      for (final e in db.expenses.values.toList()) {
        if (e.purchaseId == id && e.isActive) {
          db.putExpense(e.cancelled('إلغاء فاتورة شراء', now));
        }
      }
      for (final m in db.stockMoves.values.toList()) {
        if (m.refType == RefType.purchase && m.refId == id && m.isActive) {
          db.putStockMove(m.cancelled('إلغاء فاتورة شراء', now));
        }
      }
      db.log(
        action: AuditAction.cancel,
        entityType: 'purchase',
        entityId: id,
        summary: 'إلغاء فاتورة شراء (${p.totalAmount.format()})',
        newValues: {'reason': reason},
      );
    });
  }

  // ═══════════════════════ EXPENSES ═══════════════════════

  /// Operating / other expense. Supplier payments go through
  /// [PartyService.paySupplier]; cash purchases through [createPurchase].
  Future<Expense> createExpense({
    required Money amount,
    ExpenseType type = ExpenseType.normal,
    String? categoryId,
    String? details,
    DateTime? date,
  }) {
    if (!amount.isPositive) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'المبلغ يجب أن يكون أكبر من الصفر',
      );
    }
    if (type == ExpenseType.supplierPayment || type == ExpenseType.cashPurchase) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'استخدم شاشة الموردين/المشتريات لهذا النوع',
      );
    }
    if (categoryId != null && !db.categories.containsKey(categoryId)) {
      throw const DomainException(ErrorCodes.notFound, 'التصنيف غير موجود');
    }
    return db.run(() {
      final now = DateTime.now();
      final e = Expense(
        id: IdGen.next(),
        type: type,
        categoryId: categoryId,
        amount: amount,
        details: _clean(details),
        expenseDate: date ?? now,
        createdAt: now,
      );
      db.putExpense(e);
      final cat = categoryId == null ? null : db.categories[categoryId]?.name;
      db.log(
        action: AuditAction.create,
        entityType: 'expense',
        entityId: e.id,
        summary: 'مصروف${cat != null ? ' ($cat)' : ''}: ${amount.format()}',
        amount: amount,
      );
      return e;
    });
  }

  Future<void> cancelExpense(String id, String? reason) {
    final e = db.expenses[id];
    if (e == null) {
      throw const DomainException(ErrorCodes.notFound, 'المصروف غير موجود');
    }
    if (e.isCancelled) {
      throw const DomainException(
        ErrorCodes.alreadyCancelled,
        'المصروف ملغى مسبقاً',
      );
    }
    if (e.purchaseId != null) {
      throw const DomainException(
        ErrorCodes.alreadyCancelled,
        'هذا المصروف مرتبط بفاتورة شراء — ألغِ الفاتورة نفسها',
      );
    }
    return db.run(() {
      final now = DateTime.now();
      db.putExpense(e.cancelled(_clean(reason), now));
      // Supplier payment → reverse the ledger row too.
      if (e.type == ExpenseType.supplierPayment) {
        for (final t in db.supplierTx.values.toList()) {
          if (t.refType == RefType.expense && t.refId == id && t.isActive) {
            db.putSupplierTx(t.cancelled('إلغاء دفعة', now));
          }
        }
      }
      db.log(
        action: AuditAction.cancel,
        entityType: 'expense',
        entityId: id,
        summary: 'إلغاء ${e.type.label} (${e.amount.format()})',
        newValues: {'reason': reason},
      );
    });
  }

  Future<ExpenseCategory> createCategory(String name) {
    final n = name.trim();
    if (n.isEmpty) {
      throw const DomainException(ErrorCodes.invalidAmount, 'اسم التصنيف مطلوب');
    }
    if (db.categories.values.any((c) => c.isActive && c.name == n)) {
      throw const DomainException(ErrorCodes.duplicate, 'التصنيف موجود بالفعل');
    }
    return db.run(() {
      final c = ExpenseCategory(id: IdGen.next(), name: n);
      db.putCategory(c);
      return c;
    });
  }

  Future<void> deactivateCategory(String id) {
    final c = db.categories[id];
    if (c == null) {
      throw const DomainException(ErrorCodes.notFound, 'التصنيف غير موجود');
    }
    return db.run(() {
      db.putCategory(ExpenseCategory(id: c.id, name: c.name, isActive: false));
    });
  }

  // ═══════════════════════ DAILY INCOME ═══════════════════════

  Future<DailyIncome> createDailyIncome({
    required Money amount,
    Money? manualCogs,
    String? notes,
    DateTime? date,
  }) {
    if (!amount.isPositive) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'المبلغ يجب أن يكون أكبر من الصفر',
      );
    }
    if (manualCogs != null && manualCogs.isNegative) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'تكلفة البضاعة لا يمكن أن تكون سالبة',
      );
    }
    return db.run(() {
      final now = DateTime.now();
      final d = DailyIncome(
        id: IdGen.next(),
        amount: amount,
        manualCogs: manualCogs,
        notes: _clean(notes),
        incomeDate: date ?? now,
        createdAt: now,
      );
      db.putDailyIncome(d);
      db.log(
        action: AuditAction.create,
        entityType: 'daily_income',
        entityId: d.id,
        summary: 'دخل يومي: ${amount.format()}',
        amount: amount,
      );
      return d;
    });
  }

  Future<void> cancelDailyIncome(String id, String? reason) {
    final d = db.dailyIncomes[id];
    if (d == null) {
      throw const DomainException(ErrorCodes.notFound, 'السجل غير موجود');
    }
    if (d.isCancelled) {
      throw const DomainException(
        ErrorCodes.alreadyCancelled,
        'السجل ملغى مسبقاً',
      );
    }
    return db.run(() {
      db.putDailyIncome(d.cancelled(_clean(reason), DateTime.now()));
      db.log(
        action: AuditAction.cancel,
        entityType: 'daily_income',
        entityId: id,
        summary: 'إلغاء دخل يومي (${d.amount.format()})',
      );
    });
  }

  static String? _clean(String? s) {
    final t = s?.trim();
    return (t == null || t.isEmpty) ? null : t;
  }
}
