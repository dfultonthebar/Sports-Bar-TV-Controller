# FireStick Scout APK Specification

## Overview
FireStick Scout is a lightweight Android/Fire OS app that runs on Fire TV devices and reports their status to the Sports Bar TV Controller server. It enables the AI Game Plan to know which streaming apps are installed, logged in, and what content is currently playing.

## App Details
- **Package Name:** `com.sportsbar.scout`
- **Version:** `1.4.0-bar-20251205`
- **Min SDK:** 22 (Fire OS 5+)
- **Target SDK:** 33
- **Architecture:** ARM (Fire TV)

## Server Configuration
- **HTTP Heartbeat URL:** `http://192.168.5.100:3001/api/firestick-scout`
- **WebSocket URL:** `ws://192.168.5.100:3001/api/firestick-scout/ws` (future)
- **Heartbeat Interval:** 30 seconds
- **Timeout:** 10 seconds

## Device IDs
Each Fire TV device should have a unique ID configured. Suggested naming:
- `fire-tv-1` through `fire-tv-6` for bar TVs
- Match with existing Fire TV device entries in the database

## Features

### 1. Heartbeat System
Sends periodic status updates to the server including:
- Device ID and name
- IP address
- Currently running app (package name)
- Installed apps list
- Logged-in apps (apps where user is authenticated)

### 2. App Detection
Detects which streaming apps are installed and their login status:
- Peacock (`com.peacocktv.peacockandroid`)
- ESPN+ (`com.espn.score_center`)
- Paramount+ (`com.cbs.ott`)
- Apple TV+ (`com.apple.atve.amazon.appletv`)
- Amazon Prime Video (`com.amazon.avod`)
- Netflix (`com.netflix.ninja`)
- Hulu (`com.hulu.livingroomplus`)
- YouTube TV (`com.google.android.youtube.tvunplugged`)
- fuboTV (`com.fubo.firetv.screen`)
- Max (`com.wbd.stream`)
- Disney+ (`com.disney.disneyplus`)
- DAZN (`com.dazn`)
- Sling TV (`com.sling`)
- Big Ten+ (`com.foxsports.bigten.android`)

### 3. Game Detection (OCR)
Uses Android Accessibility Service to detect:
- Current game being shown (team names, scores)
- Game status (live, halftime, final)
- League/sport type

---

## Kotlin Implementation

### Project Structure
```
app/
├── src/main/
│   ├── java/com/sportsbar/scout/
│   │   ├── MainActivity.kt
│   │   ├── ScoutService.kt
│   │   ├── HeartbeatWorker.kt
│   │   ├── AppDetector.kt
│   │   ├── GameDetector.kt
│   │   └── api/
│   │       └── ScoutApiClient.kt
│   ├── res/
│   │   ├── layout/
│   │   │   └── activity_main.xml
│   │   └── values/
│   │       └── strings.xml
│   └── AndroidManifest.xml
└── build.gradle.kts
```

### AndroidManifest.xml
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.sportsbar.scout">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.FireStickScout">

        <activity
            android:name=".MainActivity"
            android:banner="@drawable/banner"
            android:exported="true"
            android:label="@string/app_name">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".ScoutService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="specialUse" />

        <service
            android:name=".GameDetectorService"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="false">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>

        <receiver
            android:name=".BootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>

    </application>
</manifest>
```

### MainActivity.kt
```kotlin
package com.sportsbar.scout

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var statusText: TextView
    private lateinit var deviceIdText: TextView
    private lateinit var startButton: Button
    private lateinit var stopButton: Button

    companion object {
        // Configure device ID here for each Fire TV
        const val DEVICE_ID = "fire-tv-1"  // Change per device: fire-tv-1, fire-tv-2, etc.
        const val DEVICE_NAME = "Fire TV - Bar 1"  // Human-readable name
        const val SERVER_URL = "http://192.168.5.100:3001/api/firestick-scout"
        const val HEARTBEAT_INTERVAL_MS = 30000L
        const val VERSION = "1.4.0-bar-20251205"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.statusText)
        deviceIdText = findViewById(R.id.deviceIdText)
        startButton = findViewById(R.id.startButton)
        stopButton = findViewById(R.id.stopButton)

        deviceIdText.text = "Device: $DEVICE_ID\nVersion: $VERSION"

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
    }

    private fun stopScoutService() {
        val intent = Intent(this, ScoutService::class.java)
        stopService(intent)
        statusText.text = "Status: Stopped"
    }
}
```

### ScoutService.kt
```kotlin
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

        Log.i(TAG, "Scout service started for device: ${MainActivity.DEVICE_ID}")
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
                    deviceId = MainActivity.DEVICE_ID,
                    deviceName = MainActivity.DEVICE_NAME,
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
            .setSmallIcon(R.drawable.ic_notification)
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
```

### AppDetector.kt
```kotlin
package com.sportsbar.scout

