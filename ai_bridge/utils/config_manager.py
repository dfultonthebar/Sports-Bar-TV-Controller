
"""
Configuration Manager
====================

Manages configuration for AI bridge services, providers, and workflows.
"""

import os
import yaml
import json
import logging
from typing import Dict, Any, Optional, List
from pathlib import Path

logger = logging.getLogger(__name__)

class ConfigManager:
    """
    Configuration manager for AI bridge system.
    
    Handles loading and managing configuration from multiple sources:
    - YAML configuration files
    - Environment variables
    - Runtime configuration updates
    """
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path
        self.config: Dict[str, Any] = {}
        self.provider_configs: Dict[str, Dict[str, Any]] = {}
        
        # Load configuration
        self._load_configuration()
    
    def _load_configuration(self):
        """Load configuration from files and environment"""
        # Load base configuration
        if self.config_path and os.path.exists(self.config_path):
            self._load_yaml_config(self.config_path)
        else:
            # Load default configuration
            self._load_default_config()
        
        # Load provider configurations
        self._load_provider_configs()
        
        # Override with environment variables
        self._load_environment_overrides()
    
    def _load_yaml_config(self, config_path: str):
        """Load configuration from YAML file"""
        try:
            with open(config_path, 'r') as f:
                self.config = yaml.safe_load(f) or {}
            logger.info(f"Loaded configuration from {config_path}")
        except Exception as e:
            logger.error(f"Failed to load configuration from {config_path}: {e}")
            self._load_default_config()
    
    def _load_default_config(self):
        """Load default configuration"""
        self.config = {
            'ai_bridge': {
                'enabled': True,
                'log_level': 'INFO',
                'max_concurrent_tasks': 10,
                'task_timeout': 300,
                'health_check_interval': 30
            },
            'processing': {
                'num_workers': 3,
                'queue_size': 100,
                'retry_attempts': 3,
                'retry_delay': 5
            },
            'collaboration': {
                'enabled': True,
                'default_consensus_providers': 2,
                'max_workflow_steps': 10,
                'workflow_timeout': 600
            },
            'monitoring': {
                'metrics_enabled': True,
                'metrics_interval': 60,
                'performance_tracking': True,
                'alert_thresholds': {
                    'error_rate': 0.1,
                    'response_time': 30.0,
                    'queue_size': 50
                }
            }
        }
    
    def _load_provider_configs(self):
        """Load AI provider configurations"""
        # Default provider configurations
        self.provider_configs = {
            'openai': {
                'enabled': False,
                'name': 'OpenAI',
                'base_url': 'https://api.openai.com/v1',
                'model': 'gpt-4',
                'max_tokens': 4000,
                'temperature': 0.7,
                'timeout': 30,
                'rate_limit_rpm': 500,
                'rate_limit_tpm': 30000,
                'api_key': None  # Set via environment variable
            },
            'anthropic': {
                'enabled': False,
                'name': 'Anthropic Claude',
                'base_url': 'https://api.anthropic.com/v1',
                'model': 'claude-3-sonnet-20240229',
                'max_tokens': 4000,
                'temperature': 0.7,
                'timeout': 30,
                'rate_limit_rpm': 1000,
                'rate_limit_tpm': 100000,
                'api_key': None  # Set via environment variable
            },
            'grok': {
                'enabled': False,
                'name': 'Grok',
                'base_url': 'https://api.x.ai/v1',
                'model': 'grok-beta',
                'max_tokens': 4000,
                'temperature': 0.7,
                'timeout': 30,
                'rate_limit_rpm': 1000,
                'rate_limit_tpm': 50000,
                'api_key': None  # Set via environment variable
            }
        }
        
        # Try to load provider configs from file
        provider_config_path = self._get_provider_config_path()
        if provider_config_path and os.path.exists(provider_config_path):
            try:
                with open(provider_config_path, 'r') as f:
                    file_configs = yaml.safe_load(f) or {}
                
                # Merge with defaults
                for provider_name, config in file_configs.items():
                    if provider_name in self.provider_configs:
                        self.provider_configs[provider_name].update(config)
                    else:
                        self.provider_configs[provider_name] = config
                
                logger.info(f"Loaded provider configurations from {provider_config_path}")
            except Exception as e:
                logger.error(f"Failed to load provider configurations: {e}")
    
    def _get_provider_config_path(self) -> Optional[str]:
        """Get path to provider configuration file"""
        # Check multiple possible locations
        possible_paths = [
            'config/ai_services/providers.yaml',
            'config/providers.yaml',
            '../config/ai_services/providers.yaml',
            os.path.expanduser('~/.ai_bridge/providers.yaml')
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return path
        
        return None
    
    def _load_environment_overrides(self):
        """Load configuration overrides from environment variables"""
        # AI Bridge settings
        if os.getenv('AI_BRIDGE_ENABLED'):
            self.config['ai_bridge']['enabled'] = os.getenv('AI_BRIDGE_ENABLED').lower() == 'true'
        
        if os.getenv('AI_BRIDGE_LOG_LEVEL'):
            self.config['ai_bridge']['log_level'] = os.getenv('AI_BRIDGE_LOG_LEVEL')
        
        if os.getenv('AI_BRIDGE_MAX_CONCURRENT_TASKS'):
            self.config['ai_bridge']['max_concurrent_tasks'] = int(os.getenv('AI_BRIDGE_MAX_CONCURRENT_TASKS'))
        
        # Provider API keys
        for provider_name in self.provider_configs:
            env_key = f'{provider_name.upper()}_API_KEY'
            if os.getenv(env_key):
                self.provider_configs[provider_name]['api_key'] = os.getenv(env_key)
                self.provider_configs[provider_name]['enabled'] = True
        
        # Provider-specific overrides
        for provider_name in self.provider_configs:
            # Model override
            model_env = f'{provider_name.upper()}_MODEL'
            if os.getenv(model_env):
                self.provider_configs[provider_name]['model'] = os.getenv(model_env)
            
            # Base URL override
            url_env = f'{provider_name.upper()}_BASE_URL'
            if os.getenv(url_env):
                self.provider_configs[provider_name]['base_url'] = os.getenv(url_env)
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value using dot notation"""
        keys = key.split('.')
        value = self.config
        
        try:
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return default
    
    def set(self, key: str, value: Any):
        """Set configuration value using dot notation"""
        keys = key.split('.')
        config = self.config
        
        # Navigate to parent
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        
        # Set value
        config[keys[-1]] = value
    
    def get_provider_configs(self) -> Dict[str, Dict[str, Any]]:
        """Get all provider configurations"""
        return self.provider_configs.copy()
    
    def get_provider_config(self, provider_name: str) -> Optional[Dict[str, Any]]:
        """Get configuration for a specific provider"""
        return self.provider_configs.get(provider_name)
    
    def update_provider_config(self, provider_name: str, config: Dict[str, Any]):
        """Update configuration for a specific provider"""
        if provider_name in self.provider_configs:
            self.provider_configs[provider_name].update(config)
        else:
            self.provider_configs[provider_name] = config
    
    def is_provider_enabled(self, provider_name: str) -> bool:
        """Check if a provider is enabled and configured"""
        config = self.provider_configs.get(provider_name, {})
        return (
            config.get('enabled', False) and 
            config.get('api_key') is not None
        )
    
    def get_enabled_providers(self) -> List[str]:
        """Get list of enabled provider names"""
        return [
            name for name, config in self.provider_configs.items()
            if self.is_provider_enabled(name)
        ]
    
    def save_config(self, config_path: Optional[str] = None):
        """Save current configuration to file"""
        save_path = config_path or self.config_path
        if not save_path:
            save_path = 'config/ai_bridge_config.yaml'
        
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            
            # Save main configuration
            with open(save_path, 'w') as f:
                yaml.dump(self.config, f, default_flow_style=False)
            
            # Save provider configurations
            provider_config_path = save_path.replace('.yaml', '_providers.yaml')
            with open(provider_config_path, 'w') as f:
                # Remove sensitive data before saving
                safe_configs = {}
                for name, config in self.provider_configs.items():
                    safe_config = config.copy()
                    if 'api_key' in safe_config:
                        safe_config['api_key'] = '***REDACTED***' if safe_config['api_key'] else None
                    safe_configs[name] = safe_config
                
                yaml.dump(safe_configs, f, default_flow_style=False)
            
            logger.info(f"Configuration saved to {save_path}")
            
        except Exception as e:
            logger.error(f"Failed to save configuration: {e}")
    
    def validate_config(self) -> Dict[str, List[str]]:
        """Validate configuration and return any issues"""
        issues = {
            'errors': [],
            'warnings': []
        }
        
        # Check required settings
        if not self.get('ai_bridge.enabled'):
            issues['warnings'].append("AI Bridge is disabled")
        
        # Check provider configurations
        enabled_providers = self.get_enabled_providers()
        if not enabled_providers:
            issues['errors'].append("No AI providers are enabled and configured")
        
        for provider_name in enabled_providers:
            config = self.provider_configs[provider_name]
            
            if not config.get('api_key'):
                issues['errors'].append(f"Provider {provider_name} is enabled but has no API key")
            
            if not config.get('model'):
                issues['warnings'].append(f"Provider {provider_name} has no model specified")
        
        # Check processing settings
        max_concurrent = self.get('ai_bridge.max_concurrent_tasks', 0)
        if max_concurrent <= 0:
            issues['warnings'].append("Max concurrent tasks should be greater than 0")
        
        num_workers = self.get('processing.num_workers', 0)
        if num_workers <= 0:
            issues['warnings'].append("Number of workers should be greater than 0")
        
        return issues
    
    def get_config_summary(self) -> Dict[str, Any]:
        """Get a summary of current configuration"""
        enabled_providers = self.get_enabled_providers()
        
        return {
            'ai_bridge_enabled': self.get('ai_bridge.enabled'),
            'enabled_providers': enabled_providers,
            'provider_count': len(enabled_providers),
            'max_concurrent_tasks': self.get('ai_bridge.max_concurrent_tasks'),
            'num_workers': self.get('processing.num_workers'),
            'collaboration_enabled': self.get('collaboration.enabled'),
            'monitoring_enabled': self.get('monitoring.metrics_enabled'),
            'config_path': self.config_path
        }
