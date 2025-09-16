
"""
Test AI API Configuration Manager
=================================

Tests for the AI API configuration interface and integration.
"""

import pytest
import json
from unittest.mock import Mock, patch, AsyncMock
from flask import Flask

from ui.ai_api_config_manager import AIAPIConfigManager

class TestAIAPIConfigManager:
    """Test cases for AI API Configuration Manager"""
    
    def setup_method(self):
        """Setup test environment"""
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True
        self.app.config['SECRET_KEY'] = 'test-secret-key'
        
        # Set template folder
        import os
        template_dir = os.path.join(os.path.dirname(__file__), '..', 'ui', 'templates')
        self.app.template_folder = template_dir
        
        # Mock config manager
        self.mock_config_manager = Mock()
        self.mock_config_manager.get_provider_configs.return_value = {
            'openai': {
                'enabled': True,
                'name': 'OpenAI',
                'api_key': 'test-key',
                'model': 'gpt-4',
                'max_tokens': 4000,
                'temperature': 0.7,
                'timeout': 30,
                'base_url': 'https://api.openai.com/v1',
                'rate_limit_rpm': 500,
                'rate_limit_tpm': 30000
            },
            'anthropic': {
                'enabled': False,
                'name': 'Anthropic Claude',
                'api_key': None,
                'model': 'claude-3-sonnet-20240229',
                'max_tokens': 4000,
                'temperature': 0.7,
                'timeout': 30,
                'base_url': 'https://api.anthropic.com/v1',
                'rate_limit_rpm': 1000,
                'rate_limit_tpm': 100000
            }
        }
        self.mock_config_manager.get_enabled_providers.return_value = ['openai']
        self.mock_config_manager.get.return_value = True
        
        # Create API config manager with mock
        self.api_config_manager = AIAPIConfigManager(self.mock_config_manager)
        
        # Register blueprint
        self.app.register_blueprint(self.api_config_manager.get_blueprint())
        
        self.client = self.app.test_client()
    
    def test_api_config_page_loads(self):
        """Test that the API configuration page loads successfully"""
        with self.app.app_context():
            response = self.client.get('/ai-agent/api-config')
            assert response.status_code == 200
            assert b'AI API Configuration' in response.data
            assert b'OpenAI' in response.data
            assert b'Anthropic Claude' in response.data
    
    def test_get_providers_api(self):
        """Test the get providers API endpoint"""
        response = self.client.get('/ai-agent/api/providers')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'providers' in data
        assert 'openai' in data['providers']
        assert 'anthropic' in data['providers']
        
        # Check that API keys are redacted
        assert data['providers']['openai']['api_key'] == '***REDACTED***'
    
    def test_update_provider_config(self):
        """Test updating provider configuration"""
        config_data = {
            'enabled': True,
            'api_key': 'new-test-key',
            'model': 'gpt-4-turbo',
            'max_tokens': 8000,
            'temperature': 0.5
        }
        
        response = self.client.post(
            '/ai-agent/api/providers/openai/config',
            data=json.dumps(config_data),
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        
        # Verify config manager was called
        self.mock_config_manager.update_provider_config.assert_called_once_with('openai', config_data)
        self.mock_config_manager.save_config.assert_called_once()
    
    def test_update_provider_config_validation(self):
        """Test validation when updating provider configuration"""
        # Test missing API key for enabled provider
        config_data = {
            'enabled': True,
            'api_key': '',  # Empty API key
            'model': 'gpt-4'
        }
        
        response = self.client.post(
            '/ai-agent/api/providers/openai/config',
            data=json.dumps(config_data),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False
        assert 'API key is required' in data['error']
    
    @patch('ui.ai_api_config_manager.OpenAIProvider')
    def test_test_provider_connection_success(self, mock_provider_class):
        """Test successful provider connection test"""
        # Mock provider instance
        mock_provider = AsyncMock()
        mock_provider.health_check.return_value = True
        mock_provider.process_task.return_value = Mock(
            success=True,
            content='Connection test successful'
        )
        mock_provider_class.return_value = mock_provider
        
        test_data = {
            'api_key': 'test-key',
            'model': 'gpt-4',
            'base_url': 'https://api.openai.com/v1'
        }
        
        with patch('asyncio.run') as mock_run:
            # Mock the async calls
            mock_run.side_effect = [True, Mock(success=True, content='Connection test successful')]
            
            response = self.client.post(
                '/ai-agent/api/providers/openai/test',
                data=json.dumps(test_data),
                content_type='application/json'
            )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'response_time' in data
    
    def test_test_provider_connection_missing_key(self):
        """Test provider connection test with missing API key"""
        test_data = {
            'model': 'gpt-4',
            'base_url': 'https://api.openai.com/v1'
            # Missing api_key
        }
        
        response = self.client.post(
            '/ai-agent/api/providers/openai/test',
            data=json.dumps(test_data),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False
        assert 'API key is required' in data['error']
    
    def test_add_custom_provider(self):
        """Test adding a custom provider"""
        provider_data = {
            'name': 'Custom AI',
            'base_url': 'https://api.custom.ai/v1',
            'model': 'custom-model',
            'max_tokens': 2000
        }
        
        response = self.client.post(
            '/ai-agent/api/providers/add',
            data=json.dumps(provider_data),
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'custom_ai' in data['provider_name']
        
        # Verify config manager was called
        self.mock_config_manager.update_provider_config.assert_called()
        self.mock_config_manager.save_config.assert_called()
    
    def test_add_custom_provider_validation(self):
        """Test validation when adding custom provider"""
        # Test missing required fields
        provider_data = {
            'name': 'Custom AI'
            # Missing base_url
        }
        
        response = self.client.post(
            '/ai-agent/api/providers/add',
            data=json.dumps(provider_data),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False
        assert 'base URL are required' in data['error']
    
    def test_delete_custom_provider(self):
        """Test deleting a custom provider"""
        # Add custom provider to config
        self.mock_config_manager.provider_configs = {
            'custom_provider': {'name': 'Custom Provider'}
        }
        
        response = self.client.delete('/ai-agent/api/providers/custom_provider')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        
        # Verify provider was removed
        assert 'custom_provider' not in self.mock_config_manager.provider_configs
        self.mock_config_manager.save_config.assert_called()
    
    def test_delete_builtin_provider_forbidden(self):
        """Test that built-in providers cannot be deleted"""
        response = self.client.delete('/ai-agent/api/providers/openai')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False
        assert 'Cannot delete built-in providers' in data['error']
    
    def test_get_system_status(self):
        """Test getting system status"""
        self.mock_config_manager.get_config_summary.return_value = {
            'ai_bridge_enabled': True,
            'enabled_providers': ['openai'],
            'provider_count': 1,
            'max_concurrent_tasks': 10,
            'collaboration_enabled': True,
            'monitoring_enabled': True
        }
        self.mock_config_manager.validate_config.return_value = {
            'errors': [],
            'warnings': ['Test warning']
        }
        
        response = self.client.get('/ai-agent/api/system/status')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert data['status']['ai_bridge_enabled'] is True
        assert data['status']['provider_count'] == 1
        assert len(data['status']['validation_issues']['warnings']) == 1

if __name__ == '__main__':
    pytest.main([__file__])
