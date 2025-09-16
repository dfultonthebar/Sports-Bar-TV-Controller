
"""
System Testing Framework
Comprehensive testing for all device controllers and communications
Monitors device feedback and validates system integration
"""
import time
import logging
import threading
import json
from datetime import datetime
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, asdict
from enum import Enum

# Import all device controllers
try:
    from devices.wolfpack_controller import WolfpackController
    from devices.atlas_atmosphere import AtmosphereController
    from devices.dbx_zonepro import DBXZoneProController
    from devices.global_cache_ir import GlobalCacheIRController
    from devices.amazon_fire_cube import AmazonFireCubeController
    from devices.tv_guide_integration import TVGuideIntegration
    from core.av_manager import AVManager
except ImportError as e:
    print(f"Warning: Could not import some modules: {e}")

class TestStatus(Enum):
    """Test result status"""
    PASS = "PASS"
    FAIL = "FAIL"
    SKIP = "SKIP"
    WARNING = "WARNING"

class TestType(Enum):
    """Types of tests"""
    CONNECTION = "connection"
    COMMUNICATION = "communication"
    CONTROL = "control"
    FEEDBACK = "feedback"
    INTEGRATION = "integration"

@dataclass
class TestResult:
    """Individual test result"""
    test_name: str
    test_type: TestType
    device_name: str
    status: TestStatus
    message: str
    duration: float
    timestamp: datetime
    details: Dict[str, Any] = None

    def __post_init__(self):
        if self.details is None:
            self.details = {}

@dataclass
class DeviceTestSuite:
    """Test suite for a specific device"""
    device_name: str
    device_type: str
    controller: Any
    tests: List[Callable] = None
    results: List[TestResult] = None

    def __post_init__(self):
        if self.tests is None:
            self.tests = []
        if self.results is None:
            self.results = []

