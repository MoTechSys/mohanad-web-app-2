import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../data/export/share_service.dart';
import '../theme/app_theme.dart';
import 'common.dart';

typedef BytesBuilder = Future<Uint8List> Function();

/// One entry in the export sheet.
class ExportOption {
  const ExportOption({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.fileBase,
    required this.build,
    this.isExcel = false,
  });
  final String title;
  final String subtitle;
  final IconData icon;
  final String fileBase;
  final BytesBuilder build;
  final bool isExcel;
}

/// Bottom sheet listing PDF/Excel exports; each row offers share / print /
/// save. Runs the builder with a progress dialog and surfaces errors.
Future<void> showExportSheet(BuildContext context, {required String title, required List<ExportOption> options}) {
  return showModalBottomSheet(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SheetTitle(title),
          for (final o in options) _ExportTile(o),
        ]),
      ),
    ),
  );
}

class _ExportTile extends StatelessWidget {
  const _ExportTile(this.o);
  final ExportOption o;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final color = o.isExcel ? c.primaryStrong : c.danger;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        child: Row(children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
            child: Icon(o.icon, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(o.title, style: const TextStyle(fontWeight: FontWeight.w700)),
              Text(o.subtitle, style: TextStyle(fontSize: 11.5, color: c.textMuted)),
            ]),
          ),
          IconButton.filledTonal(
            tooltip: 'مشاركة',
            icon: const Icon(Icons.share_rounded, size: 20),
            onPressed: () => runExport(context, o, ExportAction.share),
          ),
          if (!o.isExcel)
            IconButton.filledTonal(
              tooltip: 'طباعة',
              icon: const Icon(Icons.print_rounded, size: 20),
              onPressed: () => runExport(context, o, ExportAction.print),
            ),
          IconButton.filledTonal(
            tooltip: 'حفظ في الجهاز',
            icon: const Icon(Icons.save_alt_rounded, size: 20),
            onPressed: () => runExport(context, o, ExportAction.save),
          ),
        ]),
      ),
    );
  }
}

enum ExportAction { share, print, save }

Future<void> runExport(BuildContext context, ExportOption o, ExportAction action) async {
  final app = context.read<AppServices>();
  final messenger = ScaffoldMessenger.of(context);
  final nav = Navigator.of(context, rootNavigator: true);
  showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => const PopScope(
      canPop: false,
      child: Center(child: Card(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))),
    ),
  );
  try {
    final bytes = await o.build();
    final name = ShareService.safeName(o.fileBase, o.isExcel ? 'xlsx' : 'pdf');
    switch (action) {
      case ExportAction.share:
        if (o.isExcel) {
          await app.share.shareExcel(bytes, name, text: o.title);
        } else {
          await app.share.sharePdf(bytes, name, text: o.title);
        }
      case ExportAction.print:
        await app.share.printPdf(bytes, o.title);
      case ExportAction.save:
        final path = await app.share.saveToDocuments(bytes, name);
        messenger.showSnackBar(SnackBar(content: Text('تم الحفظ: $path'), duration: const Duration(seconds: 4)));
    }
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text('تعذّر التصدير: $e'), backgroundColor: Colors.red));
  } finally {
    if (nav.canPop()) nav.pop();
  }
}

/// AppBar action that opens an export sheet.
class ExportButton extends StatelessWidget {
  const ExportButton({super.key, required this.title, required this.options, this.tooltip = 'تصدير PDF / Excel'});
  final String title;
  final List<ExportOption> options;
  final String tooltip;

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: tooltip,
    icon: const Icon(Icons.ios_share_rounded),
    onPressed: () => showExportSheet(context, title: title, options: options),
  );
}
