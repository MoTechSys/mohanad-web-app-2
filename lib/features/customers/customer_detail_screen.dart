import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/money/money.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/export_actions.dart';
import '../../data/ledger_db.dart';
import '../../data/services/report_service.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/party.dart';
import 'customer_form_sheet.dart';
import 'party_tx_sheet.dart';

class CustomerDetailScreen extends StatelessWidget {
  const CustomerDetailScreen({super.key, required this.customerId});
  final String customerId;

  @override
  Widget build(BuildContext context) {
    final db = context.watch<LedgerDb>();
    final c = db.customers[customerId];
    if (c == null || c.deletedAt != null) {
      return const Scaffold(body: Center(child: Text('العميل غير موجود')));
    }
    final bal = db.customerBalance(c.id);
    final txs = db.customerStatement(c.id);
    final cur = db.settings.currency;

    return Scaffold(
      appBar: AppBar(
        title: Text(c.name),
        actions: [
          ExportButton(
            title: 'كشف حساب ${c.name}',
            tooltip: 'كشف حساب PDF',
            options: [
              ExportOption(
                title: 'كشف حساب كامل PDF',
                subtitle: 'كل حركات الدين والسداد مع الرصيد الجاري — للمشاركة عبر واتساب أو الطباعة',
                icon: Icons.picture_as_pdf_rounded,
                fileBase: 'كشف-حساب-${c.name}',
                build: () => context.read<AppServices>().pdf.customerStatement(c),
              ),
              ExportOption(
                title: 'كشف حساب هذا الشهر PDF',
                subtitle: 'حركات الشهر الحالي فقط',
                icon: Icons.calendar_month_rounded,
                fileBase: 'كشف-شهري-${c.name}',
                build: () => context.read<AppServices>().pdf.customerStatement(c, range: DateRange.thisMonth()),
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            tooltip: 'تعديل',
            onPressed: () =>
                showFormSheet(context, CustomerFormSheet(existing: c)),
          ),
          PopupMenuButton<String>(
            onSelected: (v) => _menu(context, v, c, bal),
            itemBuilder: (_) => [
              if (c.status != CustomerStatus.active)
                const PopupMenuItem(value: 'activate', child: Text('تفعيل الحساب')),
              if (c.status != CustomerStatus.frozen)
                const PopupMenuItem(value: 'freeze', child: Text('تجميد الحساب')),
              if (c.status != CustomerStatus.gracePeriod)
                const PopupMenuItem(value: 'grace', child: Text('منح مهلة سداد')),
              const PopupMenuItem(value: 'adjust', child: Text('تسوية يدوية')),
              if (!bal.isZero)
                const PopupMenuItem(value: 'clear', child: Text('تصفير الرصيد')),
              const PopupMenuDivider(),
              PopupMenuItem(
                value: 'delete',
                child: Text('حذف العميل', style: TextStyle(color: context.c.danger)),
              ),
            ],
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            _Header(c: c, bal: bal, currency: cur),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: context.c.danger,
                      ),
                      onPressed: c.status == CustomerStatus.frozen
                          ? null
                          : () => showFormSheet(
                              context,
                              PartyTxSheet.customerDebt(c.id),
                            ),
                      icon: const Icon(Icons.add),
                      label: const Text('دين جديد'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => showFormSheet(
                        context,
                        PartyTxSheet.customerPayment(c.id),
                      ),
                      icon: const Icon(Icons.check),
                      label: const Text('دفعة'),
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
                        onCancel: (t) => _cancel(context, t),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _cancel(BuildContext context, PartyTx t) async {
    final reason = await confirmWithReason(
      context,
      title: 'إلغاء الحركة',
      message:
          'سيتم عكس أثر هذه الحركة على الرصيد مع الاحتفاظ بها في السجل.',
      confirmLabel: 'إلغاء الحركة',
    );
    if (reason == null || !context.mounted) return;
    final app = context.read<AppServices>();
    await guarded(
      context,
      () => app.parties.cancelCustomerTx(t.id, reason),
      successMessage: 'تم إلغاء الحركة',
    );
  }

  Future<void> _menu(
    BuildContext context,
    String v,
    Customer c,
    Money bal,
  ) async {
    final app = context.read<AppServices>();
    switch (v) {
      case 'activate':
        await guarded(
          context,
          () => app.parties.setCustomerStatus(c.id, CustomerStatus.active),
          successMessage: 'تم تفعيل الحساب',
        );
      case 'freeze':
        if (await confirm(
          context,
          title: 'تجميد الحساب؟',
          message: 'لن يتمكن العميل من أخذ ديون جديدة حتى إعادة التفعيل.',
          destructive: true,
        )) {
          if (!context.mounted) return;
          await guarded(
            context,
            () => app.parties.setCustomerStatus(c.id, CustomerStatus.frozen),
            successMessage: 'تم تجميد الحساب',
          );
        }
      case 'grace':
        final d = await showDatePicker(
          context: context,
          initialDate: DateTime.now().add(const Duration(days: 7)),
          firstDate: DateTime.now(),
          lastDate: DateTime.now().add(const Duration(days: 365)),
          helpText: 'آخر موعد للسداد',
        );
        if (d == null || !context.mounted) return;
        await guarded(
          context,
          () => app.parties.setCustomerStatus(
            c.id,
            CustomerStatus.gracePeriod,
            graceUntil: d,
          ),
          successMessage: 'تم منح مهلة حتى ${Fmt.date(d)}',
        );
      case 'adjust':
        if (!context.mounted) return;
        await showFormSheet(context, PartyTxSheet.customerAdjust(c.id));
      case 'clear':
        final reason = await confirmWithReason(
          context,
          title: 'تصفير الرصيد',
          message: 'سيتم تسجيل تسوية بمبلغ ${bal.abs.format()} لتصفير الرصيد.',
          confirmLabel: 'تصفير',
        );
        if (reason == null || !context.mounted) return;
        await guarded(
          context,
          () => app.parties.clearCustomerBalance(c.id, reason),
          successMessage: 'تم تصفير الرصيد',
        );
      case 'delete':
        if (await confirm(
          context,
          title: 'حذف العميل؟',
          message: 'لا يمكن الحذف إذا كان هناك رصيد. السجل يبقى محفوظاً.',
          confirmLabel: 'حذف',
          destructive: true,
        )) {
          if (!context.mounted) return;
          final ok = await guarded(
            context,
            () => app.parties.deleteCustomer(c.id),
            successMessage: 'تم حذف العميل',
          );
          if (ok && context.mounted) Navigator.pop(context);
        }
    }
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.c, required this.bal, required this.currency});
  final Customer c;
  final Money bal;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final color = bal.isPositive
        ? context.c.danger
        : bal.isNegative
        ? context.c.info
        : context.c.primaryDark;
    final limit = c.creditLimit;
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.c.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: context.c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'الرصيد الحالي',
                      style: TextStyle(color: context.c.textMuted, fontSize: 12),
                    ),
                    MoneyText(bal, size: 28, color: color, currency: currency),
                    Text(
                      Fmt.balanceLabel(bal),
                      style: TextStyle(color: color, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Tag(
                    c.status.label,
                    color: switch (c.status) {
                      CustomerStatus.active => context.c.primaryDark,
                      CustomerStatus.frozen => context.c.danger,
                      CustomerStatus.gracePeriod => context.c.warning,
                    },
                  ),
                  if (c.graceUntil != null &&
                      c.status == CustomerStatus.gracePeriod)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        'حتى ${Fmt.date(c.graceUntil!)}',
                        style: TextStyle(
                          fontSize: 11,
                          color: context.c.textMuted,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
          if (limit != null && limit.isPositive) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                minHeight: 8,
                value: bal.isPositive
                    ? (bal.minor / limit.minor).clamp(0.0, 1.0)
                    : 0,
                color: bal > limit ? context.c.danger : context.c.primary,
                backgroundColor: context.c.border,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'حد الائتمان: ${limit.format()}${bal > limit ? ' — تجاوز الحد!' : ''}',
              style: TextStyle(
                fontSize: 12,
                color: bal > limit ? context.c.danger : context.c.textMuted,
              ),
            ),
          ],
          if ((c.phone ?? '').isNotEmpty || (c.address ?? '').isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 16,
              children: [
                if ((c.phone ?? '').isNotEmpty)
                  _info(context, Icons.phone_outlined, c.phone!),
                if ((c.address ?? '').isNotEmpty)
                  _info(context, Icons.place_outlined, c.address!),
              ],
            ),
          ],
          if ((c.notes ?? '').isNotEmpty) ...[
            const SizedBox(height: 6),
            _info(context, Icons.notes, c.notes!),
          ],
        ],
      ),
    );
  }

  Widget _info(BuildContext context, IconData i, String t) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(i, size: 14, color: context.c.textMuted),
      const SizedBox(width: 4),
      Text(t, style: TextStyle(fontSize: 12, color: context.c.textMuted)),
    ],
  );
}

