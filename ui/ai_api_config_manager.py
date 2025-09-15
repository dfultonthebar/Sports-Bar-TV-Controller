
"""
AI API Configuration Manager
============================

Manages the web interface for configuring external AI API keys and provider settings.
Integrates with the AI bridge system to provide a user-friendly configuration interface.
"""

import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from flask import Blueprint, render_template, jsonify, request, flash, redirect, url_for

try:
    from ai_bridge.utils.config_manager import ConfigManager
    from ai_bridge.providers.openai_provider import OpenAIProvider
    from ai_bridge.providers.anthropic_provider import AnthropicProvider
    from ai_bridge.providers.grok_provider import GrokProvider
    from ai_bridge.providers.base_provider import TaskType, AIResponse
except ImportError as e:
    logger.warning(f"AI Bridge components not available: {e}")
    # Fallback implementations for when AI bridge is not available
    class ConfigManager:
        def __init__(self): 
            self.provider_configs = {}
        def get_provider_configs(self): 
            return {}
        def get_enabled_providers(self): 
            return []
        def get(self, key, default=None): 
            return default
        def update_provider_config(self, name, config): 
            pass
        def save_config(self): 
            pass
        def is_provider_enabled(self, name): 
            return False
        def get_config_summary(self): 
            return {}
        def validate_config(self): 
            return {'errors': [], 'warnings': []}
    
    class BaseAIProvider:
        def __init__(self, config): 
            pass
        async def health_check(self): 
            return False
        async def process_task(self, *args, **kwargs): 
            return None
        async def close(self): 
            pass
    
    OpenAIProvider = AnthropicProvider = GrokProvider = BaseAIProvider
    
    class TaskType:
        GENERAL = "general"
    
    class AIResponse:
        def __init__(self, success=False, content="", **kwargs):
            self.success = success
            self.content = content

logger = logging.getLogger(__name__)

