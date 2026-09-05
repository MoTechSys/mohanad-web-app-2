import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/ledger_db.dart';
import '../../domain/models/documents.dart';
import '../../domain/models/inventory.dart';
import '../money/money.dart';
import '../theme/app_theme.dart';
import 'barcode_scanner_view.dart';
import 'common.dart';

/// Editable list of [DocLine]s for detailed sales/purchases.
/// [forPurchase] uses purchasePrice as default unit price.
class LineItemsEditor extends StatelessWidget {
  const LineItemsEditor({
    super.key,
    required this.lines,
    required this.onChanged,
    this.forPurchase = false,
  });

  final List<DocLine> lines;
  final ValueChanged<List<DocLine>> onChanged;
  final bool forPurchase;

  Money get total => lines.fold(Money.zero, (p, l) => p + l.lineTotal);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < lines.length; i++)
          _LineTile(
            line: lines[i],
            onEdit: () => _edit(context, i),
            onDelete: () {
              final n = [...lines]..removeAt(i);
              onChanged(n);
            },
          ),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _edit(context, null),
                icon: const Icon(Icons.add),
                label: const Text('إضافة صنف'),
              ),
            ),
            if (context.read<LedgerDb>().settings.inventoryEnabled) ...[
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton.tonalIcon(
                  onPressed: () => _scan(context),
                  icon: const Icon(Icons.qr_code_scanner_rounded),
                  label: const Text('مسح باركود'),
                ),
              ),
            ],
          ],
        ),
        if (lines.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'إجمالي الأصناف',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                MoneyText(total, size: 18, color: context.c.primaryDark),
              ],
            ),
          ),
      ],
    );
  }

  /// Scan a barcode: known product → add line (or +1 if already present);
  /// unknown → open the line form with the code so the user can name it.
  Future<void> _scan(BuildContext context) async {
    final db = context.read<LedgerDb>();
    final code = await scanBarcodeOnce(context, title: 'مسح باركود الصنف');
    if (code == null || !context.mounted) return;
    final p = db.productByBarcode(code);
    if (p == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('لا يوجد منتج بالباركود ${LedgerDb.normalizeBarcode(code)} — أضفه من شاشة المنتجات أولاً')),
      );
      return;
    }
    final n = [...lines];
    // Merge only with a base-unit line of the same product (pack lines stay).
    final i = n.indexWhere(
      (l) => l.productId == p.id && l.unitFactor == Qty.one,
    );
    if (i >= 0) {
      final l = n[i];
      n[i] = DocLine(
        productId: l.productId,
        name: l.name,
        qty: l.qty + Qty.one,
        unitPrice: l.unitPrice,
        unitCost: l.unitCost,
        unitName: l.unitName,
        unitFactor: l.unitFactor,
      );
    } else {
      n.add(DocLine(
        productId: p.id,
        name: p.name,
        qty: Qty.one,
        unitPrice: forPurchase ? p.purchasePrice : p.salePrice,
        unitCost: p.purchasePrice,
      ));
    }
    onChanged(n);
  }

  Future<void> _edit(BuildContext context, int? index) async {
    final result = await showFormSheet<DocLine>(
      context,
      _LineForm(
        existing: index == null ? null : lines[index],
        forPurchase: forPurchase,
      ),
    );
    if (result == null) return;
    final n = [...lines];
    if (index == null) {
      n.add(result);
    } else {
      n[index] = result;
    }
    onChanged(n);
  }
}

class _LineTile extends StatelessWidget {
  const _LineTile({
    required this.line,
    required this.onEdit,
    required this.onDelete,
  });
  final DocLine line;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        dense: true,
        onTap: onEdit,
        title: Text(
          line.name,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          '${line.qtyLabel()} × ${line.unitPrice.format()}',
          textAlign: TextAlign.right,
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            MoneyText(line.lineTotal),
            IconButton(
              icon: Icon(Icons.delete_outline, color: context.c.danger),
              visualDensity: VisualDensity.compact,
              onPressed: onDelete,
            ),
          ],
        ),
      ),
    );
  }
}

class _LineForm extends StatefulWidget {
  const _LineForm({this.existing, required this.forPurchase});
  final DocLine? existing;
  final bool forPurchase;
  @override
  State<_LineForm> createState() => _LineFormState();
}

