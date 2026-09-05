import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/money/money.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/barcode_scanner_view.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/export_actions.dart';
import '../../data/export/pdf_exporter.dart';
import '../../data/ledger_db.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/inventory.dart';

class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key});
  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  String _q = '';
  bool _lowOnly = false;

  @override
  Widget build(BuildContext context) {
    final db = context.watch<LedgerDb>();
    final app = context.read<AppServices>();
    var list = db.activeProducts.toList()..sort((a, b) => a.name.compareTo(b.name));
    final q = _q.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list.where((p) => p.name.toLowerCase().contains(q) || (p.barcode ?? '').contains(q)).toList();
    }
    if (_lowOnly) {
      list = list.where((p) => p.trackInventory && db.stockOf(p.id) <= p.minQty).toList();
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('المنتجات والمخزون'),
        actions: [
          IconButton(
            tooltip: 'طباعة ملصقات الباركود',
            icon: const Icon(Icons.qr_code_2_rounded),
            onPressed: list.isEmpty ? null : () => _labelsSheet(context, list),
          ),
          ExportButton(
            title: 'تصدير المخزون',
            options: [
              ExportOption(
                title: 'تقرير المخزون PDF',
                subtitle: 'الأصناف والكميات والقيمة وتنبيهات النقص',
                icon: Icons.picture_as_pdf_rounded,
                fileBase: 'المخزون',
                build: app.pdf.inventoryReport,
              ),
              ExportOption(
                title: 'المخزون Excel',
                subtitle: 'ورقة الأصناف + كل حركات المخزون',
                icon: Icons.table_chart_rounded,
                fileBase: 'المخزون',
                isExcel: true,
                build: app.excel.inventoryWorkbook,
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 12),
            child: Center(child: Tag('قيمة المخزون: ${app.inventory.stockValue().format()}')),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'fab_product',
        onPressed: () => showFormSheet(context, const ProductFormSheet()),
        icon: const Icon(Icons.add),
        label: const Text('منتج جديد'),
      ),
      body: SafeArea(
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: Row(children: [
              Expanded(
                child: TextField(
                  decoration: const InputDecoration(hintText: 'بحث بالاسم أو الباركود', prefixIcon: Icon(Icons.search)),
                  onChanged: (v) => setState(() => _q = v),
                ),
              ),
              const SizedBox(width: 8),
              FilterChip(
                label: const Text('ناقص'),
                selected: _lowOnly,
                onSelected: (v) => setState(() => _lowOnly = v),
              ),
            ]),
          ),
          Expanded(
            child: list.isEmpty
                ? const EmptyState(icon: Icons.inventory_outlined, title: 'لا توجد منتجات',
                    subtitle: 'أضف منتجاتك لتتبع المخزون والأرباح بدقة')
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
                    itemCount: list.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final p = list[i];
                      final stock = db.stockOf(p.id);
                      final low = p.trackInventory && stock <= p.minQty;
                      return Card(
                        child: ListTile(
                          onTap: () => _actions(context, p),
                          title: Row(children: [
                            Expanded(child: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w700))),
                            if (low) Tag('ناقص', color: context.c.danger),
                          ]),
                          subtitle: Text(
                            'شراء ${p.purchasePrice.format()} • بيع ${p.salePrice.format()} • هامش ${p.unitMargin.format()}',
                            style: const TextStyle(fontSize: 12),
                          ),
                          trailing: p.trackInventory
                              ? Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(stock.format(), textDirection: TextDirection.ltr,
                                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800,
                                            color: low ? context.c.danger : context.c.primaryDark)),
                                    Text(p.unit, style: TextStyle(fontSize: 11, color: context.c.textMuted)),
                                  ],
                                )
                              : Tag('بدون تتبع', color: context.c.textMuted),
                        ),
                      );
                    },
                  ),
          ),
        ]),
      ),
    );
  }

  Future<void> _actions(BuildContext context, Product p) async {
    final app = context.read<AppServices>();
    final v = await showModalBottomSheet<String>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w800))),
          ListTile(leading: const Icon(Icons.edit_outlined), title: const Text('تعديل المنتج'),
              onTap: () => Navigator.pop(context, 'edit')),
          if (p.trackInventory) ...[
            ListTile(leading: Icon(Icons.add_box_outlined, color: context.c.primaryDark),
                title: const Text('إدخال كمية (وارد)'), onTap: () => Navigator.pop(context, 'in')),
            ListTile(leading: Icon(Icons.remove_circle_outline, color: context.c.danger),
                title: const Text('إخراج / هالك'), onTap: () => Navigator.pop(context, 'loss')),
            ListTile(leading: const Icon(Icons.tune), title: const Text('جرد (تحديد الكمية الفعلية)'),
                onTap: () => Navigator.pop(context, 'adjust')),
          ],
          ListTile(leading: Icon(Icons.qr_code_2_rounded, color: context.c.info),
              title: const Text('ملصق باركود للطباعة'), onTap: () => Navigator.pop(context, 'label')),
          ListTile(leading: Icon(Icons.delete_outline, color: context.c.danger),
              title: const Text('حذف'), onTap: () => Navigator.pop(context, 'delete')),
        ]),
      ),
    );
    if (v == null || !context.mounted) return;
    if (v == 'edit') {
      await showFormSheet(context, ProductFormSheet(existing: p));
    } else if (v == 'label') {
      await _labelsSheet(context, [p]);
    } else if (v == 'delete') {
      if (await confirm(context, title: 'حذف المنتج؟', confirmLabel: 'حذف', destructive: true)) {
        if (!context.mounted) return;
        await guarded(context, () => app.inventory.deleteProduct(p.id), successMessage: 'تم الحذف');
      }
    } else {
      final type = switch (v) {
        'in' => StockMoveType.inbound,
        'loss' => StockMoveType.loss,
        _ => StockMoveType.adjustment,
      };
      await showFormSheet(context, _MoveSheet(product: p, type: type));
    }
  }
}

