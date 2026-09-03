package com.groceryledger.accounts

import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/// Tiny native bridge (no extra plugins → smaller APK):
///  - beep(kind)      : scanner confirmation tones via ToneGenerator
///  - vibrate(ms)     : haptic feedback
///  - openUrl(url)    : ACTION_VIEW
///  - dial(number)    : ACTION_DIAL (no CALL_PHONE permission needed)
class MainActivity : FlutterActivity() {
    private var tone: ToneGenerator? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "grocery_ledger/native")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "beep" -> {
                        beep(call.argument<String>("kind") ?: "ok")
                        result.success(null)
                    }
                    "vibrate" -> {
                        vibrate((call.argument<Int>("ms") ?: 40).toLong())
                        result.success(null)
                    }
                    "openUrl" -> {
                        val url = call.argument<String>("url")
                        result.success(url != null && open(Intent(Intent.ACTION_VIEW, Uri.parse(url))))
                    }
                    "dial" -> {
                        val n = call.argument<String>("number")
                        result.success(n != null && open(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$n"))))
                    }
                    "share" -> {
                        val text = call.argument<String>("text") ?: ""
                        val i = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, text)
                            putExtra(Intent.EXTRA_SUBJECT, call.argument<String>("subject") ?: "")
                        }
                        result.success(open(Intent.createChooser(i, null)))
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun open(i: Intent): Boolean = try {
        startActivity(i); true
    } catch (_: Exception) {
        false
    }

    private fun beep(kind: String) {
        try {
            val t = tone ?: ToneGenerator(AudioManager.STREAM_MUSIC, 90).also { tone = it }
            when (kind) {
                "error" -> t.startTone(ToneGenerator.TONE_CDMA_ABBR_ALERT, 220)
                "success" -> t.startTone(ToneGenerator.TONE_PROP_ACK, 160)
                else -> t.startTone(ToneGenerator.TONE_PROP_BEEP, 90)
            }
        } catch (_: Exception) {
        }
    }

    private fun vibrate(ms: Long) {
        try {
            val v: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(VIBRATOR_SERVICE) as Vibrator
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(ms)
            }
        } catch (_: Exception) {
        }
    }

    override fun onDestroy() {
        tone?.release()
        tone = null
        super.onDestroy()
    }
}
