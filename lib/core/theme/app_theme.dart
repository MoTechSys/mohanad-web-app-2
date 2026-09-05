import 'package:flutter/material.dart';

/// Brand constants that are safe in **both** light and dark mode (used for
/// default parameter values and the seed). Everything that must adapt to the
/// theme lives in [AppPalette] and is read through `context.c`.
class AppColors {
  AppColors._();
  static const primary = Color(0xFF1D6FE0);
  static const primaryDark = Color(0xFF1656B8);
  static const primaryLight = Color(0xFFDBEAFE);
  static const danger = Color(0xFFDC2626);
  static const dangerLight = Color(0xFFFEE2E2);
  static const warning = Color(0xFFD97706);
  static const warningLight = Color(0xFFFEF3C7);
  static const info = Color(0xFF2563EB);
  static const infoLight = Color(0xFFDBEAFE);
  static const surface = Color(0xFFF8FAFC);
  static const card = Colors.white;
  static const text = Color(0xFF0F172A);
  static const textMuted = Color(0xFF64748B);
  static const border = Color(0xFFE2E8F0);
}

/// Theme-aware semantic palette. Access with `context.c`.
class AppPalette extends ThemeExtension<AppPalette> {
  const AppPalette({
    required this.primary,
    required this.primaryStrong,
    required this.primarySoft,
    required this.danger,
    required this.dangerSoft,
    required this.warning,
    required this.warningSoft,
    required this.info,
    required this.infoSoft,
    required this.surface,
    required this.card,
    required this.cardAlt,
    required this.text,
    required this.textMuted,
    required this.border,
    required this.onPrimary,
    required this.isDark,
  });

  final Color primary;

  /// Primary used for text/icons (needs contrast against surface).
  final Color primaryStrong;

  /// Tinted background for chips/badges.
  final Color primarySoft;
  final Color danger;
  final Color dangerSoft;
  final Color warning;
  final Color warningSoft;
  final Color info;
  final Color infoSoft;
  final Color surface;
  final Color card;

  /// Slightly elevated card (inputs, nested tiles).
  final Color cardAlt;
  final Color text;
  final Color textMuted;
  final Color border;
  final Color onPrimary;
  final bool isDark;

  // Aliases matching the legacy AppColors names so call sites read the same.
  Color get primaryDark => primaryStrong;
  Color get primaryLight => primarySoft;
  Color get dangerLight => dangerSoft;
  Color get warningLight => warningSoft;
  Color get infoLight => infoSoft;

  static const light = AppPalette(
    primary: Color(0xFF1D6FE0),
    primaryStrong: Color(0xFF1656B8),
    primarySoft: Color(0xFFDBEAFE),
    danger: Color(0xFFDC2626),
    dangerSoft: Color(0xFFFEE2E2),
    warning: Color(0xFFD97706),
    warningSoft: Color(0xFFFEF3C7),
    info: Color(0xFF0D9488),
    infoSoft: Color(0xFFCCFBF1),
    surface: Color(0xFFF8FAFC),
    card: Colors.white,
    cardAlt: Color(0xFFF1F5F9),
    text: Color(0xFF0F172A),
    textMuted: Color(0xFF64748B),
    border: Color(0xFFE2E8F0),
    onPrimary: Colors.white,
    isDark: false,
  );

  static const dark = AppPalette(
    primary: Color(0xFF3B82F6),
    primaryStrong: Color(0xFF60A5FA),
    primarySoft: Color(0xFF172554),
    danger: Color(0xFFF87171),
    dangerSoft: Color(0xFF450A0A),
    warning: Color(0xFFFBBF24),
    warningSoft: Color(0xFF451A03),
    info: Color(0xFF2DD4BF),
    infoSoft: Color(0xFF042F2E),
    surface: Color(0xFF0B1220),
    card: Color(0xFF111A2E),
    cardAlt: Color(0xFF18233B),
    text: Color(0xFFF1F5F9),
    textMuted: Color(0xFF94A3B8),
    border: Color(0xFF243049),
    onPrimary: Color(0xFF0B1220),
    isDark: true,
  );

  @override
  AppPalette copyWith() => this;

