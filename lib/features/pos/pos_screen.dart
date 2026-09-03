import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../app/app_services.dart';
import '../../core/errors/domain_exception.dart';
import '../../core/money/money.dart';
import '../../core/platform/native_bridge.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/barcode_scanner_view.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/export_actions.dart';
import '../../data/ledger_db.dart';
import '../../domain/enums/enums.dart';
import '../../domain/models/documents.dart';
import '../../domain/models/inventory.dart';
import '../../domain/models/party.dart';
import '../products/products_screen.dart';
import 'cart_controller.dart';

/// Cashier: camera scanner on top, live cart below, one-tap checkout.
///
/// Input paths (all feed `CartController.scan`):
///  1. Camera (mobile_scanner) — continuous.
///  2. USB/Bluetooth HID scanners — they type the code + Enter into the
///     hidden focus field (`_hidFocus`).
///  3. Manual search field (name or barcode) with instant results.
///  4. Quick-pick grid for products without barcodes.
class PosScreen extends StatefulWidget {
  const PosScreen({super.key, this.showCamera = true});

  /// Disabled in widget tests (no camera plugin).
  final bool showCamera;

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  late final CartController _cart;
  final _search = TextEditingController();
  final _hidFocus = FocusNode();
  final _hidBuffer = StringBuffer();
  Timer? _hidTimer;
  bool _cameraOn = true;
  String? _flashKey;
  Timer? _flashTimer;

  @override
  void initState() {
    super.initState();
    final app = context.read<AppServices>();
    _cart = CartController(app.db, app.documents);
    _cameraOn = widget.showCamera;
  }

  @override
  void dispose() {
    _cart.dispose();
    _search.dispose();
    _hidFocus.dispose();
    _hidTimer?.cancel();
    _flashTimer?.cancel();
    super.dispose();
  }

  // ─────────────────────── scan handling ───────────────────────

  Future<void> _onCode(String raw) async {
    final outcome = _cart.scan(raw);
    switch (outcome) {
      case ScanOutcome.added:
      case ScanOutcome.incremented:
        unawaited(NativeBridge.scanOk());
        _flash(_cart.lastTouchedKey);
      case ScanOutcome.unknown:
        unawaited(NativeBridge.scanError());
        if (!mounted) return;
        await _handleUnknown(LedgerDb.normalizeBarcode(raw));
      case ScanOutcome.ignoredDuplicate:
      case ScanOutcome.invalid:
        break;
    }
  }

  void _flash(String? key) {
    _flashTimer?.cancel();
    setState(() => _flashKey = key);
    _flashTimer = Timer(const Duration(milliseconds: 700), () {
      if (mounted) setState(() => _flashKey = null);
    });
  }

  Future<void> _handleUnknown(String code) async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Icon(Icons.qr_code_2, size: 40, color: ctx.c.warning),
            const SizedBox(height: 8),
            const Text(
              'باركود غير مسجّل',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(code, textDirection: TextDirection.ltr, style: TextStyle(color: ctx.c.textMuted)),
            const SizedBox(height: 12),
            ListTile(
              leading: Icon(Icons.add_box_outlined, color: ctx.c.primaryStrong),
              title: const Text('إضافة صنف جديد بهذا الباركود'),
              subtitle: const Text('الاسم والسعر فقط — ثم يُضاف للسلة'),
              onTap: () => Navigator.pop(ctx, 'create'),
            ),
            ListTile(
              leading: Icon(Icons.link, color: ctx.c.info),
              title: const Text('ربط الباركود بصنف موجود'),
              onTap: () => Navigator.pop(ctx, 'link'),
            ),
            ListTile(
              leading: Icon(Icons.close, color: ctx.c.textMuted),
              title: const Text('تجاهل'),
              onTap: () => Navigator.pop(ctx),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (!mounted) return;
    if (choice == 'create') {
      final p = await showFormSheet<Product>(
        context,
        ProductFormSheet(initialBarcode: code),
      );
      if (p != null) {
        _cart.addProduct(p);
        unawaited(NativeBridge.scanOk());
        _flash(p.id);
      }
    } else if (choice == 'link') {
      final p = await _pickProduct();
      if (p == null || !mounted) return;
      final app = context.read<AppServices>();
      final ok = await guarded(context, () async {
        await app.inventory.updateProduct(p.id, barcode: code);
      }, successMessage: 'تم ربط الباركود بـ ${p.name}');
      if (ok) {
        _cart.addProduct(app.db.products[p.id]!);
        _flash(p.id);
      }
    }
  }

  Future<Product?> _pickProduct() async {
    final db = context.read<LedgerDb>();
    return showModalBottomSheet<Product>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => _ProductSearchSheet(db: db),
    );
  }

