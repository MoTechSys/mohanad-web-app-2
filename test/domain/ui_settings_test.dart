import 'package:flutter_test/flutter_test.dart';
import 'package:grocery_ledger/app/app_services.dart';
import 'package:grocery_ledger/data/kv_backend.dart';
import 'package:grocery_ledger/domain/models/settings.dart';

Future<AppServices> boot() async {
  final app = AppServices.withBackend(MemoryBackend());
  await app.init();
  return app;
}

void main() {
  group('إعدادات المرونة (م6): إخفاء الماسح وخط أكبر', () {
    test('القيم الافتراضية: الماسح ظاهر والخط عادي', () {
      const s = AppSettings();
      expect(s.hideScanner, isFalse);
      expect(s.largeFont, isFalse);
    });

    test('copyWith يحدّث القيم ويحافظ على الباقي', () {
      const s = AppSettings(storeName: 'بقالة النور');
      final s2 = s.copyWith(hideScanner: true, largeFont: true);
      expect(s2.hideScanner, isTrue);
      expect(s2.largeFont, isTrue);
      expect(s2.storeName, 'بقالة النور');
      // تعديل آخر لا يمسّهما
      final s3 = s2.copyWith(currency: 'ر.س');
      expect(s3.hideScanner, isTrue);
      expect(s3.largeFont, isTrue);
    });

    test('تُحفظ وتُقرأ عبر toMap/fromMap', () {
      const s = AppSettings(hideScanner: true, largeFont: true);
      final s2 = AppSettings.fromMap(s.toMap());
      expect(s2.hideScanner, isTrue);
      expect(s2.largeFont, isTrue);
    });

    test('توافق خلفي: خريطة قديمة بدون المفاتيح الجديدة', () {
      final old = const AppSettings().toMap()
        ..remove('hideScanner')
        ..remove('largeFont');
      final s = AppSettings.fromMap(old);
      expect(s.hideScanner, isFalse);
      expect(s.largeFont, isFalse);
    });

    test('تُحفظ في قاعدة البيانات وتنجو من التصدير والاستيراد', () async {
      final app = await boot();
      await app.settings.update(
        app.db.settings.copyWith(hideScanner: true, largeFont: true),
      );
      expect(app.db.settings.hideScanner, isTrue);

      final json = app.settings.exportJson();
      final app2 = await boot();
      await app2.settings.importJson(json);
      expect(app2.db.settings.hideScanner, isTrue);
      expect(app2.db.settings.largeFont, isTrue);
    });
  });
}
