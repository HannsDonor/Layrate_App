package com.anonymous.Layrate

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class WidgetDataModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetDataModule"

    @ReactMethod
    fun updateWidgetData(data: ReadableMap) {
        val isLoggedIn = if (data.hasKey("isLoggedIn")) data.getBoolean("isLoggedIn") else true
        val eggCount = data.getString("eggCount") ?: "--"
        val temperature = data.getString("temperature") ?: "--°"
        val humidity = data.getString("humidity") ?: "--%"
        val timestamp = data.getString("timestamp") ?: ""

        LayrateWidgetProvider.updateWidget(
            reactApplicationContext,
            isLoggedIn,
            eggCount,
            temperature,
            humidity,
            timestamp
        )
    }
}
