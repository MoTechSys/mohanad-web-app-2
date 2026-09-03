import 'package:flutter_test/flutter_test.dart';
import 'package:grocery_ledger/core/money/money.dart';

void main() {
  group('Money.tryParse', () {
    test('parses whole numbers', () {
      expect(Money.tryParse('1250'), const Money(125000));
      expect(Money.tryParse('0'), Money.zero);
    });
    test('parses decimals with 1 or 2 places', () {
      expect(Money.tryParse('12.5'), const Money(1250));
      expect(Money.tryParse('12.05'), const Money(1205));
      expect(Money.tryParse('.5'), const Money(50));
      expect(Money.tryParse('12.'), const Money(1200));
    });
    test('strips thousands separators and Arabic digits', () {
      expect(Money.tryParse('1,250.75'), const Money(125075));
      expect(Money.tryParse('١٢٣٤'), const Money(123400));
      expect(Money.tryParse('٥٠.٢٥'), const Money(5025));
    });
    test('negative values', () {
      expect(Money.tryParse('-40'), const Money(-4000));
    });
    test('rejects invalid input', () {
      expect(Money.tryParse(''), isNull);
      expect(Money.tryParse('abc'), isNull);
      expect(Money.tryParse('1.2.3'), isNull);
      expect(Money.tryParse('.'), isNull);
      expect(Money.tryParse('-'), isNull);
      expect(Money.tryParse('12.345'), isNull, reason: '3 decimals not allowed');
    });
  });

  group('Money arithmetic', () {
    test('add / subtract / negate', () {
      const a = Money(1000);
      const b = Money(250);
      expect(a + b, const Money(1250));
      expect(a - b, const Money(750));
      expect(-a, const Money(-1000));
      expect((b - a).isNegative, isTrue);
    });
    test('no floating drift over many additions', () {
      var sum = Money.zero;
      for (var i = 0; i < 10000; i++) {
        sum = sum + const Money(10); // 0.10 × 10000
      }
      expect(sum, const Money(100000)); // exactly 1000.00
    });
    test('timesQty rounds half away from zero', () {
      // 3.333 × 1.5 → 4.9995 → 5.00
      expect(const Money(333).timesQty(const Qty(1500)), const Money(500));
      // 10.00 × 0.333 → 3.33
      expect(const Money(1000).timesQty(const Qty(333)), const Money(333));
      // 2.50 × 3 → 7.50
      expect(const Money(250).timesQty(Qty.units(3)), const Money(750));
      // negative
      expect(const Money(-333).timesQty(const Qty(1500)), const Money(-500));
    });
  });

  group('Money.format', () {
    test('formats with grouping and no trailing .00', () {
      expect(const Money(125000).format(), '1,250');
      expect(const Money(125050).format(), '1,250.50');
      expect(const Money(-4005).format(), '-40.05');
      expect(const Money(100).format(alwaysDecimals: true), '1.00');
    });
    test('toEditable round-trips', () {
      for (final s in ['1250', '12.5', '0.05', '-3.2']) {
        final m = Money.tryParse(s)!;
        expect(Money.tryParse(m.toEditable()), m);
      }
    });
  });

  group('Qty', () {
    test('parses 3 decimals and truncates extra', () {
      expect(Qty.tryParse('1.250'), const Qty(1250));
      expect(Qty.tryParse('2'), const Qty(2000));
      expect(Qty.tryParse('0.5'), const Qty(500));
      expect(Qty.tryParse('1.23456'), const Qty(1234));
    });
    test('format trims trailing zeros', () {
      expect(const Qty(1250).format(), '1.25');
      expect(const Qty(2000).format(), '2');
      expect(const Qty(1).format(), '0.001');
    });
  });
}
