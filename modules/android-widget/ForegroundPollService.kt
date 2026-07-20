package com.anonymous.Layrate

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.IBinder
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

class ForegroundPollService : Service() {

    private val executor = Executors.newSingleThreadScheduledExecutor()
    private var pollTask: ScheduledFuture<*>? = null
    private var lastTemperature = "--°C"
    private var lastHumidity = "--%"
    private var lastEggCount = 0
    private val seenAlertIds = mutableSetOf<Int>()
    private var started = false

    private var flaskUrl = "http://10.0.2.2:5000"
    private var laravelUrl = "http://10.0.2.2:8000"
    private var deviceKey = ""
    private var authToken = ""
    private var pollIntervalMs = 60000L
    private var authNotified = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "onCreate")
        createNotificationChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            Log.i(TAG, "onStartCommand: null intent, restoring from prefs")
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            restoreConfig(prefs)
            if (deviceKey.isEmpty()) {
                Log.w(TAG, "No device key in prefs, stopping")
                stopSelf()
                return START_NOT_STICKY
            }
            startPolling()
            return START_STICKY
        }

        when (intent.action) {
            ACTION_STOP -> {
                Log.i(TAG, "onStartCommand: STOP")
                stopPolling()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_UPDATE_CONFIG -> {
                Log.i(TAG, "onStartCommand: UPDATE_CONFIG")
                saveConfig(intent)
                if (started) {
                    stopPolling()
                    startPolling()
                }
            }
            else -> {
                Log.i(TAG, "onStartCommand: START with config")
                saveConfig(intent)
                startPolling()
            }
        }

        return START_STICKY
    }

    private fun saveConfig(intent: Intent) {
        intent.getStringExtra(EXTRA_FLASK_URL)?.let { flaskUrl = it }
        intent.getStringExtra(EXTRA_LARAVEL_URL)?.let { laravelUrl = it }
        intent.getStringExtra(EXTRA_DEVICE_KEY)?.let { deviceKey = it }
        intent.getStringExtra(EXTRA_AUTH_TOKEN)?.let { authToken = it }
        intent.getLongExtra(EXTRA_POLL_INTERVAL, 60000L).let { pollIntervalMs = it.coerceAtLeast(5000L) }

        Log.d(TAG, "Config saved: flask=$flaskUrl laravel=$laravelUrl interval=$pollIntervalMs")

        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().apply {
            putString(EXTRA_FLASK_URL, flaskUrl)
            putString(EXTRA_LARAVEL_URL, laravelUrl)
            putString(EXTRA_DEVICE_KEY, deviceKey)
            putString(EXTRA_AUTH_TOKEN, authToken)
            putLong(EXTRA_POLL_INTERVAL, pollIntervalMs)
            apply()
        }
    }

    private fun restoreConfig(prefs: SharedPreferences) {
        flaskUrl = prefs.getString(EXTRA_FLASK_URL, flaskUrl) ?: flaskUrl
        laravelUrl = prefs.getString(EXTRA_LARAVEL_URL, laravelUrl) ?: laravelUrl
        deviceKey = prefs.getString(EXTRA_DEVICE_KEY, "") ?: ""
        authToken = prefs.getString(EXTRA_AUTH_TOKEN, "") ?: ""
        pollIntervalMs = prefs.getLong(EXTRA_POLL_INTERVAL, 60000L).coerceAtLeast(5000L)
        Log.d(TAG, "Config restored: flask=$flaskUrl interval=$pollIntervalMs deviceKey=${deviceKey.take(8)}...")
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager

        val statusChannel = NotificationChannel(
            CHANNEL_STATUS, "Layrate Monitor", NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Persistent monitoring status"
            setShowBadge(true)
        }
        nm.createNotificationChannel(statusChannel)
        Log.d(TAG, "Status channel created")

        val alertChannel = NotificationChannel(
            CHANNEL_ALERTS, "Farm Alerts", NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Incubator alert notifications"
            enableVibration(true)
        }
        nm.createNotificationChannel(alertChannel)
        Log.d(TAG, "Alert channel created")
    }

    private fun startPolling() {
        if (started) {
            Log.d(TAG, "Already started, skipping")
            return
        }
        started = true

        try {
            val notification = buildPersistentNotification(lastTemperature, lastHumidity, lastEggCount)
            startForeground(NOTIFICATION_ID_PERSISTENT, notification)
            Log.i(TAG, "startForeground() succeeded, interval=$pollIntervalMs")
        } catch (e: Exception) {
            Log.e(TAG, "startForeground() failed", e)
            started = false
            return
        }

        pollTask = executor.scheduleWithFixedDelay({
            try {
                pollFlask()
                pollAlerts()
            } catch (e: Exception) {
                Log.e(TAG, "Poll cycle failed", e)
            }
        }, 0, pollIntervalMs, TimeUnit.MILLISECONDS)

        Log.i(TAG, "Polling started with interval ${pollIntervalMs}ms")
    }

    private fun stopPolling() {
        started = false
        pollTask?.cancel(false)
        pollTask = null
        Log.d(TAG, "Polling stopped")
    }

    private fun pollFlask() {
        try {
            val url = URL("$flaskUrl/api/dashboard/status")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("Authorization", "Bearer $authToken")
            conn.connectTimeout = 10000
            conn.readTimeout = 10000

            val responseCode = conn.responseCode
            Log.d(TAG, "Flask poll: $flaskUrl/api/dashboard/status -> $responseCode")

            if (responseCode == 200) {
                getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().remove("auth_failed").apply()
                authNotified = false
                val body = readStream(conn.inputStream)
                val json = JSONObject(body)
                val temp = json.optDouble("temperature", Double.NaN)
                val hum = json.optString("humidity", "--")
                val eggs = json.optInt("egg_count", 0)

                lastTemperature = if (!temp.isNaN()) String.format("%.1f°C", temp) else "--°C"
                lastHumidity = if (hum != "--") "${hum}%" else "--%"
                lastEggCount = eggs

                showPersistentNotification(lastTemperature, lastHumidity, lastEggCount)
                val timeStr = SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date())
                LayrateWidgetProvider.updateWidget(
                    this, true,
                    lastEggCount.toString(), lastTemperature, lastHumidity, timeStr
                )
            } else if (responseCode == 401) {
                getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().putBoolean("auth_failed", true).apply()
                LayrateWidgetProvider.setLoggedOut(this)
                if (!authNotified) {
                    authNotified = true
                    showAuthFailedNotification()
                    stopPolling()
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                    Log.w(TAG, "Auth token rejected (401), service stopped")
                }
            }
            conn.disconnect()
        } catch (e: Exception) {
            Log.w(TAG, "Flask poll failed", e)
        }
    }

    private fun pollAlerts() {
        try {
            val url = URL("$flaskUrl/api/alerts?is_read=0")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("Authorization", "Bearer $authToken")
            conn.connectTimeout = 10000
            conn.readTimeout = 10000

            val responseCode = conn.responseCode
            Log.d(TAG, "Alerts poll: $flaskUrl/api/alerts?is_read=0 -> $responseCode")

            if (responseCode == 200) {
                val body = readStream(conn.inputStream)
                val json = JSONObject(body)
                val data = json.optJSONArray("alerts") ?: json.optJSONArray("data") ?: JSONArray()
                Log.d(TAG, "Alerts returned ${data.length()} items")

                for (i in 0 until data.length()) {
                    val alert = data.getJSONObject(i)
                    val id = alert.optInt("id", 0)
                    if (id > 0 && seenAlertIds.add(id)) {
                        val alertType = alert.optString("alert_type", "Alert")
                        val message = alert.optString("message", "")
                        val cageCode = alert.optString("cage_code", "")
                        Log.i(TAG, "New alert #$id: $alertType")
                        showAlertNotification(alertType, message, cageCode, id)
                    }
                }

                if (seenAlertIds.size > MAX_SEEN_ALERTS) {
                    val excess = seenAlertIds.size - MAX_SEEN_ALERTS
                    val toRemove = seenAlertIds.take(excess).toSet()
                    seenAlertIds.removeAll(toRemove)
                }
            }
            conn.disconnect()
        } catch (e: Exception) {
            Log.w(TAG, "Alerts poll failed", e)
        }
    }

    private fun showPersistentNotification(temp: String, hum: String, eggs: Int) {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val notification = buildPersistentNotification(temp, hum, eggs)
        nm.notify(NOTIFICATION_ID_PERSISTENT, notification)
    }

    private fun buildPersistentNotification(temp: String, hum: String, eggs: Int): Notification {
        val openIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = Notification.Builder(this, CHANNEL_STATUS)
            .setContentTitle("Layrate Live Monitoring")
            .setContentText("Eggs $eggs · Temperature $temp · Humidity $hum")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .setShowWhen(true)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
        }

        return builder.build()
    }

    private fun showAlertNotification(alertType: String, message: String, cageCode: String, alertId: Int) {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val location = if (cageCode.isNotEmpty()) " ($cageCode)" else ""

        val openIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = Notification.Builder(this, CHANNEL_ALERTS)
            .setContentTitle("$alertType$location")
            .setContentText(message)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setShowWhen(true)
            .setDefaults(Notification.DEFAULT_SOUND or Notification.DEFAULT_VIBRATE)
            .build()

        nm.notify(NOTIFICATION_ID_ALERT_BASE + alertId, notification)
    }

    private fun showAuthFailedNotification() {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val openIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = Notification.Builder(this, CHANNEL_ALERTS)
            .setContentTitle("Session Expired")
            .setContentText("Logged in from another device. Tap to sign in again.")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setShowWhen(true)
            .setDefaults(Notification.DEFAULT_SOUND or Notification.DEFAULT_VIBRATE)
            .build()
        nm.notify(NOTIFICATION_ID_AUTH_FAILED, notification)
    }

    private fun removeAuthFailedNotification() {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(NOTIFICATION_ID_AUTH_FAILED)
    }

    private fun removePersistentNotification() {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(NOTIFICATION_ID_PERSISTENT)
    }

    override fun onDestroy() {
        Log.i(TAG, "onDestroy")
        stopPolling()
        executor.shutdown()
        removeAuthFailedNotification()
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    companion object {
        private const val TAG = "ForegroundPollService"
        private const val PREFS_NAME = "layrate_poll_service"

        const val ACTION_STOP = "com.anonymous.Layrate.STOP"
        const val ACTION_UPDATE_CONFIG = "com.anonymous.Layrate.UPDATE_CONFIG"

        const val EXTRA_FLASK_URL = "flaskUrl"
        const val EXTRA_LARAVEL_URL = "laravelUrl"
        const val EXTRA_DEVICE_KEY = "deviceKey"
        const val EXTRA_AUTH_TOKEN = "token"
        const val EXTRA_POLL_INTERVAL = "pollIntervalMs"

        const val CHANNEL_STATUS = "layrate-foreground"
        const val CHANNEL_ALERTS = "layrate-alerts"

        private const val NOTIFICATION_ID_PERSISTENT = 1
        private const val NOTIFICATION_ID_ALERT_BASE = 1000
        private const val NOTIFICATION_ID_AUTH_FAILED = 9999
        private const val MAX_SEEN_ALERTS = 100

        fun readStream(stream: java.io.InputStream): String {
            val reader = BufferedReader(InputStreamReader(stream, "UTF-8"))
            val sb = StringBuilder()
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                sb.append(line)
            }
            reader.close()
            return sb.toString()
        }
    }
}
