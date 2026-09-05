# ── Flutter engine / embedding ────────────────────────────────────────────
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**

# ── Our MethodChannel bridge (reflection-free, but keep entry point) ──────
-keep class com.groceryledger.accounts.MainActivity { *; }

# ── ML Kit barcode (mobile_scanner) — keep model loaders/JNI glue ─────────
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_barcode.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_barcode_bundled.** { *; }
-dontwarn com.google.mlkit.**
-dontwarn com.google.android.gms.**

# ── Kotlin metadata / coroutines: strip debug probes & unused metadata ────
-dontwarn kotlinx.coroutines.**
-assumenosideeffects class kotlin.jvm.internal.Intrinsics {
    static void checkNotNull(...);
    static void checkExpressionValueIsNotNull(...);
    static void checkNotNullExpressionValue(...);
    static void checkParameterIsNotNull(...);
    static void checkNotNullParameter(...);
}

# ── Strip Android logging in release ──────────────────────────────────────
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}

# ── Aggressive but safe optimisation ──────────────────────────────────────
-optimizationpasses 5
-allowaccessmodification
-repackageclasses ''
