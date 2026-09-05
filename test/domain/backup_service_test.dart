import 'dart:convert';
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

  group('النسخ اليومي التلقائي بنمط واتساب (م5+م6)', () {
    test('ينشئ نسخة اليوم المضغوطة مرة واحدة فقط (idempotent)', () async {
      final app = await boot();
      await app.inventory.createProduct(name: 'سكر');
      final f1 = await app.backup.runDailyBackup(dir: tmp);
      expect(f1, isNotNull);
      expect(await f1!.exists(), isTrue);
      expect(f1.uri.pathSegments.last,
          BackupService.fileNameFor(DateTime.now()));
      expect(f1.path, endsWith('.glbak'));

      // المحتوى مضغوط gzip (البايتات السحرية 1f 8b) ويحتوي البيانات
      final bytes1 = await f1.readAsBytes();
      expect(bytes1[0], 0x1f);
      expect(bytes1[1], 0x8b);
      final content1 = await app.backup.readBackup(f1);
      expect(content1, contains('سكر'));

      // تشغيل ثانٍ في نفس اليوم — لا يعيد الكتابة
      await app.inventory.createProduct(name: 'ملح');
      final f2 = await app.backup.runDailyBackup(dir: tmp);
      expect(f2!.path, f1.path);
      expect(await app.backup.readBackup(f2), content1); // بقيت نسخة الصباح

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

    test('النسخة المضغوطة قابلة للاستعادة الكاملة', () async {
      final app = await boot();
      await app.inventory.createProduct(name: 'أرز بسمتي');
      final f = await app.backup.runDailyBackup(dir: tmp);

      final app2 = await boot();
      await app2.settings.importJson(await app2.backup.readBackup(f!));
      expect(app2.db.activeProducts.map((p) => p.name), contains('أرز بسمتي'));
    });

    test('يقرأ نسخ JSON القديمة (م5) بلا مشاكل — توافق خلفي', () async {
      final app = await boot();
      await app.inventory.createProduct(name: 'زيت طبخ');
      // ملف قديم غير مضغوط بصيغة م5
      final legacy = File('${tmp.path}/backup-2026-01-01.json');
      await legacy.writeAsString(app.settings.exportJson(), flush: true);

      // يُكتشف كنسخة ويُقرأ نصًا مباشرة
      expect(BackupService.isBackupName('backup-2026-01-01.json'), isTrue);
      final files = await app.backup.listBackups(tmp);
      expect(files.length, 1);

      final app2 = await boot();
      await app2.settings.importJson(await app2.backup.readBackup(legacy));
      expect(app2.db.activeProducts.map((p) => p.name), contains('زيت طبخ'));
    });

    test('backupNow يعيد كتابة نسخة اليوم بأحدث البيانات', () async {
      final app = await boot();
      await app.inventory.createProduct(name: 'سكر');
      final f1 = await app.backup.runDailyBackup(dir: tmp);
      await app.inventory.createProduct(name: 'دقيق');
      final f2 = await app.backup.backupNow(dir: tmp);
      expect(f2!.path, f1!.path); // نفس ملف اليوم
      final content = await app.backup.readBackup(f2);
      expect(content, contains('دقيق')); // أُعيدت الكتابة بالمحتوى الأحدث
    });

    test('مشاركة النسخة المضغوطة عبر ShareService (spy)', () async {
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
      // المحتوى المضغوط يُفك ويحتوي البيانات
      final json = utf8.decode(gzip.decode(bytes!));
      expect(json, contains('cashSessions'));
      expect(json, contains('شاي'));
    });

    test('dateOf و sizeLabel يعملان لكل الصيغ', () {
      expect(BackupService.dateOf('دفتر-البقالة-2026-03-15.glbak'), '2026-03-15');
      expect(BackupService.dateOf('backup-2026-01-02.json'), '2026-01-02');
      expect(BackupService.sizeLabel(500), '500 ب');
      expect(BackupService.sizeLabel(2048), '2.0 ك.ب');
      expect(BackupService.sizeLabel(3 * 1024 * 1024), '3.0 م.ب');
    });
  });
}
