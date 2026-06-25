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

    /**
     * v2.2.12 — report a PLAY_GAME outcome back to the location's box so Scout's success/failure
     * becomes visible to the system + feeds the ops flywheel (Hermes learns which titles/apps
     * reliably play). POSTs to <serverUrl>/play-result — serverUrl is the per-location box
     * (built-in SERVER_URL_DEFAULT or ConfigReceiver), so every location reports to its OWN IP.
     * Fire-and-forget; the caller runs this off the AccessibilityService thread.
     */
    fun sendPlayResult(
        deviceId: String, deviceName: String, ipAddress: String?, scoutVersion: String,
        result: String, message: String, matchedText: String, targetPackage: String,
        tokens: String, attempts: Int,
    ): Boolean {
        var connection: HttpURLConnection? = null
        try {
            val url = URL(serverUrl.trimEnd('/') + "/play-result")
            connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.connectTimeout = 8000
            connection.readTimeout = 8000
            connection.doOutput = true
            val json = JSONObject().apply {
                put("deviceId", deviceId)
                put("deviceName", deviceName)
                put("ipAddress", ipAddress ?: "")
                put("scoutVersion", scoutVersion)
                put("result", result)
                put("message", message)
                put("matchedText", matchedText)
                put("targetPackage", targetPackage)
                put("tokens", tokens)
                put("attempts", attempts)
            }
            OutputStreamWriter(connection.outputStream).use { it.write(json.toString()); it.flush() }
            val rc = connection.responseCode
            Log.d(TAG, "PlayResult ($result) response: $rc")
            return rc == 200
        } catch (e: Exception) {
            Log.e(TAG, "Error sending play result", e)
            return false
        } finally {
            connection?.disconnect()
        }
    }

    companion object {
        private const val TAG = "ScoutApiClient"
    }
}
