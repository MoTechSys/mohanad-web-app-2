/// تفقيط المبالغ: تحويل الأرقام إلى كتابة عربية للسندات الرسمية.
/// «355 ريال» ⇒ «ثلاثمائة وخمسة وخمسون ريالاً فقط لا غير»
library;

const _ones = [
  '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية',
  'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر',
  'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر',
];
const _tens = [
  '', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون',
  'تسعون',
];
const _hundreds = [
  '', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة',
  'سبعمائة', 'ثمانمائة', 'تسعمائة',
];

String _below1000(int n) {
  final parts = <String>[];
  final h = n ~/ 100, r = n % 100;
  if (h > 0) parts.add(_hundreds[h]);
  if (r > 0) {
    if (r < 20) {
      parts.add(_ones[r]);
    } else {
      final o = r % 10, t = r ~/ 10;
      if (o > 0) parts.add('${_ones[o]} و${_tens[t]}');
      if (o == 0) parts.add(_tens[t]);
    }
  }
  return parts.join(' و');
}

String _scale(int n, String one, String two, String few, String many) {
  if (n == 1) return one;
  if (n == 2) return two;
  if (n >= 3 && n <= 10) return '${_below1000(n)} $few';
  // 11–99 take the accusative singular (تمييز); 100+ use إضافة (مفرد).
  final r = n % 100;
  if (r >= 11 && r <= 99) return '${_below1000(n)} $many';
  return '${_below1000(n)} $one';
}

/// Converts a whole number (0 … 999,999,999) to Arabic words.
String arabicWords(int n) {
  if (n == 0) return 'صفر';
  if (n < 0) return 'سالب ${arabicWords(-n)}';
  final parts = <String>[];
  final millions = n ~/ 1000000;
  final thousands = (n % 1000000) ~/ 1000;
  final rest = n % 1000;
  if (millions > 0) {
    parts.add(_scale(millions, 'مليون', 'مليونان', 'ملايين', 'مليونًا'));
  }
  if (thousands > 0) {
    parts.add(_scale(thousands, 'ألف', 'ألفان', 'آلاف', 'ألفًا'));
  }
  if (rest > 0) parts.add(_below1000(rest));
  return parts.join(' و');
}

/// Official voucher phrasing: «فقط ثلاثمائة وخمسون ريالاً يمنيًا لا غير».
String tafqit(int wholeUnits, {String currency = 'ريال'}) =>
    'فقط ${arabicWords(wholeUnits)} $currency لا غير';
