import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/money/money.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../data/ledger_db.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/party.dart';
import '../../domain/models/voucher.dart';

/// سندات القبض والصرف — قائمة + إنشاء + طباعة + إلغاء (بدون حذف).
class VouchersScreen extends StatefulWidget {
  const VouchersScreen({super.key});

  @override
  State<VouchersScreen> createState() => _VouchersScreenState();
}

class _VouchersScreenState extends State<VouchersScreen> {
  VoucherType? _filter; // null = الكل

  @override
  Widget build(BuildContext context) {
    context.watch<LedgerDb>();
    final app = context.read<AppServices>();
    final list = app.vouchers.all(type: _filter);

    return Scaffold(
      appBar: AppBar(title: const Text('سندات القبض والصرف')),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'fab_voucher',
        onPressed: () => showFormSheet(context, const VoucherFormSheet()),
        icon: const Icon(Icons.add),
        label: const Text('سند جديد'),
      ),
      body: SafeArea(
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: SegmentedButton<VoucherType?>(
              segments: const [
                ButtonSegment(value: null, label: Text('الكل')),
                ButtonSegment(
                    value: VoucherType.receipt,
                    label: Text('قبض'),
                    icon: Icon(Icons.south_west_rounded, size: 16)),
                ButtonSegment(
                    value: VoucherType.payment,
                    label: Text('صرف'),
                    icon: Icon(Icons.north_east_rounded, size: 16)),
              ],
              selected: {_filter},
              onSelectionChanged: (s) => setState(() => _filter = s.first),
            ),
          ),
          Expanded(
            child: list.isEmpty
                ? const EmptyState(
                    icon: Icons.receipt_outlined,
                    title: 'لا توجد سندات',
                    subtitle: 'أنشئ سند قبض عند استلام مبلغ، أو سند صرف عند دفع مبلغ')
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
                    itemCount: list.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, i) => _VoucherTile(list[i]),
                  ),
          ),
        ]),
      ),
    );
  }
}

class _VoucherTile extends StatelessWidget {
  const _VoucherTile(this.v);
  final Voucher v;

