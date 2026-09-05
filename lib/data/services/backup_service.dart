import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import 'settings_service.dart';

/// م5+م6 — النسخ الاحتياطي اليومي التلقائي بنمط واتساب.
///
/// عند كل تشغيل للتطبيق: إن لم توجد نسخة بتاريخ اليوم تُكتب نسخة **مضغوطة
/// (gzip)** بامتداد `.glbak` في مجلد مرئي للمستخدم:
///
///   `Android/media/com.groceryledger.accounts/دفتر البقالة/Databases/`
///
/// هذا المجلد — مثل مجلد واتساب — يظهر في مدير الملفات ويمكن نسخه يدويًا،
/// ولا يحتاج أي أذونات تخزين على أندرويد 11+. ثم تُحذف الأقدم بحيث تبقى
/// **آخر 7 نسخ فقط**. العملية آمنة تمامًا: أي خطأ يُبتلع ولا يُسقط التطبيق.
///
/// الاستعادة تدعم الصيغتين: `.glbak` المضغوطة و `.json` القديمة.
class BackupService {
  BackupService(this.settings);
  final SettingsService settings;

  static const int keepLast = 7;

  /// اسم النسخ الجديدة (مضغوطة): دفتر-البقالة-2026-09-05.glbak
  static const String prefix = 'دفتر-البقالة-';
  static const String ext = '.glbak';

  /// أسماء النسخ القديمة (JSON غير مضغوط) — تبقى مقروءة للاستعادة.
  static const String legacyPrefix = 'backup-';
  static const String legacyExt = '.json';

  /// معرّف الحزمة — يحدد مسار المجلد المرئي داخل Android/media.
  static const String packageName = 'com.groceryledger.accounts';

  static final RegExp _dateRe = RegExp(r'(\d{4}-\d{2}-\d{2})');

  /// اسم ملف اليوم: دفتر-البقالة-2026-09-05.glbak
  static String fileNameFor(DateTime d) =>
      '$prefix${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}$ext';

  /// هل هذا ملف نسخة (جديدة أو قديمة)؟
  static bool isBackupName(String name) =>
      (name.startsWith(prefix) && name.endsWith(ext)) ||
      (name.startsWith(legacyPrefix) && name.endsWith(legacyExt));

  /// تاريخ النسخة من اسم الملف (للترتيب والعرض).
  static String? dateOf(String name) => _dateRe.firstMatch(name)?.group(1);

  /// المجلد المرئي بنمط واتساب. على أندرويد:
  /// `/storage/emulated/0/Android/media/<pkg>/دفتر البقالة/Databases`
  /// وعلى غيره (أو عند الفشل) يعود لمجلد مستندات التطبيق.
  Future<Directory> backupDir() async {
    if (Platform.isAndroid) {
      try {
        final ext = await getExternalStorageDirectory();
        if (ext != null && ext.path.contains('/Android/')) {
          final root = ext.path.split('/Android/').first;
          final dir = Directory(
            '$root/Android/media/$packageName/دفتر البقالة/Databases',
          );
          await dir.create(recursive: true);
          return dir;
        }
      } catch (e) {
        debugPrint('media backup dir unavailable: $e');
      }
    }
    return legacyDir();
  }

  /// المجلد القديم (م5): مستندات التطبيق/backups — يبقى للقراءة والترحيل.
  Future<Directory> legacyDir() async {
    final docs = await getApplicationDocumentsDirectory();
    return Directory('${docs.path}${Platform.pathSeparator}backups');
  }