  // ─────────────────────── HID (keyboard wedge) ───────────────────────

  KeyEventResult _onHidKey(FocusNode node, KeyEvent e) {
    if (e is! KeyDownEvent) return KeyEventResult.ignored;
    if (e.logicalKey == LogicalKeyboardKey.enter ||
        e.logicalKey == LogicalKeyboardKey.numpadEnter) {
      final code = _hidBuffer.toString();
      _hidBuffer.clear();
      if (code.length >= 3) _onCode(code);
      return KeyEventResult.handled;
    }
    final ch = e.character;
    if (ch != null && ch.isNotEmpty && ch.codeUnitAt(0) >= 0x20) {
      _hidBuffer.write(ch);
      _hidTimer?.cancel();
      // A human can't type a 13-digit code in 300ms; a scanner can.
      _hidTimer = Timer(const Duration(milliseconds: 300), _hidBuffer.clear);
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  // ─────────────────────── checkout ───────────────────────

  Future<void> _checkout() async {
    if (_cart.isEmpty) return;
    final result = await showFormSheet<_CheckoutResult>(
      context,
      _CheckoutSheet(cart: _cart),
    );
    if (result == null || !mounted) return;
    final app = context.read<AppServices>();
    Future<Sale> doIt(bool approve) => _cart.checkout(
      paymentType: result.paymentType,
      customerId: result.customer?.id,
      details: result.note,
      approveOverLimit: approve,
    );
    try {
      final sale = await doIt(false);
      _afterSale(sale, result, app);
    } on DomainException catch (e) {
      if (e.code == ErrorCodes.creditLimitExceeded && mounted) {
        final ok = await confirm(
          context,
          title: 'تجاوز حد الائتمان',
          message: '${e.message}\n\nهل تريد المتابعة على مسؤوليتك؟',
          confirmLabel: 'متابعة',
          destructive: true,
        );
        if (ok && mounted) {
          final done = await guarded(context, () async {
            final sale = await doIt(true);
            _afterSale(sale, result, app);
          });
          if (!done) return;
        }
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: context.c.danger),
        );
      }
    }
  }

