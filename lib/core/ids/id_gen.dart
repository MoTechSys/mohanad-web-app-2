import 'dart:math';

/// Compact, sortable, collision-resistant local IDs.
/// Format: `<millis base36><8 random base36 chars>` → lexicographically
/// time-ordered which keeps Hive box iteration roughly chronological.
class IdGen {
  IdGen._();
  static final Random _rng = Random.secure();
  static const String _alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';

  static String next() {
    final ts = DateTime.now().toUtc().millisecondsSinceEpoch.toRadixString(36);
    final sb = StringBuffer(ts);
    for (var i = 0; i < 8; i++) {
      sb.write(_alphabet[_rng.nextInt(_alphabet.length)]);
    }
    return sb.toString();
  }
}
