import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

/// Writes bytes to a temp file and hands them to the OS share sheet /
/// print dialog. Kept tiny so it can be stubbed in tests.
class ShareService {
  const ShareService();

  /// Test hook: when set, all operations are recorded here instead of hitting
  /// platform channels.
  static void Function(String op, String fileName, Uint8List bytes)? spy;

  static String safeName(String base, String ext) {
    final clean = base.replaceAll(RegExp(r'[\\/:*?"<>|]+'), '-').trim();
    final stamp = DateTime.now().toIso8601String().substring(0, 16).replaceAll(':', '').replaceAll('T', '_');
    return '$clean-$stamp.$ext';
  }

  Future<File> _write(String fileName, Uint8List bytes) async {
    final dir = await getTemporaryDirectory();
    final f = File('${dir.path}/exports/$fileName');
    await f.parent.create(recursive: true);
    return f.writeAsBytes(bytes, flush: true);
  }

  Future<void> sharePdf(Uint8List bytes, String fileName, {String? text}) async {
    if (spy != null) return spy!('sharePdf', fileName, bytes);
    final f = await _write(fileName, bytes);
    await Share.shareXFiles([XFile(f.path, mimeType: 'application/pdf')], text: text);
  }

  Future<void> shareExcel(Uint8List bytes, String fileName, {String? text}) async {
    if (spy != null) return spy!('shareExcel', fileName, bytes);
    final f = await _write(fileName, bytes);
    await Share.shareXFiles(
      [XFile(f.path, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')],
      text: text,
    );
  }

  /// Shares an existing file (e.g. a daily auto-backup JSON) via the OS
  /// share sheet — WhatsApp / Drive / email…
  Future<void> shareFile(File file, {String? text, String? mimeType}) async {
    if (spy != null) {
      return spy!('shareFile', file.uri.pathSegments.last,
          Uint8List.fromList(await file.readAsBytes()));
    }
    await Share.shareXFiles(
      [XFile(file.path, mimeType: mimeType ?? 'application/json')],
      text: text,
    );
  }

  /// Opens the Android print dialog (system PDF preview → any printer,
  /// including Bluetooth label/receipt printers via their print service).
  Future<void> printPdf(Uint8List bytes, String jobName) async {
    if (spy != null) return spy!('printPdf', jobName, bytes);
    await Printing.layoutPdf(onLayout: (_) async => bytes, name: jobName);
  }

  /// Saves to app documents dir; returns the path for the UI to display.
  Future<String> saveToDocuments(Uint8List bytes, String fileName) async {
    if (spy != null) {
      spy!('save', fileName, bytes);
      return fileName;
    }
    final dir = await getApplicationDocumentsDirectory();
    final f = File('${dir.path}/exports/$fileName');
    await f.parent.create(recursive: true);
    await f.writeAsBytes(bytes, flush: true);
    if (kDebugMode) debugPrint('saved ${f.path}');
    return f.path;
  }
}
