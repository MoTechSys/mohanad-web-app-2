import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';
import '../features/customers/customers_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/more/more_screen.dart';
import '../features/pos/pos_screen.dart';
import '../features/sales/sales_screen.dart';
import '../features/suppliers/suppliers_screen.dart';

/// Opens the cashier (POS) as a dedicated full-screen route.
///
/// The camera must never run inside a background `IndexedStack` tab, so the
/// cashier is always pushed on top of the shell.
Future<void> openCashier(BuildContext context) => Navigator.push(
  context,
  MaterialPageRoute(builder: (_) => const PosScreen(), fullscreenDialog: true),
);

/// Root shell with the 5 bottom tabs (matches legacy IA) plus a prominent
/// cashier button.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  static const _pages = <Widget>[
    DashboardScreen(),
    CustomersScreen(),
    SalesScreen(),
    SuppliersScreen(),
    MoreScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      body: IndexedStack(index: _index, children: _pages),
      floatingActionButton: _index == 4
          ? null
          : FloatingActionButton.extended(
              heroTag: 'shell-cashier',
              onPressed: () => openCashier(context),
              backgroundColor: c.primaryStrong,
              foregroundColor: c.onPrimary,
              icon: const Icon(Icons.qr_code_scanner_rounded),
              label: const Text(
                'الكاشير',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'الرئيسية',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people_rounded),
            label: 'العملاء',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long_rounded),
            label: 'المبيعات',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_shipping_outlined),
            selectedIcon: Icon(Icons.local_shipping_rounded),
            label: 'التجار',
          ),
          NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view_rounded),
            label: 'المزيد',
          ),
        ],
      ),
    );
  }
}
