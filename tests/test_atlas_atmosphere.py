
"""
Unit tests for Atlas Atmosphere Controller
"""

import pytest
import requests
from unittest.mock import Mock, patch, MagicMock
from devices.atlas_atmosphere import AtlasAtmosphereController, AtmosphereZone

class TestAtlasAtmosphereController:
    
    def setup_method(self):
        """Setup test fixtures"""
        self.controller = AtlasAtmosphereController("192.168.1.50", 80)
    
    def test_initialization(self):
        """Test controller initialization"""
        assert self.controller.host == "192.168.1.50"
        assert self.controller.port == 80
        assert self.controller.connected == False
        assert len(self.controller.zones) == 0
    
    @patch('requests.get')
    def test_connect_success(self, mock_get):
        """Test successful connection"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"zones": []}
        mock_get.return_value = mock_response
        
        with patch.object(self.controller, '_start_websocket'):
            result = self.controller.connect()
        
        assert result == True
        assert self.controller.connected == True
    
    @patch('requests.put')
    def test_set_zone_volume(self, mock_put):
        """Test volume control"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_put.return_value = mock_response
        self.controller.connected = True
        
        result = self.controller.set_zone_volume(1, 0.7)
        
        assert result == True
        mock_put.assert_called_once()
    
    @patch('requests.put')
    def test_mute_zone(self, mock_put):
        """Test mute control"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_put.return_value = mock_response
        self.controller.connected = True
        
        result = self.controller.mute_zone(1, True)
        
        assert result == True
        mock_put.assert_called_once()
