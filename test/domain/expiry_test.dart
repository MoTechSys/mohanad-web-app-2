import 'package:flutter_test/flutter_test.dart';
import 'package:grocery_ledger/app/app_services.dart';
import 'package:grocery_ledger/core/money/money.dart';
import 'package:grocery_ledger/data/kv_backend.dart';
import 'package:grocery_ledger/domain/models/inventory.dart';

Money m(int units) => Money.units(units);

Future<AppServices> boot() async {
  final app = AppServices.withBackend(MemoryBackend());
  await app.init();
  return app;
}

void main() {
  group('تواريخ الصلاحية (م4)', () {
    test('إنشاء منتج بتاريخ صلاحية + الحفظ والاسترجاع (round-trip)', () async {
      final app = await boot();
      final exp = DateTime.now().add(const Duration(days: 60));
      final p = await app.inventory.createProduct(
        name: 'حليب مجفف',
        salePrice: m(500),
        expiryDate: exp,
      );
      expect(p.expiryDate, isNotNull);
      expect(p.isExpired, isFalse);
      expect(p.daysToExpiry, inInclusiveRange(58, 60));

      // round-trip عبر toMap/fromMap
      final restored = Product.fromMap(p.toMap());
      expect(
        restored.expiryDate!.millisecondsSinceEpoch,
        p.expiryDate!.millisecondsSinceEpoch,
      );

      // منتج بلا صلاحية
      final q = await app.inventory.createProduct(name: 'صابون');
      expect(q.expiryDate, isNull);
      expect(q.isExpired, isFalse);
      expect(q.daysToExpiry, isNull);
    });

    test('تعديل التاريخ ثم مسحه عبر clearExpiry', () async {
      final app = await boot();
      final p = await app.inventory.createProduct(name: 'بسكويت');
      expect(p.expiryDate, isNull);

      final exp = DateTime.now().add(const Duration(days: 10));
      final updated = await app.inventory.updateProduct(
        p.id,
        expiryDate: exp,
      );
      expect(updated.expiryDate, exp);

      // تعديل آخر بدون تمرير التاريخ يجب أن يُبقيه
      final renamed =
          await app.inventory.updateProduct(p.id, name: 'بسكويت شاي');
      expect(renamed.expiryDate, exp);

      // المسح الصريح
      final cleared =
          await app.inventory.updateProduct(p.id, clearExpiry: true);
      expect(cleared.expiryDate, isNull);
    });

    test('copyWith بنمط sentinel: تمرير null يمسح، عدم التمرير يُبقي', () async {
      final exp = DateTime.now().add(const Duration(days: 5));
      final now = DateTime.now();
      final p = Product(
        id: 'x1',
        name: 'عصير',
        expiryDate: exp,
        createdAt: now,
        updatedAt: now,
      );
      // عدم التمرير → يبقى
      expect(p.copyWith(name: 'عصير برتقال').expiryDate, exp);
      // تمرير null صراحةً → يُمسح
      expect(p.copyWith(expiryDate: null).expiryDate, isNull);
    });

    test('isExpired و daysToExpiry للمنتهي فعلًا', () {
      final now = DateTime.now();
      final p = Product(
        id: 'x2',
        name: 'زبادي',
        expiryDate: now.subtract(const Duration(days: 3)),
        createdAt: now,
        updatedAt: now,
      );
      expect(p.isExpired, isTrue);
      expect(p.daysToExpiry, lessThan(0));
    });

    test('تقرير expiringSoon: نافذة 30 يومًا مرتبة من الأقرب انتهاءً',
        () async {
      final app = await boot();
      final now = DateTime.now();
      await app.inventory.createProduct(
          name: 'قريب جدًا',
          expiryDate: now.add(const Duration(days: 5)));
      await app.inventory.createProduct(
          name: 'منتهي',
          expiryDate: now.subtract(const Duration(days: 2)));
      await app.inventory.createProduct(
          name: 'قريب',
          expiryDate: now.add(const Duration(days: 25)));
      await app.inventory.createProduct(
          name: 'بعيد',
          expiryDate: now.add(const Duration(days: 200)));
      await app.inventory.createProduct(name: 'بلا صلاحية');

      final soon = app.reports.expiringSoon();
      expect(soon.map((p) => p.name).toList(),
          ['منتهي', 'قريب جدًا', 'قريب']); // مرتبة تصاعديًا بالتاريخ

      final expired = app.reports.expiredProducts();
      expect(expired.length, 1);
      expect(expired.first.name, 'منتهي');

      // نافذة أضيق
      expect(app.reports.expiringSoon(days: 7).length, 2);
    });

    test('النسخة الاحتياطية القديمة (بدون expiryDate) تُستورد بأمان', () async {
      final app = await boot();
      // fromMap بخريطة لا تحتوي المفتاح إطلاقًا (نسخة قديمة)
      final now = DateTime.now();
      final oldMap = Product(
        id: 'legacy1',
        name: 'قديم',
        createdAt: now,
        updatedAt: now,
      ).toMap()
        ..remove('expiryDate');
      final p = Product.fromMap(oldMap);
      expect(p.expiryDate, isNull);
      expect(p.isExpired, isFalse);

      // export/import يحافظ على التاريخ
      final exp = DateTime.now().add(const Duration(days: 45));
      await app.inventory.createProduct(name: 'معلبات', expiryDate: exp);
      final json = app.settings.exportJson();

      final app2 = await boot();
      await app2.settings.importJson(json);
      final restored = app2.db.activeProducts
          .firstWhere((p) => p.name == 'معلبات');
      expect(restored.expiryDate!.millisecondsSinceEpoch,
          exp.millisecondsSinceEpoch);
    });
  });
}
