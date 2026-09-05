import '../data/export/excel_exporter.dart';
import '../data/export/pdf_exporter.dart';
import '../data/export/share_service.dart';
import '../data/kv_backend.dart';
import '../data/ledger_db.dart';
import '../data/services/cash_session_service.dart';
import '../data/services/document_service.dart';
import '../data/services/inventory_service.dart';
import '../data/services/party_service.dart';
import '../data/services/report_service.dart';
import '../data/services/settings_service.dart';
import '../data/services/sms_service.dart';
import '../data/services/voucher_service.dart';

/// Composition root. One instance per app; injected via Provider.
class AppServices {
  AppServices._(this.db)
    : parties = PartyService(db),
      inventory = InventoryService(db),
      reports = ReportService(db),
      settings = SettingsService(db),
      vouchers = VoucherService(db),
      sms = SmsService(db),
      shifts = CashSessionService(db) {
    documents = DocumentService(db, parties, inventory);
    pdf = PdfExporter(db, reports);
    excel = ExcelExporter(db, reports);
  }

  factory AppServices.withBackend(KvBackend backend) =>
      AppServices._(LedgerDb(backend));

  final LedgerDb db;
  final PartyService parties;
  final InventoryService inventory;
  late final DocumentService documents;
  final ReportService reports;
  final SettingsService settings;
  final VoucherService vouchers;
  final SmsService sms;
  final CashSessionService shifts;
  late final PdfExporter pdf;
  late final ExcelExporter excel;
  final ShareService share = const ShareService();

  Future<void> init() => db.load();
}