  /// يشغَّل عند إقلاع التطبيق. [dir] يُمرَّر في الاختبارات فقط.
  /// يعيد ملف نسخة اليوم (الجديدة أو الموجودة سلفًا)، أو null عند الفشل.
  Future<File?> runDailyBackup({Directory? dir, DateTime? now}) async {
    try {
      final target = dir ?? await backupDir();
      if (!await target.exists()) await target.create(recursive: true);

      final today = now ?? DateTime.now();
      final file = File(
        '${target.path}${Platform.pathSeparator}${fileNameFor(today)}',
      );

      // نسخة واحدة لكل يوم — التشغيل المتكرر لا يعيد الكتابة.
      if (!await file.exists()) {
        final bytes = gzip.encode(utf8.encode(settings.exportJson()));
        await file.writeAsBytes(bytes, flush: true);
      }

      await prune(target);
      return file;
    } catch (e) {
      // النسخ التلقائي لا يجوز أن يعطل التطبيق أبدًا.
      debugPrint('auto-backup failed: $e');
      return null;
    }
  }

  /// نسخة فورية الآن (زر «نسخ احتياطي الآن») — تعيد كتابة ملف اليوم.
  Future<File?> backupNow({Directory? dir}) async {
    try {
      final target = dir ?? await backupDir();
      if (!await target.exists()) await target.create(recursive: true);
      final file = File(
        '${target.path}${Platform.pathSeparator}${fileNameFor(DateTime.now())}',
      );
      final bytes = gzip.encode(utf8.encode(settings.exportJson()));
      await file.writeAsBytes(bytes, flush: true);
      await prune(target);
      return file;
    } catch (e) {
      debugPrint('manual backup failed: $e');
      return null;
    }
  }

  /// حذف الأقدم بحيث تبقى آخر [keepLast] نسخ (حسب التاريخ في الاسم).
  Future<void> prune(Directory dir) async {
    final files = await listBackups(dir);
    if (files.length <= keepLast) return;
    for (final f in files.sublist(keepLast)) {
      try {
        await f.delete();
      } catch (_) {
        /* تجاهل */
      }
    }
  }

  /// كل ملفات النسخ في [dir] مرتبة من الأحدث للأقدم.
  Future<List<File>> listBackups(Directory dir) async {
    if (!await dir.exists()) return const [];
    final files = <File>[];
    await for (final e in dir.list()) {
      if (e is File && isBackupName(e.uri.pathSegments.last)) files.add(e);
    }
    files.sort((a, b) {
      final da = dateOf(a.uri.pathSegments.last) ?? '';
      final db = dateOf(b.uri.pathSegments.last) ?? '';
      return db.compareTo(da);
    });
    return files;
  }

  /// كل النسخ المتاحة على الجهاز: المجلد المرئي الجديد + مجلد م5 القديم.
  /// تُستخدم في نافذة الاستعادة الفورية.
  Future<List<File>> allBackups() async {
    final seen = <String>{};
    final out = <File>[];
    for (final d in [await backupDir(), await legacyDir()]) {
      try {
        for (final f in await listBackups(d)) {
          if (seen.add(f.uri.pathSegments.last)) out.add(f);
        }
      } catch (_) {
        /* منصة لا تدعم */
      }
    }
    out.sort((a, b) {
      final da = dateOf(a.uri.pathSegments.last) ?? '';
      final db = dateOf(b.uri.pathSegments.last) ?? '';
      return db.compareTo(da);
    });
    return out;
  }

  /// قراءة محتوى نسخة أيًّا كانت صيغتها:
  /// - `.glbak` مضغوطة (gzip) → فك الضغط.
  /// - `.json` قديمة → قراءة مباشرة.
  /// الكشف بالبايتات السحرية لا بالامتداد (أمان أعلى).
  Future<String> readBackup(File file) async {
    final bytes = await file.readAsBytes();
    if (bytes.length >= 2 && bytes[0] == 0x1f && bytes[1] == 0x8b) {
      return utf8.decode(gzip.decode(bytes));
    }
    return utf8.decode(bytes);
  }

  /// حجم الملف بصيغة مقروءة.
  static String sizeLabel(int bytes) {
    if (bytes < 1024) return '$bytes ب';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} ك.ب';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} م.ب';
  }
}