/// Choose label size & copies, then share/print the label sheet.
Future<void> _labelsSheet(BuildContext context, List<Product> products) async {
  final app = context.read<AppServices>();
  var size = LabelSize.medium;
  var copies = products.length == 1 ? 12 : 1;
  final ok = await showModalBottomSheet<bool>(
    context: context,
    showDragHandle: true,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setS) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SheetTitle(products.length == 1 ? 'ملصق: ${products.first.name}' : 'ملصقات ${products.length} صنف'),
            Text('يُطبع لكل صنف: اسم المحل، اسم الصنف، الباركود (EAN-13 / Code-128) والسعر. الأصناف بدون باركود تحصل على كود داخلي قابل للمسح.',
                style: TextStyle(fontSize: 12, color: ctx.c.textMuted)),
            const SizedBox(height: 12),
            SegmentedButton<LabelSize>(
              segments: [for (final l in LabelSize.values) ButtonSegment(value: l, label: Text(l.label, style: const TextStyle(fontSize: 11)))],
              selected: {size},
              onSelectionChanged: (v) => setS(() => size = v.first),
            ),
            const SizedBox(height: 12),
            Row(children: [
              const Expanded(child: Text('عدد النسخ لكل صنف')),
              IconButton.filledTonal(onPressed: copies > 1 ? () => setS(() => copies--) : null, icon: const Icon(Icons.remove)),
              SizedBox(width: 36, child: Text('$copies', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
              IconButton.filledTonal(onPressed: copies < 99 ? () => setS(() => copies++) : null, icon: const Icon(Icons.add)),
            ]),
            const SizedBox(height: 16),
            FilledButton.icon(onPressed: () => Navigator.pop(ctx, true), icon: const Icon(Icons.qr_code_2_rounded), label: const Text('إنشاء الملصقات')),
          ]),
        ),
      ),
    ),
  );
  if (ok != true || !context.mounted) return;
  await showExportSheet(context, title: 'ملصقات الباركود', options: [
    ExportOption(
      title: 'ورقة ملصقات A4 (PDF)',
      subtitle: '${products.length} صنف × $copies نسخة • ${size.label}',
      icon: Icons.qr_code_2_rounded,
      fileBase: 'ملصقات-باركود',
      build: () => app.pdf.barcodeLabels(products, copies: copies, size: size),
    ),
  ]);
}