import android.app.ActivityManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.net.wifi.WifiManager
import android.text.format.Formatter
import android.util.Log

class AppDetector(private val context: Context) {

    // Known streaming apps with sports content
    private val streamingApps = mapOf(
        "com.peacocktv.peacockandroid" to AppInfo("Peacock", "streaming"),
        "com.espn.score_center" to AppInfo("ESPN", "sports"),
        "com.cbs.ott" to AppInfo("Paramount+", "streaming"),
        "com.apple.atve.amazon.appletv" to AppInfo("Apple TV+", "streaming"),
        "com.amazon.avod" to AppInfo("Prime Video", "streaming"),
        "com.netflix.ninja" to AppInfo("Netflix", "streaming"),
        "com.hulu.livingroomplus" to AppInfo("Hulu", "streaming"),
        "com.google.android.youtube.tvunplugged" to AppInfo("YouTube TV", "live_tv"),
        "com.fubo.firetv.screen" to AppInfo("fuboTV", "live_tv"),
        "com.wbd.stream" to AppInfo("Max", "streaming"),
        "com.disney.disneyplus" to AppInfo("Disney+", "streaming"),
        "com.dazn" to AppInfo("DAZN", "sports"),
        "com.sling" to AppInfo("Sling TV", "live_tv"),
        "com.foxsports.bigten.android" to AppInfo("Big Ten+", "sports")
    )

    fun getCurrentApp(): CurrentAppInfo? {
        try {
            val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val endTime = System.currentTimeMillis()
            val startTime = endTime - 10000 // Last 10 seconds

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
        // For now, return same as installed
        // In future, could check app data directories or use accessibility service
        return getInstalledStreamingApps()
    }

    fun getIpAddress(): String? {
        try {
            val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val wifiInfo = wifiManager.connectionInfo
            val ip = wifiInfo.ipAddress
            return Formatter.formatIpAddress(ip)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting IP address", e)
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
```

### ScoutApiClient.kt
```kotlin
package com.sportsbar.scout.api

import android.util.Log
import com.sportsbar.scout.HeartbeatData
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class ScoutApiClient(private val serverUrl: String) {

    fun sendHeartbeat(data: HeartbeatData): Boolean {
        var connection: HttpURLConnection? = null

        try {
            val url = URL(serverUrl)
            connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.doOutput = true

            val json = JSONObject().apply {
                put("deviceId", data.deviceId)
                put("deviceName", data.deviceName)
                put("ipAddress", data.ipAddress)
                put("currentApp", data.currentApp)
                put("currentAppName", data.currentAppName)
                put("appCategory", data.appCategory)
                put("currentGame", data.currentGame)
                put("homeTeam", data.homeTeam)
                put("awayTeam", data.awayTeam)
                put("homeScore", data.homeScore)
                put("awayScore", data.awayScore)
                put("gameStatus", data.gameStatus)
                put("league", data.league)
                put("installedApps", JSONArray(data.installedApps))
                put("loggedInApps", JSONArray(data.loggedInApps))
                put("scoutVersion", data.scoutVersion)
            }

            OutputStreamWriter(connection.outputStream).use { writer ->
                writer.write(json.toString())
                writer.flush()
            }

            val responseCode = connection.responseCode
            Log.d(TAG, "Heartbeat response: $responseCode")

            return responseCode == 200
        } catch (e: Exception) {
            Log.e(TAG, "Error sending heartbeat", e)
            return false
        } finally {
            connection?.disconnect()
        }
    }

    companion object {
        private const val TAG = "ScoutApiClient"
    }
}
```

### BootReceiver.kt
```kotlin
package com.sportsbar.scout

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.i(TAG, "Boot completed, starting Scout service")
            val serviceIntent = Intent(context, ScoutService::class.java)
            ContextCompat.startForegroundService(context, serviceIntent)
        }
    }

    companion object {
        private const val TAG = "BootReceiver"
    }
}
```

### GameDetectorService.kt (Accessibility Service for OCR)
```kotlin
package com.sportsbar.scout

import android.accessibilityservice.AccessibilityService
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.util.regex.Pattern

class GameDetectorService : AccessibilityService() {

