
"""
Enhanced Main Application
Integrates all device controllers with bi-directional sync and web dashboard
"""
import logging
import time
from devices.wolfpack_controller import WolfpackController
from devices.atlas_atmosphere import AtmosphereController
from devices.dbx_zonepro import DBXZoneProController
from devices.global_cache_ir import GlobalCacheIRController
from devices.amazon_fire_cube import AmazonFireCubeController
from devices.tv_guide_integration import TVGuideIntegration
from core.av_manager_enhanced import AVManagerEnhanced
from ui.dashboard import app
import threading

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("SportsBarControl")

# Device Configuration
DEVICE_CONFIG = {
    "wolfpack": {
        "ip_address": "192.168.1.100",
        "port": 23,
        "timeout": 5
    },
    "atlas": {
        "ip_address": "192.168.1.101",
        "username": "admin",
        "password": "password"
    },
    "dbx_zonepro": {
        "ip_address": "192.168.1.102",
        "port": 23
    },
    "global_cache": {
        "ip_address": "192.168.1.103",
        "port": 4998
    },
    "fire_cube": {
        "ip_address": "192.168.1.104",
        "use_adb": True
    }
}

def initialize_devices():
    """Initialize all device controllers"""
    logger.info("Initializing device controllers...")
    
    devices = {}
    
    try:
        # Initialize Wolfpack
        logger.info("Initializing Wolfpack video matrix...")
        devices["wolfpack"] = WolfpackController(
            DEVICE_CONFIG["wolfpack"]["ip_address"],
            DEVICE_CONFIG["wolfpack"]["port"],
            DEVICE_CONFIG["wolfpack"]["timeout"]
        )
        
        # Initialize Atlas Atmosphere
        logger.info("Initializing Atlas Atmosphere audio processor...")
        devices["atlas"] = AtmosphereController(
            DEVICE_CONFIG["atlas"]["ip_address"],
            DEVICE_CONFIG["atlas"]["username"],
            DEVICE_CONFIG["atlas"]["password"]
        )
        
        # Initialize DBX ZonePro
        logger.info("Initializing DBX ZonePro audio processor...")
        devices["dbx"] = DBXZoneProController(
            DEVICE_CONFIG["dbx_zonepro"]["ip_address"],
            DEVICE_CONFIG["dbx_zonepro"]["port"]
        )
        
        # Initialize Global Cache IR
        logger.info("Initializing Global Cache IR controller...")
        devices["global_cache"] = GlobalCacheIRController(
            DEVICE_CONFIG["global_cache"]["ip_address"],
            DEVICE_CONFIG["global_cache"]["port"]
        )
        
        # Initialize Fire Cube
        logger.info("Initializing Amazon Fire Cube controller...")
        devices["fire_cube"] = AmazonFireCubeController(
            DEVICE_CONFIG["fire_cube"]["ip_address"],
            use_adb=DEVICE_CONFIG["fire_cube"]["use_adb"]
        )
        
        # Initialize TV Guide
        logger.info("Initializing TV Guide integration...")
        devices["tv_guide"] = TVGuideIntegration()
        
        logger.info("All device controllers initialized successfully")
        return devices
        
    except Exception as e:
        logger.error(f"Failed to initialize devices: {e}")
        return devices

def setup_ir_devices(global_cache):
    """Set up IR-controlled devices"""
    logger.info("Setting up IR-controlled devices...")
    
    try:
        if global_cache.connect():
            # Register common sports bar devices
            global_cache.register_device("Main Bar DirecTV", "directv", 1)
            global_cache.register_device("Patio Fire Cube", "fire_cube", 2)
            global_cache.register_device("Dining Cable Box", "cable_box", 3)
            
            logger.info("IR devices registered successfully")
            global_cache.disconnect()
        else:
            logger.warning("Could not connect to Global Cache - IR devices not registered")
            
    except Exception as e:
        logger.error(f"Failed to set up IR devices: {e}")

def run_system_tests():
    """Run basic system connectivity tests"""
    logger.info("Running basic system tests...")
    
    try:
        from tests.system_test import SystemTestFramework
        
        # Create and run basic tests
        test_framework = SystemTestFramework("config/test_config.json")
        
        # Run tests in background thread
        def run_tests():
            try:
                results = test_framework.run_all_tests()
                logger.info(f"System tests completed - Success rate: {results['test_summary']['success_rate']}%")
            except Exception as e:
                logger.error(f"System tests failed: {e}")
        
        test_thread = threading.Thread(target=run_tests, daemon=True)
        test_thread.start()
        
    except ImportError:
        logger.warning("System test framework not available - skipping tests")
    except Exception as e:
        logger.error(f"Failed to run system tests: {e}")

def main():
    """Main application entry point"""
    logger.info("🏈 Starting Sports Bar AV Control System...")
    
    # Initialize devices
    devices = initialize_devices()
    
    if not devices.get("wolfpack") or not devices.get("atlas"):
        logger.error("Critical devices (Wolfpack/Atlas) not available - cannot start AV Manager")
        return
    
    # Connect primary devices
    logger.info("Connecting to primary AV devices...")
    wolfpack_connected = devices["wolfpack"].connect()
    
    if not wolfpack_connected:
        logger.error("Failed to connect to Wolfpack - system may not function properly")
    
    # Set up IR devices
    if devices.get("global_cache"):
        setup_ir_devices(devices["global_cache"])
    
    # Initialize AV Manager with bi-directional sync
    logger.info("Initializing AV Manager with bi-directional sync...")
    global manager
    manager = AVManagerEnhanced(
        devices["wolfpack"],
        devices["atlas"],
        "config/mappings.yaml",
        poll_interval=3
    )
    
    # Update shared state for dashboard
    from ui.dashboard import shared_state
    shared_state["available_inputs"] = manager.get_available_inputs()
    shared_state["available_outputs"] = manager.get_available_outputs()
    shared_state["presets"] = manager.get_presets()
    
    # Run system tests
    run_system_tests()
    
    # Start web dashboard
    logger.info("Starting web dashboard on http://0.0.0.0:5000")
    
    try:
        # Run Flask app
        app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
        
    except KeyboardInterrupt:
        logger.info("Shutting down system...")
        
    finally:
        # Cleanup
        logger.info("Cleaning up connections...")
        if wolfpack_connected:
            devices["wolfpack"].disconnect()
        
        if manager:
            manager.stop()
        
        logger.info("Sports Bar AV Control System shutdown complete")

if __name__ == "__main__":
    main()