  void _afterSale(Sale sale, _CheckoutResult r, AppServices app) {
    unawaited(NativeBridge.beep('success'));
    if (!mounted) return;
    final cur = app.db.settings.currency;
    final change = r.paid == null ? null : r.paid! - sale.netAmount;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: context.c.primaryStrong,
        duration: const Duration(seconds: 6),
        action: SnackBarAction(
          label: 'إيصال',
          textColor: Colors.white,
          onPressed: () => showExportSheet(context, title: 'إيصال البيع', options: [
            ExportOption(
              title: 'إيصال 80mm',
              subtitle: 'للطابعة الحرارية أو المشاركة عبر واتساب',
              icon: Icons.receipt_rounded,
              fileBase: 'إيصال-${sale.invoiceNo ?? sale.id.substring(0, 6)}',
              build: () => app.pdf.saleReceipt(sale),
            ),
            ExportOption(
              title: 'فاتورة A4',
              subtitle: 'فاتورة رسمية بشعار المحل',
              icon: Icons.description_rounded,
              fileBase: 'فاتورة-${sale.invoiceNo ?? sale.id.substring(0, 6)}',
              build: () => app.pdf.saleInvoice(sale),
            ),
          ]),
        ),
        content: Row(
          children: [
            const Icon(Icons.check_circle, color: Colors.white),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                change != null && change.isPositive
                    ? 'تم البيع ${sale.netAmount.format()} $cur — الباقي ${change.format()} $cur'
                    : 'تم البيع ${sale.netAmount.format()} $cur',
                style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─────────────────────── UI ───────────────────────

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final db = context.watch<LedgerDb>();
    return Focus(
      focusNode: _hidFocus,
      onKeyEvent: _onHidKey,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('الكاشير'),
          actions: [
            if (widget.showCamera)
              IconButton(
                tooltip: _cameraOn ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا',
                icon: Icon(_cameraOn ? Icons.videocam : Icons.videocam_off_outlined),
                onPressed: () => setState(() => _cameraOn = !_cameraOn),
              ),
            AnimatedBuilder(
              animation: _cart,
              builder: (_, _) => IconButton(
                tooltip: 'تفريغ السلة',
                icon: const Icon(Icons.delete_sweep_outlined),
                onPressed: _cart.isEmpty
                    ? null
                    : () async {
                        final ok = await confirm(
                          context,
                          title: 'تفريغ السلة؟',
                          message: 'سيتم حذف كل الأصناف من السلة الحالية.',
                          confirmLabel: 'تفريغ',
                          destructive: true,
                        );
                        if (ok) _cart.clear();
                      },
              ),
            ),
          ],
        ),
        body: SafeArea(
          child: Column(
            children: [
              if (_cameraOn && widget.showCamera)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                  child: BarcodeScannerView(height: 190, onCode: _onCode),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: _SearchBar(
                  controller: _search,
                  db: db,
                  onPick: (p) {
                    _cart.addProduct(p);
                    unawaited(NativeBridge.scanOk());
                    _flash(p.id);
                    _search.clear();
                  },
                  onSubmitCode: _onCode,
                  onAdHoc: () async {
                    final r = await showFormSheet<({String name, Money price})>(
                      context,
                      const _AdHocSheet(),
                    );
                    if (r != null) {
                      _cart.addAdHoc(name: r.name, unitPrice: r.price);
                      _flash(_cart.lastTouchedKey);
                    }
                  },
                ),
              ),
              Expanded(
                child: AnimatedBuilder(
                  animation: _cart,
                  builder: (context, _) {
                    if (_cart.isEmpty) {
                      return _QuickPicks(
                        db: db,
                        onPick: (p) {
                          _cart.addProduct(p);
                          unawaited(NativeBridge.scanOk());
                          _flash(p.id);
                        },
                      );
                    }
                    return ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                      itemCount: _cart.lines.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (_, i) {
                        // Newest at top.
                        final l = _cart.lines[_cart.lines.length - 1 - i];
                        return _CartTile(
                          line: l,
                          highlight: _flashKey == l.key,
                          currency: db.settings.currency,
                          onInc: () => _cart.increment(l.key),
                          onDec: () => _cart.decrement(l.key),
                          onRemove: () => _cart.remove(l.key),
                          onEdit: () => _editLine(l),
                        );
                      },
                    );
                  },
                ),
              ),
              _TotalsBar(cart: _cart, currency: db.settings.currency, onCheckout: _checkout, onDiscount: _editDiscount),
            ],
          ),
        ),
        backgroundColor: c.surface,
      ),
    );
  }

  Future<void> _editLine(CartLine l) async {
    final r = await showFormSheet<({Qty qty, Money price})>(
      context,
      _LineEditSheet(line: l),
    );
    if (r == null) return;
    try {
      _cart.setUnitPrice(l.key, r.price);
      _cart.setQty(l.key, r.qty);
    } on DomainException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _editDiscount() async {
    final ctrl = TextEditingController(text: _cart.discount.isZero ? '' : _cart.discount.toEditable());
    final v = await showFormSheet<Money>(
      context,
      Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SheetTitle('خصم على الفاتورة'),
          MoneyField(controller: ctrl, label: 'قيمة الخصم', allowZero: true, autofocus: true),
          const SizedBox(height: 12),
          Builder(
            builder: (ctx) => FilledButton(
              onPressed: () => Navigator.pop(ctx, Money.tryParse(ctrl.text) ?? Money.zero),
              child: const Text('تطبيق'),
            ),
          ),
        ],
      ),
    );
    if (v == null) return;
    try {
      _cart.setDiscount(v);
    } on DomainException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: context.c.danger),
        );
      }
    }
  }
}

// ═══════════════════════ sub-widgets ═══════════════════════

class _SearchBar extends StatefulWidget {
  const _SearchBar({
    required this.controller,
    required this.db,
    required this.onPick,
    required this.onSubmitCode,
    required this.onAdHoc,
  });
  final TextEditingController controller;
  final LedgerDb db;
  final ValueChanged<Product> onPick;
  final ValueChanged<String> onSubmitCode;
  final VoidCallback onAdHoc;

