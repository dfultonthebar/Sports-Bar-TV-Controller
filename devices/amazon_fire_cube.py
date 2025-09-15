
"""
Amazon Fire Cube Controller
Supports both IR control (via Global Cache) and ADB network control
for Amazon Fire TV Cube devices
"""
import socket
import subprocess
import time
import logging
from typing import Optional, Dict, List
from dataclasses import dataclass
from enum import Enum

class FireCubeCommand(Enum):
    """Common Fire Cube commands"""
    POWER = "POWER"
    HOME = "HOME"
    BACK = "BACK"
    UP = "DPAD_UP"
    DOWN = "DPAD_DOWN"
    LEFT = "DPAD_LEFT"
    RIGHT = "DPAD_RIGHT"
    SELECT = "DPAD_CENTER"
    MENU = "MENU"
    PLAY_PAUSE = "MEDIA_PLAY_PAUSE"
    REWIND = "MEDIA_REWIND"
    FAST_FORWARD = "MEDIA_FAST_FORWARD"

@dataclass
class FireCubeApp:
    """Represents a Fire Cube app"""
    name: str
    package_name: str
    activity: str = ""

@dataclass
class FireCubeStatus:
    """Fire Cube device status"""
    device_name: str = ""
    ip_address: str = ""
    is_connected: bool = False
    current_app: str = ""
    installed_apps: List[FireCubeApp] = None
    adb_enabled: bool = False

    def __post_init__(self):
        if self.installed_apps is None:
            self.installed_apps = []

