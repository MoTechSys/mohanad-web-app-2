import '../../core/errors/domain_exception.dart';
import '../../core/ids/id_gen.dart';
import '../../core/money/money.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/cash_session.dart';
import '../ledger_db.dart';

/// ورديات الصندوق (م3): فتح وردية برصيد افتتاحي، إغلاق بجرد فعلي،
/// وتقرير Z مشتق بالكامل من الدفاتر خلال نافذة الوردية.
///
/// القواعد:
/// * وردية واحدة مفتوحة كحد أقصى (sessionOpen عند محاولة فتح ثانية).
/// * الإغلاق يجمّد «المتوقع» داخل السجل كي لا يتغير التقرير مع أي تعديل لاحق.
/// * لا حذف إطلاقًا — السجل append-only مثل باقي الدفاتر.
class CashSessionService {
  CashSessionService(this.db);
  final LedgerDb db;

  // ─────────────────────── queries ───────────────────────

  /// الوردية المفتوحة حاليًا (إن وجدت).
  CashSession? get openSession {
    for (final s in db.cashSessions.values) {
      if (s.isOpen) return s;
    }
    return null;
  }

  /// كل الورديات، الأحدث أولًا.
  List<CashSession> all() {
    final list = db.cashSessions.values.toList()
      ..sort((a, b) => b.openedAt.compareTo(a.openedAt));
    return list;
  }

  /// رقم متسلسل بشري Z-0001 — يفحص الكل، لا يُعاد استخدام رقم أبدًا.
  String nextSessionNo() {
    var maxN = 0;
    for (final s in db.cashSessions.values) {
      final n = int.tryParse(s.sessionNo.replaceFirst('Z-', '')) ?? 0;
      if (n > maxN) maxN = n;
    }
    return 'Z-${(maxN + 1).toString().padLeft(4, '0')}';
  }

  // ─────────────────────── open / close ───────────────────────

  /// فتح وردية جديدة. يرفض إن كانت هناك وردية مفتوحة.
  Future<CashSession> openShift({
    required String workerName,
    required Money openingCash,
    String? notes,
  }) {
    final w = workerName.trim();
    if (w.isEmpty) {
      throw const DomainException(
          ErrorCodes.invalidAmount, 'اسم العامل مطلوب');
    }
    if (openingCash.isNegative) {
      throw const DomainException(
          ErrorCodes.invalidAmount, 'الرصيد الافتتاحي لا يكون سالبًا');
    }
    final existing = openSession;
    if (existing != null) {
      throw DomainException(ErrorCodes.sessionOpen,
          'توجد وردية مفتوحة (${existing.sessionNo} — ${existing.workerName}). أغلقها أولًا.');
    }

    final no = nextSessionNo();
    return db.run(() {
      final s = CashSession(
        id: IdGen.next(),
        sessionNo: no,
        workerName: w,
        openingCash: openingCash,
        openedAt: DateTime.now(),
        notes: (notes ?? '').trim().isEmpty ? null : notes!.trim(),
      );
      db.putCashSession(s);
      db.log(
        action: AuditAction.create,
        entityType: 'cash_session',
        entityId: s.id,
        summary: 'فتح وردية ${s.sessionNo} — $w (افتتاحي ${openingCash.format()})',
      );
      return s;
    });
  }

