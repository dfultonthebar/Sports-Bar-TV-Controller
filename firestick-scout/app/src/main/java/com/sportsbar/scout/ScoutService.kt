package com.sportsbar.scout

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.sportsbar.scout.api.ScoutApiClient

class ScoutService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var appDetector: AppDetector
    private lateinit var apiClient: ScoutApiClient

    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            sendHeartbeat()
            handler.postDelayed(this, MainActivity.HEARTBEAT_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        appDetector = AppDetector(this)
        apiClient = ScoutApiClient(MainActivity.SERVER_URL)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)

        // Start heartbeat loop
        handler.post(heartbeatRunnable)

        Log.i(TAG, "Scout service started for device: ${MainActivity.deviceId}")
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(heartbeatRunnable)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun sendHeartbeat() {
        Thread {
            try {
                val currentApp = appDetector.getCurrentApp()
                val installedApps = appDetector.getInstalledStreamingApps()
                val loggedInApps = appDetector.getLoggedInApps()
                val ipAddress = appDetector.getIpAddress()

                val heartbeat = HeartbeatData(
                    deviceId = MainActivity.deviceId,
                    deviceName = MainActivity.deviceName,
                    ipAddress = ipAddress,
                    currentApp = currentApp?.packageName,
                    currentAppName = currentApp?.appName,
                    appCategory = currentApp?.category,
                    installedApps = installedApps,
                    loggedInApps = loggedInApps,
                    scoutVersion = MainActivity.VERSION
                )

                val success = apiClient.sendHeartbeat(heartbeat)
                if (success) {
                    Log.d(TAG, "Heartbeat sent successfully")
                } else {
                    Log.w(TAG, "Failed to send heartbeat")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error sending heartbeat", e)
            }
        }.start()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Scout Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "FireStick Scout background service"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("FireStick Scout")
            .setContentText("Monitoring streaming apps...")
            .setSmallIcon(android.R.drawable.ic_menu_info_details)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    companion object {
        private const val TAG = "ScoutService"
        private const val CHANNEL_ID = "scout_service_channel"
        private const val NOTIFICATION_ID = 1
    }
}

data class HeartbeatData(
    val deviceId: String,
    val deviceName: String,
    val ipAddress: String?,
    val currentApp: String?,
    val currentAppName: String?,
    val appCategory: String?,
    val currentGame: String? = null,
    val homeTeam: String? = null,
    val awayTeam: String? = null,
    val homeScore: String? = null,
    val awayScore: String? = null,
    val gameStatus: String? = null,
    val league: String? = null,
    val installedApps: List<String>,
    val loggedInApps: List<String>,
    val scoutVersion: String
)