    // Patterns to detect game info from screen text
    private val scorePattern = Pattern.compile("(\\d{1,3})\\s*[-:]\\s*(\\d{1,3})")
    private val teamPatterns = listOf(
        // NFL teams
        "Chiefs", "Eagles", "Bills", "Cowboys", "49ers", "Dolphins", "Lions", "Ravens",
        "Bengals", "Jaguars", "Chargers", "Jets", "Patriots", "Steelers", "Broncos",
        "Raiders", "Packers", "Vikings", "Bears", "Saints", "Buccaneers", "Falcons",
        "Panthers", "Seahawks", "Cardinals", "Rams", "Giants", "Commanders", "Browns",
        "Texans", "Titans", "Colts",
        // NBA teams
        "Lakers", "Celtics", "Warriors", "Nets", "Heat", "Bucks", "76ers", "Suns",
        "Mavericks", "Clippers", "Nuggets", "Grizzlies", "Cavaliers", "Hawks", "Bulls",
        "Knicks", "Raptors", "Blazers", "Jazz", "Pelicans", "Spurs", "Kings", "Rockets",
        "Thunder", "Timberwolves", "Hornets", "Magic", "Pistons", "Pacers", "Wizards",
        // NHL teams
        "Bruins", "Rangers", "Maple Leafs", "Lightning", "Avalanche", "Oilers", "Panthers",
        "Devils", "Hurricanes", "Stars", "Golden Knights", "Kings", "Kraken", "Wild",
        "Jets", "Flames", "Senators", "Canucks", "Predators", "Blues", "Red Wings",
        "Islanders", "Penguins", "Capitals", "Blackhawks", "Ducks", "Coyotes", "Sharks",
        // MLB teams
        "Yankees", "Red Sox", "Dodgers", "Cubs", "Cardinals", "Giants", "Astros", "Braves",
        "Mets", "Phillies", "Padres", "Mariners", "Blue Jays", "Twins", "Rays", "Guardians",
        "Orioles", "Rangers", "Brewers", "Angels", "Tigers", "Royals", "White Sox", "Reds",
        "Rockies", "Diamondbacks", "Pirates", "Marlins", "Nationals", "Athletics"
    )

    private var lastDetectedGame: DetectedGame? = null

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        // Only process window content changes
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
            event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            return
        }

        val rootNode = rootInActiveWindow ?: return
        val screenText = extractAllText(rootNode)

        val game = detectGame(screenText)
        if (game != null && game != lastDetectedGame) {
            lastDetectedGame = game
            Log.i(TAG, "Detected game: ${game.homeTeam} vs ${game.awayTeam}, Score: ${game.homeScore}-${game.awayScore}")
            // Could broadcast this to ScoutService
        }
    }

    override fun onInterrupt() {
        Log.w(TAG, "Accessibility service interrupted")
    }

    private fun extractAllText(node: AccessibilityNodeInfo): String {
        val builder = StringBuilder()
        extractTextRecursive(node, builder)
        return builder.toString()
    }

    private fun extractTextRecursive(node: AccessibilityNodeInfo?, builder: StringBuilder) {
        if (node == null) return

        node.text?.let {
            builder.append(it).append(" ")
        }
        node.contentDescription?.let {
            builder.append(it).append(" ")
        }

        for (i in 0 until node.childCount) {
            extractTextRecursive(node.getChild(i), builder)
        }
    }

    private fun detectGame(text: String): DetectedGame? {
        // Find team names
        val foundTeams = teamPatterns.filter { text.contains(it, ignoreCase = true) }
        if (foundTeams.size < 2) return null

        // Find score
        val scoreMatcher = scorePattern.matcher(text)
        var homeScore: String? = null
        var awayScore: String? = null

        if (scoreMatcher.find()) {
            homeScore = scoreMatcher.group(1)
            awayScore = scoreMatcher.group(2)
        }

        // Detect status
        val status = when {
            text.contains("FINAL", ignoreCase = true) -> "final"
            text.contains("HALF", ignoreCase = true) -> "halftime"
            text.contains("LIVE", ignoreCase = true) -> "live"
            text.contains("Q1", ignoreCase = true) ||
            text.contains("Q2", ignoreCase = true) ||
            text.contains("Q3", ignoreCase = true) ||
            text.contains("Q4", ignoreCase = true) -> "live"
            text.contains("1st", ignoreCase = true) ||
            text.contains("2nd", ignoreCase = true) ||
            text.contains("3rd", ignoreCase = true) -> "live"
            else -> "unknown"
        }

        return DetectedGame(
            homeTeam = foundTeams.getOrNull(0) ?: "",
            awayTeam = foundTeams.getOrNull(1) ?: "",
            homeScore = homeScore,
            awayScore = awayScore,
            status = status
        )
    }

    companion object {
        private const val TAG = "GameDetector"
    }
}

