package com.sportsbar.scout

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class ConfigReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val url = intent.getStringExtra("server_url")
        if (url.isNullOrBlank()) {
            Log.w("ConfigReceiver", "CONFIG broadcast with empty server_url — ignoring")
            return
        }
        context.getSharedPreferences("scout_config", Context.MODE_PRIVATE)
            .edit()
            .putString("server_url", url)
            .apply()
        Log.i("ConfigReceiver", "Saved new server_url: $url")
    }
}
