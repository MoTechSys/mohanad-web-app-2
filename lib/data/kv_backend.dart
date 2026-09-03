import 'package:hive_flutter/hive_flutter.dart';

/// Minimal key/value persistence contract. Each "box" holds
/// `id → Map<String, dynamic>` records.
abstract class KvBackend {
  Future<void> open(List<String> boxes);
  Map<String, Map<String, dynamic>> readAll(String box);
  Future<void> writeMany(String box, Map<String, Map<String, dynamic>> rows);
  Future<void> clearAll();
  Future<void> close();
}

/// In-memory backend for unit tests and previews.
class MemoryBackend implements KvBackend {
  final Map<String, Map<String, Map<String, dynamic>>> _data = {};

  @override
  Future<void> open(List<String> boxes) async {
    for (final b in boxes) {
      _data.putIfAbsent(b, () => {});
    }
  }

  @override
  Map<String, Map<String, dynamic>> readAll(String box) =>
      Map.of(_data[box] ?? const {});

  @override
  Future<void> writeMany(
    String box,
    Map<String, Map<String, dynamic>> rows,
  ) async {
    _data.putIfAbsent(box, () => {}).addAll(rows);
  }

  @override
  Future<void> clearAll() async {
    for (final b in _data.values) {
      b.clear();
    }
  }

  @override
  Future<void> close() async {}
}

/// Hive-backed persistence. Boxes are opened once at startup; all rows are
/// read into memory by the repositories, and writes go straight through.
class HiveBackend implements KvBackend {
  final Map<String, Box<Map>> _boxes = {};

  @override
  Future<void> open(List<String> boxes) async {
    await Hive.initFlutter('grocery_ledger');
    for (final name in boxes) {
      _boxes[name] = await Hive.openBox<Map>(name);
    }
  }

  @override
  Map<String, Map<String, dynamic>> readAll(String box) {
    final b = _boxes[box]!;
    final out = <String, Map<String, dynamic>>{};
    for (final key in b.keys) {
      final v = b.get(key);
      if (v != null) out[key as String] = Map<String, dynamic>.from(v);
    }
    return out;
  }

  @override
  Future<void> writeMany(
    String box,
    Map<String, Map<String, dynamic>> rows,
  ) async {
    if (rows.isEmpty) return;
    await _boxes[box]!.putAll(rows);
  }

  @override
  Future<void> clearAll() async {
    for (final b in _boxes.values) {
      await b.clear();
    }
  }

  @override
  Future<void> close() async {
    for (final b in _boxes.values) {
      await b.close();
    }
    _boxes.clear();
  }
}