  /// إغلاق الوردية بجرد فعلي [countedCash]. «المتوقع» يُحسب لحظة الإغلاق
  /// ويُجمَّد داخل السجل.
  Future<CashSession> closeShift(
    String id, {
    required Money countedCash,
    String? notes,
  }) {
    final s = db.cashSessions[id];
    if (s == null) {
      throw const DomainException(ErrorCodes.notFound, 'الوردية غير موجودة');
    }
    if (!s.isOpen) {
      throw const DomainException(
          ErrorCodes.sessionClosed, 'الوردية مغلقة مسبقًا');
    }
    if (countedCash.isNegative) {
      throw const DomainException(
          ErrorCodes.invalidAmount, 'النقد المعدود لا يكون سالبًا');
    }

    final now = DateTime.now();
    final report = zReport(s, until: now);
    return db.run(() {
      final closed = s.closed(
        at: now,
        counted: countedCash,
        expected: report.expectedCash,
        notes: (notes ?? '').trim().isEmpty ? null : notes!.trim(),
      );
      db.putCashSession(closed);
      final diff = closed.difference!;
      db.log(
        action: AuditAction.update,
        entityType: 'cash_session',
        entityId: s.id,
        summary: 'إغلاق وردية ${s.sessionNo} — معدود ${countedCash.format()}'
            '، متوقع ${report.expectedCash.format()}'
            '${diff.isZero ? ' (مطابق)' : '، فرق ${diff.format()}'}',
      );
      return closed;
    });
  }

  // ─────────────────────── Z report ───────────────────────

  /// تقرير Z للوردية: يجمع من الدفاتر كل ما وقع في نافذة
  /// [s.openedAt → until] (أو لحظة الإغلاق المجمَّدة للورديات المغلقة).
  ///
  /// نُدرج فقط القيود **النشطة** (غير الملغاة) — الإلغاء بعد إغلاق الوردية
  /// لا يغيّر «المتوقع» المجمَّد داخل السجل، لكنه يظهر في التقرير المعاد
  /// حسابه؛ لذلك المرجع الرسمي بعد الإغلاق هو الرقم المجمَّد.
  ZReport zReport(CashSession s, {DateTime? until}) {
    final from = s.openedAt;
    final to = s.closedAt ?? until ?? DateTime.now();
    bool inWin(DateTime d) => !d.isBefore(from) && !d.isAfter(to);

    var cashSales = Money.zero;
    var cashCount = 0;
    var creditSales = Money.zero;
    var creditCount = 0;
    for (final sale in db.sales.values) {
      if (!sale.isActive || !inWin(sale.createdAt)) continue;
      if (sale.paymentType == PaymentType.cash) {
        cashSales += sale.netAmount;
        cashCount++;
      } else {
        creditSales += sale.netAmount;
        creditCount++;
      }
    }

    // سدادات العملاء (تشمل سندات القبض المرتبطة بعميل لأنها تكتب سطر سداد).
    var payments = Money.zero;
    for (final t in db.customerTx.values) {
      if (!t.isActive || t.type != PartyTxType.payment) continue;
      if (!inWin(t.createdAt)) continue;
      payments += t.amount;
    }

    // سندات قبض لأطراف خارجية (بدون عميل — ليست في دفتر العملاء).
    var otherReceipts = Money.zero;
    for (final v in db.vouchers.values) {
      if (!v.isActive || v.type != VoucherType.receipt) continue;
      if (v.customerId != null) continue; // محسوبة ضمن السدادات
      if (!inWin(v.createdAt)) continue;
      otherReceipts += v.amount;
    }

    var income = Money.zero;
    for (final d in db.dailyIncomes.values) {
      if (d.isActive && inWin(d.createdAt)) income += d.amount;
    }

    // كل النقد الخارج = المصروفات النشطة (تشمل سداد الموردين وسندات الصرف
    // والمشتريات النقدية — كلها تُسجَّل مصروفًا في هذا النظام).
    var expenses = Money.zero;
    var expCount = 0;
    for (final e in db.expenses.values) {
      if (!e.isActive || !inWin(e.createdAt)) continue;
      expenses += e.amount;
      expCount++;
    }

    return ZReport(
      session: s,
      until: to,
      cashSales: cashSales,
      cashSalesCount: cashCount,
      creditSales: creditSales,
      creditSalesCount: creditCount,
      customerPayments: payments,
      otherReceipts: otherReceipts,
      dailyIncome: income,
      expenses: expenses,
      expensesCount: expCount,
    );
  }
}
