package com.sportsbar.scout

import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import com.sportsbar.scout.BuildConfig
import android.os.Bundle
import android.provider.Settings
import android.text.format.Formatter
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import java.net.NetworkInterface

class MainActivity : AppCompatActivity() {

    private lateinit var statusText: TextView
    private lateinit var deviceIdText: TextView
    private lateinit var startButton: Button
    private lateinit var stopButton: Button

    companion object {
        const val HEARTBEAT_INTERVAL_MS = 30000L
        val VERSION: String get() = BuildConfig.VERSION_NAME

        fun getServerUrl(context: Context): String {
            return context.getSharedPreferences("scout_config", Context.MODE_PRIVATE)
                .getString("server_url", BuildConfig.SERVER_URL_DEFAULT)
                ?: BuildConfig.SERVER_URL_DEFAULT
        }

        // Android ID to Device ID mapping (primary - most reliable)
        private val ANDROID_ID_MAP = mapOf(
            "269b00cbf863c6ab" to Pair("firetv-1", "Fire TV 1"),
            "6f5baa80b48bfc75" to Pair("firetv-2", "Fire TV 2"),
            "546fb1d1cff87eab" to Pair("firetv-3", "Fire TV 3")
        )

        // IP to Device ID mapping (fallback)
        private val IP_DEVICE_MAP = mapOf(
            "10.40.10.92" to Pair("firetv-1", "Fire TV 1"),
            "10.40.10.93" to Pair("firetv-2", "Fire TV 2"),
            "10.40.10.94" to Pair("firetv-3", "Fire TV 3")
        )

        var deviceId: String = "fire-tv-unknown"
        var deviceName: String = "Fire TV Unknown"
        var ipAddress: String? = null
        var androidId: String? = null

        fun detectDevice(context: Context) {
            // Try Android ID first (most reliable)
            androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            androidId?.let { aid ->
                ANDROID_ID_MAP[aid]?.let { (id, name) ->
                    deviceId = id
                    deviceName = name
                }
            }

            // Get IP address (for reporting and fallback)
            ipAddress = getIpAddress(context)

            // Fallback to IP if Android ID not matched
            if (deviceId == "fire-tv-unknown") {
                ipAddress?.let { ip ->
                    IP_DEVICE_MAP[ip]?.let { (id, name) ->
                        deviceId = id
                        deviceName = name
                    }
                }
            }
        }

        @Suppress("DEPRECATION")
        private fun getIpAddress(context: Context): String? {
            // Try NetworkInterface first (works for both WiFi and Ethernet)
            try {
                val interfaces = NetworkInterface.getNetworkInterfaces()
                while (interfaces.hasMoreElements()) {
                    val iface = interfaces.nextElement()
                    // Skip loopback and inactive interfaces
                    if (iface.isLoopback || !iface.isUp) continue

                    val addresses = iface.inetAddresses
                    while (addresses.hasMoreElements()) {
                        val addr = addresses.nextElement()
                        // Skip IPv6 and loopback
                        if (!addr.isLoopbackAddress && addr.hostAddress?.contains('.') == true) {
                            val ip = addr.hostAddress
                            // Only return 192.168.x.x addresses
                            if (ip?.startsWith("10.40.10.") == true || ip?.startsWith("192.168.") == true) {
                                return ip
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                // Fall through to WiFi method
            }

            // Fallback to WifiManager for WiFi connections
            return try {
                val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                val wifiInfo = wifiManager.connectionInfo
                val ip = wifiInfo.ipAddress
                if (ip != 0) Formatter.formatIpAddress(ip) else null
            } catch (e: Exception) {
                null
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Detect device based on IP
        detectDevice(this)

        statusText = findViewById(R.id.statusText)
        deviceIdText = findViewById(R.id.deviceIdText)
        startButton = findViewById(R.id.startButton)
        stopButton = findViewById(R.id.stopButton)

        deviceIdText.text = "Device: $deviceName ($deviceId)\nIP: $ipAddress\nVersion: $VERSION"

        startButton.setOnClickListener {
            startScoutService()
        }

        stopButton.setOnClickListener {
            stopScoutService()
        }

        // Auto-start on launch
        startScoutService()
    }

    private fun startScoutService() {
        val intent = Intent(this, ScoutService::class.java)
        ContextCompat.startForegroundService(this, intent)
        statusText.text = "Status: Running"
        statusText.setTextColor(0xFF4ADE80.toInt())
    }

    private fun stopScoutService() {
        val intent = Intent(this, ScoutService::class.java)
        stopService(intent)
        statusText.text = "Status: Stopped"
        statusText.setTextColor(0xFFEF4444.toInt())
    }
}
