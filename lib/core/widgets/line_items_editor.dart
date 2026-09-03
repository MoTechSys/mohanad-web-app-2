import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/ledger_db.dart';
import '../../domain/models/documents.dart';
import '../../domain/models/inventory.dart';
import '../money/money.dart';
import '../theme/app_theme.dart';
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
        OutlinedButton.icon(
          onPressed: () => _edit(context, null),
          icon: const Icon(Icons.add),
          label: const Text('إضافة صنف'),
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
                MoneyText(total, size: 18, color: AppColors.primaryDark),
              ],
            ),
          ),
      ],
    );
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
          '${line.qty.format()} × ${line.unitPrice.format()}',
          textDirection: TextDirection.ltr,
          textAlign: TextAlign.right,
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            MoneyText(line.lineTotal),
            IconButton(
              icon: const Icon(Icons.delete_outline, color: AppColors.danger),
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

  @override
  void initState() {
    super.initState();
    final pid = widget.existing?.productId;
    if (pid != null) _product = context.read<LedgerDb>().products[pid];
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
      if (p != null) {
        _name.text = p.name;
        _price.text =
            (widget.forPurchase ? p.purchasePrice : p.salePrice).toEditable();
      }
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
            PickerField<Product>(
              label: 'من المنتجات',
              items: products,
              labelOf: (p) => p.name,
              subtitleOf: (p) =>
                  'المخزون: ${db.stockOf(p.id).format()} ${p.unit} • '
                  'بيع ${p.salePrice.format()} • شراء ${p.purchasePrice.format()}',
              value: _product,
              onChanged: _pickProduct,
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
                  label: widget.forPurchase ? 'سعر الشراء *' : 'سعر البيع *',
                  allowZero: true,
                  onChanged: (_) => setState(() {}),
                ),
              ),
            ],
          ),
          if (_product != null &&
              !widget.forPurchase &&
              _product!.trackInventory &&
              qty > db.stockOf(_product!.id))
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'تنبيه: الكمية أكبر من المخزون المتاح (${db.stockOf(_product!.id).format()}) — سيصبح المخزون سالباً',
                style: const TextStyle(color: AppColors.warning, fontSize: 12),
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
              Navigator.pop(
                context,
                DocLine(
                  productId: p?.id,
                  name: _name.text.trim(),
                  qty: Qty.tryParse(_qty.text)!,
                  unitPrice: Money.tryParse(_price.text)!,
                  unitCost: p?.purchasePrice ?? Money.zero,
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
