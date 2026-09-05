package com.groceryledger.accounts

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.MediaStore
import android.telephony.SmsManager
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.io.File
import java.io.FileOutputStream
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/// Tiny native bridge (no extra plugins → smaller APK):
///  - beep(kind)      : scanner confirmation tones via ToneGenerator
///  - vibrate(ms)     : haptic feedback
///  - openUrl(url)    : ACTION_VIEW
///  - dial(number)    : ACTION_DIAL (no CALL_PHONE permission needed)
///  - sendSms(...)    : direct SMS via SmsManager (offline stores — no chooser)
///  - showNotification: local notification (expiry alerts) — POST_NOTIFICATIONS on 33+
///  - saveToDownloads : writes a file into public Download/دفتر البقالة via MediaStore
class MainActivity : FlutterActivity() {
    private var tone: ToneGenerator? = null
    private var pendingSms: Pair<String, String>? = null
    private var pendingResult: MethodChannel.Result? = null
    private var pendingNotification: Triple<Int, String, String>? = null

    companion object {
        private const val SMS_PERMISSION_REQUEST = 7301
        private const val NOTIF_PERMISSION_REQUEST = 7302
        private const val CHANNEL_ID = "grocery_alerts"
    }

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
                    "sendSms" -> {
                        val number = call.argument<String>("number")
                        val text = call.argument<String>("text")
                        if (number.isNullOrBlank() || text.isNullOrBlank()) {
                            result.success(false)
                        } else {
                            sendSms(number, text, result)
                        }
                    }
                    "showNotification" -> {
                        val id = call.argument<Int>("id") ?: 1
                        val title = call.argument<String>("title") ?: ""
                        val body = call.argument<String>("body") ?: ""
                        showNotification(id, title, body)
                        result.success(true)
                    }
                    "saveToDownloads" -> {
                        val name = call.argument<String>("name")
                        val bytes = call.argument<ByteArray>("bytes")
                        val mime = call.argument<String>("mime") ?: "application/octet-stream"
                        if (name.isNullOrBlank() || bytes == null) {
                            result.success(null)
                        } else {
                            result.success(saveToDownloads(name, bytes, mime))
                        }
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

    /// Sends the SMS directly (SmsManager). Requests SEND_SMS at runtime the
    /// first time; retries automatically once granted. Long messages are
    /// split into multipart automatically.
    private fun sendSms(number: String, text: String, result: MethodChannel.Result) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            pendingSms = number to text
            pendingResult = result
            ActivityCompat.requestPermissions(
                this, arrayOf(Manifest.permission.SEND_SMS), SMS_PERMISSION_REQUEST
            )
            return
        }
        result.success(doSendSms(number, text))
    }

    private fun doSendSms(number: String, text: String): Boolean = try {
        @Suppress("DEPRECATION")
        val sms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(SmsManager::class.java)
        } else {
            SmsManager.getDefault()
        }
        val parts = sms.divideMessage(text)
        if (parts.size > 1) {
            sms.sendMultipartTextMessage(number, null, parts, null, null)
        } else {
            sms.sendTextMessage(number, null, text, null, null)
        }
        true
    } catch (_: Exception) {
        false
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<out String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == SMS_PERMISSION_REQUEST) {
            val granted = grantResults.isNotEmpty() &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED
            val p = pendingSms
            val r = pendingResult
            pendingSms = null
            pendingResult = null
            if (p != null && r != null) {
                r.success(granted && doSendSms(p.first, p.second))
            }
        }
        if (requestCode == NOTIF_PERMISSION_REQUEST) {
            val granted = grantResults.isNotEmpty() &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED
            val n = pendingNotification
            pendingNotification = null
            if (granted && n != null) doShowNotification(n.first, n.second, n.third)
        }
    }

    /// إشعار محلي (تنبيهات انتهاء الصلاحية). على أندرويد 13+ يطلب إذن
    /// POST_NOTIFICATIONS أول مرة ثم يعيد المحاولة تلقائيًا عند الموافقة.
    private fun showNotification(id: Int, title: String, body: String) {
        try {
            if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                pendingNotification = Triple(id, title, body)
                ActivityCompat.requestPermissions(
                    this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIF_PERMISSION_REQUEST
                )
                return
            }
            doShowNotification(id, title, body)
        } catch (_: Exception) {
        }
    }

    private fun doShowNotification(id: Int, title: String, body: String) {
        try {
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                nm.createNotificationChannel(
                    NotificationChannel(
                        CHANNEL_ID, "تنبيهات دفتر البقالة",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply { description = "تنبيهات انتهاء الصلاحية ونقص المخزون" }
                )
            }
            val tap = PendingIntent.getActivity(
                this, 0, Intent(this, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val n = NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(applicationInfo.icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(tap)
                .setAutoCancel(true)
                .build()
            nm.notify(id, n)
        } catch (_: Exception) {
        }
    }

    /// حفظ ملف في مجلد التنزيلات العام: Download/دفتر البقالة/
    /// - أندرويد 10+ (API 29): MediaStore بدون أي أذونات.
    /// - أقدم: كتابة مباشرة (WRITE_EXTERNAL_STORAGE ضمن maxSdkVersion=28).
    /// يعيد المسار المعروض للمستخدم أو null عند الفشل.
    private fun saveToDownloads(name: String, bytes: ByteArray, mime: String): String? = try {
        val subDir = "دفتر البقالة"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.RELATIVE_PATH,
                    Environment.DIRECTORY_DOWNLOADS + File.separator + subDir)
            }
            val uri = contentResolver.insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI, values
            )
            if (uri == null) null else {
                contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                "Download/$subDir/$name"
            }
        } else {
            @Suppress("DEPRECATION")
            val dl = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val dir = File(dl, subDir).apply { mkdirs() }
            val f = File(dir, name)
            FileOutputStream(f).use { it.write(bytes) }
            "Download/$subDir/$name"
        }
    } catch (_: Exception) {
        null
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
