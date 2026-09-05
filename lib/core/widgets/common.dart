import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../errors/domain_exception.dart';
import '../money/money.dart';
import '../theme/app_theme.dart';

/// Runs [action], showing a friendly SnackBar on DomainException.
/// Returns true on success.
Future<bool> guarded(
  BuildContext context,
  Future<void> Function() action, {
  String? successMessage,
}) async {
  final messenger = ScaffoldMessenger.of(context);
  final c = context.c;
  try {
    await action();
    if (successMessage != null) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(successMessage),
          backgroundColor: c.primaryStrong,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
    return true;
  } on DomainException catch (e) {
    messenger.showSnackBar(
      SnackBar(
        content: Text(e.message),
        backgroundColor: c.danger,
        behavior: SnackBarBehavior.floating,
      ),
    );
    return false;
  } catch (e) {
    messenger.showSnackBar(
      SnackBar(
        content: Text('حدث خطأ غير متوقع: $e'),
        backgroundColor: c.danger,
        behavior: SnackBarBehavior.floating,
      ),
    );
    return false;
  }
}

/// Confirm dialog with optional reason text field.
Future<String?> confirmWithReason(
  BuildContext context, {
  required String title,
  String? message,
  String confirmLabel = 'تأكيد',
  bool requireReason = true,
  bool destructive = true,
}) async {
  final ctrl = TextEditingController();
  final formKey = GlobalKey<FormState>();
  final result = await showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Form(
        key: formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (message != null) ...[
              Text(message, style: TextStyle(color: context.c.textMuted)),
              const SizedBox(height: 12),
            ],
            if (requireReason)
              TextFormField(
                controller: ctrl,
                autofocus: true,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'السبب'),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'السبب مطلوب' : null,
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('إلغاء'),
        ),
        FilledButton(
          style: destructive
              ? FilledButton.styleFrom(backgroundColor: context.c.danger)
              : null,
          onPressed: () {
            if (formKey.currentState?.validate() ?? false) {
              Navigator.pop(ctx, requireReason ? ctrl.text.trim() : '');
            }
          },
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return result;
}

Future<bool> confirm(
  BuildContext context, {
  required String title,
  String? message,
  String confirmLabel = 'تأكيد',
  bool destructive = false,
}) async {
  final r = await confirmWithReason(
    context,
    title: title,
    message: message,
    confirmLabel: confirmLabel,
    requireReason: false,
    destructive: destructive,
  );
  return r != null;
}

/// Money text field with strict decimal input & validation.
class MoneyField extends StatelessWidget {
  const MoneyField({
    super.key,
    required this.controller,
    required this.label,
    this.allowZero = false,
    this.allowNegative = false,
    this.optional = false,
    this.autofocus = false,
    this.hint,
    this.onChanged,
    this.suffix,
  });

  final TextEditingController controller;
  final String label;
  final bool allowZero;
  final bool allowNegative;
  final bool optional;
  final bool autofocus;
  final String? hint;
  final ValueChanged<Money?>? onChanged;
  final String? suffix;

  static Money? parse(String raw) => Money.tryParse(raw);

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      autofocus: autofocus,
      textDirection: TextDirection.ltr,
      textAlign: TextAlign.right,
      keyboardType: const TextInputType.numberWithOptions(
        decimal: true,
        signed: true,
      ),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩.,\-]')),
      ],
      decoration: InputDecoration(
        labelText: label,
        hintText: hint ?? '0.00',
        suffixText: suffix,
      ),
      onChanged: onChanged == null ? null : (v) => onChanged!(parse(v)),
      validator: (v) {
        final s = (v ?? '').trim();
        if (s.isEmpty) return optional ? null : 'المبلغ مطلوب';
        final m = parse(s);
        if (m == null) return 'صيغة غير صحيحة';
        if (m.isNegative && !allowNegative) return 'لا يُسمح بقيمة سالبة';
        if (m.isZero && !allowZero) return 'المبلغ يجب أن يكون أكبر من الصفر';
        return null;
      },
    );
  }
}

