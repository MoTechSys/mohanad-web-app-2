import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:grocery_ledger/app/app_services.dart';
import 'package:grocery_ledger/data/kv_backend.dart';
import 'package:grocery_ledger/data/export/share_service.dart';
import 'package:grocery_ledger/data/services/backup_service.dart';

Future<AppServices> boot() async {
  final app = AppServices.withBackend(MemoryBackend());
  await app.init();
  return app;
}

void main() {
  late Directory tmp;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('gl_backup_');
  });
  tearDown(() async {
    if (await tmp.exists()) await tmp.delete(recursive: true);
  });

  group('النسخ اليومي التلقائي (م5)', () {
    test('ينشئ نسخة اليوم مرة واحدة فقط (idempotent)', () async {
      final app = await boot();
      await app.inventory.createProduct(name: 'سكر');
      final f1 = await app.backup.runDailyBackup(dir: tmp);
      expect(f1, isNotNull);
      expect(await f1!.exists(), isTrue);
      expect(f1.uri.pathSegments.last,
          BackupService.fileNameFor(DateTime.now()));
      final content1 = await f1.readAsString();
      expect(content1, contains('سكر'));

      // تشغيل ثانٍ في نفس اليوم — لا يعيد الكتابة
      await app.inventory.createProduct(name: 'ملح');
      final f2 = await app.backup.runDailyBackup(dir: tmp);
      expect(f2!.path, f1.path);
      expect(await f2.readAsString(), content1); // بقيت نسخة الصباح

      final files = await app.backup.listBackups(tmp);
      expect(files.length, 1);
    });

    test('يحتفظ بآخر 7 نسخ فقط ويحذف الأقدم', () async {
      final app = await boot();
      // 10 أيام متتالية
      for (var i = 9; i >= 0; i--) {
        await app.backup.runDailyBackup(
            dir: tmp, now: DateTime.now().subtract(Duration(days: i)));
      }
      final files = await app.backup.listBackups(tmp);
      expect(files.length, BackupService.keepLast); // 7
      // الأحدث أولًا = نسخة اليوم
      expect(files.first.uri.pathSegments.last,
          BackupService.fileNameFor(DateTime.now()));
      // الأقدم المتبقي = قبل 6 أيام (حُذفت 7 و8 و9)
      expect(files.last.uri.pathSegments.last,
          BackupService.fileNameFor(
              DateTime.now().subtract(const Duration(days: 6))));
    });

    test('النسخة التلقائية قابلة للاستعادة الكاملة', () async {
      final app = await boot();
      await app.inventory.createProduct(name: 'أرز بسمتي');
      final f = await app.backup.runDailyBackup(dir: tmp);

      final app2 = await boot();
      await app2.settings.importJson(await f!.readAsString());
      expect(app2.db.activeProducts.map((p) => p.name), contains('أرز بسمتي'));
    });

    test('مشاركة النسخة التلقائية عبر ShareService (spy)', () async {
      final app = await boot();
      await app.inventory.createProduct(name: 'شاي');
      final f = await app.backup.runDailyBackup(dir: tmp);

      String? op, name;
      List<int>? bytes;
      ShareService.spy = (o, n, b) {
        op = o;
        name = n;
        bytes = b;
      };
      addTearDown(() => ShareService.spy = null);

      await app.share.shareFile(f!, text: 'نسخة احتياطية');
      expect(op, 'shareFile');
      expect(name, BackupService.fileNameFor(DateTime.now()));
      expect(String.fromCharCodes(bytes!), contains('cashSessions'));
    });
  });
}
