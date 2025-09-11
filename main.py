
#!/usr/bin/env python3
"""
Sports Bar TV Controller - Main Application
Main application runner that initializes all components and starts the web server
"""

import sys
import os
import logging
import argparse
import signal
import threading
import time
from pathlib import Path
from typing import Dict, Any

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from core.av_manager import AVManager
from ui.dashboard import SportsBarDashboard, create_dashboard_templates
from ui.sports_content_dashboard import SportsContentDashboard
from core.event_bus import event_bus
from services.content_discovery_manager import ContentDiscoveryManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/sportsbar_av.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class SportsBarController:
    """
    Main Sports Bar TV Controller Application
    
    Coordinates all system components:
    - AV Manager for device control and sync
    - Web Dashboard for user interface
    - Event Bus for real-time communication
    """
    
    def __init__(self, config_path: str = "config/mappings.yaml", sports_config_path: str = "config/sports_config.yaml"):
        self.config_path = config_path
        self.sports_config_path = sports_config_path
        self.av_manager = None
        self.dashboard = None
        self.sports_dashboard = None
        self.content_manager = None
        self.running = False
        
        # Create necessary directories
        self._create_directories()
        
        logger.info("Sports Bar Controller initialized")
    
    def _create_directories(self):
        """Create necessary directories"""
        directories = [
            "logs",
            "config", 
            "ui/templates",
            "ui/static",
            "services",
            "tests"
        ]
        
        for directory in directories:
            Path(directory).mkdir(parents=True, exist_ok=True)
    
    def initialize(self):
        """Initialize all system components"""
        try:
            logger.info("Initializing Sports Bar Controller...")
            
            # Initialize AV Manager
            self.av_manager = AVManager(self.config_path)
            self.av_manager.initialize_devices()
            
            # Load sports configuration
            sports_config = self._load_sports_config()
            
            # Initialize Content Discovery Manager
            self.content_manager = ContentDiscoveryManager(sports_config)
            
            # Create dashboard templates
            create_dashboard_templates()
            
            # Initialize Main Dashboard
            self.dashboard = SportsBarDashboard(self.av_manager)
            
            # Initialize Sports Content Dashboard
            self.sports_dashboard = SportsContentDashboard(self.content_manager)
            
            # Register sports dashboard blueprint
            self.dashboard.app.register_blueprint(self.sports_dashboard.get_blueprint())
            
            logger.info("All components initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Initialization failed: {e}")
            return False
    
    def start(self, host: str = "0.0.0.0", port: int = 5000, debug: bool = False):
        """Start the Sports Bar Controller system"""
        if not self.initialize():
            logger.error("Failed to initialize system")
            return False
        
        try:
            self.running = True
            logger.info("Starting Sports Bar Controller system...")
            
            # Connect to devices in a separate thread
            device_thread = threading.Thread(
                target=self._connect_devices_delayed,
                daemon=True
            )
            device_thread.start()
            
            # Setup signal handlers for graceful shutdown
            signal.signal(signal.SIGINT, self._signal_handler)
            signal.signal(signal.SIGTERM, self._signal_handler)
            
            # Start the web dashboard (this blocks)
            logger.info(f"Starting web dashboard on {host}:{port}")
            self.dashboard.run(debug=debug)
            
        except KeyboardInterrupt:
            logger.info("Received keyboard interrupt")
        except Exception as e:
            logger.error(f"System error: {e}")
        finally:
            self.stop()
    
    def _connect_devices_delayed(self):
        """Connect to devices with a delay to allow dashboard to start"""
        time.sleep(3)  # Give dashboard time to start
        
        logger.info("Connecting to AV devices...")
        if self.av_manager.connect_devices():
            logger.info("Successfully connected to all devices")
        else:
            logger.warning("Failed to connect to some devices")
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, shutting down...")
        self.stop()
        sys.exit(0)
    
    def stop(self):
        """Stop the Sports Bar Controller system"""
        if not self.running:
            return
        
        logger.info("Stopping Sports Bar Controller system...")
        self.running = False
        
        # Disconnect from devices
        if self.av_manager:
            self.av_manager.disconnect_devices()
        
        # Clear event bus
        event_bus.clear_history()
        
        logger.info("Sports Bar Controller stopped")
    
    def _load_sports_config(self) -> Dict[str, Any]:
        """Load sports configuration from YAML file"""
        import yaml
        import os
        
        try:
            # Try to load from file
            if os.path.exists(self.sports_config_path):
                with open(self.sports_config_path, 'r') as f:
                    config = yaml.safe_load(f)
                    
                # Replace environment variables
                config = self._replace_env_vars(config)
                return config
            else:
                logger.warning(f"Sports config file not found: {self.sports_config_path}")
                # Return default configuration
                return self._get_default_sports_config()
                
        except Exception as e:
            logger.error(f"Error loading sports config: {e}")
            return self._get_default_sports_config()
    
    def _replace_env_vars(self, config: Any) -> Any:
        """Replace environment variables in configuration"""
        import os
        import re
        
        if isinstance(config, dict):
            return {k: self._replace_env_vars(v) for k, v in config.items()}
        elif isinstance(config, list):
            return [self._replace_env_vars(item) for item in config]
        elif isinstance(config, str):
            # Replace ${VAR_NAME} with environment variable
            pattern = r'\$\{([^}]+)\}'
            matches = re.findall(pattern, config)
            for match in matches:
                env_value = os.getenv(match, '')
                config = config.replace(f'${{{match}}}', env_value)
            return config
        else:
            return config
    
    def _get_default_sports_config(self) -> Dict[str, Any]:
        """Get default sports configuration"""
        return {
            'sports_api': {
                'cache_duration_minutes': 30,
                'api_keys': {},
                'timeout_seconds': 30
            },
            'content_discovery': {
                'default_results': {
                    'live': 10,
                    'upcoming': 20,
                    'search': 15,
                    'featured': 8
                }
            }
        }

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Sports Bar TV Controller - Professional AV Automation System"
    )
    
    parser.add_argument(
        "--config", "-c",
        default="config/mappings.yaml",
        help="Configuration file path (default: config/mappings.yaml)"
    )
    
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Dashboard host address (default: 0.0.0.0)"
    )
    
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=5000,
        help="Dashboard port (default: 5000)"
    )
    
    parser.add_argument(
        "--debug", "-d",
        action="store_true",
        help="Enable debug mode"
    )
    
    parser.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Set logging level (default: INFO)"
    )
    
    args = parser.parse_args()
    
    # Set logging level
    logging.getLogger().setLevel(getattr(logging, args.log_level))
    
    # Print startup banner
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║                                                              ║
    ║              🏈 SPORTS BAR TV CONTROLLER 🏈                  ║
    ║                                                              ║
    ║           Professional AV Automation System                  ║
    ║                                                              ║
    ║  • Wolfpack Video Matrix Control                             ║
    ║  • Atlas Atmosphere Audio Processing                         ║
    ║  • Bi-directional AV Sync                                    ║
    ║  • Web Dashboard Interface                                   ║
    ║  • Real-time Event System                                    ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
    """)
    
    logger.info("=" * 60)
    logger.info("SPORTS BAR TV CONTROLLER STARTING")
    logger.info("=" * 60)
    logger.info(f"Configuration: {args.config}")
    logger.info(f"Dashboard: http://{args.host}:{args.port}")
    logger.info(f"Debug mode: {args.debug}")
    logger.info(f"Log level: {args.log_level}")
    logger.info("=" * 60)
    
    # Create and start the controller
    controller = SportsBarController(args.config)
    
    try:
        controller.start(
            host=args.host,
            port=args.port,
            debug=args.debug
        )
    except Exception as e:
        logger.error(f"Failed to start controller: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