/// Ledger row (shared by customers & suppliers).
class PartyTxTile extends StatelessWidget {
  const PartyTxTile({
    super.key,
    required this.tx,
    required this.onCancel,
    this.forSupplier = false,
  });
  final PartyTx tx;
  final ValueChanged<PartyTx> onCancel;
  final bool forSupplier;

  @override
  Widget build(BuildContext context) {
    final t = tx;
    final cancelled = t.cancelledAt != null;
    final isDebt = t.type == PartyTxType.debt;
    final isPay = t.type == PartyTxType.payment;
    final delta = t.signedDelta;
    final color = cancelled
        ? context.c.textMuted
        : delta.isPositive
        ? context.c.danger
        : context.c.primaryDark;
    final icon = isDebt
        ? Icons.add_circle_outline
        : isPay
        ? Icons.check_circle_outline
        : t.type == PartyTxType.opening
        ? Icons.flag_outlined
        : Icons.tune;
    final canCancel =
        !cancelled && t.type != PartyTxType.opening && t.refType == RefType.manual;
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: color),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _typeLabel(t),
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          decoration:
                              cancelled ? TextDecoration.lineThrough : null,
                        ),
                      ),
                      Text(
                        '${Fmt.date(t.txDate)} • ${Fmt.dateTime(t.createdAt).split('  ').last}',
                        style: TextStyle(
                          fontSize: 11,
                          color: context.c.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    MoneyText(delta, color: color, signed: true),
                    Text(
                      'الرصيد بعد: ${t.balanceAfter.format()}',
                      textDirection: TextDirection.rtl,
                      style: TextStyle(
                        fontSize: 11,
                        color: context.c.textMuted,
                      ),
                    ),
                  ],
                ),
                if (canCancel)
                  IconButton(
                    tooltip: 'إلغاء',
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.undo, size: 20),
                    onPressed: () => onCancel(t),
                  ),
              ],
            ),
            if ((t.notes ?? '').isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  t.notes!,
                  style: TextStyle(fontSize: 12, color: context.c.textMuted),
                ),
              ),
            if (cancelled)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: CancelledBanner(reason: t.cancelReason),
              ),
          ],
        ),
      ),
    );
  }

  String _typeLabel(PartyTx t) {
    final base = switch (t.type) {
      PartyTxType.debt => forSupplier ? 'مشتريات بالأجل' : 'دين',
      PartyTxType.payment => forSupplier ? 'دفعة للمورد' : 'دفعة سداد',
      PartyTxType.adjustment => 'تسوية',
      PartyTxType.opening => 'رصيد افتتاحي',
    };
    final src = switch (t.refType) {
      RefType.sale => ' (فاتورة بيع)',
      RefType.saleCancel => ' (إلغاء بيع)',
      RefType.purchase => ' (فاتورة شراء)',
      RefType.purchaseCancel => ' (إلغاء شراء)',
      RefType.expense => ' (مصروف)',
      RefType.expenseCancel => ' (إلغاء مصروف)',
      RefType.manual => '',
    };
    return '$base$src';
  }
}
