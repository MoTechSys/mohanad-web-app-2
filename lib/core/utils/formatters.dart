import 'package:intl/intl.dart';

import '../money/money.dart';

/// Human formatting helpers (Arabic labels, Latin digits for accuracy).
class Fmt {
  Fmt._();

  static final _date = DateFormat('yyyy/MM/dd');
  static final _dateTime = DateFormat('yyyy/MM/dd  HH:mm');
  static final _dayName = DateFormat('EEEE', 'ar');
  static final _monthName = DateFormat('MMMM yyyy', 'ar');

  static String date(DateTime d) => _date.format(d);
  static String dateTime(DateTime d) => _dateTime.format(d);
  static String dayName(DateTime d) => _dayName.format(d);
  static String monthName(DateTime d) => _monthName.format(d);

  static String money(Money m, {String? currency}) =>
      currency == null || currency.isEmpty
      ? m.format()
      : '${m.format()} $currency';

  /// Signed balance text: positive = عليه، negative = له.
  static String balanceLabel(Money m) {
    if (m.isZero) return 'مسدد';
    return m.isPositive ? 'عليه ${m.format()}' : 'له ${m.abs.format()}';
  }

  static String relative(DateTime d) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(d.year, d.month, d.day);
    final diff = today.difference(day).inDays;
    if (diff == 0) return 'اليوم';
    if (diff == 1) return 'أمس';
    if (diff < 7) return 'قبل $diff أيام';
    return date(d);
  }
}