  @override
  State<_SearchBar> createState() => _SearchBarState();
}

class _SearchBarState extends State<_SearchBar> {
  final _link = LayerLink();
  OverlayEntry? _overlay;
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_refresh);
    _focus.addListener(_refresh);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_refresh);
    _focus.removeListener(_refresh);
    _focus.dispose();
    _hide();
    super.dispose();
  }

  void _refresh() {
    final q = widget.controller.text.trim();
    if (q.isEmpty || !_focus.hasFocus) {
      _hide();
    } else {
      _show();
    }
  }

  void _hide() {
    _overlay?.remove();
    _overlay = null;
  }

  void _show() {
    _overlay?.markNeedsBuild();
    if (_overlay != null) return;
    _overlay = OverlayEntry(
      builder: (ctx) {
        final results = widget.db.searchProducts(widget.controller.text, limit: 8);
        final c = ctx.c;
        return Positioned(
          width: MediaQuery.sizeOf(ctx).width - 32,
          child: CompositedTransformFollower(
            link: _link,
            showWhenUnlinked: false,
            offset: const Offset(0, 56),
            child: Material(
              elevation: 8,
              color: c.card,
              borderRadius: BorderRadius.circular(14),
              clipBehavior: Clip.antiAlias,
              child: results.isEmpty
                  ? ListTile(
                      leading: Icon(Icons.search_off, color: c.textMuted),
                      title: const Text('لا توجد نتائج'),
                      subtitle: const Text('اضغط Enter لمعالجة النص كباركود، أو أضف صنفاً حراً'),
                    )
                  : ListView.separated(
                      shrinkWrap: true,
                      padding: EdgeInsets.zero,
                      itemCount: results.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final p = results[i];
                        return ListTile(
                          dense: true,
                          leading: Icon(Icons.inventory_2_outlined, color: c.primaryStrong),
                          title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                          subtitle: p.barcode == null
                              ? null
                              : Text(p.barcode!, textDirection: TextDirection.ltr, style: TextStyle(color: c.textMuted, fontSize: 11)),
                          trailing: MoneyText(p.salePrice, color: c.primaryStrong),
                          onTap: () {
                            widget.onPick(p);
                            _focus.requestFocus();
                          },
                        );
                      },
                    ),
            ),
          ),
        );
      },
    );
    Overlay.of(context).insert(_overlay!);
  }

  @override
  Widget build(BuildContext context) {
    return CompositedTransformTarget(
      link: _link,
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: widget.controller,
              focusNode: _focus,
              decoration: InputDecoration(
                hintText: 'ابحث بالاسم أو الباركود…',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: widget.controller.text.isEmpty
                    ? null
                    : IconButton(icon: const Icon(Icons.clear), onPressed: widget.controller.clear),
                isDense: true,
              ),
              textInputAction: TextInputAction.search,
              onSubmitted: (v) {
                final t = v.trim();
                if (t.isEmpty) return;
                final r = widget.db.searchProducts(t, limit: 1);
                if (r.length == 1 && r.first.barcode == LedgerDb.normalizeBarcode(t)) {
                  widget.onPick(r.first);
                } else if (RegExp(r'^[0-9٠-٩\s-]{3,}$').hasMatch(t)) {
                  widget.onSubmitCode(t);
                } else if (r.isNotEmpty) {
                  widget.onPick(r.first);
                }
                widget.controller.clear();
              },
            ),
          ),
          const SizedBox(width: 8),
          Tooltip(
            message: 'صنف حر (بدون تسجيل)',
            child: Material(
              color: context.c.card,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: context.c.border),
              ),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: widget.onAdHoc,
                child: const Padding(
                  padding: EdgeInsets.all(12),
                  child: Icon(Icons.edit_note),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickPicks extends StatelessWidget {
  const _QuickPicks({required this.db, required this.onPick});
  final LedgerDb db;
  final ValueChanged<Product> onPick;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final all = db.searchProducts('');
    if (all.isEmpty) {
      return EmptyState(
        icon: Icons.qr_code_scanner,
        title: 'ابدأ بمسح الباركود',
        subtitle: 'أو أضف أصنافك من «المزيد ← المنتجات والمخزون» ليظهروا هنا كأزرار سريعة.',
      );
    }
    // Products without barcodes first (they can't be scanned), then the rest.
    final noCode = all.where((p) => p.barcode == null || p.barcode!.isEmpty).toList();
    final withCode = all.where((p) => p.barcode != null && p.barcode!.isNotEmpty).toList();
    final items = [...noCode, ...withCode].take(24).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 6),
          child: Row(
            children: [
              Icon(Icons.bolt, size: 18, color: c.warning),
              const SizedBox(width: 6),
              Text('أصناف سريعة', style: TextStyle(fontWeight: FontWeight.w800, color: c.textMuted)),
              const Spacer(),
              Text('السلة فارغة', style: TextStyle(color: c.textMuted, fontSize: 12)),
            ],
          ),
        ),
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.15,
            ),
            itemCount: items.length,
            itemBuilder: (_, i) {
              final p = items[i];
              return Material(
                color: c.card,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: BorderSide(color: c.border),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => onPick(p),
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          p.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                        ),
                        const SizedBox(height: 6),
                        MoneyText(p.salePrice, size: 13, color: c.primaryStrong),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _CartTile extends StatelessWidget {
  const _CartTile({
    required this.line,
    required this.highlight,
    required this.currency,
    required this.onInc,
    required this.onDec,
    required this.onRemove,
    required this.onEdit,
  });
  final CartLine line;
  final bool highlight;
  final String currency;
  final VoidCallback onInc;
  final VoidCallback onDec;
  final VoidCallback onRemove;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Dismissible(
      key: ValueKey(line.key),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => onRemove(),
      background: Container(
        alignment: AlignmentDirectional.centerEnd,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(color: c.danger, borderRadius: BorderRadius.circular(14)),
        child: const Icon(Icons.delete_outline, color: Colors.white),
      ),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        decoration: BoxDecoration(
          color: highlight ? c.primarySoft : c.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: highlight ? c.primary : c.border, width: highlight ? 1.5 : 1),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onEdit,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 6, 10),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(line.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15), maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Text(
                        '${line.unitPrice.format()} × ${line.qty.format()} ${line.unit}',
                        style: TextStyle(color: c.textMuted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                MoneyText(line.total, size: 16, color: c.text),
                const SizedBox(width: 6),
                _QtyStepper(onInc: onInc, onDec: onDec, qty: line.qty),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _QtyStepper extends StatelessWidget {
  const _QtyStepper({required this.onInc, required this.onDec, required this.qty});
  final VoidCallback onInc;
  final VoidCallback onDec;
  final Qty qty;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      decoration: BoxDecoration(
        color: c.cardAlt,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: Icon(qty <= Qty.one ? Icons.delete_outline : Icons.remove, size: 20, color: qty <= Qty.one ? c.danger : c.text),
            onPressed: onDec,
          ),
          Text(qty.format(), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: Icon(Icons.add, size: 20, color: c.primaryStrong),
            onPressed: onInc,
          ),
        ],
      ),
    );
  }
}

