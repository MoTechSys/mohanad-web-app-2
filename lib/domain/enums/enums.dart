// Domain enumerations. Stored in Hive by `index` — **append only**,
// never reorder or remove members.

enum CustomerStatus {
  active('نشط'),
  frozen('مجمّد'),
  gracePeriod('مهلة');

  const CustomerStatus(this.label);
  final String label;
}

enum PartyTxType {
  /// Increases what the party owes (customer debt / our debt to supplier).
  debt('دين'),

  /// Decreases the balance.
  payment('سداد'),

  /// Signed manual correction.
  adjustment('تسوية'),

  /// Opening balance; cannot be cancelled.
  opening('رصيد افتتاحي');

  const PartyTxType(this.label);
  final String label;
}

enum PaymentType {
  cash('نقدي'),
  credit('آجل');

  const PaymentType(this.label);
  final String label;
}

enum DocMode {
  totalOnly('إجمالي'),
  detailedItems('تفصيلي');

  const DocMode(this.label);
  final String label;
}

enum ExpenseType {
  /// Operational expense (rent, electricity, salaries…). Counts in P&L.
  normal('مصروف تشغيلي'),

  /// Payment to a supplier against outstanding debt. NOT an operating
  /// expense (it settles a liability). Counts in cash-flow only.
  supplierPayment('دفعة لمورد'),

  /// Cash purchase of goods. Counts as COGS proxy in estimated P&L,
  /// cash-out in cash-flow.
  cashPurchase('شراء نقدي'),

  other('أخرى');

  const ExpenseType(this.label);
  final String label;
}

enum ProductStatus {
  active('نشط'),
  paused('موقوف'),
  archived('مؤرشف');

  const ProductStatus(this.label);
  final String label;
}

enum StockMoveType {
  inbound('وارد'),
  outbound('صادر'),
  adjustment('تعديل'),
  returned('مرتجع'),
  loss('تالف/خسارة');

  const StockMoveType(this.label);
  final String label;
}

enum RefType {
  manual,
  sale,
  saleCancel,
  purchase,
  purchaseCancel,
  expense,
  expenseCancel,
}

enum AuditAction {
  create('إنشاء'),
  update('تعديل'),
  cancel('إلغاء'),
  delete('حذف'),
  restore('استعادة'),
  settings('إعدادات');

  const AuditAction(this.label);
  final String label;
}

enum ProfitMode {
  /// Revenue − COGS (from sale item cost snapshots) − operating expenses.
  accurate('دقيق (من بنود البيع)'),

  /// Revenue (sales + daily income) − cash purchases − operating expenses.
  estimated('تقديري (المشتريات كتكلفة)');

  const ProfitMode(this.label);
  final String label;
}