class _LineFormState extends State<_LineForm> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _qty = TextEditingController(
    text: widget.existing?.qty.format() ?? '1',
  );
  late final _price = TextEditingController(
    text: widget.existing?.unitPrice.toEditable(),
  );
  Product? _product;

  /// Selected sale/purchase unit. Null ⇒ the product's base unit (or a
  /// free-text line without a product).
  PackUnit? _unit;

  @override
  void initState() {
    super.initState();
    final pid = widget.existing?.productId;
    if (pid != null) _product = context.read<LedgerDb>().products[pid];
    final uName = widget.existing?.unitName;
    if (uName != null && _product != null) {
      for (final u in _product!.allUnits) {
        if (u.name == uName) {
          _unit = u;
          break;
        }
      }
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _qty.dispose();
    _price.dispose();
    super.dispose();
  }

  void _pickProduct(Product? p) {
    setState(() {
      _product = p;
      _unit = null; // reset to base unit on product change
      if (p != null) {
        _name.text = p.name;
        _price.text =
            (widget.forPurchase ? p.purchasePrice : p.salePrice).toEditable();
      }
    });
  }

  /// Change the selling unit and auto-fill its price (pack price if set,
  /// otherwise base price × factor).
  void _pickUnit(PackUnit? u) {
    final p = _product;
    if (p == null) return;
    setState(() {
      _unit = (u != null && u.factor == Qty.one && u.name == p.unit) ? null : u;
      final chosen = _unit ??
          PackUnit(
            name: p.unit,
            factor: Qty.one,
            salePrice: p.salePrice,
            purchasePrice: p.purchasePrice,
          );
      _price.text = (widget.forPurchase
              ? chosen.purchaseOf(p.purchasePrice)
              : chosen.saleOf(p.salePrice))
          .toEditable();
    });
  }

  @override
  Widget build(BuildContext context) {
    final db = context.read<LedgerDb>();
    final products = db.activeProducts.toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    final inventoryOn = db.settings.inventoryEnabled && products.isNotEmpty;
    final qty = Qty.tryParse(_qty.text) ?? Qty.zero;
    final price = Money.tryParse(_price.text) ?? Money.zero;

    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SheetTitle(widget.existing == null ? 'إضافة صنف' : 'تعديل صنف'),
          if (inventoryOn) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: PickerField<Product>(
                    label: 'من المنتجات',
                    items: products,
                    labelOf: (p) => p.name,
                    subtitleOf: (p) =>
                        'المخزون: ${db.stockOf(p.id).format()} ${p.unit} • '
                        'بيع ${p.salePrice.format()} • شراء ${p.purchasePrice.format()}',
                    value: _product,
                    onChanged: _pickProduct,
                  ),
                ),
                const SizedBox(width: 8),
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: IconButton.filledTonal(
                    tooltip: 'مسح باركود',
                    icon: const Icon(Icons.qr_code_scanner_rounded),
                    onPressed: () async {
                      final code = await scanBarcodeOnce(context, title: 'مسح باركود الصنف');
                      if (code == null || !context.mounted) return;
                      final p = db.productByBarcode(code);
                      if (p == null) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('لا يوجد منتج بهذا الباركود')),
                        );
                      } else {
                        _pickProduct(p);
                      }
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          TextFormField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'اسم الصنف *'),
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'الاسم مطلوب' : null,
          ),
          const SizedBox(height: 12),
          if (_product != null && _product!.packUnits.isNotEmpty) ...[
            DropdownButtonFormField<String>(
              initialValue: _unit?.name ?? _product!.unit,
              decoration: const InputDecoration(
                labelText: 'الوحدة',
                prefixIcon: Icon(Icons.inventory_2_outlined),
              ),
              items: [
                for (final u in _product!.allUnits)
                  DropdownMenuItem(
                    value: u.name,
                    child: Text(
                      u.factor == Qty.one
                          ? u.name
                          : '${u.name} (${u.factor.format()} ${_product!.unit})',
                    ),
                  ),
              ],
              onChanged: (name) {
                if (name == null) return;
                final p = _product!;
                PackUnit chosen = PackUnit(
                  name: p.unit,
                  factor: Qty.one,
                  salePrice: p.salePrice,
                  purchasePrice: p.purchasePrice,
                );
                for (final u in p.allUnits) {
                  if (u.name == name) {
                    chosen = u;
                    break;
                  }
                }
                _pickUnit(chosen);
              },
            ),
            const SizedBox(height: 12),
          ],
          Row(
            children: [
              Expanded(
                child: QtyField(
                  controller: _qty,
                  label: 'الكمية *',
                  onChanged: (_) => setState(() {}),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: MoneyField(
                  controller: _price,
                  label: _unit == null
                      ? (widget.forPurchase ? 'سعر الشراء *' : 'سعر البيع *')
                      : (widget.forPurchase
                          ? 'سعر شراء الـ${_unit!.name} *'
                          : 'سعر بيع الـ${_unit!.name} *'),
                  allowZero: true,
                  onChanged: (_) => setState(() {}),
                ),
              ),
            ],
          ),
          if (_product != null && (_unit?.factor ?? Qty.one) > Qty.one)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                '= ${qty.times(_unit!.factor).format()} ${_product!.unit} من المخزون',
                style: TextStyle(color: context.c.primaryDark, fontSize: 12),
              ),
            ),
          if (_product != null &&
              !widget.forPurchase &&
              _product!.trackInventory &&
              qty.times(_unit?.factor ?? Qty.one) > db.stockOf(_product!.id))
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                db.settings.blockOversell
                    ? '⛔ الكمية أكبر من المخزون المتاح (${db.stockOf(_product!.id).format()} ${_product!.unit}) — لن يُقبل البيع'
                    : 'تنبيه: الكمية أكبر من المخزون المتاح (${db.stockOf(_product!.id).format()} ${_product!.unit}) — سيصبح المخزون سالباً',
                style: TextStyle(
                  color: db.settings.blockOversell
                      ? context.c.danger
                      : context.c.warning,
                  fontSize: 12,
                ),
              ),
            ),
          const SizedBox(height: 14),
          Row(
            children: [
              const Expanded(child: Text('إجمالي الصنف')),
              MoneyText(price.timesQty(qty), size: 18),
            ],
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () {
              if (!(_form.currentState?.validate() ?? false)) return;
              final p = _product;
              final u = _unit;
              Navigator.pop(
                context,
                DocLine(
                  productId: p?.id,
                  name: _name.text.trim(),
                  qty: Qty.tryParse(_qty.text)!,
                  unitPrice: Money.tryParse(_price.text)!,
                  // Cost per chosen unit = base cost × factor (pack cost if set).
                  unitCost: p == null
                      ? Money.zero
                      : (u?.purchaseOf(p.purchasePrice) ?? p.purchasePrice),
                  unitName: u?.name,
                  unitFactor: u?.factor ?? Qty.one,
                ),
              );
            },
            child: const Text('تأكيد'),
          ),
        ],
      ),
    );
  }
}
