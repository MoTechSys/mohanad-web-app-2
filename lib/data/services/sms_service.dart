import '../../core/money/money.dart';
import '../../core/platform/native_bridge.dart';
import '../../core/utils/formatters.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/voucher.dart';
import '../ledger_db.dart';

/// إشعارات SMS المباشرة للعملاء (متطلب أساسي: «الرسائل ضروري تكون مباشرة»).
///
/// القوالب:
///  - بيع آجل: المبلغ + إجمالي الدين.
///  - سند قبض (سداد): المدفوع + المتبقي.
///  - تذكير بالدين.
///
/// الإرسال عبر SmsManager مباشرة (بدون فتح تطبيق الرسائل)، بينما واتساب
/// يبقى بالمشاركة عبر النظام.
class SmsService {
  SmsService(this.db);
  final LedgerDb db;

  /// تُستبدل في الاختبارات لمراقبة الإرسال بدل الاتصال بالمنصة.
  Future<bool> Function(String number, String text)? sender;

  String get _store => db.settings.storeName;

  Future<bool> _send(String? phone, String text) async {
    final n = (phone ?? '').replaceAll(RegExp(r'[\s\-]'), '');
    if (n.isEmpty) return false;
    final f = sender ?? NativeBridge.sendSms;
    return f(n, text);
  }

  // ── القوالب ────────────────────────────────────────────────────────────

  /// بيع آجل: «تم تسجيل مبلغ X عليكم. إجمالي الدين: Y»
  String creditSaleMessage({
    required Money saleAmount,
    required Money totalDebt,
  }) =>
      '$_store: تم تسجيل مبلغ ${Fmt.money(saleAmount)} عليكم. '
      'إجمالي الدين: ${Fmt.money(totalDebt)}. شكرًا لتعاملكم معنا.';

  /// سند قبض: «استلمنا منكم X. المتبقي: Y» (أو «تم سداد كامل الدين»)
  String receiptMessage({required Money paid, required Money remaining}) {
    final tail = remaining.isPositive
        ? 'المتبقي عليكم: ${Fmt.money(remaining)}.'
        : 'تم سداد كامل المبلغ، لا يوجد دين. شكرًا لكم.';
    return '$_store: استلمنا منكم ${Fmt.money(paid)}. $tail';
  }

  /// تذكير بالدين المستحق.
  String reminderMessage({required String name, required Money debt}) =>
      '$_store: تذكير — إجمالي المبلغ المستحق عليكم ${Fmt.money(debt)}. '
      'نرجو التكرم بالسداد عند الإمكان. شكرًا $name.';

  // ── الإرسال ────────────────────────────────────────────────────────────

  /// إشعار بيع آجل لعميل (يُحسب إجمالي دينه الحالي تلقائيًا).
  Future<bool> notifyCreditSale({
    required String customerId,
    required Money saleAmount,
  }) {
    final c = db.customers[customerId];
    if (c == null) return Future.value(false);
    final debt = db.customerBalance(customerId);
    return _send(
      c.phone,
      creditSaleMessage(saleAmount: saleAmount, totalDebt: debt),
    );
  }

  /// إشعار سند قبض (يُستدعى بعد إنشاء السند — الرصيد الحالي هو «المتبقي»).
  Future<bool> notifyVoucher(Voucher v) {
    if (v.type != VoucherType.receipt || v.customerId == null) {
      return Future.value(false);
    }
    final c = db.customers[v.customerId!];
    if (c == null) return Future.value(false);
    final remaining = db.customerBalance(v.customerId!);
    return _send(c.phone, receiptMessage(paid: v.amount, remaining: remaining));
  }

  /// تذكير يدوي بالدين.
  Future<bool> sendReminder(String customerId) {
    final c = db.customers[customerId];
    if (c == null) return Future.value(false);
    final debt = db.customerBalance(customerId);
    if (!debt.isPositive) return Future.value(false);
    return _send(c.phone, reminderMessage(name: c.name, debt: debt));
  }

  /// مشاركة نص عبر واتساب/غيره (share sheet — ليس مباشرًا، حسب المتطلب).
  Future<bool> shareText(String text) => NativeBridge.share(text);
}