/// Quantity field (up to 3 decimals).
class QtyField extends StatelessWidget {
  const QtyField({
    super.key,
    required this.controller,
    required this.label,
    this.allowZero = false,
    this.optional = false,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final bool allowZero;
  final bool optional;
  final ValueChanged<Qty?>? onChanged;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      textDirection: TextDirection.ltr,
      textAlign: TextAlign.right,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩.]')),
      ],
      decoration: InputDecoration(labelText: label, hintText: '1'),
      onChanged: onChanged == null ? null : (v) => onChanged!(Qty.tryParse(v)),
      validator: (v) {
        final s = (v ?? '').trim();
        if (s.isEmpty) return optional ? null : 'الكمية مطلوبة';
        final q = Qty.tryParse(s);
        if (q == null) return 'صيغة غير صحيحة';
        if (q.isNegative) return 'لا يُسمح بقيمة سالبة';
        if (q.isZero && !allowZero) return 'الكمية يجب أن تكون أكبر من الصفر';
        return null;
      },
    );
  }
}

/// Date picker tile.
class DateField extends StatelessWidget {
  const DateField({
    super.key,
    required this.value,
    required this.onChanged,
    this.label = 'التاريخ',
  });

  final DateTime value;
  final ValueChanged<DateTime> onChanged;
  final String label;

  @override
  Widget build(BuildContext context) {
    final d = value;
    final text =
        '${d.year}/${d.month.toString().padLeft(2, '0')}/${d.day.toString().padLeft(2, '0')}';
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: d,
          firstDate: DateTime(2015),
          lastDate: DateTime.now().add(const Duration(days: 1)),
        );
        if (picked != null) {
          onChanged(
            DateTime(picked.year, picked.month, picked.day, d.hour, d.minute),
          );
        }
      },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          suffixIcon: const Icon(Icons.calendar_today_outlined, size: 20),
        ),
        child: Text(text, textDirection: TextDirection.ltr),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.action,
  });
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: context.c.primaryLight,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 40, color: context.c.primaryDark),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              textAlign: TextAlign.center,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(
                subtitle!,
                style: TextStyle(color: context.c.textMuted),
                textAlign: TextAlign.center,
              ),
            ],
            if (action != null) ...[const SizedBox(height: 20), action!],
          ],
        ),
      ),
    );
  }
}