class AmazonFireCubeController:
    """
    Python control module for Amazon Fire TV Cube
    Supports both ADB network control and IR fallback
    """

    def __init__(self, ip_address: str, adb_port: int = 5555, use_adb: bool = True):
        """
        Initialize Fire Cube controller

        Args:
            ip_address: Fire Cube IP address
            adb_port: ADB port (usually 5555)
            use_adb: Whether to use ADB or IR control
        """
        self.ip_address = ip_address
        self.adb_port = adb_port
        self.use_adb = use_adb
        self.adb_address = f"{ip_address}:{adb_port}"

        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(f"FireCube_{ip_address}")

        # Device status
        self.status = FireCubeStatus()
        self.status.ip_address = ip_address

        # Load common apps
        self._load_common_apps()

    def _load_common_apps(self):
        """Load common Fire Cube apps"""
        self.common_apps = {
            "netflix": FireCubeApp("Netflix", "com.netflix.ninja", "com.netflix.ninja.MainActivity"),
            "prime_video": FireCubeApp("Prime Video", "com.amazon.avod.thirdpartyclient", "com.amazon.ignition.core.player.LauncherActivity"),
            "youtube": FireCubeApp("YouTube", "com.google.android.youtube.tv", "com.google.android.apps.youtube.tv.activity.ShellActivity"),
            "hulu": FireCubeApp("Hulu", "com.hulu.plus", "com.hulu.features.splash.SplashActivity"),
            "disney_plus": FireCubeApp("Disney+", "com.disney.disneyplus", "com.bamtechmedia.dominguez.main.MainActivity"),
            "espn": FireCubeApp("ESPN", "com.espn.score_center", "com.espn.sportscenter.ui.SplashActivity"),
            "fox_sports": FireCubeApp("FOX Sports", "com.foxsports.android", "com.foxsports.android.activity.MainActivity"),
            "sling_tv": FireCubeApp("Sling TV", "com.sling", "com.sling.tv.MainActivity"),
            "youtube_tv": FireCubeApp("YouTube TV", "com.google.android.apps.youtube.unplugged", "com.google.android.apps.youtube.unplugged.activity.MainActivity")
        }

    def connect(self) -> bool:
        """
        Establish connection to Fire Cube

        Returns:
            bool: True if connected successfully
        """
        if self.use_adb:
            return self._connect_adb()
        else:
            # For IR control, connection is handled by Global Cache
            self.status.is_connected = True
            return True

    def _connect_adb(self) -> bool:
        """Connect via ADB"""
        try:
            # Connect to Fire Cube via ADB
            result = subprocess.run(
                ["adb", "connect", self.adb_address],
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0 and "connected" in result.stdout.lower():
                self.status.is_connected = True
                self.status.adb_enabled = True
                self.logger.info(f"Connected to Fire Cube via ADB at {self.adb_address}")
                
                # Get device info
                self._get_device_info()
                return True
            else:
                self.logger.error(f"ADB connection failed: {result.stderr}")
                return False

        except subprocess.TimeoutExpired:
            self.logger.error("ADB connection timeout")
            return False
        except FileNotFoundError:
            self.logger.error("ADB not found. Install Android SDK platform-tools")
            return False
        except Exception as e:
            self.logger.error(f"ADB connection error: {e}")
            return False

    def disconnect(self):
        """Disconnect from Fire Cube"""
        if self.use_adb and self.status.adb_enabled:
            try:
                subprocess.run(
                    ["adb", "disconnect", self.adb_address],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
            except Exception as e:
                self.logger.error(f"ADB disconnect error: {e}")

        self.status.is_connected = False
        self.logger.info("Disconnected from Fire Cube")

    def _get_device_info(self):
        """Get Fire Cube device information"""
        if not self.status.adb_enabled:
            return

        try:
            # Get device name
            result = subprocess.run(
                ["adb", "-s", self.adb_address, "shell", "getprop", "ro.product.model"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                self.status.device_name = result.stdout.strip()

            # Get current app
            self._get_current_app()

        except Exception as e:
            self.logger.error(f"Failed to get device info: {e}")

    def _get_current_app(self):
        """Get currently running app"""
        if not self.status.adb_enabled:
            return

        try:
            result = subprocess.run(
                ["adb", "-s", self.adb_address, "shell", "dumpsys", "window", "windows", "|", "grep", "-E", "mCurrentFocus"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                # Parse current focus to get app package
                output = result.stdout.strip()
                if "/" in output:
                    package = output.split("/")[0].split()[-1]
                    self.status.current_app = package

        except Exception as e:
            self.logger.error(f"Failed to get current app: {e}")

    def send_key(self, key_code: str) -> bool:
        """
        Send key command to Fire Cube

        Args:
            key_code: Android key code (e.g., KEYCODE_HOME, KEYCODE_BACK)

        Returns:
            bool: True if successful
        """
        if not self.status.is_connected:
            self.logger.error("Not connected to Fire Cube")
            return False

        if self.use_adb and self.status.adb_enabled:
            return self._send_adb_key(key_code)
        else:
            # Fallback to IR control would go here
            self.logger.warning("IR control not implemented - use Global Cache IR controller")
            return False

    def _send_adb_key(self, key_code: str) -> bool:
        """Send key via ADB"""
        try:
            result = subprocess.run(
                ["adb", "-s", self.adb_address, "shell", "input", "keyevent", key_code],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode == 0:
                self.logger.debug(f"Sent key: {key_code}")
                return True
            else:
                self.logger.error(f"Key command failed: {result.stderr}")
                return False

        except Exception as e:
            self.logger.error(f"ADB key command error: {e}")
            return False

    def launch_app(self, app_name: str) -> bool:
        """
        Launch an app on Fire Cube

        Args:
            app_name: App name (netflix, prime_video, youtube, etc.)

        Returns:
            bool: True if successful
        """
        if not self.status.is_connected:
            self.logger.error("Not connected to Fire Cube")
            return False

        app = self.common_apps.get(app_name.lower())
        if not app:
            self.logger.error(f"Unknown app: {app_name}")
            return False

        if self.use_adb and self.status.adb_enabled:
            return self._launch_app_adb(app)
        else:
            self.logger.warning("App launch requires ADB connection")
            return False

    def _launch_app_adb(self, app: FireCubeApp) -> bool:
        """Launch app via ADB"""
        try:
            if app.activity:
                # Launch with specific activity
                cmd = ["adb", "-s", self.adb_address, "shell", "am", "start", 
                       "-n", f"{app.package_name}/{app.activity}"]
            else:
                # Launch main activity
                cmd = ["adb", "-s", self.adb_address, "shell", "monkey", 
                       "-p", app.package_name, "-c", "android.intent.category.LAUNCHER", "1"]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

            if result.returncode == 0:
                self.logger.info(f"Launched {app.name}")
                time.sleep(2)  # Wait for app to start
                self._get_current_app()
                return True
            else:
                self.logger.error(f"Failed to launch {app.name}: {result.stderr}")
                return False

        except Exception as e:
            self.logger.error(f"App launch error: {e}")
            return False

    def go_home(self) -> bool:
        """Go to Fire Cube home screen"""
        return self.send_key("KEYCODE_HOME")

    def go_back(self) -> bool:
        """Go back"""
        return self.send_key("KEYCODE_BACK")

    def navigate_up(self) -> bool:
        """Navigate up"""
        return self.send_key("KEYCODE_DPAD_UP")

    def navigate_down(self) -> bool:
        """Navigate down"""
        return self.send_key("KEYCODE_DPAD_DOWN")

    def navigate_left(self) -> bool:
        """Navigate left"""
        return self.send_key("KEYCODE_DPAD_LEFT")

    def navigate_right(self) -> bool:
        """Navigate right"""
        return self.send_key("KEYCODE_DPAD_RIGHT")

    def select(self) -> bool:
        """Select/Enter"""
        return self.send_key("KEYCODE_DPAD_CENTER")

    def play_pause(self) -> bool:
        """Play/Pause media"""
        return self.send_key("KEYCODE_MEDIA_PLAY_PAUSE")

    def power_toggle(self) -> bool:
        """Toggle power"""
        return self.send_key("KEYCODE_POWER")

    def volume_up(self) -> bool:
        """Volume up"""
        return self.send_key("KEYCODE_VOLUME_UP")

    def volume_down(self) -> bool:
        """Volume down"""
        return self.send_key("KEYCODE_VOLUME_DOWN")

    def mute(self) -> bool:
        """Mute"""
        return self.send_key("KEYCODE_VOLUME_MUTE")

    def sports_bar_apps_setup(self):
        """
        Example: Launch common sports bar streaming apps
        """
        sports_apps = ["espn", "fox_sports", "youtube_tv", "sling_tv"]
        
        self.logger.info("Setting up sports bar streaming apps")
        for app in sports_apps:
            if app in self.common_apps:
                self.logger.info(f"Available: {self.common_apps[app].name}")

    def __enter__(self):
        """Context manager entry"""
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.disconnect()

# Example usage
def example_usage():
    """Example of how to use the Fire Cube controller"""
    
    # Initialize controller
    fire_cube = AmazonFireCubeController("192.168.1.104", use_adb=True)

    try:
        # Connect to Fire Cube
        if fire_cube.connect():
            print(f"Connected to {fire_cube.status.device_name}")

            # Go to home screen
            fire_cube.go_home()
            time.sleep(2)

            # Launch ESPN app
            fire_cube.launch_app("espn")
            time.sleep(3)

            # Navigate and select
            fire_cube.navigate_down()
            time.sleep(1)
            fire_cube.select()

        else:
            print("Failed to connect to Fire Cube")

    finally:
        fire_cube.disconnect()

if __name__ == "__main__":
    example_usage()
