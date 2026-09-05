import '../../core/money/money.dart';
import 'serde.dart';

/// وردية صندوق (شفت عامل): تُفتح برصيد افتتاحي وتُغلق بجردٍ فعلي.
///
/// **قاعدة الاشتقاق**: حركات الوردية (مبيعات نقدية، مقبوضات، مصروفات…) لا
/// تُخزَّن هنا؛ تُحسب من الدفاتر خلال نافذة [openedAt → closedAt]. السجل
/// append-only: لا حذف، والإغلاق يجمّد الوردية نهائيًا.
class CashSession {
  const CashSession({
    required this.id,
    required this.sessionNo,
    required this.workerName,
    required this.openingCash,
    required this.openedAt,
    this.notes,
    this.closedAt,
    this.countedCash,
    this.expectedCash,
    this.closeNotes,
  });

  final String id;

  /// رقم متسلسل بشري: Z-0001 …
  final String sessionNo;
  final String workerName;
  final Money openingCash;
  final DateTime openedAt;
  final String? notes;

  // ── حقول الإغلاق (null = الوردية مفتوحة) ──
  final DateTime? closedAt;

  /// النقد المعدود فعليًا عند الإغلاق.
  final Money? countedCash;

  /// النقد المتوقع لحظة الإغلاق (يُجمَّد كي لا يتغير التقرير لاحقًا).
  final Money? expectedCash;
  final String? closeNotes;

  bool get isOpen => closedAt == null;

  /// الفرق = المعدود − المتوقع (موجب: زيادة، سالب: عجز).
  Money? get difference => (countedCash != null && expectedCash != null)
      ? countedCash! - expectedCash!
      : null;

  CashSession closed({
    required DateTime at,
    required Money counted,
    required Money expected,
    String? notes,
  }) => CashSession(
    id: id,
    sessionNo: sessionNo,
    workerName: workerName,
    openingCash: openingCash,
    openedAt: openedAt,
    notes: this.notes,
    closedAt: at,
    countedCash: counted,
    expectedCash: expected,
    closeNotes: notes,
  );

  Map<String, dynamic> toMap() => {
    'id': id,
    'session_no': sessionNo,
    'worker_name': workerName,
    'opening_cash': openingCash.minor,
    'opened_at': Serde.dt(openedAt),
    'notes': notes,
    'closed_at': Serde.dt(closedAt),
    'counted_cash': countedCash?.minor,
    'expected_cash': expectedCash?.minor,
    'close_notes': closeNotes,
  };

  factory CashSession.fromMap(Map<String, dynamic> m) => CashSession(
    id: m['id'] as String,
    sessionNo: m['session_no'] as String,
    workerName: m['worker_name'] as String,
    openingCash: Serde.moneyReq(m['opening_cash']),
    openedAt: Serde.dtReq(m['opened_at']),
    notes: m['notes'] as String?,
    closedAt: Serde.dtFrom(m['closed_at']),
    countedCash: Serde.moneyOpt(m['counted_cash']),
    expectedCash: Serde.moneyOpt(m['expected_cash']),
    closeNotes: m['close_notes'] as String?,
  );
}

/// ملخص تقرير Z لوردية: كل الأرقام مشتقة من الدفاتر خلال نافذة الوردية.
class ZReport {
  const ZReport({
    required this.session,
    required this.until,
    required this.cashSales,
    required this.cashSalesCount,
    required this.creditSales,
    required this.creditSalesCount,
    required this.customerPayments,
    required this.otherReceipts,
    required this.dailyIncome,
    required this.expenses,
    required this.expensesCount,
  });

  final CashSession session;
  final DateTime until;

  /// مبيعات نقدية (تدخل الدرج).
  final Money cashSales;
  final int cashSalesCount;

  /// مبيعات آجلة (معلومة فقط — لا تدخل الدرج).
  final Money creditSales;
  final int creditSalesCount;

  /// سدادات العملاء (يدوية + سندات قبض لعملاء).
  final Money customerPayments;

  /// سندات قبض لأطراف خارجية (بدون عميل).
  final Money otherReceipts;

  /// دخل يومي مسجَّل إجماليًا.
  final Money dailyIncome;

  /// كل المصروفات النشطة (تشمل سداد الموردين وسندات الصرف والمشتريات النقدية).
  final Money expenses;
  final int expensesCount;

  Money get cashIn =>
      cashSales + customerPayments + otherReceipts + dailyIncome;
  Money get cashOut => expenses;

  /// النقد المتوقع في الدرج = الافتتاحي + الداخل − الخارج.
  Money get expectedCash => session.openingCash + cashIn - cashOut;
}