  @override
  Widget build(BuildContext context) {
    final app = context.read<AppServices>();
    final c = context.c;
    final isReceipt = v.type == VoucherType.receipt;
    final color = v.isCancelled
        ? c.textMuted
        : isReceipt
            ? c.primaryStrong
            : c.danger;
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withValues(alpha: 0.12),
          child: Icon(
              isReceipt ? Icons.south_west_rounded : Icons.north_east_rounded,
              color: color, size: 20),
        ),
        title: Text('${v.voucherNo} • ${app.vouchers.partyName(v)}',
            style: TextStyle(
                fontWeight: FontWeight.w700,
                decoration: v.isCancelled ? TextDecoration.lineThrough : null)),
        subtitle: Text(
          [
            Fmt.relative(v.voucherDate),
            v.method.label,
            if ((v.details ?? '').isNotEmpty) v.details!,
            if (v.isCancelled) 'ملغى: ${v.cancelReason}',
          ].join(' • '),
          style: const TextStyle(fontSize: 11),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: MoneyText(v.amount, color: color),
        onTap: () => _showActions(context, v),
      ),
    );
  }

  void _showActions(BuildContext context, Voucher v) {
    final app = context.read<AppServices>();
    final party = app.vouchers.partyName(v);
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            title: Text('${v.type.label} ${v.voucherNo}',
                style: const TextStyle(fontWeight: FontWeight.w800)),
            subtitle: Text('$party — ${v.amount.format()}'),
          ),
          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.print_outlined),
            title: const Text('طباعة سند رسمي (A5)'),
            onTap: () async {
              Navigator.pop(ctx);
              await guarded(context, () async {
                final bytes = await app.pdf.voucherA5(v, partyName: party);
                await app.share.printPdf(bytes, v.voucherNo);
              });
            },
          ),
          ListTile(
            leading: const Icon(Icons.receipt_long_outlined),
            title: const Text('طباعة إيصال حراري (80mm)'),
            onTap: () async {
              Navigator.pop(ctx);
              await guarded(context, () async {
                final bytes = await app.pdf.voucherReceipt80(v, partyName: party);
                await app.share.printPdf(bytes, v.voucherNo);
              });
            },
          ),
          if (v.type == VoucherType.receipt && v.customerId != null && v.isActive)
            ListTile(
              leading: const Icon(Icons.sms_outlined),
              title: const Text('إرسال SMS للعميل (مباشر)'),
              subtitle: const Text('المدفوع + المتبقي من الدين', style: TextStyle(fontSize: 11)),
              onTap: () async {
                Navigator.pop(ctx);
                final ok = await app.sms.notifyVoucher(v);
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: Text(ok
                      ? 'تم إرسال الرسالة للعميل'
                      : 'تعذّر الإرسال — تأكد من رقم العميل وصلاحية الرسائل'),
                  backgroundColor:
                      ok ? context.c.primaryStrong : context.c.danger,
                  behavior: SnackBarBehavior.floating,
                ));
              },
            ),
          ListTile(
            leading: const Icon(Icons.share_outlined),
            title: const Text('مشاركة PDF (واتساب وغيره)'),
            onTap: () async {
              Navigator.pop(ctx);
              await guarded(context, () async {
                final bytes = await app.pdf.voucherA5(v, partyName: party);
                await app.share.sharePdf(bytes, '${v.voucherNo}.pdf',
                    text: '${v.type.label} ${v.voucherNo} — ${v.amount.format()}');
              });
            },
          ),
          if (v.isActive)
            ListTile(
              leading: Icon(Icons.cancel_outlined, color: context.c.danger),
              title: Text('إلغاء السند (بسبب)',
                  style: TextStyle(color: context.c.danger)),
              onTap: () async {
                Navigator.pop(ctx);
                final reason = await confirmWithReason(context,
                    title: 'إلغاء السند ${v.voucherNo}',
                    message:
                        'سيُعكس أثر السند على الحساب المرتبط. لا يمكن التراجع.',
                    confirmLabel: 'إلغاء السند');
                if (reason == null || !context.mounted) return;
                await guarded(
                    context, () => app.vouchers.cancelVoucher(v.id, reason),
                    successMessage: 'تم إلغاء السند');
              },
            ),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }
}

/// نموذج إنشاء سند قبض/صرف.
class VoucherFormSheet extends StatefulWidget {
  const VoucherFormSheet({super.key, this.initialType});
  final VoucherType? initialType;

  @override
  State<VoucherFormSheet> createState() => _VoucherFormSheetState();
}

class _VoucherFormSheetState extends State<VoucherFormSheet> {
  final _form = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _manualName = TextEditingController();
  final _details = TextEditingController();

  late VoucherType _type = widget.initialType ?? VoucherType.receipt;
  VoucherMethod _method = VoucherMethod.cash;
  Customer? _customer;
  Supplier? _supplier;
  bool _manualParty = false;
  DateTime _date = DateTime.now();
  bool _busy = false;

