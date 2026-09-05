import '../../core/money/money.dart';
import '../enums/enums.dart';
import 'serde.dart';

class AppSettings {
  const AppSettings({
    this.storeName = 'بقالتي',
    this.ownerName,
    this.phone,
    this.currency = 'ر.ي',
    this.largeTxThreshold,
    this.dailyTarget,
    this.inventoryEnabled = true,
    this.profitMode = ProfitMode.accurate,
    this.cashPurchaseAsCogs = true,
    this.pinCode,
    this.themeMode = AppThemeMode.system,
    this.address,
    this.receiptHeader,
    this.receiptFooter = 'شكراً لتسوقكم معنا',
    this.logoBase64,
    this.blockOversell = true,
    this.warnBelowCost = true,
    this.updatePricesFromPurchase = true,
    this.hideScanner = false,
    this.largeFont = false,
  });

  final String storeName;
  final String? ownerName;
  final String? phone;
  final String currency;

  /// Operations ≥ threshold get flagged. `null` = disabled.
  final Money? largeTxThreshold;
  final Money? dailyTarget;
  final bool inventoryEnabled;
  final ProfitMode profitMode;

  /// In estimated mode: treat cash purchases as cost of goods.
  final bool cashPurchaseAsCogs;

  /// Optional 4-6 digit lock. Null = no lock.
  final String? pinCode;

  /// Light / dark / follow system.
  final AppThemeMode themeMode;

  /// Branding used on invoices / reports (PDF).
  final String? address;
  /// Free text printed under the store name (e.g. slogan / tax no.).
  final String? receiptHeader;
  /// Free text printed at the bottom of every document.
  final String? receiptFooter;
  /// PNG/JPEG logo, base64 (kept small; ≤ 512px recommended).
  final String? logoBase64;

  /// Reject selling more than available stock (voice-note requirement).
  /// When false the cashier may oversell after an explicit confirmation.
  final bool blockOversell;

  /// Warn (confirmation dialog) when selling below purchase cost.
  final bool warnBelowCost;

  /// After a detailed purchase, update the product's purchase/sale prices
  /// from the invoice lines.
  final bool updatePricesFromPurchase;

  /// م6: إخفاء ماسح الباركود (لمحلات بلا باركود) — يخفي الكاشير/الكاميرا.
  final bool hideScanner;

  /// م6: خط أكبر لكبار السن وضعاف القراءة (يكبّر كل نصوص التطبيق 15%).
  final bool largeFont;

  bool get hasLogo => logoBase64 != null && logoBase64!.isNotEmpty;

  AppSettings copyWith({
    String? storeName,
    String? ownerName,
    String? phone,
    String? currency,
    Money? largeTxThreshold,
    bool clearLargeTx = false,
    Money? dailyTarget,
    bool clearDailyTarget = false,
    bool? inventoryEnabled,
    ProfitMode? profitMode,
    bool? cashPurchaseAsCogs,
    String? pinCode,
    bool clearPin = false,
    AppThemeMode? themeMode,
    String? address,
    String? receiptHeader,
    String? receiptFooter,
    String? logoBase64,
    bool clearLogo = false,
    bool? blockOversell,
    bool? warnBelowCost,
    bool? updatePricesFromPurchase,
    bool? hideScanner,
    bool? largeFont,
  }) => AppSettings(
    storeName: storeName ?? this.storeName,
    ownerName: ownerName ?? this.ownerName,
    phone: phone ?? this.phone,
    currency: currency ?? this.currency,
    largeTxThreshold: clearLargeTx
        ? null
        : (largeTxThreshold ?? this.largeTxThreshold),
    dailyTarget: clearDailyTarget ? null : (dailyTarget ?? this.dailyTarget),
    inventoryEnabled: inventoryEnabled ?? this.inventoryEnabled,
    profitMode: profitMode ?? this.profitMode,
    cashPurchaseAsCogs: cashPurchaseAsCogs ?? this.cashPurchaseAsCogs,
    pinCode: clearPin ? null : (pinCode ?? this.pinCode),
    themeMode: themeMode ?? this.themeMode,
    address: address ?? this.address,
    receiptHeader: receiptHeader ?? this.receiptHeader,
    receiptFooter: receiptFooter ?? this.receiptFooter,
    logoBase64: clearLogo ? null : (logoBase64 ?? this.logoBase64),
    blockOversell: blockOversell ?? this.blockOversell,
    warnBelowCost: warnBelowCost ?? this.warnBelowCost,
    updatePricesFromPurchase:
        updatePricesFromPurchase ?? this.updatePricesFromPurchase,
    hideScanner: hideScanner ?? this.hideScanner,
    largeFont: largeFont ?? this.largeFont,
  );

