import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/money/money.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
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
                            if (low) const Tag('ناقص', color: AppColors.danger),
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
                                            color: low ? AppColors.danger : AppColors.primaryDark)),
                                    Text(p.unit, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                                  ],
                                )
                              : const Tag('بدون تتبع', color: AppColors.textMuted),
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
            ListTile(leading: const Icon(Icons.add_box_outlined, color: AppColors.primaryDark),
                title: const Text('إدخال كمية (وارد)'), onTap: () => Navigator.pop(context, 'in')),
            ListTile(leading: const Icon(Icons.remove_circle_outline, color: AppColors.danger),
                title: const Text('إخراج / هالك'), onTap: () => Navigator.pop(context, 'loss')),
            ListTile(leading: const Icon(Icons.tune), title: const Text('جرد (تحديد الكمية الفعلية)'),
                onTap: () => Navigator.pop(context, 'adjust')),
          ],
          ListTile(leading: const Icon(Icons.delete_outline, color: AppColors.danger),
              title: const Text('حذف'), onTap: () => Navigator.pop(context, 'delete')),
        ]),
      ),
    );
    if (v == null || !context.mounted) return;
    if (v == 'edit') {
      await showFormSheet(context, ProductFormSheet(existing: p));
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
            style: const TextStyle(color: AppColors.textMuted)),
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
  const ProductFormSheet({super.key, this.existing});
  final Product? existing;
  @override
  State<ProductFormSheet> createState() => _ProductFormSheetState();
}

class _ProductFormSheetState extends State<ProductFormSheet> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _barcode = TextEditingController(text: widget.existing?.barcode);
  late final _unit = TextEditingController(text: widget.existing?.unit ?? 'حبة');
  late final _buy = TextEditingController(text: widget.existing?.purchasePrice.toEditable());
  late final _sell = TextEditingController(text: widget.existing?.salePrice.toEditable());
  late final _min = TextEditingController(text: widget.existing?.minQty.format());
  final _opening = TextEditingController();
  late bool _track = widget.existing?.trackInventory ?? true;
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
          Expanded(child: TextFormField(controller: _barcode, textDirection: TextDirection.ltr,
              decoration: const InputDecoration(labelText: 'الباركود'))),
          const SizedBox(width: 10),
          Expanded(child: TextFormField(controller: _unit, decoration: const InputDecoration(labelText: 'الوحدة'))),
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
        const SizedBox(height: 20),
        FilledButton(
          onPressed: () async {
            if (!(_form.currentState?.validate() ?? false)) return;
            final app = context.read<AppServices>();
            Money m(TextEditingController c) => Money.tryParse(c.text) ?? Money.zero;
            Qty qq(TextEditingController c) => Qty.tryParse(c.text) ?? Qty.zero;
            final ok = await guarded(context, () async {
              if (isEdit) {
                await app.inventory.updateProduct(widget.existing!.id, name: _name.text, barcode: _barcode.text,
                    unit: _unit.text, purchasePrice: m(_buy), salePrice: m(_sell), minQty: qq(_min), trackInventory: _track);
              } else {
                await app.inventory.createProduct(name: _name.text, barcode: _barcode.text.trim().isEmpty ? null : _barcode.text,
                    unit: _unit.text.trim().isEmpty ? 'حبة' : _unit.text, purchasePrice: m(_buy), salePrice: m(_sell),
                    minQty: qq(_min), trackInventory: _track, openingQty: qq(_opening));
              }
            }, successMessage: isEdit ? 'تم التحديث' : 'تمت الإضافة');
            if (ok && context.mounted) Navigator.pop(context);
          },
          child: Text(isEdit ? 'حفظ' : 'إضافة'),
        ),
      ]),
    );
  }
}
