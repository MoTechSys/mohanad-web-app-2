import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../theme/app_theme.dart';

/// Live camera viewfinder that reports every decoded barcode to [onCode].
///
/// * Keeps running between scans (continuous mode) — de-duplication is the
///   caller's responsibility (see `CartController.scan`).
/// * Shows a friendly permission / error state instead of a black box.
/// * Torch toggle built in.
class BarcodeScannerView extends StatefulWidget {
  const BarcodeScannerView({
    super.key,
    required this.onCode,
    this.height = 220,
    this.formats = const [
      BarcodeFormat.ean13,
      BarcodeFormat.ean8,
      BarcodeFormat.upcA,
      BarcodeFormat.upcE,
      BarcodeFormat.code128,
      BarcodeFormat.code39,
      BarcodeFormat.qrCode,
      BarcodeFormat.itf,
    ],
  });

  final ValueChanged<String> onCode;
  final double height;
  final List<BarcodeFormat> formats;

  @override
  State<BarcodeScannerView> createState() => _BarcodeScannerViewState();
}

class _BarcodeScannerViewState extends State<BarcodeScannerView>
    with WidgetsBindingObserver {
  late final MobileScannerController _ctrl = MobileScannerController(
    formats: widget.formats,
    detectionSpeed: DetectionSpeed.normal,
    detectionTimeoutMs: 350,
    facing: CameraFacing.back,
    autoStart: false,
  );
  bool _torch = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _ctrl.start();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Release the camera when backgrounded; resume when back.
    if (!_ctrl.value.hasCameraPermission) return;
    switch (state) {
      case AppLifecycleState.resumed:
        _ctrl.start();
      case AppLifecycleState.inactive:
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
      case AppLifecycleState.detached:
        _ctrl.stop();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ctrl.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture cap) {
    for (final b in cap.barcodes) {
      final v = b.rawValue;
      if (v != null && v.isNotEmpty) {
        widget.onCode(v);
        return;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: SizedBox(
        height: widget.height,
        child: Stack(
          fit: StackFit.expand,
          children: [
            MobileScanner(
              controller: _ctrl,
              onDetect: _onDetect,
              errorBuilder: (context, error) => _ErrorState(
                error: error,
                onRetry: () => _ctrl.start(),
              ),
              placeholderBuilder: (context) => Container(
                color: Colors.black,
                alignment: Alignment.center,
                child: const CircularProgressIndicator(color: Colors.white),
              ),
            ),
            // Aiming frame
            IgnorePointer(
              child: Center(
                child: Container(
                  width: 240,
                  height: 120,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: c.primary.withValues(alpha: 0.95),
                      width: 3,
                    ),
                  ),
                ),
              ),
            ),
            IgnorePointer(
              child: Center(
                child: Container(
                  width: 220,
                  height: 2,
                  color: c.danger.withValues(alpha: 0.8),
                ),
              ),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: _RoundIcon(
                icon: _torch ? Icons.flash_on : Icons.flash_off,
                onTap: () async {
                  await _ctrl.toggleTorch();
                  if (mounted) setState(() => _torch = !_torch);
                },
              ),
            ),
            Positioned(
              bottom: 8,
              right: 8,
              left: 8,
              child: IgnorePointer(
                child: Text(
                  'وجّه الكاميرا نحو الباركود',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.9),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    shadows: const [Shadow(blurRadius: 6, color: Colors.black)],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoundIcon extends StatelessWidget {
  const _RoundIcon({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.black.withValues(alpha: 0.45),
    shape: const CircleBorder(),
    child: InkWell(
      customBorder: const CircleBorder(),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    ),
  );
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.error, required this.onRetry});
  final MobileScannerException error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final denied = error.errorCode == MobileScannerErrorCode.permissionDenied;
    return Container(
      color: c.cardAlt,
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            denied ? Icons.no_photography_outlined : Icons.videocam_off_outlined,
            size: 36,
            color: c.textMuted,
          ),
          const SizedBox(height: 8),
          Text(
            denied
                ? 'لم يُسمح باستخدام الكاميرا. فعّل الإذن من إعدادات الهاتف أو أدخل الباركود يدوياً.'
                : 'تعذّر تشغيل الكاميرا. يمكنك إدخال الباركود يدوياً.',
            textAlign: TextAlign.center,
            style: TextStyle(color: c.textMuted, fontSize: 13),
          ),
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('إعادة المحاولة'),
          ),
        ],
      ),
    );
  }
}

/// Full-screen single-shot scanner. Returns the code or null.
Future<String?> scanBarcodeOnce(BuildContext context, {String title = 'مسح الباركود'}) {
  return Navigator.push<String>(
    context,
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (ctx) => _SingleScanPage(title: title),
    ),
  );
}

class _SingleScanPage extends StatefulWidget {
  const _SingleScanPage({required this.title});
  final String title;

  @override
  State<_SingleScanPage> createState() => _SingleScanPageState();
}

class _SingleScanPageState extends State<_SingleScanPage> {
  bool _done = false;
  final _manual = TextEditingController();

  @override
  void dispose() {
    _manual.dispose();
    super.dispose();
  }

  void _finish(String code) {
    if (_done) return;
    _done = true;
    Navigator.pop(context, code);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Expanded(
                child: BarcodeScannerView(
                  height: double.infinity,
                  onCode: _finish,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _manual,
                textDirection: TextDirection.ltr,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'أو أدخل الباركود يدوياً',
                  prefixIcon: const Icon(Icons.keyboard_outlined),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.check),
                    onPressed: () {
                      if (_manual.text.trim().isNotEmpty) _finish(_manual.text.trim());
                    },
                  ),
                ),
                onSubmitted: (v) {
                  if (v.trim().isNotEmpty) _finish(v.trim());
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