/// Compact KPI card used on dashboard and reports.
class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.title,
    required this.value,
    this.icon,
    this.color,
    this.subtitle,
    this.onTap,
  });
  final String title;
  final String value;
  final IconData? icon;
  final Color? color;
  final String? subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = this.color ?? context.c.primaryStrong;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 18, color: color),
                    const SizedBox(width: 6),
                  ],
                  Expanded(
                    child: Text(
                      title,
                      style: TextStyle(
                        fontSize: 12,
                        color: context.c.textMuted,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: AlignmentDirectional.centerStart,
                child: Text(
                  value,
                  textDirection: TextDirection.ltr,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 4),
                Text(
                  subtitle!,
                  style: TextStyle(fontSize: 11, color: context.c.textMuted),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

class MoneyText extends StatelessWidget {
  const MoneyText(
    this.money, {
    super.key,
    this.size = 15,
    this.color,
    this.bold = true,
    this.signed = false,
    this.currency,
  });
  final Money money;
  final double size;
  final Color? color;
  final bool bold;
  final bool signed;
  final String? currency;

  @override
  Widget build(BuildContext context) {
    var s = money.abs.format();
    if (signed && !money.isZero) s = (money.isNegative ? '- ' : '+ ') + s;
    if (currency != null && currency!.isNotEmpty) s = '$s $currency';
    return Text(
      s,
      textDirection: TextDirection.ltr,
      style: TextStyle(
        fontSize: size,
        fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
        color: color ?? context.c.text,
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );
  }
}

/// Small pill.
class Tag extends StatelessWidget {
  const Tag(this.text, {super.key, this.color, this.bg});
  final String text;
  final Color? color;
  final Color? bg;
  @override
  Widget build(BuildContext context) {
    final color = this.color ?? context.c.primaryStrong;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg ?? color.withValues(alpha: context.c.isDark ? 0.22 : 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

class CancelledBanner extends StatelessWidget {
  const CancelledBanner({super.key, this.reason});
  final String? reason;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: context.c.dangerLight,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(Icons.block, color: context.c.danger, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'ملغاة${reason == null || reason!.isEmpty ? '' : ' — $reason'}',
              style: TextStyle(
                color: context.c.danger,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bottom-sheet scaffold for forms.
Future<T?> showFormSheet<T>(BuildContext context, Widget child) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
        child: child,
      ),
    ),
  );
}

class SheetTitle extends StatelessWidget {
  const SheetTitle(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Text(
      text,
      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
    ),
  );
}

/// Simple searchable dropdown for parties/products.
class PickerField<T> extends StatelessWidget {
  const PickerField({
    super.key,
    required this.label,
    required this.items,
    required this.labelOf,
    required this.value,
    required this.onChanged,
    this.subtitleOf,
    this.allowClear = true,
    this.validator,
  });
  final String label;
  final List<T> items;
  final String Function(T) labelOf;
  final String Function(T)? subtitleOf;
  final T? value;
  final ValueChanged<T?> onChanged;
  final bool allowClear;
  final FormFieldValidator<T?>? validator;

  @override
  Widget build(BuildContext context) {
    return FormField<T?>(
      initialValue: value,
      validator: validator,
      builder: (state) {
        final v = value;
        return InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () async {
            final picked = await showModalBottomSheet<_Pick<T>>(
              context: context,
              isScrollControlled: true,
              useSafeArea: true,
              builder: (_) => _PickerSheet<T>(
                items: items,
                labelOf: labelOf,
                subtitleOf: subtitleOf,
                title: label,
                allowClear: allowClear && v != null,
              ),
            );
            if (picked != null) {
              onChanged(picked.value);
              state.didChange(picked.value);
            }
          },
          child: InputDecorator(
            decoration: InputDecoration(
              labelText: label,
              errorText: state.errorText,
              suffixIcon: const Icon(Icons.expand_more),
            ),
            child: Text(
              v == null ? '— اختر —' : labelOf(v),
              style: TextStyle(
                color: v == null ? context.c.textMuted : context.c.text,
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Pick<T> {
  const _Pick(this.value);
  final T? value;
}

class _PickerSheet<T> extends StatefulWidget {
  const _PickerSheet({
    required this.items,
    required this.labelOf,
    required this.title,
    required this.allowClear,
    this.subtitleOf,
  });
  final List<T> items;
  final String Function(T) labelOf;
  final String Function(T)? subtitleOf;
  final String title;
  final bool allowClear;
  @override
  State<_PickerSheet<T>> createState() => _PickerSheetState<T>();
}

class _PickerSheetState<T> extends State<_PickerSheet<T>> {
  String q = '';
  @override
  Widget build(BuildContext context) {
    final filtered = widget.items
        .where((e) => widget.labelOf(e).toLowerCase().contains(q.toLowerCase()))
        .toList();
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.75,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: TextField(
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'بحث في ${widget.title}...',
                prefixIcon: const Icon(Icons.search),
              ),
              onChanged: (v) => setState(() => q = v),
            ),
          ),
          if (widget.allowClear)
            ListTile(
              leading: Icon(Icons.clear, color: context.c.danger),
              title: const Text('بدون اختيار'),
              onTap: () => Navigator.pop(context, const _Pick(null)),
            ),
          Expanded(
            child: filtered.isEmpty
                ? const Center(child: Text('لا توجد نتائج'))
                : ListView.separated(
                    itemCount: filtered.length,
                    separatorBuilder: (_, _) => const Divider(),
                    itemBuilder: (_, i) {
                      final e = filtered[i];
                      return ListTile(
                        title: Text(widget.labelOf(e)),
                        subtitle: widget.subtitleOf == null
                            ? null
                            : Text(widget.subtitleOf!(e)),
                        onTap: () => Navigator.pop(context, _Pick<T>(e)),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