  @override
  AppPalette lerp(ThemeExtension<AppPalette>? other, double t) {
    if (other is! AppPalette) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    return AppPalette(
      primary: c(primary, other.primary),
      primaryStrong: c(primaryStrong, other.primaryStrong),
      primarySoft: c(primarySoft, other.primarySoft),
      danger: c(danger, other.danger),
      dangerSoft: c(dangerSoft, other.dangerSoft),
      warning: c(warning, other.warning),
      warningSoft: c(warningSoft, other.warningSoft),
      info: c(info, other.info),
      infoSoft: c(infoSoft, other.infoSoft),
      surface: c(surface, other.surface),
      card: c(card, other.card),
      cardAlt: c(cardAlt, other.cardAlt),
      text: c(text, other.text),
      textMuted: c(textMuted, other.textMuted),
      border: c(border, other.border),
      onPrimary: c(onPrimary, other.onPrimary),
      isDark: t < 0.5 ? isDark : other.isDark,
    );
  }
}

extension AppPaletteX on BuildContext {
  /// Theme-aware colors: `context.c.textMuted`, `context.c.danger`, …
  AppPalette get c =>
      Theme.of(this).extension<AppPalette>() ?? AppPalette.light;
}

class AppTheme {
  AppTheme._();

  static ThemeData light() => _build(AppPalette.light);
  static ThemeData dark() => _build(AppPalette.dark);

  static ThemeData _build(AppPalette p) {
    final brightness = p.isDark ? Brightness.dark : Brightness.light;
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: brightness,
      primary: p.primaryStrong,
      onPrimary: p.onPrimary,
      surface: p.surface,
      onSurface: p.text,
      error: p.danger,
      outline: p.border,
      surfaceContainerHighest: p.cardAlt,
      surfaceContainer: p.card,
      surfaceContainerLow: p.card,
    );
    OutlineInputBorder border(Color c, [double w = 1]) => OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: c, width: w),
    );
    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      extensions: [p],
      scaffoldBackgroundColor: p.surface,
      canvasColor: p.surface,
      visualDensity: VisualDensity.standard,
      splashFactory: InkSparkle.splashFactory,
      textTheme: ThemeData(brightness: brightness).textTheme.apply(
        bodyColor: p.text,
        displayColor: p.text,
      ),
      iconTheme: IconThemeData(color: p.textMuted),
      appBarTheme: AppBarTheme(
        backgroundColor: p.surface,
        foregroundColor: p.text,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: p.text,
        ),
        iconTheme: IconThemeData(color: p.text),
      ),
      cardTheme: CardThemeData(
        color: p.card,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: p.border),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: p.card,
        border: border(p.border),
        enabledBorder: border(p.border),
        focusedBorder: border(p.primary, 2),
        errorBorder: border(p.danger),
        focusedErrorBorder: border(p.danger, 2),
        labelStyle: TextStyle(color: p.textMuted),
        hintStyle: TextStyle(color: p.textMuted),
        prefixIconColor: p.textMuted,
        suffixIconColor: p.textMuted,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 14,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(50),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(50),
          foregroundColor: p.text,
          side: BorderSide(color: p.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: p.primaryStrong),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: SegmentedButton.styleFrom(
          selectedBackgroundColor: p.primarySoft,
          selectedForegroundColor: p.primaryStrong,
          foregroundColor: p.textMuted,
          side: BorderSide(color: p.border),
        ),
      ),
      chipTheme: ChipThemeData(
        side: BorderSide(color: p.border),
        backgroundColor: p.card,
        selectedColor: p.primarySoft,
        labelStyle: TextStyle(color: p.text),
        secondaryLabelStyle: TextStyle(color: p.primaryStrong),
        checkmarkColor: p.primaryStrong,
        shape: const StadiumBorder(),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: p.card,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: p.card,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: p.border,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: p.card,
        surfaceTintColor: Colors.transparent,
        indicatorColor: p.primarySoft,
        height: 68,
        iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(
            color: s.contains(WidgetState.selected) ? p.primaryStrong : p.textMuted,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => TextStyle(
            fontSize: 12,
            color: s.contains(WidgetState.selected) ? p.primaryStrong : p.textMuted,
            fontWeight: s.contains(WidgetState.selected)
                ? FontWeight.w700
                : FontWeight.w500,
          ),
        ),
      ),
      listTileTheme: ListTileThemeData(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        iconColor: p.textMuted,
        textColor: p.text,
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: p.card,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: p.isDark ? p.cardAlt : const Color(0xFF1E293B),
        contentTextStyle: const TextStyle(color: Colors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? p.onPrimary : null,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? p.primary : null,
        ),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: p.primary,
        linearTrackColor: p.primarySoft,
      ),
      dividerTheme: DividerThemeData(color: p.border, space: 1),
    );
  }
}