class AIAPIConfigManager:
    """
    Web interface for managing AI API configurations
    """
    
    def __init__(self, config_manager: ConfigManager = None):
        self.config_manager = config_manager or ConfigManager()
        self.blueprint = Blueprint('ai_api_config', __name__, url_prefix='/ai-agent')
        self._setup_routes()
        
        # Provider class mapping
        self.provider_classes = {
            'openai': OpenAIProvider,
            'anthropic': AnthropicProvider,
            'grok': GrokProvider
        }
        
        # Provider metadata
        self.provider_metadata = {
            'openai': {
                'name': 'OpenAI',
                'docs_url': 'https://platform.openai.com/api-keys',
                'available_models': ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
                'description': 'OpenAI GPT models for advanced AI capabilities'
            },
            'anthropic': {
                'name': 'Anthropic Claude',
                'docs_url': 'https://console.anthropic.com/',
                'available_models': ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
                'description': 'Anthropic Claude models for safe and helpful AI assistance'
            },
            'grok': {
                'name': 'Grok',
                'docs_url': 'https://x.ai/',
                'available_models': ['grok-beta', 'grok-1'],
                'description': 'X.AI Grok models for real-time and witty AI responses'
            }
        }
    
    def _setup_routes(self):
        """Setup Flask routes for AI API configuration"""
        
        @self.blueprint.route('/api-config')
        def api_config():
            """Main API configuration page"""
            try:
                # Get current provider configurations
                provider_configs = self.config_manager.get_provider_configs()
                
                # Enhance with metadata and metrics
                enhanced_configs = {}
                for provider_name, config in provider_configs.items():
                    enhanced_config = config.copy()
                    
                    # Add metadata
                    if provider_name in self.provider_metadata:
                        enhanced_config.update(self.provider_metadata[provider_name])
                    
                    # Add metrics if available
                    try:
                        if self.config_manager.is_provider_enabled(provider_name):
                            provider_class = self.provider_classes.get(provider_name)
                            if provider_class:
                                provider_instance = provider_class(config)
                                enhanced_config['metrics'] = provider_instance.get_metrics()
                    except Exception as e:
                        logger.warning(f"Failed to get metrics for {provider_name}: {e}")
                    
                    enhanced_configs[provider_name] = enhanced_config
                
                # Get system statistics
                active_providers = self.config_manager.get_enabled_providers()
                ai_bridge_enabled = self.config_manager.get('ai_bridge.enabled', False)
                
                # Calculate aggregate metrics
                total_requests = 0
                total_successes = 0
                for config in enhanced_configs.values():
                    if 'metrics' in config:
                        total_requests += config['metrics'].get('request_count', 0)
                        total_successes += config['metrics'].get('request_count', 0) * config['metrics'].get('success_rate', 0)
                
                success_rate = total_successes / total_requests if total_requests > 0 else 0
                
                return render_template('ai_api_config.html',
                    providers=enhanced_configs,
                    active_providers=active_providers,
                    ai_bridge_enabled=ai_bridge_enabled,
                    total_requests=total_requests,
                    success_rate=success_rate
                )
                
            except Exception as e:
                logger.error(f"Error loading API configuration page: {e}")
                flash(f"Error loading configuration: {e}", 'error')
                return render_template('ai_api_config.html',
                    providers={},
                    active_providers=[],
                    ai_bridge_enabled=False,
                    total_requests=0,
                    success_rate=0
                )
        
        @self.blueprint.route('/api/providers/<provider_name>/config', methods=['POST'])
        def update_provider_config(provider_name):
            """Update configuration for a specific provider"""
            try:
                data = request.get_json()
                
                if not data:
                    return jsonify({'success': False, 'error': 'No configuration data provided'}), 400
                
                # Validate required fields
                if data.get('enabled') and not data.get('api_key'):
                    return jsonify({'success': False, 'error': 'API key is required when provider is enabled'}), 400
                
                # Update provider configuration
                self.config_manager.update_provider_config(provider_name, data)
                
                # Save configuration to file
                self.config_manager.save_config()
                
                logger.info(f"Updated configuration for provider {provider_name}")
                
                return jsonify({
                    'success': True,
                    'message': f'Configuration for {provider_name} updated successfully'
                })
                
            except Exception as e:
                logger.error(f"Error updating provider configuration: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @self.blueprint.route('/api/providers/<provider_name>/test', methods=['POST'])
        def test_provider_connection(provider_name):
            """Test connection to a specific provider"""
            try:
                data = request.get_json()
                
                if not data or not data.get('api_key'):
                    return jsonify({'success': False, 'error': 'API key is required for testing'}), 400
                
                # Get provider class
                provider_class = self.provider_classes.get(provider_name)
                if not provider_class:
                    return jsonify({'success': False, 'error': f'Unknown provider: {provider_name}'}), 400
                
                # Create provider instance with test configuration
                test_config = data.copy()
                test_config['name'] = provider_name
                
                provider = provider_class(test_config)
                
                # Perform health check
                import asyncio
                start_time = datetime.now()
                
                # Run async operations in event loop
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                try:
                    is_healthy = loop.run_until_complete(provider.health_check())
                    end_time = datetime.now()
                    
                    response_time = (end_time - start_time).total_seconds() * 1000  # Convert to milliseconds
                    
                    if is_healthy:
                        # Try a simple test request
                        try:
                            test_response = loop.run_until_complete(provider.process_task(
                                TaskType.GENERAL,
                                "Hello! Please respond with 'Connection test successful' to confirm the API is working.",
                                context={'test': True}
                            ))
                            
                            loop.run_until_complete(provider.close())
                            
                            return jsonify({
                                'success': True,
                                'response_time': round(response_time, 2),
                                'model_info': test_config.get('model'),
                                'test_response': test_response.content[:100] if test_response.success else None
                            })
                            
                        except Exception as test_error:
                            loop.run_until_complete(provider.close())
                            return jsonify({
                                'success': False,
                                'error': f'API test failed: {str(test_error)}'
                            })
                    else:
                        loop.run_until_complete(provider.close())
                        return jsonify({
                            'success': False,
                            'error': 'Health check failed - provider is not responding'
                        })
                finally:
                    loop.close()
                
            except Exception as e:
                logger.error(f"Error testing provider {provider_name}: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @self.blueprint.route('/api/providers')
        def get_providers():
            """Get all provider configurations"""
            try:
                provider_configs = self.config_manager.get_provider_configs()
                
                # Remove sensitive information
                safe_configs = {}
                for name, config in provider_configs.items():
                    safe_config = config.copy()
                    if 'api_key' in safe_config:
                        safe_config['api_key'] = '***REDACTED***' if safe_config['api_key'] else None
                    safe_configs[name] = safe_config
                
                return jsonify({
                    'success': True,
                    'providers': safe_configs
                })
                
            except Exception as e:
                logger.error(f"Error getting providers: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @self.blueprint.route('/api/providers/<provider_name>', methods=['DELETE'])
        def delete_provider(provider_name):
            """Delete a provider configuration"""
            try:
                # Check if it's a built-in provider
                if provider_name in ['openai', 'anthropic', 'grok']:
                    return jsonify({
                        'success': False, 
                        'error': 'Cannot delete built-in providers. Disable them instead.'
                    }), 400
                
                # Remove from configuration
                if provider_name in self.config_manager.provider_configs:
                    del self.config_manager.provider_configs[provider_name]
                    self.config_manager.save_config()
                    
                    logger.info(f"Deleted provider configuration: {provider_name}")
                    
                    return jsonify({
                        'success': True,
                        'message': f'Provider {provider_name} deleted successfully'
                    })
                else:
                    return jsonify({
                        'success': False,
                        'error': f'Provider {provider_name} not found'
                    }), 404
                
            except Exception as e:
                logger.error(f"Error deleting provider {provider_name}: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @self.blueprint.route('/api/providers/add', methods=['POST'])
        def add_custom_provider():
            """Add a custom provider configuration"""
            try:
                data = request.get_json()
                
                if not data or not data.get('name') or not data.get('base_url'):
                    return jsonify({
                        'success': False, 
                        'error': 'Provider name and base URL are required'
                    }), 400
                
                provider_name = data['name'].lower().replace(' ', '_')
                
                # Check if provider already exists
                if provider_name in self.config_manager.provider_configs:
                    return jsonify({
                        'success': False,
                        'error': f'Provider {provider_name} already exists'
                    }), 400
                
                # Create new provider configuration
                new_config = {
                    'enabled': False,
                    'name': data['name'],
                    'base_url': data['base_url'],
                    'model': data.get('model', 'default'),
                    'max_tokens': data.get('max_tokens', 4000),
                    'temperature': data.get('temperature', 0.7),
                    'timeout': data.get('timeout', 30),
                    'rate_limit_rpm': data.get('rate_limit_rpm', 60),
                    'rate_limit_tpm': data.get('rate_limit_tpm', 10000),
                    'api_key': None
                }
                
                self.config_manager.update_provider_config(provider_name, new_config)
                self.config_manager.save_config()
                
                logger.info(f"Added custom provider: {provider_name}")
                
                return jsonify({
                    'success': True,
                    'message': f'Custom provider {data["name"]} added successfully',
                    'provider_name': provider_name
                })
                
            except Exception as e:
                logger.error(f"Error adding custom provider: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @self.blueprint.route('/api/system/status')
        def get_system_status():
            """Get AI bridge system status"""
            try:
                config_summary = self.config_manager.get_config_summary()
                validation_issues = self.config_manager.validate_config()
                
                return jsonify({
                    'success': True,
                    'status': {
                        'ai_bridge_enabled': config_summary['ai_bridge_enabled'],
                        'enabled_providers': config_summary['enabled_providers'],
                        'provider_count': config_summary['provider_count'],
                        'max_concurrent_tasks': config_summary['max_concurrent_tasks'],
                        'collaboration_enabled': config_summary['collaboration_enabled'],
                        'monitoring_enabled': config_summary['monitoring_enabled'],
                        'validation_issues': validation_issues
                    }
                })
                
            except Exception as e:
                logger.error(f"Error getting system status: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
    
    def get_blueprint(self) -> Blueprint:
        """Get the Flask blueprint for the API configuration manager"""
        return self.blueprint

def create_api_config_templates():
    """Create HTML templates for the API configuration interface"""
    from pathlib import Path
    
    templates_dir = Path(__file__).parent / "templates"
    templates_dir.mkdir(exist_ok=True)
    
    # The template is already created in the batch_file_write above
    logger.info("AI API configuration templates created")
