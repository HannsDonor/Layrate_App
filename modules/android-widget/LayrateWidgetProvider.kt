package com.anonymous.Layrate

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.widget.RemoteViews

class LayrateWidgetProvider : AppWidgetProvider() {

    override fun onReceive(context: Context, intent: Intent) {
        if (ACTION_TOGGLE_BG == intent.action) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val current = prefs.getBoolean(KEY_BG_SOLID, true)
            prefs.edit().putBoolean(KEY_BG_SOLID, !current).commit()

            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, LayrateWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            for (appWidgetId in appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId)
            }
            return
        }
        super.onReceive(context, intent)
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {}

    override fun onDisabled(context: Context) {}

    companion object {
        private const val PREFS_NAME = "layrate_widget_data"
        private const val KEY_IS_LOGGED_IN = "is_logged_in"
        private const val KEY_EGG_COUNT = "egg_count"
        private const val KEY_TEMPERATURE = "temperature"
        private const val KEY_HUMIDITY = "humidity"
        private const val KEY_TIMESTAMP = "timestamp"
        private const val KEY_BG_SOLID = "bg_solid"
        private const val ACTION_TOGGLE_BG = "com.anonymous.Layrate.TOGGLE_WIDGET_BG"

        fun setLoggedOut(context: Context) {
            val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putBoolean(KEY_IS_LOGGED_IN, false)
                .commit()

            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, LayrateWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            for (appWidgetId in appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId)
            }
        }

        fun updateWidget(
            context: Context,
            isLoggedIn: Boolean,
            eggCount: String,
            temperature: String,
            humidity: String,
            timestamp: String
        ) {
            val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putBoolean(KEY_IS_LOGGED_IN, isLoggedIn)
                .putString(KEY_EGG_COUNT, eggCount)
                .putString(KEY_TEMPERATURE, temperature)
                .putString(KEY_HUMIDITY, humidity)
                .putString(KEY_TIMESTAMP, timestamp)
                .commit()

            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, LayrateWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            for (appWidgetId in appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId)
            }
        }

        private fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val isLoggedIn = prefs.getBoolean(KEY_IS_LOGGED_IN, false)

            if (!isLoggedIn) {
                val views = RemoteViews(context.packageName, R.layout.layrate_widget_logged_out_layout)
                val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                if (intent != null) {
                    val pendingIntent = PendingIntent.getActivity(
                        context, 0, intent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)
                }
                appWidgetManager.updateAppWidget(appWidgetId, views)
                return
            }

            val eggCount = prefs.getString(KEY_EGG_COUNT, "--") ?: "--"
            val temperature = prefs.getString(KEY_TEMPERATURE, "--°") ?: "--°"
            val humidity = prefs.getString(KEY_HUMIDITY, "--%") ?: "--%"
            val timestamp = prefs.getString(KEY_TIMESTAMP, "") ?: ""
            val isSolid = prefs.getBoolean(KEY_BG_SOLID, true)

            val views = RemoteViews(context.packageName, R.layout.layrate_widget_layout)

            val solidTextColor = android.graphics.Color.parseColor("#1A1A1A")
            val whiteColor = android.graphics.Color.parseColor("#FFFFFF")
            val textColor = if (isSolid) solidTextColor else whiteColor
            val dividerColor = if (isSolid) android.graphics.Color.parseColor("#e6e6e6") else whiteColor
            val toggleLabel = if (isSolid) "Light" else "Glass"
            val bgDrawable = if (isSolid) R.drawable.widget_card_bg_solid else R.drawable.widget_card_bg_transparent

            views.setInt(R.id.widget_root, "setBackgroundResource", bgDrawable)
            views.setTextViewText(R.id.widget_bg_toggle, toggleLabel)
            views.setTextColor(R.id.widget_bg_toggle, textColor)
            views.setTextColor(R.id.widget_total_eggs_label, textColor)
            views.setTextColor(R.id.widget_egg_count, textColor)
            views.setTextColor(R.id.widget_temp_label, textColor)
            views.setTextColor(R.id.widget_humidity_label, textColor)
            views.setTextColor(R.id.widget_timestamp, textColor)
            views.setInt(R.id.widget_vertical_divider, "setBackgroundColor", dividerColor)
            views.setInt(R.id.widget_horizontal_divider, "setBackgroundColor", dividerColor)
            views.setInt(R.id.widget_bottom_divider, "setBackgroundColor", dividerColor)

            val toggleIntent = Intent(context, LayrateWidgetProvider::class.java).apply {
                action = ACTION_TOGGLE_BG
            }
            val togglePendingIntent = PendingIntent.getBroadcast(
                context, 0, toggleIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_bg_toggle, togglePendingIntent)

            views.setTextViewText(R.id.widget_egg_count, eggCount)
            views.setTextViewText(R.id.widget_temperature, temperature)
            views.setTextViewText(R.id.widget_humidity, humidity)

            if (timestamp.isNotEmpty()) {
                views.setTextViewText(R.id.widget_timestamp, "Updated $timestamp")
            }

            val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (intent != null) {
                val pendingIntent = PendingIntent.getActivity(
                    context, 0, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_egg_count, pendingIntent)
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