class _TotalsBar extends StatelessWidget {
  const _TotalsBar({required this.cart, required this.currency, required this.onCheckout, required this.onDiscount});
  final CartController cart;
  final String currency;
  final VoidCallback onCheckout;
  final VoidCallback onDiscount;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return AnimatedBuilder(
      animation: cart,
      builder: (context, _) => Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        decoration: BoxDecoration(
          color: c.card,
          border: Border(top: BorderSide(color: c.border)),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: c.isDark ? 0.4 : 0.06), blurRadius: 12, offset: const Offset(0, -4)),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Text('${cart.itemCount} صنف • ${cart.totalQty.format()} قطعة', style: TextStyle(color: c.textMuted, fontSize: 12)),
                const Spacer(),
                TextButton.icon(
                  onPressed: cart.isEmpty ? null : onDiscount,
                  icon: const Icon(Icons.percent, size: 16),
                  label: Text(cart.discount.isZero ? 'خصم' : 'خصم ${cart.discount.format()}'),
                ),
              ],
            ),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('الإجمالي', style: TextStyle(color: c.textMuted, fontSize: 12)),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          MoneyText(cart.net, size: 28, color: c.primaryStrong),
                          const SizedBox(width: 4),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 5),
                            child: Text(currency, style: TextStyle(color: c.textMuted, fontWeight: FontWeight.w700)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                SizedBox(
                  width: 160,
                  child: FilledButton.icon(
                    onPressed: cart.isEmpty ? null : onCheckout,
                    icon: const Icon(Icons.payments_outlined),
                    label: const Text('إتمام البيع'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════ sheets ═══════════════════════

class _LineEditSheet extends StatefulWidget {
  const _LineEditSheet({required this.line});
  final CartLine line;
  @override
  State<_LineEditSheet> createState() => _LineEditSheetState();
}

class _LineEditSheetState extends State<_LineEditSheet> {
  late final _qty = TextEditingController(text: widget.line.qty.format());
  late final _price = TextEditingController(text: widget.line.unitPrice.toEditable());
  final _form = GlobalKey<FormState>();

  @override
  void dispose() {
    _qty.dispose();
    _price.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _form,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SheetTitle(widget.line.name),
          Row(
            children: [
              Expanded(child: QtyField(controller: _qty, label: 'الكمية')),
              const SizedBox(width: 12),
              Expanded(child: MoneyField(controller: _price, label: 'سعر الوحدة', allowZero: true)),
            ],
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () {
              if (!_form.currentState!.validate()) return;
              Navigator.pop(context, (qty: Qty.tryParse(_qty.text)!, price: Money.tryParse(_price.text)!));
            },
            child: const Text('حفظ'),
          ),
        ],
      ),
    );
  }
}

class _AdHocSheet extends StatefulWidget {
  const _AdHocSheet();
  @override
  State<_AdHocSheet> createState() => _AdHocSheetState();
}

class _AdHocSheetState extends State<_AdHocSheet> {
  final _name = TextEditingController();
  final _price = TextEditingController();
  final _form = GlobalKey<FormState>();

  @override
  void dispose() {
    _name.dispose();
    _price.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _form,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SheetTitle('صنف حر'),
          Text('للأصناف غير المسجّلة (خضار، بقايا…). لا يؤثر على المخزون.', style: TextStyle(color: context.c.textMuted, fontSize: 12)),
          const SizedBox(height: 12),
          TextFormField(
            controller: _name,
            autofocus: true,
            decoration: const InputDecoration(labelText: 'الوصف *'),
            validator: (v) => (v ?? '').trim().isEmpty ? 'مطلوب' : null,
          ),
          const SizedBox(height: 12),
          MoneyField(controller: _price, label: 'السعر *', allowZero: true),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () {
              if (!_form.currentState!.validate()) return;
              Navigator.pop(context, (name: _name.text.trim(), price: Money.tryParse(_price.text)!));
            },
            child: const Text('إضافة للسلة'),
          ),
        ],
      ),
    );
  }
}

