/// Arabic-aware text normalisation and typo-tolerant matching.
///
/// Grocery owners type fast and inconsistently («جبن/چبن», «موزة/موزه»,
/// «إصبع/اصبع»). Search must forgive 1–2 letter differences (voice note
/// requirement: «لو تغير حرف حرفين يقبل»).
library;

class ArabicText {
  ArabicText._();

  /// Canonical form used for matching (NOT for display):
  /// - Arabic-Indic digits → ASCII
  /// - strip tashkeel/tatweel
  /// - unify hamza carriers: أ إ آ ٱ → ا, ؤ → و, ئ → ي, stand-alone ء removed
  /// - ة → ه, ى → ي, گ→ك, پ→ب, چ→ج, ڤ→ف (common keyboard variants)
  /// - lower-case latin, collapse whitespace
  static String normalize(String input) {
    final b = StringBuffer();
    var lastSpace = true;
    for (final r in input.trim().toLowerCase().runes) {
      int c = r;
      // Arabic-Indic and Eastern Arabic-Indic digits → ASCII.
      if (c >= 0x0660 && c <= 0x0669) {
        c = 0x30 + (c - 0x0660);
      } else if (c >= 0x06F0 && c <= 0x06F9) {
        c = 0x30 + (c - 0x06F0);
      }
      // Skip tashkeel (064B–065F), superscript alef 0670, tatweel 0640.
      if ((c >= 0x064B && c <= 0x065F) || c == 0x0670 || c == 0x0640) {
        continue;
      }
      switch (c) {
        case 0x0623: // أ
        case 0x0625: // إ
        case 0x0622: // آ
        case 0x0671: // ٱ
          c = 0x0627; // ا
        case 0x0624: // ؤ
          c = 0x0648; // و
        case 0x0626: // ئ
        case 0x0649: // ى
          c = 0x064A; // ي
        case 0x0629: // ة
          c = 0x0647; // ه
        case 0x06AF: // گ
          c = 0x0643; // ك
        case 0x067E: // پ
          c = 0x0628; // ب
        case 0x0686: // چ
          c = 0x062C; // ج
        case 0x06A4: // ڤ
          c = 0x0641; // ف
        case 0x0621: // ء stand-alone
          continue;
      }
      // Collapse runs of whitespace into single spaces.
      if (c == 0x20 || c == 0x09 || c == 0x0A) {
        if (!lastSpace) {
          b.writeCharCode(0x20);
          lastSpace = true;
        }
        continue;
      }
      lastSpace = false;
      b.writeCharCode(c);
    }
    var s = b.toString();
    if (s.endsWith(' ')) s = s.substring(0, s.length - 1);
    return s;
  }

  /// Bounded Levenshtein distance. Returns a value > [max] early when the
  /// distance certainly exceeds it (fast rejection for long words).
  static int distance(String a, String b, {int max = 2}) {
    if (a == b) return 0;
    final la = a.length, lb = b.length;
    if ((la - lb).abs() > max) return max + 1;
    if (la == 0) return lb;
    if (lb == 0) return la;
    var prev = List<int>.generate(lb + 1, (i) => i);
    final curr = List<int>.filled(lb + 1, 0);
    for (var i = 1; i <= la; i++) {
      curr[0] = i;
      var rowMin = curr[0];
      final ca = a.codeUnitAt(i - 1);
      for (var j = 1; j <= lb; j++) {
        final cost = ca == b.codeUnitAt(j - 1) ? 0 : 1;
        var v = prev[j] + 1;
        final ins = curr[j - 1] + 1;
        if (ins < v) v = ins;
        final sub = prev[j - 1] + cost;
        if (sub < v) v = sub;
        curr[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1; // whole row exceeds budget
      final t = prev;
      prev = List<int>.of(curr);
      curr.setAll(0, t);
    }
    return prev[lb];
  }

  /// Typo-tolerant match of [query] against [target] (both raw strings).
  /// Returns a score: 0 = no match, higher = better.
  ///   100 prefix · 80 contains · 60..40 fuzzy word match.
  static int matchScore(String query, String target) {
    final q = normalize(query);
    final t = normalize(target);
    if (q.isEmpty || t.isEmpty) return 0;
    if (t.startsWith(q)) return 100;
    if (t.contains(q)) return 80;
    // Fuzzy: compare query against each word of the target.
    // Budget: 1 edit for short words (≤4), 2 edits for longer.
    final budget = q.length <= 4 ? 1 : 2;
    var best = 0;
    for (final w in t.split(' ')) {
      if (w.isEmpty) continue;
      // Compare against word prefix of same-ish length (typing in progress).
      final probe = w.length > q.length + budget
          ? w.substring(0, q.length + budget)
          : w;
      final d = distance(q, probe, max: budget);
      if (d <= budget) {
        final score = 60 - d * 10;
        if (score > best) best = score;
      }
    }
    return best;
  }
}