class _MoveSheet extends StatefulWidget {
  const _MoveSheet({required this.product, required this.type});
  final Product product;
  final StockMoveType type;
  @override
  State<_MoveSheet> createState() => _MoveSheetState();
}

class _MoveSheetState extends State<_MoveSheet> {
  final _form = GlobalKey<FormState>();
  final _qty = TextEditingController();
  final _notes = TextEditingController();
  @override
  void dispose() { _qty.dispose(); _notes.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final db = context.read<LedgerDb>();
    final adjust = widget.type == StockMoveType.adjustment;
    return Form(
      key: _form,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SheetTitle('${widget.type.label} — ${widget.product.name}'),
        Text('المخزون الحالي: ${db.stockOf(widget.product.id).format()} ${widget.product.unit}',
            style: TextStyle(color: context.c.textMuted)),
        const SizedBox(height: 12),
        QtyField(controller: _qty, label: adjust ? 'الكمية الفعلية بعد الجرد *' : 'الكمية *', allowZero: adjust),
        const SizedBox(height: 12),
        TextFormField(controller: _notes, decoration: const InputDecoration(labelText: 'ملاحظات')),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: () async {
            if (!(_form.currentState?.validate() ?? false)) return;
            final ok = await guarded(context, () => context.read<AppServices>().inventory.manualMove(
                widget.product.id, widget.type, Qty.tryParse(_qty.text)!, notes: _notes.text),
                successMessage: 'تم تسجيل الحركة');
            if (ok && context.mounted) Navigator.pop(context);
          },
          child: const Text('حفظ'),
        ),
      ]),
    );
  }
}

class ProductFormSheet extends StatefulWidget {
  const ProductFormSheet({super.key, this.existing, this.initialBarcode});
  final Product? existing;
  /// Pre-fills the barcode field (used when the cashier scans an unknown code).
  final String? initialBarcode;
  @override
  State<ProductFormSheet> createState() => _ProductFormSheetState();
}

