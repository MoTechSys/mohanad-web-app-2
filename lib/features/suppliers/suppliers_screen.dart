import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/money/money.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/export_actions.dart';
import '../../data/ledger_db.dart';
import '../../domain/models/party.dart';
import '../customers/customer_detail_screen.dart' show PartyTxTile;
import '../customers/party_tx_sheet.dart';
import '../purchases/purchase_sheet.dart';
import '../purchases/purchases_screen.dart';

class SuppliersScreen extends StatefulWidget {
  const SuppliersScreen({super.key});

  @override
  State<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends State<SuppliersScreen> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final db = context.watch<LedgerDb>();
    var list = db.activeSuppliers.toList();
    final q = _q.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list
          .where(
            (s) =>
                s.name.toLowerCase().contains(q) || (s.phone ?? '').contains(q),
          )
          .toList();
    }
    list.sort(
      (a, b) => db
          .supplierBalance(b.id)
          .minor
          .compareTo(db.supplierBalance(a.id).minor),
    );
    final total = list.fold(Money.zero, (p, s) {
      final b = db.supplierBalance(s.id);
      return b.isPositive ? p + b : p;
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('التجار والمشتريات'),
        actions: [
          IconButton(
            tooltip: 'فواتير المشتريات',
            icon: const Icon(Icons.receipt_long_outlined),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const PurchasesScreen()),
            ),
          ),
        ],
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          FloatingActionButton.small(
            heroTag: 'fab_supplier_new',
            tooltip: 'مورد جديد',
            onPressed: () => showFormSheet(context, const SupplierFormSheet()),
            child: const Icon(Icons.person_add_alt_1),
          ),
          const SizedBox(height: 10),
          FloatingActionButton.extended(
            heroTag: 'fab_purchase',
            onPressed: () => showFormSheet(context, const PurchaseSheet()),
            icon: const Icon(Icons.add_shopping_cart),
            label: const Text('فاتورة شراء'),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: TextField(
                decoration: const InputDecoration(
                  hintText: 'بحث عن مورد',
                  prefixIcon: Icon(Icons.search),
                ),
                onChanged: (v) => setState(() => _q = v),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Expanded(
                    child: StatCard(
                      title: 'إجمالي مستحقات التجار',
                      value: total.format(),
                      icon: Icons.local_shipping_outlined,
                      color: context.c.info,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: list.isEmpty
                  ? EmptyState(
                      icon: Icons.local_shipping_outlined,
                      title: q.isEmpty ? 'لا يوجد موردون' : 'لا توجد نتائج',
                      subtitle: q.isEmpty
                          ? 'أضف الموردين لتتبع المشتريات والمستحقات'
                          : null,
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                      itemCount: list.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (_, i) {
                        final s = list[i];
                        final bal = db.supplierBalance(s.id);
                        return Card(
                          child: ListTile(
                            onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    SupplierDetailScreen(supplierId: s.id),
                              ),
                            ),
                            leading: CircleAvatar(
                              backgroundColor: context.c.infoLight,
                              child: Text(
                                s.name.characters.first,
                                style: TextStyle(
                                  color: context.c.info,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            title: Text(
                              s.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            subtitle: Text(
                              s.phone ?? 'بدون هاتف',
                              textDirection: TextDirection.ltr,
                              textAlign: TextAlign.right,
                              style: const TextStyle(fontSize: 12),
                            ),
                            trailing: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                MoneyText(
                                  bal,
                                  color: bal.isPositive
                                      ? context.c.info
                                      : context.c.primaryDark,
                                ),
                                Text(
                                  bal.isZero
                                      ? 'مسدد'
                                      : (bal.isPositive
                                            ? 'له علينا'
                                            : 'لنا عنده'),
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: context.c.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class SupplierFormSheet extends StatefulWidget {
  const SupplierFormSheet({super.key, this.existing});
  final Supplier? existing;
  @override
  State<SupplierFormSheet> createState() => _SupplierFormSheetState();
}

class _SupplierFormSheetState extends State<SupplierFormSheet> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _phone = TextEditingController(text: widget.existing?.phone);
  late final _address = TextEditingController(text: widget.existing?.address);
  late final _notes = TextEditingController(text: widget.existing?.notes);
  final _opening = TextEditingController();
  bool _busy = false;
  bool get isEdit => widget.existing != null;

  @override
  void dispose() {
    for (final c in [_name, _phone, _address, _notes, _opening]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    final app = context.read<AppServices>();
    final ok = await guarded(context, () async {
      if (isEdit) {
        await app.parties.updateSupplier(
          widget.existing!.id,
          name: _name.text,
          phone: _phone.text,
          address: _address.text,
          notes: _notes.text,
        );
      } else {
        await app.parties.createSupplier(
          name: _name.text,
          phone: _phone.text,
          address: _address.text,
          notes: _notes.text,
          openingBalance: _opening.text.trim().isEmpty
              ? Money.zero
              : Money.tryParse(_opening.text) ?? Money.zero,
        );
      }
    }, successMessage: isEdit ? 'تم تحديث المورد' : 'تمت إضافة المورد');
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SheetTitle(isEdit ? 'تعديل مورد' : 'مورد جديد'),
          TextFormField(
            controller: _name,
            autofocus: !isEdit,
            decoration: const InputDecoration(labelText: 'الاسم *'),
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'الاسم مطلوب' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(labelText: 'الهاتف'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _address,
            decoration: const InputDecoration(labelText: 'العنوان'),
          ),
          if (!isEdit) ...[
            const SizedBox(height: 12),
            MoneyField(
              controller: _opening,
              label: 'رصيد افتتاحي (مستحق سابق له)',
              optional: true,
              allowZero: true,
              allowNegative: true,
              hint: '0',
            ),
          ],
          const SizedBox(height: 12),
          TextFormField(
            controller: _notes,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'ملاحظات'),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _save,
            child: Text(isEdit ? 'حفظ التعديلات' : 'إضافة'),
          ),
        ],
      ),
    );
  }
}

class SupplierDetailScreen extends StatelessWidget {
  const SupplierDetailScreen({super.key, required this.supplierId});
  final String supplierId;

  @override
  Widget build(BuildContext context) {
    final db = context.watch<LedgerDb>();
    final app = context.read<AppServices>();
    final s = db.suppliers[supplierId];
    if (s == null || s.deletedAt != null) {
      return const Scaffold(body: Center(child: Text('المورد غير موجود')));
    }
    final bal = db.supplierBalance(s.id);
    final txs = db.supplierStatement(s.id);
    return Scaffold(
      appBar: AppBar(
        title: Text(s.name),
        actions: [
          ExportButton(
            title: 'كشف حساب ${s.name}',
            tooltip: 'كشف حساب PDF',
            options: [
              ExportOption(
                title: 'كشف حساب المورد PDF',
                subtitle: 'المشتريات الآجلة والدفعات والرصيد المستحق',
                icon: Icons.picture_as_pdf_rounded,
                fileBase: 'كشف-مورد-${s.name}',
                build: () => app.pdf.supplierStatement(s),
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            onPressed: () =>
                showFormSheet(context, SupplierFormSheet(existing: s)),
          ),
          PopupMenuButton<String>(
            onSelected: (v) async {
              switch (v) {
                case 'adjust':
                  await showFormSheet(
                    context,
                    PartyTxSheet.supplierAdjust(s.id),
                  );
                case 'delete':
                  if (await confirm(
                    context,
                    title: 'حذف المورد؟',
                    message: 'لا يمكن الحذف إذا كان هناك رصيد.',
                    confirmLabel: 'حذف',
                    destructive: true,
                  )) {
                    if (!context.mounted) return;
                    final ok = await guarded(
                      context,
                      () => app.parties.deleteSupplier(s.id),
                      successMessage: 'تم حذف المورد',
                    );
                    if (ok && context.mounted) Navigator.pop(context);
                  }
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(value: 'adjust', child: Text('تسوية يدوية')),
              PopupMenuDivider(),
              PopupMenuItem(
                value: 'delete',
                child: Text(
                  'حذف المورد',
                  style: TextStyle(color: context.c.danger),
                ),
              ),
            ],
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: context.c.card,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: context.c.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'المستحق للمورد',
                          style: TextStyle(
                            color: context.c.textMuted,
                            fontSize: 12,
                          ),
                        ),
                        MoneyText(
                          bal,
                          size: 28,
                          color: bal.isPositive
                              ? context.c.info
                              : context.c.primaryDark,
                          currency: db.settings.currency,
                        ),
                        Text(
                          bal.isZero
                              ? 'مسدد بالكامل'
                              : bal.isPositive
                              ? 'له علينا'
                              : 'لنا عنده (رصيد دائن)',
                          style: TextStyle(color: context.c.textMuted),
                        ),
                      ],
                    ),
                  ),
                  if ((s.phone ?? '').isNotEmpty)
                    Text(
                      s.phone!,
                      textDirection: TextDirection.ltr,
                      style: TextStyle(color: context.c.textMuted),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => showFormSheet(
                        context,
                        PurchaseSheet(initialSupplierId: s.id),
                      ),
                      icon: const Icon(Icons.add_shopping_cart),
                      label: const Text('فاتورة شراء'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => showFormSheet(
                        context,
                        PartyTxSheet.supplierPayment(s.id),
                      ),
                      icon: const Icon(Icons.payments_outlined),
                      label: const Text('دفعة للمورد'),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(),
            Expanded(
              child: txs.isEmpty
                  ? const EmptyState(
                      icon: Icons.receipt_long_outlined,
                      title: 'لا توجد حركات',
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                      itemCount: txs.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (_, i) => PartyTxTile(
                        tx: txs[i],
                        forSupplier: true,
                        onCancel: (t) async {
                          final reason = await confirmWithReason(
                            context,
                            title: 'إلغاء الحركة',
                            message: 'سيتم عكس أثرها على رصيد المورد.',
                            confirmLabel: 'إلغاء الحركة',
                          );
                          if (reason == null || !context.mounted) return;
                          await guarded(
                            context,
                            () => app.parties.cancelSupplierTx(t.id, reason),
                            successMessage:
                                'تم إلغاء الحركة (${Fmt.date(DateTime.now())})',
                          );
                        },
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
