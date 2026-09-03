import '../../core/money/money.dart';

/// Tiny serialization helpers shared by all models.
/// Everything is persisted as `Map<String, dynamic>` with primitive values
/// so Hive needs no generated adapters.
class Serde {
  Serde._();

  static int? dt(DateTime? d) => d?.toUtc().millisecondsSinceEpoch;
  static DateTime? dtFrom(Object? v) => v == null
      ? null
      : DateTime.fromMillisecondsSinceEpoch(v as int, isUtc: true).toLocal();
  static DateTime dtReq(Object? v) => dtFrom(v)!;

  static int? money(Money? m) => m?.minor;
  static Money moneyReq(Object? v) => Money((v as int?) ?? 0);
  static Money? moneyOpt(Object? v) => v == null ? null : Money(v as int);

  static int qty(Qty q) => q.milli;
  static Qty qtyReq(Object? v) => Qty((v as int?) ?? 0);

  static T enumFrom<T extends Enum>(List<T> values, Object? v, T fallback) {
    if (v is int && v >= 0 && v < values.length) return values[v];
    return fallback;
  }

  static String? str(Object? v) {
    if (v == null) return null;
    final s = v as String;
    return s.isEmpty ? null : s;
  }

  static List<Map<String, dynamic>> listOfMaps(Object? v) {
    if (v is! List) return const [];
    return v.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }
}
