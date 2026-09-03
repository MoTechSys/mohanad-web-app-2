import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../core/money/money.dart';
import '../../core/utils/formatters.dart';
import '../../domain/models/settings.dart';

/// Shared branding for every PDF the app produces (invoice, labels, reports).
///
/// The store identity (name, logo, header/footer statements) is taken from
/// [AppSettings] so everything the owner prints carries his own brand.
class PdfBrand {
  PdfBrand._(this.settings, this.font, this.fontBold, this.logo);

  final AppSettings settings;
  final pw.Font font;
  final pw.Font fontBold;
  final pw.MemoryImage? logo;

  static pw.Font? _cachedFont;

  static Future<PdfBrand> load(AppSettings s) async {
    _cachedFont ??= pw.Font.ttf(
      await rootBundle.load('assets/fonts/NotoNaskhArabic-Regular.ttf'),
    );
    pw.MemoryImage? logo;
    if (s.hasLogo) {
      try {
        logo = pw.MemoryImage(base64Decode(s.logoBase64!));
      } catch (_) {
        logo = null;
      }
    }
    return PdfBrand._(s, _cachedFont!, _cachedFont!, logo);
  }

  static const primary = PdfColor.fromInt(0xFF1B5E3F);
  static const primarySoft = PdfColor.fromInt(0xFFE3F1EA);
  static const muted = PdfColor.fromInt(0xFF6B7280);
  static const line = PdfColor.fromInt(0xFFD1D5DB);
  static const zebra = PdfColor.fromInt(0xFFF6F7F9);

  pw.ThemeData theme() => pw.ThemeData.withFont(base: font, bold: fontBold)
      .copyWith(defaultTextStyle: pw.TextStyle(font: font, fontSize: 10));

  pw.TextStyle get h1 => pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: primary);
  pw.TextStyle get h2 => pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold);
  pw.TextStyle get small => const pw.TextStyle(fontSize: 8.5, color: muted);
  pw.TextStyle get bold => pw.TextStyle(fontWeight: pw.FontWeight.bold);

  String money(Money m) => Fmt.money(m, currency: settings.currency);

  /// Store header: logo + name + header statement + address/phone.
  pw.Widget header({String? title, String? subtitle}) {
    final s = settings;
    return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
      pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.center, children: [
        if (logo != null)
          pw.Container(
            width: 56,
            height: 56,
            margin: const pw.EdgeInsets.only(left: 12),
            child: pw.Image(logo!, fit: pw.BoxFit.contain),
          ),
        pw.Expanded(
          child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text(s.storeName, style: h1),
            if ((s.receiptHeader ?? '').isNotEmpty)
              pw.Text(s.receiptHeader!, style: const pw.TextStyle(fontSize: 10)),
            pw.Text(
              [
                if ((s.address ?? '').isNotEmpty) s.address!,
                if ((s.phone ?? '').isNotEmpty) 'هاتف: ${s.phone}',
                if ((s.ownerName ?? '').isNotEmpty) 'المالك: ${s.ownerName}',
              ].join('  •  '),
              style: small,
            ),
          ]),
        ),
        if (title != null)
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: pw.BoxDecoration(
                color: primarySoft,
                borderRadius: pw.BorderRadius.circular(6),
              ),
              child: pw.Text(title, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: primary, fontSize: 12)),
            ),
            if (subtitle != null) pw.Padding(padding: const pw.EdgeInsets.only(top: 3), child: pw.Text(subtitle, style: small)),
          ]),
      ]),
      pw.SizedBox(height: 6),
      pw.Divider(color: primary, thickness: 1.2),
    ]);
  }

  /// Footer statement + page numbers + developer credit.
  pw.Widget footer(pw.Context ctx) {
    final f = settings.receiptFooter ?? '';
    return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
      pw.Divider(color: line, thickness: 0.6),
      if (f.isNotEmpty) pw.Center(child: pw.Text(f, style: const pw.TextStyle(fontSize: 9.5))),
      pw.SizedBox(height: 2),
      pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
        pw.Text('صفحة ${ctx.pageNumber} من ${ctx.pagesCount}', style: small),
        pw.Text('طُبع ${Fmt.dateTime(DateTime.now())} • دفتر البقالة', style: small),
      ]),
    ]);
  }

  pw.Document document() => pw.Document(
    theme: theme(),
    title: settings.storeName,
    author: settings.storeName,
    creator: 'دفتر البقالة',
  );

  /// Standard RTL A4 multipage.
  pw.MultiPage page({
    required List<pw.Widget> Function(pw.Context) build,
    String? title,
    String? subtitle,
    PdfPageFormat format = PdfPageFormat.a4,
  }) => pw.MultiPage(
    pageFormat: format,
    textDirection: pw.TextDirection.rtl,
    margin: const pw.EdgeInsets.fromLTRB(28, 28, 28, 24),
    header: (_) => pw.Padding(padding: const pw.EdgeInsets.only(bottom: 8), child: header(title: title, subtitle: subtitle)),
    footer: footer,
    build: build,
  );

  /// Zebra-striped RTL data table with bold header row.
  pw.Widget table({
    required List<String> headers,
    required List<List<String>> rows,
    List<pw.Alignment>? aligns,
    Map<int, pw.TableColumnWidth>? widths,
    List<String>? totals,
  }) {
    pw.Widget cell(String t, {bool head = false, bool tot = false, pw.Alignment? a}) => pw.Container(
      alignment: a ?? pw.Alignment.centerRight,
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 4.5),
      child: pw.Text(t, style: (head || tot) ? bold.copyWith(fontSize: 9.5, color: head ? PdfColors.white : primary) : const pw.TextStyle(fontSize: 9.5)),
    );
    return pw.Table(
      columnWidths: widths,
      border: pw.TableBorder(horizontalInside: const pw.BorderSide(color: line, width: 0.4), bottom: const pw.BorderSide(color: line, width: 0.6)),
      children: [
        pw.TableRow(
          decoration: const pw.BoxDecoration(color: primary),
          children: [for (var i = 0; i < headers.length; i++) cell(headers[i], head: true, a: aligns?[i])],
        ),
        for (var r = 0; r < rows.length; r++)
          pw.TableRow(
            decoration: pw.BoxDecoration(color: r.isOdd ? zebra : PdfColors.white),
            children: [for (var i = 0; i < rows[r].length; i++) cell(rows[r][i], a: aligns?[i])],
          ),
        if (totals != null)
          pw.TableRow(
            decoration: const pw.BoxDecoration(color: primarySoft),
            children: [for (var i = 0; i < totals.length; i++) cell(totals[i], tot: true, a: aligns?[i])],
          ),
      ],
    );
  }

  /// Key/value summary card grid.
  pw.Widget kpis(List<(String, String)> items, {int perRow = 3}) => pw.Wrap(
    spacing: 8,
    runSpacing: 8,
    children: [
      for (final (k, v) in items)
        pw.Container(
          width: (PdfPageFormat.a4.availableWidth - 56 - 8 * (perRow - 1)) / perRow,
          padding: const pw.EdgeInsets.all(8),
          decoration: pw.BoxDecoration(
            border: pw.Border.all(color: line, width: 0.6),
            borderRadius: pw.BorderRadius.circular(6),
          ),
          child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text(k, style: small),
            pw.SizedBox(height: 2),
            pw.Text(v, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: primary)),
          ]),
        ),
    ],
  );

  static Future<Uint8List> save(pw.Document d) => d.save();
}
