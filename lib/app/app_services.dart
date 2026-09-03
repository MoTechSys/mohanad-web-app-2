import '../data/kv_backend.dart';
import '../data/ledger_db.dart';
import '../data/services/document_service.dart';
import '../data/services/inventory_service.dart';
import '../data/services/party_service.dart';
import '../data/services/report_service.dart';
import '../data/services/settings_service.dart';

/// Composition root. One instance per app; injected via Provider.
class AppServices {
  AppServices._(this.db)
    : parties = PartyService(db),
      inventory = InventoryService(db),
      reports = ReportService(db),
      settings = SettingsService(db) {
    documents = DocumentService(db, parties, inventory);
  }

  factory AppServices.withBackend(KvBackend backend) =>
      AppServices._(LedgerDb(backend));

  final LedgerDb db;
  final PartyService parties;
  final InventoryService inventory;
  late final DocumentService documents;
  final ReportService reports;
  final SettingsService settings;

  Future<void> init() => db.load();
}