class SystemTestFramework:
    """
    Comprehensive system testing framework for sports bar automation
    Tests all devices for communications, control, and monitoring feedback
    """

    def __init__(self, config_file: str = "config/test_config.json"):
        """
        Initialize system test framework

        Args:
            config_file: Path to test configuration file
        """
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger("SystemTest")

        # Test configuration
        self.config_file = config_file
        self.test_config = self._load_test_config()

        # Test results
        self.test_suites: Dict[str, DeviceTestSuite] = {}
        self.overall_results: List[TestResult] = []
        self.test_start_time = None
        self.test_end_time = None

        # Device controllers
        self.controllers = {}
        
        # Monitoring
        self.monitoring_active = False
        self.monitoring_thread = None
        self.feedback_data = {}

    def _load_test_config(self) -> Dict[str, Any]:
        """Load test configuration"""
        try:
            with open(self.config_file, 'r') as f:
                config = json.load(f)
            self.logger.info(f"Loaded test config from {self.config_file}")
            return config
        except FileNotFoundError:
            self.logger.warning(f"Test config file not found: {self.config_file}")
            return self._create_default_config()
        except Exception as e:
            self.logger.error(f"Failed to load test config: {e}")
            return self._create_default_config()

    def _create_default_config(self) -> Dict[str, Any]:
        """Create default test configuration"""
        return {
            "devices": {
                "wolfpack": {
                    "enabled": True,
                    "ip_address": "192.168.1.100",
                    "port": 23,
                    "timeout": 5
                },
                "atlas": {
                    "enabled": True,
                    "ip_address": "192.168.1.101",
                    "username": "admin",
                    "password": "password"
                },
                "dbx_zonepro": {
                    "enabled": True,
                    "ip_address": "192.168.1.102",
                    "port": 23
                },
                "global_cache": {
                    "enabled": True,
                    "ip_address": "192.168.1.103",
                    "port": 4998
                },
                "fire_cube": {
                    "enabled": True,
                    "ip_address": "192.168.1.104",
                    "use_adb": True
                }
            },
            "test_settings": {
                "connection_timeout": 10,
                "command_timeout": 5,
                "monitoring_duration": 30,
                "retry_attempts": 3
            }
        }

    def initialize_controllers(self):
        """Initialize all device controllers"""
        self.logger.info("Initializing device controllers...")
        
        config = self.test_config.get("devices", {})
        
        # Initialize Wolfpack
        if config.get("wolfpack", {}).get("enabled", False):
            try:
                wolfpack_config = config["wolfpack"]
                self.controllers["wolfpack"] = WolfpackController(
                    wolfpack_config["ip_address"],
                    wolfpack_config.get("port", 23),
                    wolfpack_config.get("timeout", 5)
                )
                self.logger.info("Wolfpack controller initialized")
            except Exception as e:
                self.logger.error(f"Failed to initialize Wolfpack: {e}")

        # Initialize Atlas Atmosphere
        if config.get("atlas", {}).get("enabled", False):
            try:
                atlas_config = config["atlas"]
                self.controllers["atlas"] = AtmosphereController(
                    atlas_config["ip_address"],
                    atlas_config.get("username", ""),
                    atlas_config.get("password", "")
                )
                self.logger.info("Atlas Atmosphere controller initialized")
            except Exception as e:
                self.logger.error(f"Failed to initialize Atlas: {e}")

        # Initialize DBX ZonePro
        if config.get("dbx_zonepro", {}).get("enabled", False):
            try:
                dbx_config = config["dbx_zonepro"]
                self.controllers["dbx_zonepro"] = DBXZoneProController(
                    dbx_config["ip_address"],
                    dbx_config.get("port", 23)
                )
                self.logger.info("DBX ZonePro controller initialized")
            except Exception as e:
                self.logger.error(f"Failed to initialize DBX ZonePro: {e}")

        # Initialize Global Cache IR
        if config.get("global_cache", {}).get("enabled", False):
            try:
                gc_config = config["global_cache"]
                self.controllers["global_cache"] = GlobalCacheIRController(
                    gc_config["ip_address"],
                    gc_config.get("port", 4998)
                )
                self.logger.info("Global Cache IR controller initialized")
            except Exception as e:
                self.logger.error(f"Failed to initialize Global Cache: {e}")

        # Initialize Fire Cube
        if config.get("fire_cube", {}).get("enabled", False):
            try:
                fire_config = config["fire_cube"]
                self.controllers["fire_cube"] = AmazonFireCubeController(
                    fire_config["ip_address"],
                    use_adb=fire_config.get("use_adb", True)
                )
                self.logger.info("Fire Cube controller initialized")
            except Exception as e:
                self.logger.error(f"Failed to initialize Fire Cube: {e}")

        # Initialize TV Guide
        try:
            self.controllers["tv_guide"] = TVGuideIntegration()
            self.logger.info("TV Guide integration initialized")
        except Exception as e:
            self.logger.error(f"Failed to initialize TV Guide: {e}")

    def run_all_tests(self) -> Dict[str, Any]:
        """
        Run comprehensive system tests

        Returns:
            Dict: Complete test results
        """
        self.logger.info("Starting comprehensive system tests...")
        self.test_start_time = datetime.now()

        # Initialize controllers
        self.initialize_controllers()

        # Create test suites for each device
        self._create_test_suites()

        # Run individual device tests
        for suite_name, suite in self.test_suites.items():
            self.logger.info(f"Running tests for {suite_name}...")
            self._run_device_test_suite(suite)

        # Run integration tests
        self._run_integration_tests()

        # Start monitoring
        self._start_monitoring()

        # Wait for monitoring to complete
        if self.monitoring_thread:
            self.monitoring_thread.join()

        self.test_end_time = datetime.now()
        
        # Generate final report
        return self._generate_test_report()

    def _create_test_suites(self):
        """Create test suites for each device"""
        
        # Wolfpack test suite
        if "wolfpack" in self.controllers:
            suite = DeviceTestSuite(
                device_name="wolfpack",
                device_type="video_matrix",
                controller=self.controllers["wolfpack"]
            )
            suite.tests = [
                self._test_wolfpack_connection,
                self._test_wolfpack_status,
                self._test_wolfpack_switching,
                self._test_wolfpack_presets
            ]
            self.test_suites["wolfpack"] = suite

        # Atlas test suite
        if "atlas" in self.controllers:
            suite = DeviceTestSuite(
                device_name="atlas",
                device_type="audio_processor",
                controller=self.controllers["atlas"]
            )
            suite.tests = [
                self._test_atlas_connection,
                self._test_atlas_zones,
                self._test_atlas_sources,
                self._test_atlas_presets
            ]
            self.test_suites["atlas"] = suite

        # DBX ZonePro test suite
        if "dbx_zonepro" in self.controllers:
            suite = DeviceTestSuite(
                device_name="dbx_zonepro",
                device_type="audio_processor",
                controller=self.controllers["dbx_zonepro"]
            )
            suite.tests = [
                self._test_dbx_connection,
                self._test_dbx_levels,
                self._test_dbx_muting,
                self._test_dbx_presets
            ]
            self.test_suites["dbx_zonepro"] = suite

        # Global Cache test suite
        if "global_cache" in self.controllers:
            suite = DeviceTestSuite(
                device_name="global_cache",
                device_type="ir_controller",
                controller=self.controllers["global_cache"]
            )
            suite.tests = [
                self._test_gc_connection,
                self._test_gc_device_info,
                self._test_gc_ir_commands
            ]
            self.test_suites["global_cache"] = suite

        # Fire Cube test suite
        if "fire_cube" in self.controllers:
            suite = DeviceTestSuite(
                device_name="fire_cube",
                device_type="streaming_device",
                controller=self.controllers["fire_cube"]
            )
            suite.tests = [
                self._test_fire_cube_connection,
                self._test_fire_cube_navigation,
                self._test_fire_cube_apps
            ]
            self.test_suites["fire_cube"] = suite

        # TV Guide test suite
        if "tv_guide" in self.controllers:
            suite = DeviceTestSuite(
                device_name="tv_guide",
                device_type="data_service",
                controller=self.controllers["tv_guide"]
            )
            suite.tests = [
                self._test_tv_guide_data,
                self._test_tv_guide_sports,
                self._test_tv_guide_channels
            ]
            self.test_suites["tv_guide"] = suite

    def _run_device_test_suite(self, suite: DeviceTestSuite):
        """Run all tests in a device test suite"""
        for test_func in suite.tests:
            try:
                result = test_func(suite.controller)
                suite.results.append(result)
                self.overall_results.append(result)
                
                status_symbol = "✓" if result.status == TestStatus.PASS else "✗"
                self.logger.info(f"{status_symbol} {result.test_name}: {result.message}")
                
            except Exception as e:
                error_result = TestResult(
                    test_name=test_func.__name__,
                    test_type=TestType.CONNECTION,
                    device_name=suite.device_name,
                    status=TestStatus.FAIL,
                    message=f"Test execution failed: {str(e)}",
                    duration=0.0,
                    timestamp=datetime.now()
                )
                suite.results.append(error_result)
                self.overall_results.append(error_result)
                self.logger.error(f"✗ {test_func.__name__}: Test execution failed: {e}")

    # Individual device test methods
    def _test_wolfpack_connection(self, controller) -> TestResult:
        """Test Wolfpack connection"""
        start_time = time.time()
        try:
            success = controller.connect()
            duration = time.time() - start_time
            
            if success:
                controller.disconnect()
                return TestResult(
                    test_name="Wolfpack Connection",
                    test_type=TestType.CONNECTION,
                    device_name="wolfpack",
                    status=TestStatus.PASS,
                    message="Successfully connected and disconnected",
                    duration=duration,
                    timestamp=datetime.now()
                )
            else:
                return TestResult(
                    test_name="Wolfpack Connection",
                    test_type=TestType.CONNECTION,
                    device_name="wolfpack",
                    status=TestStatus.FAIL,
                    message="Failed to connect",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="Wolfpack Connection",
                test_type=TestType.CONNECTION,
                device_name="wolfpack",
                status=TestStatus.FAIL,
                message=f"Connection test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _test_wolfpack_status(self, controller) -> TestResult:
        """Test Wolfpack status retrieval"""
        start_time = time.time()
        try:
            controller.connect()
            status = controller.get_matrix_info()
            controller.disconnect()
            
            duration = time.time() - start_time
            
            if status.model:
                return TestResult(
                    test_name="Wolfpack Status",
                    test_type=TestType.COMMUNICATION,
                    device_name="wolfpack",
                    status=TestStatus.PASS,
                    message=f"Retrieved status: {status.model}",
                    duration=duration,
                    timestamp=datetime.now(),
                    details={"model": status.model, "firmware": status.firmware}
                )
            else:
                return TestResult(
                    test_name="Wolfpack Status",
                    test_type=TestType.COMMUNICATION,
                    device_name="wolfpack",
                    status=TestStatus.WARNING,
                    message="Connected but no status data received",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="Wolfpack Status",
                test_type=TestType.COMMUNICATION,
                device_name="wolfpack",
                status=TestStatus.FAIL,
                message=f"Status test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _test_wolfpack_switching(self, controller) -> TestResult:
        """Test Wolfpack video switching"""
        start_time = time.time()
        try:
            controller.connect()
            
            # Test basic switching
            success = controller.switch_input_to_output(1, 1)
            time.sleep(1)
            
            # Verify the switch
            routes = controller.get_current_routes()
            controller.disconnect()
            
            duration = time.time() - start_time
            
            if success and routes.get(1) == 1:
                return TestResult(
                    test_name="Wolfpack Switching",
                    test_type=TestType.CONTROL,
                    device_name="wolfpack",
                    status=TestStatus.PASS,
                    message="Successfully switched input 1 to output 1",
                    duration=duration,
                    timestamp=datetime.now(),
                    details={"routes": routes}
                )
            else:
                return TestResult(
                    test_name="Wolfpack Switching",
                    test_type=TestType.CONTROL,
                    device_name="wolfpack",
                    status=TestStatus.FAIL,
                    message="Switching command failed or not verified",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="Wolfpack Switching",
                test_type=TestType.CONTROL,
                device_name="wolfpack",
                status=TestStatus.FAIL,
                message=f"Switching test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _test_wolfpack_presets(self, controller) -> TestResult:
        """Test Wolfpack preset functionality"""
        start_time = time.time()
        try:
            controller.connect()
            
            # Save a test preset
            save_success = controller.save_preset(99, "System Test")
            time.sleep(1)
            
            # Recall the preset
            recall_success = controller.recall_preset(99)
            controller.disconnect()
            
            duration = time.time() - start_time
            
            if save_success and recall_success:
                return TestResult(
                    test_name="Wolfpack Presets",
                    test_type=TestType.CONTROL,
                    device_name="wolfpack",
                    status=TestStatus.PASS,
                    message="Successfully saved and recalled preset",
                    duration=duration,
                    timestamp=datetime.now()
                )
            else:
                return TestResult(
                    test_name="Wolfpack Presets",
                    test_type=TestType.CONTROL,
                    device_name="wolfpack",
                    status=TestStatus.WARNING,
                    message="Preset commands sent but success uncertain",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="Wolfpack Presets",
                test_type=TestType.CONTROL,
                device_name="wolfpack",
                status=TestStatus.FAIL,
                message=f"Preset test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    # Atlas test methods
    def _test_atlas_connection(self, controller) -> TestResult:
        """Test Atlas Atmosphere connection"""
        start_time = time.time()
        try:
            zones = controller.get_zones()
            duration = time.time() - start_time
            
            if zones:
                return TestResult(
                    test_name="Atlas Connection",
                    test_type=TestType.CONNECTION,
                    device_name="atlas",
                    status=TestStatus.PASS,
                    message="Successfully connected and retrieved zones",
                    duration=duration,
                    timestamp=datetime.now(),
                    details={"zone_count": len(zones.get("zones", []))}
                )
            else:
                return TestResult(
                    test_name="Atlas Connection",
                    test_type=TestType.CONNECTION,
                    device_name="atlas",
                    status=TestStatus.FAIL,
                    message="Failed to retrieve zones",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="Atlas Connection",
                test_type=TestType.CONNECTION,
                device_name="atlas",
                status=TestStatus.FAIL,
                message=f"Connection test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _test_atlas_zones(self, controller) -> TestResult:
        """Test Atlas zone control"""
        start_time = time.time()
        try:
            # Test volume control
            volume_success = controller.set_zone_volume("zone_1", 0.5)
            time.sleep(1)
            
            # Test mute control
            mute_success = controller.mute_zone("zone_1", True)
            time.sleep(1)
            controller.mute_zone("zone_1", False)  # Unmute
            
            duration = time.time() - start_time
            
            if volume_success and mute_success:
                return TestResult(
                    test_name="Atlas Zone Control",
                    test_type=TestType.CONTROL,
                    device_name="atlas",
                    status=TestStatus.PASS,
                    message="Successfully controlled zone volume and mute",
                    duration=duration,
                    timestamp=datetime.now()
                )
            else:
                return TestResult(
                    test_name="Atlas Zone Control",
                    test_type=TestType.CONTROL,
                    device_name="atlas",
                    status=TestStatus.WARNING,
                    message="Zone control commands sent but success uncertain",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="Atlas Zone Control",
                test_type=TestType.CONTROL,
                device_name="atlas",
                status=TestStatus.FAIL,
                message=f"Zone control test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _test_atlas_sources(self, controller) -> TestResult:
        """Test Atlas source routing"""
        start_time = time.time()
        try:
            sources = controller.get_sources()
            
            if sources:
                # Test source switching
                switch_success = controller.set_zone_source("zone_1", "source_1")
                duration = time.time() - start_time
                
                return TestResult(
                    test_name="Atlas Source Control",
                    test_type=TestType.CONTROL,
                    device_name="atlas",
                    status=TestStatus.PASS if switch_success else TestStatus.WARNING,
                    message=f"Retrieved {len(sources.get('sources', []))} sources, switching {'successful' if switch_success else 'uncertain'}",
                    duration=duration,
                    timestamp=datetime.now(),
                    details={"source_count": len(sources.get("sources", []))}
                )
            else:
                return TestResult(
                    test_name="Atlas Source Control",
                    test_type=TestType.COMMUNICATION,
                    device_name="atlas",
                    status=TestStatus.FAIL,
                    message="Failed to retrieve sources",
                    duration=time.time() - start_time,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="Atlas Source Control",
                test_type=TestType.CONTROL,
                device_name="atlas",
                status=TestStatus.FAIL,
                message=f"Source control test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _test_atlas_presets(self, controller) -> TestResult:
        """Test Atlas preset recall"""
        start_time = time.time()
        try:
            success = controller.recall_preset("preset_1")
            duration = time.time() - start_time
            
            return TestResult(
                test_name="Atlas Presets",
                test_type=TestType.CONTROL,
                device_name="atlas",
                status=TestStatus.PASS if success else TestStatus.WARNING,
                message="Preset recall command sent" + (" successfully" if success else " but success uncertain"),
                duration=duration,
                timestamp=datetime.now()
            )
        except Exception as e:
            return TestResult(
                test_name="Atlas Presets",
                test_type=TestType.CONTROL,
                device_name="atlas",
                status=TestStatus.FAIL,
                message=f"Preset test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    # DBX ZonePro test methods
    def _test_dbx_connection(self, controller) -> TestResult:
        """Test DBX ZonePro connection"""
        start_time = time.time()
        try:
            success = controller.connect()
            duration = time.time() - start_time
            
            if success:
                info = controller.get_device_info()
                controller.disconnect()
                
                return TestResult(
                    test_name="DBX Connection",
                    test_type=TestType.CONNECTION,
                    device_name="dbx_zonepro",
                    status=TestStatus.PASS,
                    message=f"Successfully connected to {info.model}",
                    duration=duration,
                    timestamp=datetime.now(),
                    details={"model": info.model, "firmware": info.firmware}
                )
            else:
                return TestResult(
                    test_name="DBX Connection",
                    test_type=TestType.CONNECTION,
                    device_name="dbx_zonepro",
                    status=TestStatus.FAIL,
                    message="Failed to connect",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="DBX Connection",
                test_type=TestType.CONNECTION,
                device_name="dbx_zonepro",
                status=TestStatus.FAIL,
                message=f"Connection test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _test_dbx_levels(self, controller) -> TestResult:
        """Test DBX zone level control"""
        start_time = time.time()
        try:
            controller.connect()
            
            # Test level setting
            success = controller.set_zone_level(1, -10.0)
            time.sleep(1)
            
            # Test level reading
            level = controller.get_zone_level(1)
            controller.disconnect()
            
            duration = time.time() - start_time
            
            if success:
                return TestResult(
                    test_name="DBX Level Control",
                    test_type=TestType.CONTROL,
                    device_name="dbx_zonepro",
                    status=TestStatus.PASS,
                    message=f"Successfully set zone level, readback: {level} dB",
                    duration=duration,
                    timestamp=datetime.now(),
                    details={"set_level": -10.0, "read_level": level}
                )
            else:
                return TestResult(
                    test_name="DBX Level Control",
                    test_type=TestType.CONTROL,
                    device_name="dbx_zonepro",
                    status=TestStatus.FAIL,
                    message="Failed to set zone level",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="DBX Level Control",
                test_type=TestType.CONTROL,
                device_name="dbx_zonepro",
                status=TestStatus.FAIL,
                message=f"Level control test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _test_dbx_muting(self, controller) -> TestResult:
        """Test DBX muting control"""
        start_time = time.time()
        try:
            controller.connect()
            
            # Test mute
            mute_success = controller.mute_zone(1, True)
            time.sleep(1)
            
            # Test unmute
            unmute_success = controller.mute_zone(1, False)
            controller.disconnect()
            
            duration = time.time() - start_time
            
            if mute_success and unmute_success:
                return TestResult(
                    test_name="DBX Mute Control",
                    test_type=TestType.CONTROL,
                    device_name="dbx_zonepro",
                    status=TestStatus.PASS,
                    message="Successfully muted and unmuted zone",
                    duration=duration,
                    timestamp=datetime.now()
                )
            else:
                return TestResult(
                    test_name="DBX Mute Control",
                    test_type=TestType.CONTROL,
                    device_name="dbx_zonepro",
                    status=TestStatus.WARNING,
                    message="Mute commands sent but success uncertain",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="DBX Mute Control",
                test_type=TestType.CONTROL,
                device_name="dbx_zonepro",
                status=TestStatus.FAIL,
                message=f"Mute control test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _test_dbx_presets(self, controller) -> TestResult:
        """Test DBX preset functionality"""
        start_time = time.time()
        try:
            controller.connect()
            
            # Test preset save and recall
            save_success = controller.save_preset(99, "System Test")
            time.sleep(1)
            recall_success = controller.recall_preset(99)
            
            controller.disconnect()
            duration = time.time() - start_time
            
            if save_success and recall_success:
                return TestResult(
                    test_name="DBX Presets",
                    test_type=TestType.CONTROL,
                    device_name="dbx_zonepro",
                    status=TestStatus.PASS,
                    message="Successfully saved and recalled preset",
                    duration=duration,
                    timestamp=datetime.now()
                )
            else:
                return TestResult(
                    test_name="DBX Presets",
                    test_type=TestType.CONTROL,
                    device_name="dbx_zonepro",
                    status=TestStatus.WARNING,
                    message="Preset commands sent but success uncertain",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="DBX Presets",
                test_type=TestType.CONTROL,
                device_name="dbx_zonepro",
                status=TestStatus.FAIL,
                message=f"Preset test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    # Global Cache test methods
    def _test_gc_connection(self, controller) -> TestResult:
        """Test Global Cache connection"""
        start_time = time.time()
        try:
            success = controller.connect()
            duration = time.time() - start_time
            
            if success:
                controller.disconnect()
                return TestResult(
                    test_name="Global Cache Connection",
                    test_type=TestType.CONNECTION,
                    device_name="global_cache",
                    status=TestStatus.PASS,
                    message="Successfully connected and disconnected",
                    duration=duration,
                    timestamp=datetime.now()
                )
            else:
                return TestResult(
                    test_name="Global Cache Connection",
                    test_type=TestType.CONNECTION,
                    device_name="global_cache",
                    status=TestStatus.FAIL,
                    message="Failed to connect",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="Global Cache Connection",
                test_type=TestType.CONNECTION,
                device_name="global_cache",
                status=TestStatus.FAIL,
                message=f"Connection test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _test_gc_device_info(self, controller) -> TestResult:
        """Test Global Cache device info retrieval"""
        start_time = time.time()
        try:
            controller.connect()
            info = controller.get_device_info()
            controller.disconnect()
            
            duration = time.time() - start_time
            
            if info.model:
                return TestResult(
                    test_name="Global Cache Device Info",
                    test_type=TestType.COMMUNICATION,
                    device_name="global_cache",
                    status=TestStatus.PASS,
                    message=f"Retrieved device info: {info.model}",
                    duration=duration,
                    timestamp=datetime.now(),
                    details={"model": info.model, "firmware": info.firmware, "ir_ports": info.ir_ports}
                )
            else:
                return TestResult(
                    test_name="Global Cache Device Info",
                    test_type=TestType.COMMUNICATION,
                    device_name="global_cache",
                    status=TestStatus.WARNING,
                    message="Connected but no device info received",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="Global Cache Device Info",
                test_type=TestType.COMMUNICATION,
                device_name="global_cache",
                status=TestStatus.FAIL,
                message=f"Device info test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _test_gc_ir_commands(self, controller) -> TestResult:
        """Test Global Cache IR command sending"""
        start_time = time.time()
        try:
            controller.connect()
            
            # Set up a test device
            controller.register_device("Test Device", "directv", 1)
            
            # Send a test IR command
            success = controller.control_device("Test Device", "POWER")
            controller.disconnect()
            
            duration = time.time() - start_time
            
            if success:
                return TestResult(
                    test_name="Global Cache IR Commands",
                    test_type=TestType.CONTROL,
                    device_name="global_cache",
                    status=TestStatus.PASS,
                    message="Successfully sent IR command",
                    duration=duration,
                    timestamp=datetime.now()
                )
            else:
                return TestResult(
                    test_name="Global Cache IR Commands",
                    test_type=TestType.CONTROL,
                    device_name="global_cache",
                    status=TestStatus.WARNING,
                    message="IR command sent but success uncertain",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="Global Cache IR Commands",
                test_type=TestType.CONTROL,
                device_name="global_cache",
                status=TestStatus.FAIL,
                message=f"IR command test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    # Fire Cube test methods
    def _test_fire_cube_connection(self, controller) -> TestResult:
        """Test Fire Cube connection"""
        start_time = time.time()
        try:
            success = controller.connect()
            duration = time.time() - start_time
            
            if success:
                controller.disconnect()
                return TestResult(
                    test_name="Fire Cube Connection",
                    test_type=TestType.CONNECTION,
                    device_name="fire_cube",
                    status=TestStatus.PASS,
                    message=f"Successfully connected via {'ADB' if controller.use_adb else 'IR'}",
                    duration=duration,
                    timestamp=datetime.now(),
                    details={"connection_type": "ADB" if controller.use_adb else "IR"}
                )
            else:
                return TestResult(
                    test_name="Fire Cube Connection",
                    test_type=TestType.CONNECTION,
                    device_name="fire_cube",
                    status=TestStatus.FAIL,
                    message="Failed to connect",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="Fire Cube Connection",
                test_type=TestType.CONNECTION,
                device_name="fire_cube",
                status=TestStatus.FAIL,
                message=f"Connection test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _test_fire_cube_navigation(self, controller) -> TestResult:
        """Test Fire Cube navigation"""
        start_time = time.time()
        try:
            controller.connect()
            
            # Test basic navigation
            home_success = controller.go_home()
            time.sleep(2)
            nav_success = controller.navigate_down()
            time.sleep(1)
            select_success = controller.select()
            
            controller.disconnect()
            duration = time.time() - start_time
            
            if home_success and nav_success and select_success:
                return TestResult(
                    test_name="Fire Cube Navigation",
                    test_type=TestType.CONTROL,
                    device_name="fire_cube",
                    status=TestStatus.PASS,
                    message="Successfully executed navigation commands",
                    duration=duration,
                    timestamp=datetime.now()
                )
            else:
                return TestResult(
                    test_name="Fire Cube Navigation",
                    test_type=TestType.CONTROL,
                    device_name="fire_cube",
                    status=TestStatus.WARNING,
                    message="Navigation commands sent but success uncertain",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="Fire Cube Navigation",
                test_type=TestType.CONTROL,
                device_name="fire_cube",
                status=TestStatus.FAIL,
                message=f"Navigation test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _test_fire_cube_apps(self, controller) -> TestResult:
        """Test Fire Cube app launching"""
        start_time = time.time()
        try:
            controller.connect()
            
            # Test app launch
            success = controller.launch_app("netflix")
            time.sleep(3)
            
            # Go back to home
            controller.go_home()
            controller.disconnect()
            
            duration = time.time() - start_time
            
            if success:
                return TestResult(
                    test_name="Fire Cube Apps",
                    test_type=TestType.CONTROL,
                    device_name="fire_cube",
                    status=TestStatus.PASS,
                    message="Successfully launched Netflix app",
                    duration=duration,
                    timestamp=datetime.now()
                )
            else:
                return TestResult(
                    test_name="Fire Cube Apps",
                    test_type=TestType.CONTROL,
                    device_name="fire_cube",
                    status=TestStatus.WARNING,
                    message="App launch command sent but success uncertain",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="Fire Cube Apps",
                test_type=TestType.CONTROL,
                device_name="fire_cube",
                status=TestStatus.FAIL,
                message=f"App launch test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    # TV Guide test methods
    def _test_tv_guide_data(self, controller) -> TestResult:
        """Test TV Guide data retrieval"""
        start_time = time.time()
        try:
            current_programs = controller.get_current_programs()
            duration = time.time() - start_time
            
            if current_programs:
                return TestResult(
                    test_name="TV Guide Data",
                    test_type=TestType.COMMUNICATION,
                    device_name="tv_guide",
                    status=TestStatus.PASS,
                    message=f"Retrieved {len(current_programs)} current programs",
                    duration=duration,
                    timestamp=datetime.now(),
                    details={"program_count": len(current_programs)}
                )
            else:
                return TestResult(
                    test_name="TV Guide Data",
                    test_type=TestType.COMMUNICATION,
                    device_name="tv_guide",
                    status=TestStatus.WARNING,
                    message="No current programs retrieved",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="TV Guide Data",
                test_type=TestType.COMMUNICATION,
                device_name="tv_guide",
                status=TestStatus.FAIL,
                message=f"TV Guide data test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _test_tv_guide_sports(self, controller) -> TestResult:
        """Test TV Guide sports program detection"""
        start_time = time.time()
        try:
            sports_programs = controller.get_sports_programs()
            duration = time.time() - start_time
            
            return TestResult(
                test_name="TV Guide Sports",
                test_type=TestType.COMMUNICATION,
                device_name="tv_guide",
                status=TestStatus.PASS,
                message=f"Retrieved {len(sports_programs)} sports programs",
                duration=duration,
                timestamp=datetime.now(),
                details={"sports_count": len(sports_programs)}
            )
        except Exception as e:
            return TestResult(
                test_name="TV Guide Sports",
                test_type=TestType.COMMUNICATION,
                device_name="tv_guide",
                status=TestStatus.FAIL,
                message=f"Sports program test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _test_tv_guide_channels(self, controller) -> TestResult:
        """Test TV Guide channel information"""
        start_time = time.time()
        try:
            sports_channels = controller.get_sports_channels()
            duration = time.time() - start_time
            
            if sports_channels:
                return TestResult(
                    test_name="TV Guide Channels",
                    test_type=TestType.COMMUNICATION,
                    device_name="tv_guide",
                    status=TestStatus.PASS,
                    message=f"Retrieved {len(sports_channels)} sports channels",
                    duration=duration,
                    timestamp=datetime.now(),
                    details={"channel_count": len(sports_channels)}
                )
            else:
                return TestResult(
                    test_name="TV Guide Channels",
                    test_type=TestType.COMMUNICATION,
                    device_name="tv_guide",
                    status=TestStatus.WARNING,
                    message="No sports channels retrieved",
                    duration=duration,
                    timestamp=datetime.now()
                )
        except Exception as e:
            return TestResult(
                test_name="TV Guide Channels",
                test_type=TestType.COMMUNICATION,
                device_name="tv_guide",
                status=TestStatus.FAIL,
                message=f"Channel test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )

    def _run_integration_tests(self):
        """Run integration tests between devices"""
        self.logger.info("Running integration tests...")
        
        # Test AV Manager integration if available
        if "wolfpack" in self.controllers and "atlas" in self.controllers:
            self._test_av_manager_integration()

    def _test_av_manager_integration(self):
        """Test AV Manager integration"""
        start_time = time.time()
        try:
            # This would require the AV Manager to be initialized
            # For now, just log that integration testing is available
            result = TestResult(
                test_name="AV Manager Integration",
                test_type=TestType.INTEGRATION,
                device_name="av_manager",
                status=TestStatus.SKIP,
                message="AV Manager integration test not implemented",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )
            self.overall_results.append(result)
            self.logger.info("⚠ AV Manager Integration: Test not implemented")
            
        except Exception as e:
            result = TestResult(
                test_name="AV Manager Integration",
                test_type=TestType.INTEGRATION,
                device_name="av_manager",
                status=TestStatus.FAIL,
                message=f"Integration test failed: {str(e)}",
                duration=time.time() - start_time,
                timestamp=datetime.now()
            )
            self.overall_results.append(result)
            self.logger.error(f"✗ AV Manager Integration: {e}")

    def _start_monitoring(self):
        """Start device monitoring for feedback"""
        self.logger.info("Starting device monitoring...")
        self.monitoring_active = True
        
        # Start monitoring thread
        self.monitoring_thread = threading.Thread(target=self._monitor_devices, daemon=True)
        self.monitoring_thread.start()

    def _monitor_devices(self):
        """Monitor devices for feedback and status changes"""
        monitor_duration = self.test_config.get("test_settings", {}).get("monitoring_duration", 30)
        start_time = time.time()
        
        while self.monitoring_active and (time.time() - start_time) < monitor_duration:
            try:
                # Monitor each device
                for device_name, controller in self.controllers.items():
                    if device_name == "tv_guide":
                        continue  # Skip TV guide for monitoring
                    
                    self._monitor_device(device_name, controller)
                
                time.sleep(5)  # Monitor every 5 seconds
                
            except Exception as e:
                self.logger.error(f"Monitoring error: {e}")
                break
        
        self.monitoring_active = False
        self.logger.info("Device monitoring completed")

    def _monitor_device(self, device_name: str, controller):
        """Monitor a specific device"""
        try:
            if device_name == "wolfpack":
                if hasattr(controller, 'is_connected') and controller.is_connected:
                    routes = controller.get_current_routes()
                    self.feedback_data[device_name] = {
                        "timestamp": datetime.now().isoformat(),
                        "status": "connected",
                        "routes": routes
                    }
                else:
                    self.feedback_data[device_name] = {
                        "timestamp": datetime.now().isoformat(),
                        "status": "disconnected"
                    }
            
            elif device_name == "atlas":
                # Monitor Atlas zones (this would require WebSocket connection)
                self.feedback_data[device_name] = {
                    "timestamp": datetime.now().isoformat(),
                    "status": "monitoring_not_implemented"
                }
            
            # Add monitoring for other devices as needed
            
        except Exception as e:
            self.feedback_data[device_name] = {
                "timestamp": datetime.now().isoformat(),
                "status": "monitoring_error",
                "error": str(e)
            }

    def _generate_test_report(self) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        total_tests = len(self.overall_results)
        passed_tests = len([r for r in self.overall_results if r.status == TestStatus.PASS])
        failed_tests = len([r for r in self.overall_results if r.status == TestStatus.FAIL])
        warning_tests = len([r for r in self.overall_results if r.status == TestStatus.WARNING])
        skipped_tests = len([r for r in self.overall_results if r.status == TestStatus.SKIP])
        
        # Calculate success rate
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        # Group results by device
        device_results = {}
        for suite_name, suite in self.test_suites.items():
            device_results[suite_name] = {
                "device_type": suite.device_type,
                "total_tests": len(suite.results),
                "passed": len([r for r in suite.results if r.status == TestStatus.PASS]),
                "failed": len([r for r in suite.results if r.status == TestStatus.FAIL]),
                "warnings": len([r for r in suite.results if r.status == TestStatus.WARNING]),
                "skipped": len([r for r in suite.results if r.status == TestStatus.SKIP]),
                "results": [asdict(r) for r in suite.results]
            }
        
        # Generate report
        report = {
            "test_summary": {
                "total_tests": total_tests,
                "passed": passed_tests,
                "failed": failed_tests,
                "warnings": warning_tests,
                "skipped": skipped_tests,
                "success_rate": round(success_rate, 2),
                "start_time": self.test_start_time.isoformat() if self.test_start_time else None,
                "end_time": self.test_end_time.isoformat() if self.test_end_time else None,
                "duration": (self.test_end_time - self.test_start_time).total_seconds() if self.test_start_time and self.test_end_time else 0
            },
            "device_results": device_results,
            "monitoring_data": self.feedback_data,
            "all_results": [asdict(r) for r in self.overall_results],
            "recommendations": self._generate_recommendations()
        }
        
        # Save report to file
        report_filename = f"system_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_filename, 'w') as f:
            json.dump(report, f, indent=2)
        
        self.logger.info(f"Test report saved to {report_filename}")
        
        # Print summary
        self._print_test_summary(report)
        
        return report

    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on test results"""
        recommendations = []
        
        # Check for failed connections
        failed_connections = [r for r in self.overall_results 
                            if r.test_type == TestType.CONNECTION and r.status == TestStatus.FAIL]
        
        if failed_connections:
            recommendations.append("Check network connectivity and device IP addresses for failed connections")
        
        # Check for communication issues
        comm_issues = [r for r in self.overall_results 
                      if r.test_type == TestType.COMMUNICATION and r.status == TestStatus.FAIL]
        
        if comm_issues:
            recommendations.append("Verify device API credentials and communication protocols")
        
        # Check for control issues
        control_issues = [r for r in self.overall_results 
                         if r.test_type == TestType.CONTROL and r.status == TestStatus.FAIL]
        
        if control_issues:
            recommendations.append("Review device control commands and verify device capabilities")
        
        # Check success rate
        success_rate = len([r for r in self.overall_results if r.status == TestStatus.PASS]) / len(self.overall_results) * 100
        
        if success_rate < 80:
            recommendations.append("Overall success rate is below 80% - consider reviewing system configuration")
        elif success_rate > 95:
            recommendations.append("Excellent system performance - all devices are functioning well")
        
        return recommendations

    def _print_test_summary(self, report: Dict[str, Any]):
        """Print test summary to console"""
        summary = report["test_summary"]
        
        print("\n" + "="*60)
        print("SYSTEM TEST RESULTS SUMMARY")
        print("="*60)
        print(f"Total Tests: {summary['total_tests']}")
        print(f"Passed: {summary['passed']} ✓")
        print(f"Failed: {summary['failed']} ✗")
        print(f"Warnings: {summary['warnings']} ⚠")
        print(f"Skipped: {summary['skipped']} -")
        print(f"Success Rate: {summary['success_rate']}%")
        print(f"Duration: {summary['duration']:.2f} seconds")
        
        print("\nDEVICE BREAKDOWN:")
        print("-" * 40)
        for device_name, device_data in report["device_results"].items():
            status_icon = "✓" if device_data["failed"] == 0 else "✗"
            print(f"{status_icon} {device_name.upper()}: {device_data['passed']}/{device_data['total_tests']} passed")
        
        if report["recommendations"]:
            print("\nRECOMMENDATIONS:")
            print("-" * 40)
            for i, rec in enumerate(report["recommendations"], 1):
                print(f"{i}. {rec}")
        
        print("="*60)

# Example usage and test configuration
def create_test_config():
    """Create a sample test configuration file"""
    config = {
        "devices": {
            "wolfpack": {
                "enabled": True,
                "ip_address": "192.168.1.100",
                "port": 23,
                "timeout": 5
            },
            "atlas": {
                "enabled": True,
                "ip_address": "192.168.1.101",
                "username": "admin",
                "password": "password"
            },
            "dbx_zonepro": {
                "enabled": True,
                "ip_address": "192.168.1.102",
                "port": 23
            },
            "global_cache": {
                "enabled": True,
                "ip_address": "192.168.1.103",
                "port": 4998
            },
            "fire_cube": {
                "enabled": True,
                "ip_address": "192.168.1.104",
                "use_adb": True
            }
        },
        "test_settings": {
            "connection_timeout": 10,
            "command_timeout": 5,
            "monitoring_duration": 30,
            "retry_attempts": 3
        }
    }
    
    with open("config/test_config.json", 'w') as f:
        json.dump(config, f, indent=2)
    
    print("Test configuration created at config/test_config.json")

def main():
    """Main function to run system tests"""
    # Create test framework
    test_framework = SystemTestFramework()
    
    # Run all tests
    results = test_framework.run_all_tests()
    
    # Results are automatically printed and saved
    return results

if __name__ == "__main__":
    # Create sample config if needed
    import os
    if not os.path.exists("config/test_config.json"):
        os.makedirs("config", exist_ok=True)
        create_test_config()
    
    # Run tests
    main()
