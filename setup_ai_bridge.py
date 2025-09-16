
#!/usr/bin/env python3
"""
AI Bridge Setup Script
======================

Setup and initialization script for the AI-to-AI communication system.
"""

import os
import sys
import asyncio
import logging
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from ai_bridge import AIBridge
from ai_bridge.utils.config_manager import ConfigManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_environment():
    """Check if the environment is properly configured"""
    logger.info("Checking environment configuration...")
    
    issues = []
    warnings = []
    
    # Check Python version
    if sys.version_info < (3.8, 0):
        issues.append("Python 3.8 or higher is required")
    
    # Check for API keys
    api_keys = {
        'OpenAI': os.getenv('OPENAI_API_KEY'),
        'Anthropic': os.getenv('ANTHROPIC_API_KEY'),
        'Grok': os.getenv('GROK_API_KEY')
    }
    
    configured_providers = [name for name, key in api_keys.items() if key]
    
    if not configured_providers:
        issues.append("No AI provider API keys configured. Set at least one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GROK_API_KEY")
    else:
        logger.info(f"Configured providers: {', '.join(configured_providers)}")
        
        if len(configured_providers) < 2:
            warnings.append("Only one provider configured. Collaborative features will be limited.")
    
    # Check required directories
    required_dirs = [
        'config/ai_services',
        'logs',
        'ai_bridge/core',
        'ai_bridge/providers',
        'ai_bridge/utils'
    ]
    
    for dir_path in required_dirs:
        full_path = project_root / dir_path
        if not full_path.exists():
            issues.append(f"Required directory missing: {dir_path}")
    
    # Check configuration files
    config_files = [
        'config/ai_services/ai_bridge_config.yaml',
        'config/ai_services/providers.yaml'
    ]
    
    for config_file in config_files:
        full_path = project_root / config_file
        if not full_path.exists():
            warnings.append(f"Configuration file missing: {config_file} (will use defaults)")
    
    return issues, warnings

def install_dependencies():
    """Install required dependencies"""
    logger.info("Installing AI Bridge dependencies...")
    
    requirements_file = project_root / 'requirements_ai_bridge.txt'
    
    if requirements_file.exists():
        import subprocess
        try:
            subprocess.check_call([
                sys.executable, '-m', 'pip', 'install', '-r', str(requirements_file)
            ])
            logger.info("Dependencies installed successfully")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to install dependencies: {e}")
            return False
    else:
        logger.warning("Requirements file not found, skipping dependency installation")
        return True

async def test_ai_bridge():
    """Test AI Bridge functionality"""
    logger.info("Testing AI Bridge functionality...")
    
    try:
        # Initialize configuration
        config_manager = ConfigManager()
        issues = config_manager.validate_config()
        
        if issues['errors']:
            logger.error("Configuration errors found:")
            for error in issues['errors']:
                logger.error(f"  - {error}")
            return False
        
        if issues['warnings']:
            logger.warning("Configuration warnings:")
            for warning in issues['warnings']:
                logger.warning(f"  - {warning}")
        
        # Test AI Bridge initialization
        bridge = AIBridge()
        
        logger.info("AI Bridge initialized successfully")
        logger.info(f"Available providers: {len(bridge.providers)}")
        
        # Test provider health
        await bridge.start()
        
        healthy_providers = 0
        for provider_name, provider in bridge.providers.items():
            try:
                health = await provider.health_check()
                if health:
                    healthy_providers += 1
                    logger.info(f"Provider {provider_name}: Healthy")
                else:
                    logger.warning(f"Provider {provider_name}: Unhealthy")
            except Exception as e:
                logger.error(f"Provider {provider_name}: Error - {e}")
        
        await bridge.stop()
        
        if healthy_providers == 0:
            logger.error("No healthy providers found")
            return False
        
        logger.info(f"AI Bridge test completed successfully ({healthy_providers} healthy providers)")
        return True
        
    except Exception as e:
        logger.error(f"AI Bridge test failed: {e}")
        return False

def create_example_config():
    """Create example configuration files"""
    logger.info("Creating example configuration files...")
    
    # Create directories
    config_dir = project_root / 'config' / 'ai_services'
    config_dir.mkdir(parents=True, exist_ok=True)
    
    # Create example environment file
    env_example = project_root / '.env.example'
    if not env_example.exists():
        env_content = """# AI Bridge Environment Configuration
# Copy this file to .env and fill in your API keys

# AI Provider API Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GROK_API_KEY=your_grok_api_key_here

# AI Bridge Settings
AI_BRIDGE_ENABLED=true
AI_BRIDGE_MAX_CONCURRENT_TASKS=10
AI_BRIDGE_LOG_LEVEL=INFO

# Provider-specific settings (optional)
OPENAI_MODEL=gpt-4
ANTHROPIC_MODEL=claude-3-sonnet-20240229
GROK_MODEL=grok-beta
"""
        env_example.write_text(env_content)
        logger.info("Created .env.example file")
    
    logger.info("Configuration setup completed")

def main():
    """Main setup function"""
    print("AI Bridge Setup")
    print("===============")
    
    # Check environment
    issues, warnings = check_environment()
    
    if issues:
        print("\nCritical Issues Found:")
        for issue in issues:
            print(f"  ❌ {issue}")
        print("\nPlease resolve these issues before continuing.")
        return 1
    
    if warnings:
        print("\nWarnings:")
        for warning in warnings:
            print(f"  ⚠️  {warning}")
    
    # Install dependencies
    print("\nInstalling dependencies...")
    if not install_dependencies():
        print("❌ Failed to install dependencies")
        return 1
    print("✅ Dependencies installed")
    
    # Create example configuration
    create_example_config()
    print("✅ Configuration files created")
    
    # Test AI Bridge
    print("\nTesting AI Bridge...")
    try:
        success = asyncio.run(test_ai_bridge())
        if success:
            print("✅ AI Bridge test passed")
        else:
            print("❌ AI Bridge test failed")
            return 1
    except Exception as e:
        print(f"❌ AI Bridge test error: {e}")
        return 1
    
    print("\n🎉 AI Bridge setup completed successfully!")
    print("\nNext steps:")
    print("1. Set your API keys in environment variables or .env file")
    print("2. Review configuration files in config/ai_services/")
    print("3. Run examples: python examples/ai_bridge_examples.py")
    print("4. Run tests: python -m pytest tests/test_ai_bridge.py")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
