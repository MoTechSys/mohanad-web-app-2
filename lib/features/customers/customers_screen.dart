import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/money/money.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import '../../data/ledger_db.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/party.dart';
import 'customer_detail_screen.dart';
import 'customer_form_sheet.dart';

enum _Filter { all, debtors, settled, frozen }

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  String _q = '';
  _Filter _filter = _Filter.all;

  @override
  Widget build(BuildContext context) {
    final db = context.watch<LedgerDb>();
    var list = db.activeCustomers.toList();
    final q = _q.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list
          .where(
            (c) =>
                c.name.toLowerCase().contains(q) ||
                (c.phone ?? '').contains(q),
          )
          .toList();
    }
    list = switch (_filter) {
      _Filter.all => list,
      _Filter.debtors => list
          .where((c) => db.customerBalance(c.id).isPositive)
          .toList(),
      _Filter.settled => list
          .where((c) => !db.customerBalance(c.id).isPositive)
          .toList(),
      _Filter.frozen => list
          .where((c) => c.status != CustomerStatus.active)
          .toList(),
    };
    list.sort(
      (a, b) => db.customerBalance(b.id).minor.compareTo(
        db.customerBalance(a.id).minor,
      ),
    );
    final total = list.fold(Money.zero, (p, c) {
      final b = db.customerBalance(c.id);
      return b.isPositive ? p + b : p;
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('العملاء'),
        actions: [
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 12),
            child: Center(
              child: Tag(
                'إجمالي الديون: ${total.format()}',
                color: AppColors.danger,
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'fab_customers',
        onPressed: () => showFormSheet(context, const CustomerFormSheet()),
        icon: const Icon(Icons.person_add_alt_1),
        label: const Text('عميل جديد'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: TextField(
                decoration: const InputDecoration(
                  hintText: 'بحث بالاسم أو الهاتف',
                  prefixIcon: Icon(Icons.search),
                ),
                onChanged: (v) => setState(() => _q = v),
              ),
            ),
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _chip('الكل', _Filter.all),
                  _chip('عليهم ديون', _Filter.debtors),
                  _chip('مسددون', _Filter.settled),
                  _chip('مجمّد/مهلة', _Filter.frozen),
                ],
              ),
            ),
            const SizedBox(height: 6),
            Expanded(
              child: list.isEmpty
                  ? EmptyState(
                      icon: Icons.people_outline,
                      title: q.isEmpty ? 'لا يوجد عملاء بعد' : 'لا توجد نتائج',
                      subtitle: q.isEmpty
                          ? 'أضف أول عميل لبدء تسجيل الديون والدفعات'
                          : null,
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
                      itemCount: list.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (_, i) => _CustomerTile(c: list[i]),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip(String label, _Filter f) => Padding(
    padding: const EdgeInsetsDirectional.only(end: 8),
    child: ChoiceChip(
      label: Text(label),
      selected: _filter == f,
      onSelected: (_) => setState(() => _filter = f),
    ),
  );
}

class _CustomerTile extends StatelessWidget {
  const _CustomerTile({required this.c});
  final Customer c;

  @override
  Widget build(BuildContext context) {
    final db = context.read<LedgerDb>();
    final bal = db.customerBalance(c.id);
    final over =
        c.creditLimit != null && c.creditLimit!.isPositive && bal > c.creditLimit!;
    return Card(
      child: ListTile(
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => CustomerDetailScreen(customerId: c.id),
          ),
        ),
        leading: CircleAvatar(
          backgroundColor: bal.isPositive
              ? AppColors.dangerLight
              : AppColors.primaryLight,
          child: Text(
            c.name.characters.first,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: bal.isPositive ? AppColors.danger : AppColors.primaryDark,
            ),
          ),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                c.name,
                style: const TextStyle(fontWeight: FontWeight.w700),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (c.status == CustomerStatus.frozen)
              const Tag('مجمّد', color: AppColors.danger),
            if (c.status == CustomerStatus.gracePeriod)
              const Tag('مهلة', color: AppColors.warning),
            if (over) ...[
              const SizedBox(width: 4),
              const Tag('تجاوز الحد', color: AppColors.warning),
            ],
          ],
        ),
        subtitle: Text(
          c.phone ?? 'بدون هاتف',
          textDirection: TextDirection.ltr,
          textAlign: TextAlign.right,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            MoneyText(
              bal,
              color: bal.isPositive
                  ? AppColors.danger
                  : bal.isNegative
                  ? AppColors.info
                  : AppColors.primaryDark,
            ),
            Text(
              bal.isZero ? 'مسدد' : (bal.isPositive ? 'عليه' : 'له'),
              style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}
