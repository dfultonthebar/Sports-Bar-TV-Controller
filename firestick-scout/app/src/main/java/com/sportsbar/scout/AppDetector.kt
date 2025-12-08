package com.sportsbar.scout

import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.net.wifi.WifiManager
import android.text.format.Formatter
import android.util.Log
import java.net.NetworkInterface

class AppDetector(private val context: Context) {

    // Known streaming apps with sports content
    // Includes both Fire TV-specific and standard Android package names
    private val streamingApps = mapOf(
        // Live TV Services
        "com.google.android.apps.youtube.unplugged" to AppInfo("YouTube TV", "live_tv"),
        "com.fubo.firetv.screen" to AppInfo("fuboTV", "live_tv"),
        "com.sling" to AppInfo("Sling TV", "live_tv"),
        "com.sling.livingroom" to AppInfo("Sling TV", "live_tv"),
        "com.directv.dvrscheduler" to AppInfo("DirecTV Stream", "live_tv"),
        "com.att.tv" to AppInfo("DirecTV Stream", "live_tv"),

        // YouTube (Fire TV specific)
        "com.amazon.firetv.youtube" to AppInfo("YouTube", "streaming"),
        "com.amazon.firetv.youtube.tv" to AppInfo("YouTube", "streaming"),
        "com.google.android.youtube.tv" to AppInfo("YouTube", "streaming"),

        // Sports-Focused Apps - ESPN (multiple package names)
        "com.espn.score_center" to AppInfo("ESPN", "sports"),
        "com.espn.gtv" to AppInfo("ESPN", "sports"),  // Fire TV ESPN
        "com.espn" to AppInfo("ESPN", "sports"),

        // FOX Sports
        "com.foxsports.android" to AppInfo("FOX Sports", "sports"),
        "com.foxsports.android.foxsportsgo" to AppInfo("FOX Sports", "sports"),

        // Turner Networks
        "com.turner.tntdrama" to AppInfo("TNT", "sports"),
        "com.turner.tbs" to AppInfo("TBS", "sports"),

        // Other Sports Apps
        "com.dazn" to AppInfo("DAZN", "sports"),
        "com.flosports.apps.android" to AppInfo("FloSports", "sports"),
        "com.bfrapp" to AppInfo("Bally Sports", "sports"),
        "com.ballysports.ftv" to AppInfo("Bally Sports", "sports"),
        "com.foxsports.bigten.android" to AppInfo("Big Ten+", "sports"),
        "com.nfl.fantasy" to AppInfo("NFL", "sports"),
        "com.nfl.app.android" to AppInfo("NFL", "sports"),
        "com.nba.app" to AppInfo("NBA", "sports"),
        "com.nba.leaguepass" to AppInfo("NBA League Pass", "sports"),
        "com.mlb.android" to AppInfo("MLB.TV", "sports"),
        "com.mlb.atbat" to AppInfo("MLB.TV", "sports"),
        "com.nhl.gc" to AppInfo("NHL", "sports"),
        "com.nhl.gc1415" to AppInfo("NHL", "sports"),

        // High School Sports - NFHS (multiple package names)
        "com.nfhsnetwork.ui" to AppInfo("NFHS Network", "sports"),
        "com.nfhsnetwork.app" to AppInfo("NFHS Network", "sports"),
        "com.playon.nfhslive" to AppInfo("NFHS Network", "sports"),  // Fire TV NFHS

        // Streaming Services - Peacock (multiple package names)
        "com.peacocktv.peacockandroid" to AppInfo("Peacock", "streaming"),
        "com.peacock.peacockfiretv" to AppInfo("Peacock", "streaming"),  // Fire TV Peacock

        // Paramount+
        "com.cbs.ott" to AppInfo("Paramount+", "streaming"),
        "com.cbs.app" to AppInfo("Paramount+", "streaming"),

        // Apple TV+
        "com.apple.atve.amazon.appletv" to AppInfo("Apple TV+", "streaming"),

        // Amazon Prime Video
        "com.amazon.avod" to AppInfo("Prime Video", "streaming"),

        // Netflix
        "com.netflix.ninja" to AppInfo("Netflix", "streaming"),
        "com.netflix.mediaclient" to AppInfo("Netflix", "streaming"),

        // Hulu (multiple package names)
        "com.hulu.livingroomplus" to AppInfo("Hulu", "streaming"),
        "com.hulu.plus" to AppInfo("Hulu", "streaming"),  // Fire TV Hulu

        // Max (HBO Max)
        "com.wbd.stream" to AppInfo("Max", "streaming"),
        "com.hbo.hbonow" to AppInfo("Max", "streaming"),

        // Disney+
        "com.disney.disneyplus" to AppInfo("Disney+", "streaming"),

        // Free Streaming
        "com.pluto.tv" to AppInfo("Pluto TV", "streaming"),
        "com.tubi" to AppInfo("Tubi", "streaming"),
        "com.tubitv" to AppInfo("Tubi", "streaming"),
        "com.roku.web" to AppInfo("Roku Channel", "streaming"),

        // International & Soccer
        "com.willow.tv" to AppInfo("Willow TV", "sports"),
        "com.fanatiz.app" to AppInfo("Fanatiz", "sports"),
        "tv.mls" to AppInfo("MLS Season Pass", "sports"),

        // College & Regional Networks
        "com.espn.espnplus" to AppInfo("ESPN+", "sports"),
        "com.sec.android" to AppInfo("SEC Network", "sports"),
        "com.accdigital.network" to AppInfo("ACC Network", "sports"),
        "com.pac12.app" to AppInfo("Pac-12 Network", "sports")
    )

    fun getCurrentApp(): CurrentAppInfo? {
        try {
            val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val endTime = System.currentTimeMillis()
            val startTime = endTime - 10000

            val stats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startTime,
                endTime
            )

            val recentApp = stats
                .filter { it.lastTimeUsed > startTime }
                .maxByOrNull { it.lastTimeUsed }

            if (recentApp != null) {
                val appInfo = streamingApps[recentApp.packageName]
                if (appInfo != null) {
                    return CurrentAppInfo(
                        packageName = recentApp.packageName,
                        appName = appInfo.name,
                        category = appInfo.category
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting current app", e)
        }
        return null
    }

    fun getInstalledStreamingApps(): List<String> {
        val installed = mutableListOf<String>()
        val pm = context.packageManager

        for (packageName in streamingApps.keys) {
            try {
                pm.getPackageInfo(packageName, 0)
                installed.add(packageName)
            } catch (e: PackageManager.NameNotFoundException) {
                // App not installed
            }
        }

        return installed
    }

    fun getLoggedInApps(): List<String> {
        return getInstalledStreamingApps()
    }

    @Suppress("DEPRECATION")
    fun getIpAddress(): String? {
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
                        if (ip?.startsWith("192.168.") == true) {
                            return ip
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "NetworkInterface error", e)
        }

        // Fallback to WifiManager for WiFi connections
        try {
            val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val wifiInfo = wifiManager.connectionInfo
            val ip = wifiInfo.ipAddress
            if (ip != 0) return Formatter.formatIpAddress(ip)
        } catch (e: Exception) {
            Log.e(TAG, "WifiManager error", e)
        }
        return null
    }

    companion object {
        private const val TAG = "AppDetector"
    }
}

data class AppInfo(
    val name: String,
    val category: String
)

data class CurrentAppInfo(
    val packageName: String,
    val appName: String,
    val category: String
)
