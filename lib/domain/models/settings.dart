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
