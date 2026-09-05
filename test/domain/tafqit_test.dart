import 'package:flutter_test/flutter_test.dart';
import 'package:grocery_ledger/core/utils/tafqit.dart';

void main() {
  group('تفقيط المبالغ', () {
    test('ones and teens', () {
      expect(arabicWords(0), 'صفر');
      expect(arabicWords(1), 'واحد');
      expect(arabicWords(2), 'اثنان');
      expect(arabicWords(11), 'أحد عشر');
      expect(arabicWords(19), 'تسعة عشر');
    });

    test('tens and composition', () {
      expect(arabicWords(20), 'عشرون');
      expect(arabicWords(25), 'خمسة وعشرون');
      expect(arabicWords(99), 'تسعة وتسعون');
    });

    test('hundreds', () {
      expect(arabicWords(100), 'مائة');
      expect(arabicWords(200), 'مائتان');
      expect(arabicWords(355), 'ثلاثمائة وخمسة وخمسون');
      expect(arabicWords(999), 'تسعمائة وتسعة وتسعون');
    });

    test('thousands', () {
      expect(arabicWords(1000), 'ألف');
      expect(arabicWords(2000), 'ألفان');
      expect(arabicWords(5000), 'خمسة آلاف');
      expect(arabicWords(15000), 'خمسة عشر ألفًا');
      expect(arabicWords(120500), 'مائة وعشرون ألفًا وخمسمائة');
      expect(arabicWords(500000), 'خمسمائة ألف');
    });

    test('millions', () {
      expect(arabicWords(1000000), 'مليون');
      expect(arabicWords(3500000), 'ثلاثة ملايين وخمسمائة ألف');
    });

    test('official phrasing', () {
      expect(tafqit(350, currency: 'ريال'), 'فقط ثلاثمائة وخمسون ريال لا غير');
    });
  });
}
