import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import 'settings_service.dart';

/// م5 — النسخ الاحتياطي اليومي التلقائي.
///
/// عند كل تشغيل للتطبيق: إن لم توجد نسخة بتاريخ اليوم تُكتب نسخة JSON كاملة
/// في مجلد `backups/` داخل مستندات التطبيق، ثم تُحذف الأقدم بحيث تبقى
/// **آخر 7 نسخ فقط**. العملية آمنة تمامًا: أي خطأ يُبتلع ولا يُسقط التطبيق.
class BackupService {
  BackupService(this.settings);
  final SettingsService settings;

  static const int keepLast = 7;
  static const String prefix = 'backup-';
  static const String ext = '.json';

  /// اسم ملف اليوم: backup-2026-09-05.json
  static String fileNameFor(DateTime d) =>
      '$prefix${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}$ext';

  /// المجلد الافتراضي على الجهاز (داخل مستندات التطبيق).
  Future<Directory> defaultDir() async {
    final docs = await getApplicationDocumentsDirectory();
    return Directory('${docs.path}${Platform.pathSeparator}backups');
  }

  /// يشغَّل عند إقلاع التطبيق. [dir] يُمرَّر في الاختبارات فقط.
  /// يعيد ملف نسخة اليوم (الجديدة أو الموجودة سلفًا)، أو null عند الفشل.
  Future<File?> runDailyBackup({Directory? dir, DateTime? now}) async {
    try {
      final target = dir ?? await defaultDir();
      if (!await target.exists()) await target.create(recursive: true);

      final today = now ?? DateTime.now();
      final file = File(
        '${target.path}${Platform.pathSeparator}${fileNameFor(today)}',
      );

      // نسخة واحدة لكل يوم — التشغيل المتكرر لا يعيد الكتابة.
      if (!await file.exists()) {
        await file.writeAsString(settings.exportJson(), flush: true);
      }

      await prune(target);
      return file;
    } catch (e) {
      // النسخ التلقائي لا يجوز أن يعطل التطبيق أبدًا.
      debugPrint('auto-backup failed: $e');
      return null;
    }
  }

  /// حذف الأقدم بحيث تبقى آخر [keepLast] نسخ (بترتيب اسم الملف = التاريخ).
  Future<void> prune(Directory dir) async {
    final files = await listBackups(dir);
    if (files.length <= keepLast) return;
    for (final f in files.sublist(keepLast)) {
      try {
        await f.delete();
      } catch (_) {/* تجاهل */}
    }
  }

  /// كل ملفات النسخ التلقائية مرتبة من الأحدث للأقدم.
  Future<List<File>> listBackups(Directory dir) async {
    if (!await dir.exists()) return const [];
    final files = <File>[];
    await for (final e in dir.list()) {
      if (e is File) {
        final name = e.uri.pathSegments.last;
        if (name.startsWith(prefix) && name.endsWith(ext)) files.add(e);
      }
    }
    files.sort(
      (a, b) => b.uri.pathSegments.last.compareTo(a.uri.pathSegments.last),
    );
    return files;
  }
}
