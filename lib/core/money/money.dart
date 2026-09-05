import 'package:intl/intl.dart';

/// Monetary value stored as an integer number of *minor units*
/// (e.g. fils / halalas / cents). Never use `double` for money.
///
/// 2 decimal places are assumed (scale = 100). This matches the legacy
/// `decimal(14,2)` columns and removes floating-point drift entirely.
extension type const Money(int minor) implements Object {
  static const int scale = 100;
  static const Money zero = Money(0);

  /// Parse a user-entered decimal string like `"1250"`, `"1250.5"`, `"1,250.75"`.
  /// Returns `null` if the input is not a valid non-negative/negative decimal.
  static Money? tryParse(String raw) {
    var s = raw.trim().replaceAll(',', '').replaceAll('٬', '');
    s = _normalizeArabicDigits(s);
    if (s.isEmpty) return null;
    final neg = s.startsWith('-');
    if (neg) s = s.substring(1);
    if (s.isEmpty || s == '.') return null;
    if (!RegExp(r'^\d*\.?\d*$').hasMatch(s)) return null;
    final parts = s.split('.');
    final whole = parts[0];
    var frac = parts.length > 1 ? parts[1] : '';
    // Money has exactly 2 decimals; reject finer input instead of silently rounding.
    if (frac.length > 2) return null;
    frac = frac.padRight(2, '0');
    final w = whole.isEmpty ? 0 : int.tryParse(whole);
    final f = int.tryParse(frac);
    if (w == null || f == null) return null;
    final value = w * scale + f;
    return Money(neg ? -value : value);
  }

  static String _normalizeArabicDigits(String s) {
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    final sb = StringBuffer();
    for (final r in s.runes) {
      final ch = String.fromCharCode(r);
      final idx = arabic.indexOf(ch);
      sb.write(idx >= 0 ? idx.toString() : ch);
    }
    return sb.toString();
  }

  /// Construct from a whole-unit integer amount (e.g. 500 → 500.00).
  factory Money.units(int units) => Money(units * scale);

  Money operator +(Money o) => Money(minor + o.minor);
  Money operator -(Money o) => Money(minor - o.minor);
  Money operator -() => Money(-minor);
  bool operator <(Money o) => minor < o.minor;
  bool operator <=(Money o) => minor <= o.minor;
  bool operator >(Money o) => minor > o.minor;
  bool operator >=(Money o) => minor >= o.minor;

  /// Multiply by a quantity expressed in *thousandths* (see [Qty]).
  /// Rounds half away from zero to the nearest minor unit.
  Money timesQty(Qty q) {
    final num = minor * q.milli;
    final abs = num.abs();
    final rounded = (abs + Qty.scale ~/ 2) ~/ Qty.scale;
    return Money(num < 0 ? -rounded : rounded);
  }

  bool get isZero => minor == 0;
  bool get isPositive => minor > 0;
  bool get isNegative => minor < 0;
  Money get abs => Money(minor.abs());

  double toDouble() => minor / scale;

  /// `"1,250.50"` — English digits, grouping separators, always 2 decimals
  /// unless the fractional part is zero (then no decimals) for readability.
  String format({bool alwaysDecimals = false}) {
    final whole = minor.abs() ~/ scale;
    final frac = minor.abs() % scale;
    final wholeStr = NumberFormat('#,##0', 'en_US').format(whole);
    final sign = minor < 0 ? '-' : '';
    if (frac == 0 && !alwaysDecimals) return '$sign$wholeStr';
    return '$sign$wholeStr.${frac.toString().padLeft(2, '0')}';
  }

  /// Plain editable string: `"1250.5"` / `"1250"`.
  String toEditable() {
    final whole = minor.abs() ~/ scale;
    final frac = minor.abs() % scale;
    final sign = minor < 0 ? '-' : '';
    if (frac == 0) return '$sign$whole';
    var f = frac.toString().padLeft(2, '0');
    if (f.endsWith('0')) f = f.substring(0, 1);
    return '$sign$whole.$f';
  }
}

/// Quantity with 3 decimal places stored as integer thousandths.
/// Supports weights like 1.250 kg without floating point.
extension type const Qty(int milli) implements Object {
  static const int scale = 1000;
  static const Qty zero = Qty(0);
  static const Qty one = Qty(scale);

  factory Qty.units(int units) => Qty(units * scale);

  static Qty? tryParse(String raw) {
    var s = raw.trim().replaceAll(',', '');
    s = Money._normalizeArabicDigits(s);
    if (s.isEmpty) return null;
    final neg = s.startsWith('-');
    if (neg) s = s.substring(1);
    if (!RegExp(r'^\d*\.?\d*$').hasMatch(s) || s.isEmpty || s == '.') return null;
    final parts = s.split('.');
    final whole = parts[0].isEmpty ? 0 : int.tryParse(parts[0]);
    var fracStr = parts.length > 1 ? parts[1] : '';
    if (fracStr.length > 3) fracStr = fracStr.substring(0, 3);
    fracStr = fracStr.padRight(3, '0');
    final frac = int.tryParse(fracStr);
    if (whole == null || frac == null) return null;
    final v = whole * scale + frac;
    return Qty(neg ? -v : v);
  }

  Qty operator +(Qty o) => Qty(milli + o.milli);
  Qty operator -(Qty o) => Qty(milli - o.milli);
  Qty operator -() => Qty(-milli);

  /// Multiply two quantities (e.g. 2 cartons × 24 pieces/carton = 48 pieces).
  /// Rounds half away from zero to the nearest thousandth.
  Qty times(Qty o) {
    final num = milli * o.milli;
    final abs = num.abs();
    final rounded = (abs + scale ~/ 2) ~/ scale;
    return Qty(num < 0 ? -rounded : rounded);
  }
  bool operator <(Qty o) => milli < o.milli;
  bool operator <=(Qty o) => milli <= o.milli;
  bool operator >(Qty o) => milli > o.milli;
  bool operator >=(Qty o) => milli >= o.milli;

  bool get isZero => milli == 0;
  bool get isPositive => milli > 0;
  bool get isNegative => milli < 0;

  double toDouble() => milli / scale;

  String format() {
    final whole = milli.abs() ~/ scale;
    final frac = milli.abs() % scale;
    final sign = milli < 0 ? '-' : '';
    if (frac == 0) return '$sign$whole';
    var f = frac.toString().padLeft(3, '0');
    while (f.endsWith('0')) {
      f = f.substring(0, f.length - 1);
    }
    return '$sign$whole.$f';
  }
}