class _CheckoutResult {
  const _CheckoutResult({required this.paymentType, this.customer, this.paid, this.note});
  final PaymentType paymentType;
  final Customer? customer;
  final Money? paid;
  final String? note;
}

class _CheckoutSheet extends StatefulWidget {
  const _CheckoutSheet({required this.cart});
  final CartController cart;
  @override
  State<_CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends State<_CheckoutSheet> {
  PaymentType _pay = PaymentType.cash;
  Customer? _customer;
  final _paid = TextEditingController();
  final _note = TextEditingController();

  @override
  void dispose() {
    _paid.dispose();
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final db = context.watch<LedgerDb>();
    final net = widget.cart.net;
    final paid = Money.tryParse(_paid.text);
    final change = paid == null ? null : widget.cart.changeFor(paid);
    final cur = db.settings.currency;
    final customers = db.activeCustomers.where((x) => x.status != CustomerStatus.frozen).toList()
      ..sort((a, b) => a.name.compareTo(b.name));

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SheetTitle('إتمام البيع'),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: c.primarySoft, borderRadius: BorderRadius.circular(14)),
          child: Row(
            children: [
              Text('المطلوب', style: TextStyle(color: c.primaryStrong, fontWeight: FontWeight.w700)),
              const Spacer(),
              MoneyText(net, size: 24, color: c.primaryStrong),
              const SizedBox(width: 4),
              Text(cur, style: TextStyle(color: c.primaryStrong)),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SegmentedButton<PaymentType>(
          segments: const [
            ButtonSegment(value: PaymentType.cash, icon: Icon(Icons.payments_outlined), label: Text('نقدي')),
            ButtonSegment(value: PaymentType.credit, icon: Icon(Icons.schedule), label: Text('آجل (دين)')),
          ],
          selected: {_pay},
          onSelectionChanged: (s) => setState(() => _pay = s.first),
        ),
        const SizedBox(height: 14),
        if (_pay == PaymentType.cash) ...[
          MoneyField(
            controller: _paid,
            label: 'المبلغ المدفوع (اختياري لحساب الباقي)',
            optional: true,
            allowZero: true,
            onChanged: (_) => setState(() {}),
          ),
          if (paid != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Text(change == null ? 'المبلغ أقل من المطلوب' : 'الباقي للعميل', style: TextStyle(color: change == null ? c.danger : c.textMuted)),
                const Spacer(),
                if (change != null) MoneyText(change, size: 20, color: c.info),
              ],
            ),
          ],
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final m in _suggest(net))
                ActionChip(
                  label: Text(m.format()),
                  onPressed: () => setState(() => _paid.text = m.toEditable()),
                ),
            ],
          ),
        ] else ...[
          PickerField<Customer>(
            label: 'العميل *',
            items: customers,
            labelOf: (x) => x.name,
            subtitleOf: (x) => 'الرصيد: ${db.customerBalance(x.id).format()} $cur',
            value: _customer,
            onChanged: (v) => setState(() => _customer = v),
            allowClear: false,
          ),
          if (_customer != null) ...[
            const SizedBox(height: 8),
            Text(
              'الرصيد بعد البيع: ${(db.customerBalance(_customer!.id) + net).format()} $cur',
              style: TextStyle(color: c.textMuted, fontSize: 12),
            ),
          ],
        ],
        const SizedBox(height: 12),
        TextField(
          controller: _note,
          decoration: const InputDecoration(labelText: 'ملاحظة (اختياري)'),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: (_pay == PaymentType.credit && _customer == null)
              ? null
              : () => Navigator.pop(
                  context,
                  _CheckoutResult(
                    paymentType: _pay,
                    customer: _pay == PaymentType.credit ? _customer : null,
                    paid: _pay == PaymentType.cash ? paid : null,
                    note: _note.text.trim().isEmpty ? null : _note.text.trim(),
                  ),
                ),
          icon: const Icon(Icons.check),
          label: Text(_pay == PaymentType.cash ? 'تأكيد البيع النقدي' : 'تسجيل الدين وإتمام البيع'),
        ),
        const SizedBox(height: 4),
        Text(
          Fmt.dateTime(DateTime.now()),
          textAlign: TextAlign.center,
          style: TextStyle(color: c.textMuted, fontSize: 11),
        ),
      ],
    );
  }

  /// Common cash denominations ≥ net.
  List<Money> _suggest(Money net) {
    final out = <Money>{};
    if (net.isZero) return const [];
    out.add(net);
    for (final step in [50, 100, 500, 1000, 5000]) {
      final units = net.minor ~/ Money.scale;
      final rounded = ((units + step - 1) ~/ step) * step;
      if (rounded > units) out.add(Money.units(rounded));
      if (out.length >= 4) break;
    }
    return out.toList();
  }
}

class _ProductSearchSheet extends StatefulWidget {
  const _ProductSearchSheet({required this.db});
  final LedgerDb db;
  @override
  State<_ProductSearchSheet> createState() => _ProductSearchSheetState();
}

class _ProductSearchSheetState extends State<_ProductSearchSheet> {
  final _q = TextEditingController();
  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final results = widget.db.searchProducts(_q.text);
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.75,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: TextField(
              controller: _q,
              autofocus: true,
              decoration: const InputDecoration(hintText: 'اختر الصنف…', prefixIcon: Icon(Icons.search)),
              onChanged: (_) => setState(() {}),
            ),
          ),
          Expanded(
            child: results.isEmpty
                ? const EmptyState(icon: Icons.search_off, title: 'لا توجد نتائج')
                : ListView.builder(
                    itemCount: results.length,
                    itemBuilder: (_, i) => ListTile(
                      title: Text(results[i].name),
                      subtitle: results[i].barcode == null ? const Text('بدون باركود') : Text(results[i].barcode!, textDirection: TextDirection.ltr),
                      trailing: MoneyText(results[i].salePrice),
                      onTap: () => Navigator.pop(context, results[i]),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