  Map<String, dynamic> toMap() => {
    'storeName': storeName,
    'ownerName': ownerName,
    'phone': phone,
    'currency': currency,
    'largeTxThreshold': Serde.money(largeTxThreshold),
    'dailyTarget': Serde.money(dailyTarget),
    'inventoryEnabled': inventoryEnabled,
    'profitMode': profitMode.index,
    'cashPurchaseAsCogs': cashPurchaseAsCogs,
    'pinCode': pinCode,
    'themeMode': themeMode.index,
    'address': address,
    'receiptHeader': receiptHeader,
    'receiptFooter': receiptFooter,
    'logoBase64': logoBase64,
    'blockOversell': blockOversell,
    'warnBelowCost': warnBelowCost,
    'updatePricesFromPurchase': updatePricesFromPurchase,
    'hideScanner': hideScanner,
    'largeFont': largeFont,
  };

  factory AppSettings.fromMap(Map<String, dynamic> m) => AppSettings(
    storeName: (m['storeName'] as String?) ?? 'بقالتي',
    ownerName: Serde.str(m['ownerName']),
    phone: Serde.str(m['phone']),
    currency: (m['currency'] as String?) ?? 'ر.ي',
    largeTxThreshold: Serde.moneyOpt(m['largeTxThreshold']),
    dailyTarget: Serde.moneyOpt(m['dailyTarget']),
    inventoryEnabled: (m['inventoryEnabled'] as bool?) ?? true,
    profitMode: Serde.enumFrom(
      ProfitMode.values,
      m['profitMode'],
      ProfitMode.accurate,
    ),
    cashPurchaseAsCogs: (m['cashPurchaseAsCogs'] as bool?) ?? true,
    pinCode: Serde.str(m['pinCode']),
    themeMode: Serde.enumFrom(
      AppThemeMode.values,
      m['themeMode'],
      AppThemeMode.system,
    ),
    address: Serde.str(m['address']),
    receiptHeader: Serde.str(m['receiptHeader']),
    receiptFooter: (m['receiptFooter'] as String?) ?? 'شكراً لتسوقكم معنا',
    logoBase64: Serde.str(m['logoBase64']),
    blockOversell: (m['blockOversell'] as bool?) ?? true,
    warnBelowCost: (m['warnBelowCost'] as bool?) ?? true,
    updatePricesFromPurchase:
        (m['updatePricesFromPurchase'] as bool?) ?? true,
    hideScanner: (m['hideScanner'] as bool?) ?? false,
    largeFont: (m['largeFont'] as bool?) ?? false,
  );
}

class AuditEntry {
  const AuditEntry({
    required this.id,
    required this.action,
    required this.entityType,
    required this.entityId,
    required this.summary,
    this.oldValues,
    this.newValues,
    required this.at,
    this.isLargeTx = false,
  });

  final String id;
  final AuditAction action;
  final String entityType;
  final String entityId;

  /// Arabic human-readable summary.
  final String summary;
  final Map<String, dynamic>? oldValues;
  final Map<String, dynamic>? newValues;
  final DateTime at;
  final bool isLargeTx;

  Map<String, dynamic> toMap() => {
    'id': id,
    'action': action.index,
    'entityType': entityType,
    'entityId': entityId,
    'summary': summary,
    'oldValues': oldValues,
    'newValues': newValues,
    'at': Serde.dt(at),
    'isLargeTx': isLargeTx,
  };

  factory AuditEntry.fromMap(Map<String, dynamic> m) => AuditEntry(
    id: m['id'] as String,
    action: Serde.enumFrom(AuditAction.values, m['action'], AuditAction.update),
    entityType: m['entityType'] as String,
    entityId: m['entityId'] as String,
    summary: m['summary'] as String,
    oldValues: m['oldValues'] == null
        ? null
        : Map<String, dynamic>.from(m['oldValues'] as Map),
    newValues: m['newValues'] == null
        ? null
        : Map<String, dynamic>.from(m['newValues'] as Map),
    at: Serde.dtReq(m['at']),
    isLargeTx: (m['isLargeTx'] as bool?) ?? false,
  );
}
