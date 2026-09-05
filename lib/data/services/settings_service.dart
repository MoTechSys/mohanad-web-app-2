import 'dart:convert';

import '../../core/errors/domain_exception.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/documents.dart';
import '../../domain/models/inventory.dart';
import '../../domain/models/party.dart';
import '../../domain/models/settings.dart';
import '../../domain/models/voucher.dart';
import '../ledger_db.dart';

/// Settings, backup (JSON export) and restore.
class SettingsService {
  SettingsService(this.db);
  final LedgerDb db;

  static const int backupVersion = 1;

  Future<void> update(AppSettings s) {
    if (s.storeName.trim().isEmpty) {
      throw const DomainException(ErrorCodes.invalidAmount, 'اسم المحل مطلوب');
    }
    final pin = s.pinCode;
    if (pin != null && !RegExp(r'^\d{4,6}$').hasMatch(pin)) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'رمز القفل يجب أن يكون 4 إلى 6 أرقام',
      );
    }
    final old = db.settings;
    return db.run(() {
      db.putSettings(s);
      db.log(
        action: AuditAction.settings,
        entityType: 'settings',
        entityId: 'main',
        summary: 'تعديل الإعدادات',
        oldValues: old.toMap()..remove('pinCode'),
        newValues: s.toMap()..remove('pinCode'),
      );
    });
  }

  /// Full JSON snapshot of every box.
  String exportJson() {
    final data = <String, dynamic>{
      'version': backupVersion,
      'exportedAt': DateTime.now().toUtc().toIso8601String(),
      'settings': db.settings.toMap(),
      'customers': db.customers.values.map((e) => e.toMap()).toList(),
      'suppliers': db.suppliers.values.map((e) => e.toMap()).toList(),
      'customerTx': db.customerTx.values.map((e) => e.toMap()).toList(),
      'supplierTx': db.supplierTx.values.map((e) => e.toMap()).toList(),
      'sales': db.sales.values.map((e) => e.toMap()).toList(),
      'purchases': db.purchases.values.map((e) => e.toMap()).toList(),
      'expenses': db.expenses.values.map((e) => e.toMap()).toList(),
      'categories': db.categories.values.map((e) => e.toMap()).toList(),
      'dailyIncomes': db.dailyIncomes.values.map((e) => e.toMap()).toList(),
      'products': db.products.values.map((e) => e.toMap()).toList(),
      'stockMoves': db.stockMoves.values.map((e) => e.toMap()).toList(),
      'audit': db.audit.values.map((e) => e.toMap()).toList(),
      // v2.1 — old backups without this key import fine (defaults to []).
      'vouchers': db.vouchers.values.map((e) => e.toMap()).toList(),
    };
    return jsonEncode(data);
  }

  /// Replaces **all** data with the backup. Validates before wiping.
  Future<void> importJson(String json) async {
    final Map<String, dynamic> data;
    try {
      data = jsonDecode(json) as Map<String, dynamic>;
    } catch (_) {
      throw const DomainException(ErrorCodes.invalidAmount, 'ملف النسخة غير صالح');
    }
    if (data['version'] != backupVersion) {
      throw const DomainException(
        ErrorCodes.invalidAmount,
        'إصدار النسخة الاحتياطية غير مدعوم',
      );
    }
    List<Map<String, dynamic>> rows(String k) =>
        ((data[k] as List?) ?? const []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

    // Parse everything first — throws before any destructive step.
    final customers = rows('customers').map(Customer.fromMap).toList();
    final suppliers = rows('suppliers').map(Supplier.fromMap).toList();
    final custTx = rows('customerTx').map(PartyTx.fromMap).toList();
    final supTx = rows('supplierTx').map(PartyTx.fromMap).toList();
    final sales = rows('sales').map(Sale.fromMap).toList();
    final purchases = rows('purchases').map(Purchase.fromMap).toList();
    final expenses = rows('expenses').map(Expense.fromMap).toList();
    final cats = rows('categories').map(ExpenseCategory.fromMap).toList();
    final incomes = rows('dailyIncomes').map(DailyIncome.fromMap).toList();
    final products = rows('products').map(Product.fromMap).toList();
    final moves = rows('stockMoves').map(StockMove.fromMap).toList();
    final audit = rows('audit').map(AuditEntry.fromMap).toList();
    final vouchers = rows('vouchers').map(Voucher.fromMap).toList();
    final settings = data['settings'] == null
        ? const AppSettings()
        : AppSettings.fromMap(Map<String, dynamic>.from(data['settings'] as Map));

    await db.wipeAll(seedDefaults: false);
    await db.run(() {
      customers.forEach(db.putCustomer);
      suppliers.forEach(db.putSupplier);
      custTx.forEach(db.putCustomerTx);
      supTx.forEach(db.putSupplierTx);
      sales.forEach(db.putSale);
      purchases.forEach(db.putPurchase);
      expenses.forEach(db.putExpense);
      cats.forEach(db.putCategory);
      incomes.forEach(db.putDailyIncome);
      products.forEach(db.putProduct);
      moves.forEach(db.putStockMove);
      audit.forEach(db.putAudit);
      vouchers.forEach(db.putVoucher);
      db.putSettings(settings);
      db.log(
        action: AuditAction.restore,
        entityType: 'backup',
        entityId: 'main',
        summary: 'استعادة نسخة احتياطية',
      );
    });
  }
}