class _ProductFormSheetState extends State<ProductFormSheet> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _barcode = TextEditingController(
      text: widget.existing?.barcode ?? widget.initialBarcode ?? '');
  late final _unit = TextEditingController(text: widget.existing?.unit ?? 'حبة');
  late final _buy = TextEditingController(text: widget.existing?.purchasePrice.toEditable());
  late final _sell = TextEditingController(text: widget.existing?.salePrice.toEditable());
  late final _min = TextEditingController(text: widget.existing?.minQty.format());
  final _opening = TextEditingController();
  late bool _track = widget.existing?.trackInventory ?? true;
  late List<PackUnit> _packUnits = [...?widget.existing?.packUnits];
  bool get isEdit => widget.existing != null;

  @override
  void dispose() {
    for (final c in [_name, _barcode, _unit, _buy, _sell, _min, _opening]) { c.dispose(); }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _form,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SheetTitle(isEdit ? 'تعديل منتج' : 'منتج جديد'),
        TextFormField(controller: _name, autofocus: !isEdit,
            decoration: const InputDecoration(labelText: 'اسم المنتج *'),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'الاسم مطلوب' : null),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: TextFormField(
              controller: _barcode,
              textDirection: TextDirection.ltr,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: 'الباركود',
                suffixIcon: IconButton(
                  tooltip: 'مسح بالكاميرا',
                  icon: const Icon(Icons.qr_code_scanner_rounded),
                  onPressed: () async {
                    final code = await scanBarcodeOnce(context, title: 'مسح باركود المنتج');
                    if (code != null && mounted) {
                      setState(() => _barcode.text = LedgerDb.normalizeBarcode(code));
                    }
                  },
                ),
              ),
              validator: (v) {
                final code = LedgerDb.normalizeBarcode(v ?? '');
                if (code.isEmpty) return null;
                final dup = context.read<LedgerDb>().productByBarcode(code);
                if (dup != null && dup.id != widget.existing?.id) {
                  return 'مستخدم للمنتج: ${dup.name}';
                }
                return null;
              },
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: TextFormField(
              controller: _unit,
              decoration: InputDecoration(
                labelText: 'الوحدة الأساسية',
                suffixIcon: PopupMenuButton<String>(
                  tooltip: 'وحدات شائعة',
                  icon: const Icon(Icons.arrow_drop_down),
                  onSelected: (u) => setState(() => _unit.text = u),
                  itemBuilder: (_) => [
                    for (final u in kCommonUnits)
                      PopupMenuItem(value: u, child: Text(u)),
                  ],
                ),
              ),
            ),
          ),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: MoneyField(controller: _buy, label: 'سعر الشراء', allowZero: true, optional: true, hint: '0')),
          const SizedBox(width: 10),
          Expanded(child: MoneyField(controller: _sell, label: 'سعر البيع', allowZero: true, optional: true, hint: '0')),
        ]),
        const SizedBox(height: 12),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('تتبع المخزون'),
          value: _track,
          onChanged: (v) => setState(() => _track = v),
        ),
        if (_track)
          Row(children: [
            Expanded(child: QtyField(controller: _min, label: 'حد النقص', allowZero: true, optional: true)),
            if (!isEdit) ...[
              const SizedBox(width: 10),
              Expanded(child: QtyField(controller: _opening, label: 'الكمية الافتتاحية', allowZero: true, optional: true)),
            ],
          ]),
        const SizedBox(height: 8),
        // ── وحدات العبوة (كرتون / جوتة / قرطاس …) ──
        Row(children: [
          const Expanded(
            child: Text('وحدات العبوة (اختياري)',
                style: TextStyle(fontWeight: FontWeight.w700)),
          ),
          TextButton.icon(
            onPressed: () => _editPackUnit(null),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('إضافة عبوة'),
          ),
        ]),
        if (_packUnits.isEmpty)
          Text(
            'مثال: كرتون = 24 ${_unit.text.trim().isEmpty ? 'حبة' : _unit.text.trim()} — يتيح البيع والشراء بالعبوة مع خصم المخزون بدقة',
            style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor),
          )
        else
          for (var i = 0; i < _packUnits.length; i++)
            Card(
              margin: const EdgeInsets.only(bottom: 6),
              child: ListTile(
                dense: true,
                onTap: () => _editPackUnit(i),
                leading: const Icon(Icons.inventory_2_outlined),
                title: Text(
                  '${_packUnits[i].name} = ${_packUnits[i].factor.format()} ${_unit.text.trim().isEmpty ? 'حبة' : _unit.text.trim()}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(
                  'بيع: ${_packUnits[i].salePrice?.format() ?? 'تلقائي (×العامل)'} • شراء: ${_packUnits[i].purchasePrice?.format() ?? 'تلقائي'}',
                ),
                trailing: IconButton(
                  icon: Icon(Icons.delete_outline, color: context.c.danger),
                  visualDensity: VisualDensity.compact,
                  onPressed: () =>
                      setState(() => _packUnits = [..._packUnits]..removeAt(i)),
                ),
              ),
            ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: () async {
            if (!(_form.currentState?.validate() ?? false)) return;
            final app = context.read<AppServices>();
            Money m(TextEditingController c) => Money.tryParse(c.text) ?? Money.zero;
            Qty qq(TextEditingController c) => Qty.tryParse(c.text) ?? Qty.zero;
            final barcode = LedgerDb.normalizeBarcode(_barcode.text);
            Product? result;
            final ok = await guarded(context, () async {
              if (isEdit) {
                result = await app.inventory.updateProduct(widget.existing!.id, name: _name.text, barcode: barcode,
                    unit: _unit.text, purchasePrice: m(_buy), salePrice: m(_sell), minQty: qq(_min),
                    trackInventory: _track, packUnits: _packUnits);
              } else {
                result = await app.inventory.createProduct(name: _name.text, barcode: barcode.isEmpty ? null : barcode,
                    unit: _unit.text.trim().isEmpty ? 'حبة' : _unit.text, purchasePrice: m(_buy), salePrice: m(_sell),
                    minQty: qq(_min), trackInventory: _track, openingQty: qq(_opening), packUnits: _packUnits);
              }
            }, successMessage: isEdit ? 'تم التحديث' : 'تمت الإضافة');
            if (ok && context.mounted) Navigator.pop(context, result);
          },
          child: Text(isEdit ? 'حفظ' : 'إضافة'),
        ),
      ]),
    );
  }

  Future<void> _editPackUnit(int? index) async {
    final result = await showFormSheet<PackUnit>(
      context,
      _PackUnitForm(
        existing: index == null ? null : _packUnits[index],
        baseUnit: _unit.text.trim().isEmpty ? 'حبة' : _unit.text.trim(),
        takenNames: [
          _unit.text.trim(),
          for (var i = 0; i < _packUnits.length; i++)
            if (i != index) _packUnits[i].name,
        ],
      ),
    );
    if (result == null || !mounted) return;
    setState(() {
      final n = [..._packUnits];
      if (index == null) {
        n.add(result);
      } else {
        n[index] = result;
      }
      _packUnits = n;
    });
  }
}

