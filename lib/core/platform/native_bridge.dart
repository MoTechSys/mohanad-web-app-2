import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Thin wrapper over the Android MethodChannel implemented in MainActivity.kt.
/// Every call is best-effort: failures are swallowed so the UI never breaks
/// on platforms without the channel (tests, web preview).
class NativeBridge {
  NativeBridge._();

  static const _ch = MethodChannel('grocery_ledger/native');

  /// Set in tests to observe calls instead of hitting the platform.
  @visibleForTesting
  static void Function(String method, Map<String, dynamic> args)? spy;

  static Future<T?> _call<T>(String m, [Map<String, dynamic> args = const {}]) async {
    spy?.call(m, args);
    if (spy != null) return null;
    try {
      return await _ch.invokeMethod<T>(m, args);
    } on MissingPluginException {
      return null;
    } on PlatformException {
      return null;
    }
  }

  /// Short scanner beep. [kind]: `ok` | `success` | `error`.
  static Future<void> beep([String kind = 'ok']) => _call('beep', {'kind': kind});

  static Future<void> vibrate([int ms = 40]) => _call('vibrate', {'ms': ms});

  static Future<bool> openUrl(String url) async =>
      (await _call<bool>('openUrl', {'url': url})) ?? false;

  static Future<bool> dial(String number) async =>
      (await _call<bool>('dial', {'number': number})) ?? false;

  static Future<bool> share(String text, {String? subject}) async =>
      (await _call<bool>('share', {'text': text, 'subject': subject})) ?? false;

  /// إرسال SMS مباشر عبر SmsManager (بدون فتح تطبيق الرسائل).
  /// يطلب صلاحية SEND_SMS تلقائيًا أول مرة. يرجع false عند الرفض/الفشل.
  static Future<bool> sendSms(String number, String text) async =>
      (await _call<bool>('sendSms', {'number': number, 'text': text})) ?? false;

  /// Combined scan feedback: sound + haptic.
  static Future<void> scanOk() async {
    await beep('ok');
    await vibrate(30);
  }

  static Future<void> scanError() async {
    await beep('error');
    await vibrate(120);
  }
}