data class DetectedGame(
    val homeTeam: String,
    val awayTeam: String,
    val homeScore: String?,
    val awayScore: String?,
    val status: String
)
```

### res/xml/accessibility_service_config.xml
```xml
<?xml version="1.0" encoding="utf-8"?>
<accessibility-service
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowContentChanged|typeWindowStateChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagReportViewIds|flagIncludeNotImportantViews"
    android:canRetrieveWindowContent="true"
    android:description="@string/accessibility_service_description"
    android:notificationTimeout="100"
    android:settingsActivity="com.sportsbar.scout.MainActivity" />
```

### res/values/strings.xml
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">FireStick Scout</string>
    <string name="accessibility_service_description">
        FireStick Scout monitors streaming apps to detect which games are currently playing.
        This helps the Sports Bar TV Controller automatically manage your TVs.
    </string>
</resources>
```

### res/layout/activity_main.xml
```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="24dp"
    android:gravity="center"
    android:background="#1a1a2e">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="FireStick Scout"
        android:textSize="32sp"
        android:textColor="#ffffff"
        android:textStyle="bold" />

    <TextView
        android:id="@+id/deviceIdText"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="16dp"
        android:textSize="18sp"
        android:textColor="#888888" />

    <TextView
        android:id="@+id/statusText"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="32dp"
        android:text="Status: Initializing..."
        android:textSize="24sp"
        android:textColor="#4ade80" />

    <LinearLayout
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="32dp"
        android:orientation="horizontal">

        <Button
            android:id="@+id/startButton"
            android:layout_width="150dp"
            android:layout_height="wrap_content"
            android:text="Start"
            android:textSize="18sp"
            android:layout_marginEnd="16dp" />

        <Button
            android:id="@+id/stopButton"
            android:layout_width="150dp"
            android:layout_height="wrap_content"
            android:text="Stop"
            android:textSize="18sp" />

    </LinearLayout>

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="48dp"
        android:text="Server: 192.168.5.100:3001"
        android:textSize="14sp"
        android:textColor="#666666" />

</LinearLayout>
```

### build.gradle.kts (app level)
```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sportsbar.scout"
    compileSdk = 33

    defaultConfig {
        applicationId = "com.sportsbar.scout"
        minSdk = 22
        targetSdk = 33
        versionCode = 140
        versionName = "1.4.0-bar-20251205"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = "1.8"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.9.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.leanback:leanback:1.0.0")
}
```

---

## Installation Instructions

### 1. Build the APK
```bash
# In Android Studio or via command line
./gradlew assembleRelease
```

### 2. Enable ADB on Fire TV
1. Go to Settings > My Fire TV > Developer Options
2. Enable ADB Debugging
3. Enable Apps from Unknown Sources

### 3. Install via ADB
```bash
# Connect to Fire TV
adb connect 192.168.5.133:5555

# Install APK
adb install -r firestick-scout-1.4.0.apk

# Launch app
adb shell am start -n com.sportsbar.scout/.MainActivity
```

### 4. Grant Permissions
After installation:
1. Open FireStick Scout app
2. Go to Settings > Accessibility > FireStick Scout
3. Enable accessibility service (for game detection)
4. App will auto-start on boot

### 5. Configure Device ID
Edit `MainActivity.kt` before building for each device:
```kotlin
const val DEVICE_ID = "fire-tv-1"  // Change per device
const val DEVICE_NAME = "Fire TV - Bar 1"  // Change per device
```

Build separate APKs for each Fire TV, or implement a setup screen.

---

## Server Integration

The server API at `/api/firestick-scout` expects:

```json
{
  "deviceId": "fire-tv-1",
  "deviceName": "Fire TV - Bar 1",
  "ipAddress": "192.168.5.133",
  "currentApp": "com.peacocktv.peacockandroid",
  "currentAppName": "Peacock",
  "appCategory": "streaming",
  "currentGame": "Eagles vs Cowboys",
  "homeTeam": "Eagles",
  "awayTeam": "Cowboys",
  "homeScore": "24",
  "awayScore": "17",
  "gameStatus": "live",
  "league": "NFL",
  "installedApps": [
    "com.peacocktv.peacockandroid",
    "com.espn.score_center",
    "com.amazon.avod"
  ],
  "loggedInApps": [
    "com.peacocktv.peacockandroid",
    "com.amazon.avod"
  ],
  "scoutVersion": "1.4.0-bar-20251205"
}
```

The server will:
1. Update `firestick_live_status` table
2. Mark device as online
3. Provide status to AI Game Plan

---

## Future Enhancements

1. **WebSocket Support**: Replace HTTP polling with WebSocket for real-time updates
2. **Deep Link Launch**: Server can command Fire TV to launch specific content
3. **Multiple Device Config**: Settings screen to configure device ID without rebuilding
4. **Authentication Check**: Better detection of which apps user is logged into
5. **Game Detection ML**: Use TensorFlow Lite for more accurate game detection