/// Add/edit one packaging unit: name + factor + optional pack prices.
class _PackUnitForm extends StatefulWidget {
  const _PackUnitForm({
    this.existing,
    required this.baseUnit,
    required this.takenNames,
  });
  final PackUnit? existing;
  final String baseUnit;
  final List<String> takenNames;
  @override
  State<_PackUnitForm> createState() => _PackUnitFormState();
}

class _PackUnitFormState extends State<_PackUnitForm> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _factor = TextEditingController(
    text: widget.existing?.factor.format() ?? '',
  );
  late final _sell = TextEditingController(
    text: widget.existing?.salePrice?.toEditable() ?? '',
  );
  late final _buy = TextEditingController(
    text: widget.existing?.purchasePrice?.toEditable() ?? '',
  );

  @override
  void dispose() {
    for (final c in [_name, _factor, _sell, _buy]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _form,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SheetTitle(widget.existing == null ? 'إضافة عبوة' : 'تعديل عبوة'),
        Row(children: [
          Expanded(
            child: TextFormField(
              controller: _name,
              autofocus: widget.existing == null,
              decoration: InputDecoration(
                labelText: 'اسم العبوة *',
                hintText: 'كرتون / جوتة / قرطاس …',
                suffixIcon: PopupMenuButton<String>(
                  tooltip: 'وحدات شائعة',
                  icon: const Icon(Icons.arrow_drop_down),
                  onSelected: (u) => setState(() => _name.text = u),
                  itemBuilder: (_) => [
                    for (final u in kCommonUnits)
                      if (!widget.takenNames.contains(u))
                        PopupMenuItem(value: u, child: Text(u)),
                  ],
                ),
              ),
              validator: (v) {
                final t = v?.trim() ?? '';
                if (t.isEmpty) return 'الاسم مطلوب';
                if (widget.takenNames.contains(t)) return 'الاسم مستخدم مسبقاً';
                return null;
              },
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: QtyField(
              controller: _factor,
              label: 'كم ${widget.baseUnit} بالعبوة؟ *',
              onChanged: (_) => setState(() {}),
            ),
          ),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: MoneyField(
              controller: _sell,
              label: 'سعر بيع العبوة',
              optional: true,
              allowZero: true,
              hint: 'تلقائي',
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: MoneyField(
              controller: _buy,
              label: 'سعر شراء العبوة',
              optional: true,
              allowZero: true,
              hint: 'تلقائي',
            ),
          ),
        ]),
        const SizedBox(height: 6),
        Text(
          'اترك السعر فارغاً ليُحسب تلقائياً = سعر الـ${widget.baseUnit} × العدد',
          style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: () {
            if (!(_form.currentState?.validate() ?? false)) return;
            final factor = Qty.tryParse(_factor.text) ?? Qty.zero;
            if (!(factor > Qty.one)) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('عدد الوحدات بالعبوة يجب أن يكون أكبر من 1')),
              );
              return;
            }
            Navigator.pop(
              context,
              PackUnit(
                name: _name.text.trim(),
                factor: factor,
                salePrice: Money.tryParse(_sell.text),
                purchasePrice: Money.tryParse(_buy.text),
              ),
            );
          },
          child: const Text('تأكيد'),
        ),
      ]),
    );
  }
}