  @override
  void dispose() {
    _amount.dispose();
    _manualName.dispose();
    _details.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final db = context.watch<LedgerDb>();
    final isReceipt = _type == VoucherType.receipt;
    final customers = db.activeCustomers.toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    final suppliers = db.activeSuppliers.toList()
      ..sort((a, b) => a.name.compareTo(b.name));

    return Form(
      key: _form,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SheetTitle('سند جديد'),
          SegmentedButton<VoucherType>(
            segments: const [
              ButtonSegment(
                  value: VoucherType.receipt,
                  label: Text('سند قبض (استلام)'),
                  icon: Icon(Icons.south_west_rounded, size: 16)),
              ButtonSegment(
                  value: VoucherType.payment,
                  label: Text('سند صرف (دفع)'),
                  icon: Icon(Icons.north_east_rounded, size: 16)),
            ],
            selected: {_type},
            onSelectionChanged: (s) => setState(() {
              _type = s.first;
              _customer = null;
              _supplier = null;
            }),
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(isReceipt ? 'طرف خارجي (ليس عميلًا مسجلًا)' : 'طرف خارجي (ليس مورّدًا مسجلًا)',
                style: const TextStyle(fontSize: 13)),
            value: _manualParty,
            onChanged: (v) => setState(() => _manualParty = v),
          ),
          if (_manualParty)
            TextFormField(
              controller: _manualName,
              decoration: InputDecoration(
                  labelText: isReceipt ? 'استلمنا من (الاسم)' : 'صرفنا إلى (الاسم)'),
              validator: (v) =>
                  (v ?? '').trim().isEmpty ? 'الاسم مطلوب' : null,
            )
          else if (isReceipt)
            PickerField<Customer>(
              label: 'العميل',
              items: customers,
              labelOf: (c) => c.name,
              subtitleOf: (c) {
                final b = db.customerBalance(c.id);
                return b.isZero ? 'لا دين' : 'الدين: ${b.format()}';
              },
              value: _customer,
              onChanged: (v) => setState(() => _customer = v),
              validator: (v) => v == null ? 'اختر العميل' : null,
            )
          else
            PickerField<Supplier>(
              label: 'المورّد',
              items: suppliers,
              labelOf: (s) => s.name,
              subtitleOf: (s) {
                final b = db.supplierBalance(s.id);
                return b.isZero ? 'لا مستحقات' : 'المستحق: ${b.format()}';
              },
              value: _supplier,
              onChanged: (v) => setState(() => _supplier = v),
              validator: (v) => v == null ? 'اختر المورّد' : null,
            ),
          const SizedBox(height: 12),
          MoneyField(controller: _amount, label: 'المبلغ', autofocus: false),
          const SizedBox(height: 12),
          SegmentedButton<VoucherMethod>(
            segments: [
              for (final m in VoucherMethod.values)
                ButtonSegment(value: m, label: Text(m.label)),
            ],
            selected: {_method},
            onSelectionChanged: (s) => setState(() => _method = s.first),
          ),
          const SizedBox(height: 12),
          DateField(value: _date, onChanged: (d) => setState(() => _date = d)),
          const SizedBox(height: 12),
          TextFormField(
            controller: _details,
            decoration: const InputDecoration(labelText: 'وذلك مقابل (اختياري)'),
            maxLength: 120,
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: _busy ? null : _save,
            icon: const Icon(Icons.check),
            label: Text(_busy ? 'جارٍ الحفظ…' : 'حفظ السند'),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    final app = context.read<AppServices>();
    final amount = Money.tryParse(_amount.text)!;
    setState(() => _busy = true);

    Voucher? created;
    final ok = await guarded(context, () async {
      if (_type == VoucherType.receipt) {
        created = await app.vouchers.createReceipt(
          customerId: _manualParty ? null : _customer?.id,
          partyNameManual: _manualParty ? _manualName.text.trim() : null,
          amount: amount,
          method: _method,
          details: _details.text.trim().isEmpty ? null : _details.text.trim(),
          date: _date,
        );
      } else {
        created = await app.vouchers.createPayment(
          supplierId: _manualParty ? null : _supplier?.id,
          partyNameManual: _manualParty ? _manualName.text.trim() : null,
          amount: amount,
          method: _method,
          details: _details.text.trim().isEmpty ? null : _details.text.trim(),
          date: _date,
        );
      }
    }, successMessage: 'تم إنشاء السند');

    if (!mounted) return;
    setState(() => _busy = false);
    if (ok && created != null) {
      Navigator.pop(context);
      _offerPrint(created!);
    }
  }

  void _offerPrint(Voucher v) {
    final app = context.read<AppServices>();
    final party = app.vouchers.partyName(v);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text('${v.type.label} ${v.voucherNo} — ${v.amount.format()}'),
      action: SnackBarAction(
        label: 'طباعة',
        onPressed: () async {
          final bytes = await app.pdf.voucherA5(v, partyName: party);
          await app.share.printPdf(bytes, v.voucherNo);
        },
      ),
    ));
  }
}
