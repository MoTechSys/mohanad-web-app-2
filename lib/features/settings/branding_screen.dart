import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/export_actions.dart';
import '../../data/ledger_db.dart';
import '../../data/services/report_service.dart';

/// Store identity printed on every invoice / label / report:
/// logo, name, top statement (header) and bottom statement (footer).
class BrandingScreen extends StatefulWidget {
  const BrandingScreen({super.key});
  @override
  State<BrandingScreen> createState() => _BrandingScreenState();
}

class _BrandingScreenState extends State<BrandingScreen> {
  final _form = GlobalKey<FormState>();
  late final _s0 = context.read<LedgerDb>().settings;
  late final _store = TextEditingController(text: _s0.storeName);
  late final _owner = TextEditingController(text: _s0.ownerName);
  late final _phone = TextEditingController(text: _s0.phone);
  late final _address = TextEditingController(text: _s0.address);
  late final _header = TextEditingController(text: _s0.receiptHeader);
  late final _footer = TextEditingController(text: _s0.receiptFooter);
  late String? _logo = _s0.logoBase64;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_store, _owner, _phone, _address, _header, _footer]) {
      c.dispose();
    }
    super.dispose();
  }

  Uint8List? get _logoBytes {
    if (_logo == null || _logo!.isEmpty) return null;
    try {
      return base64Decode(_logo!);
    } catch (_) {
      return null;
    }
  }

  Future<void> _pickLogo(ImageSource src) async {
    setState(() => _busy = true);
    try {
      final x = await ImagePicker().pickImage(
        source: src,
        maxWidth: 512,
        maxHeight: 512,
        imageQuality: 85,
      );
      if (x == null) return;
      final bytes = await x.readAsBytes();
      if (bytes.lengthInBytes > 400 * 1024) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('الصورة كبيرة جداً — اختر صورة أصغر (أقل من 400KB)')),
          );
        }
        return;
      }
      setState(() => _logo = base64Encode(bytes));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تعذّر اختيار الصورة: $e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    final app = context.read<AppServices>();
    final s = app.db.settings.copyWith(
      storeName: _store.text.trim(),
      ownerName: _owner.text.trim(),
      phone: _phone.text.trim(),
      address: _address.text.trim(),
      receiptHeader: _header.text.trim(),
      receiptFooter: _footer.text.trim(),
      logoBase64: _logo,
      clearLogo: _logo == null,
    );
    final ok = await guarded(context, () => app.settings.update(s), successMessage: 'تم حفظ هوية المحل');
    if (ok && mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final app = context.read<AppServices>();
    final bytes = _logoBytes;
    return Scaffold(
      appBar: AppBar(
        title: const Text('هوية المحل والطباعة'),
        actions: [
          IconButton(
            tooltip: 'معاينة PDF بالإعدادات المحفوظة',
            icon: const Icon(Icons.preview_rounded),
            onPressed: () => showExportSheet(context, title: 'معاينة الهوية', options: [
              ExportOption(
                title: 'نموذج تقرير هذا الشهر',
                subtitle: 'يظهر فيه الشعار والبيان العلوي والسفلي كما ستُطبع',
                icon: Icons.picture_as_pdf_rounded,
                fileBase: 'معاينة',
                build: () => app.pdf.periodReport(DateRange.thisMonth(), title: 'معاينة'),
              ),
            ]),
          ),
        ],
      ),
      body: SafeArea(
        child: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Live preview of the printed header
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: c.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: c.border),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Row(children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: c.primarySoft,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: c.border),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: bytes == null
                          ? Icon(Icons.storefront_rounded, color: c.primaryStrong, size: 32)
                          : Image.memory(bytes, fit: BoxFit.contain),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(_store.text.isEmpty ? 'اسم المحل' : _store.text,
                            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.primaryStrong)),
                        if (_header.text.isNotEmpty) Text(_header.text, style: const TextStyle(fontSize: 12)),
                        Text(
                          [if (_address.text.isNotEmpty) _address.text, if (_phone.text.isNotEmpty) 'هاتف: ${_phone.text}'].join(' • '),
                          style: TextStyle(fontSize: 11, color: c.textMuted),
                        ),
                      ]),
                    ),
                  ]),
                  Divider(color: c.primary, thickness: 1.2, height: 18),
                  Container(height: 6, margin: const EdgeInsets.only(bottom: 4), color: c.border.withValues(alpha: 0.5)),
                  Container(height: 6, margin: const EdgeInsets.only(bottom: 4), color: c.border.withValues(alpha: 0.3)),
                  Container(height: 6, width: 120, color: c.border.withValues(alpha: 0.3)),
                  Divider(color: c.border, height: 18),
                  Center(child: Text(_footer.text.isEmpty ? '— البيان السفلي —' : _footer.text, style: TextStyle(fontSize: 11, color: c.textMuted))),
                ]),
              ),
              const SizedBox(height: 6),
              Center(child: Text('معاينة مباشرة لرأس وتذييل كل فاتورة وتقرير', style: TextStyle(fontSize: 11, color: c.textMuted))),

              const SectionTitle('الشعار'),
              Row(children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : () => _pickLogo(ImageSource.gallery),
                    icon: const Icon(Icons.photo_library_outlined),
                    label: const Text('من المعرض'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : () => _pickLogo(ImageSource.camera),
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: const Text('بالكاميرا'),
                  ),
                ),
                if (bytes != null) ...[
                  const SizedBox(width: 8),
                  IconButton.filledTonal(
                    tooltip: 'إزالة الشعار',
                    onPressed: () => setState(() => _logo = null),
                    icon: Icon(Icons.delete_outline, color: c.danger),
                  ),
                ],
              ]),

              const SectionTitle('بيانات المحل'),
              TextFormField(
                controller: _store,
                decoration: const InputDecoration(labelText: 'اسم المحل *'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'مطلوب' : null,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              TextFormField(controller: _owner, decoration: const InputDecoration(labelText: 'اسم المالك'), onChanged: (_) => setState(() {})),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                textDirection: TextDirection.ltr,
                decoration: const InputDecoration(labelText: 'الهاتف'),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              TextFormField(controller: _address, decoration: const InputDecoration(labelText: 'العنوان'), onChanged: (_) => setState(() {})),

              const SectionTitle('البيان العلوي والسفلي'),
              TextFormField(
                controller: _header,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'البيان العلوي (تحت اسم المحل)',
                  hintText: 'مثال: مواد غذائية • جملة وقطاعي • السجل التجاري 12345',
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _footer,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'البيان السفلي (أسفل كل فاتورة وتقرير)',
                  hintText: 'مثال: شكراً لتسوقكم معنا — البضاعة المباعة لا تُرد بعد 3 أيام',
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 22),
              FilledButton.icon(onPressed: _busy ? null : _save, icon: const Icon(Icons.save_rounded), label: const Text('حفظ هوية المحل')),
            ],
          ),
        ),
      ),
    );
  }
}
