package com.anonymous.Layrate

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class PollServiceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PollServiceModule"

    @ReactMethod
    fun startService(config: ReadableMap) {
        val context = reactApplicationContext
        val intent = Intent(context, ForegroundPollService::class.java).apply {
            putExtra(ForegroundPollService.EXTRA_FLASK_URL, config.getString("flaskUrl") ?: "http://10.0.2.2:5000")
            putExtra(ForegroundPollService.EXTRA_LARAVEL_URL, config.getString("laravelUrl") ?: "http://10.0.2.2:8000")
            putExtra(ForegroundPollService.EXTRA_DEVICE_KEY, config.getString("deviceKey") ?: "")
            putExtra(ForegroundPollService.EXTRA_AUTH_TOKEN, config.getString("token") ?: "")
            putExtra(ForegroundPollService.EXTRA_POLL_INTERVAL, config.getInt("pollIntervalMs").toLong().coerceAtLeast(5000L))
        }
        context.startForegroundService(intent)
    }

    @ReactMethod
    fun stopService() {
        val context = reactApplicationContext
        val intent = Intent(context, ForegroundPollService::class.java).apply {
            action = ForegroundPollService.ACTION_STOP
        }
        context.startService(intent)
    }

    @ReactMethod
    fun updateInterval(intervalMs: Int) {
        val context = reactApplicationContext
        val prefs = context.getSharedPreferences("layrate_poll_service", Context.MODE_PRIVATE)
        val intent = Intent(context, ForegroundPollService::class.java).apply {
            action = ForegroundPollService.ACTION_UPDATE_CONFIG
            putExtra(ForegroundPollService.EXTRA_FLASK_URL, prefs.getString(ForegroundPollService.EXTRA_FLASK_URL, "http://10.0.2.2:5000"))
            putExtra(ForegroundPollService.EXTRA_LARAVEL_URL, prefs.getString(ForegroundPollService.EXTRA_LARAVEL_URL, "http://10.0.2.2:8000"))
            putExtra(ForegroundPollService.EXTRA_DEVICE_KEY, prefs.getString(ForegroundPollService.EXTRA_DEVICE_KEY, "") ?: "")
            putExtra(ForegroundPollService.EXTRA_AUTH_TOKEN, prefs.getString(ForegroundPollService.EXTRA_AUTH_TOKEN, "") ?: "")
            putExtra(ForegroundPollService.EXTRA_POLL_INTERVAL, intervalMs.toLong().coerceAtLeast(5000L))
        }
        context.startService(intent)
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun isAuthFailed(): Boolean {
        val prefs = reactApplicationContext.getSharedPreferences("layrate_poll_service", Context.MODE_PRIVATE)
        return prefs.getBoolean("auth_failed", false)
    }

    @ReactMethod
    fun clearAuthFailed() {
        val prefs = reactApplicationContext.getSharedPreferences("layrate_poll_service", Context.MODE_PRIVATE)
        prefs.edit().remove("auth_failed").apply()
    }
}
