import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../data/ledger_db.dart';
import '../../domain/enums/enums.dart';
import 'purchase_sheet.dart';

class PurchasesScreen extends StatelessWidget {
  const PurchasesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final db = context.watch<LedgerDb>();
    final app = context.read<AppServices>();
    final list = db.purchases.values.toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return Scaffold(
      appBar: AppBar(title: const Text('فواتير المشتريات')),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'fab_purchase2',
        onPressed: () => showFormSheet(context, const PurchaseSheet()),
        icon: const Icon(Icons.add),
        label: const Text('فاتورة شراء'),
      ),
      body: SafeArea(
        child: list.isEmpty
            ? const EmptyState(
                icon: Icons.inventory_2_outlined,
                title: 'لا توجد مشتريات',
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final p = list[i];
                  final credit = p.paymentType == PaymentType.credit;
                  final name = p.supplierId != null
                      ? (db.suppliers[p.supplierId!]?.name ?? 'مورد محذوف')
                      : (p.supplierNameManual ?? 'شراء نقدي');
                  final color = p.isCancelled
                      ? context.c.textMuted
                      : credit
                      ? context.c.info
                      : context.c.warning;
                  return Card(
                    child: ListTile(
                      leading: Icon(
                        credit ? Icons.schedule : Icons.payments_outlined,
                        color: color,
                      ),
                      title: Text(
                        name,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          decoration: p.isCancelled
                              ? TextDecoration.lineThrough
                              : null,
                        ),
                      ),
                      subtitle: Text(
                        [
                          Fmt.relative(p.purchaseDate),
                          if (p.lines.isNotEmpty) '${p.lines.length} صنف',
                          if ((p.invoiceNo ?? '').isNotEmpty) '#${p.invoiceNo}',
                          if (p.isCancelled) 'ملغاة',
                        ].join(' • '),
                        style: const TextStyle(fontSize: 11),
                      ),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          MoneyText(p.totalAmount, color: color),
                          Tag(credit ? 'آجل' : 'نقدي', color: color),
                        ],
                      ),
                      onTap: p.isCancelled
                          ? null
                          : () async {
                              final reason = await confirmWithReason(
                                context,
                                title: 'إلغاء فاتورة الشراء',
                                message:
                                    'سيتم عكس أثرها على المورد/المصروف والمخزون.',
                                confirmLabel: 'إلغاء الفاتورة',
                              );
                              if (reason == null || !context.mounted) return;
                              await guarded(
                                context,
                                () =>
                                    app.documents.cancelPurchase(p.id, reason),
                                successMessage: 'تم إلغاء الفاتورة',
                              );
                            },
                    ),
                  );
                },
              ),
      ),
    );
  }
}
