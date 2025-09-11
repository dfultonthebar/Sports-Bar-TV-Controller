
"""
Unit tests for Wolfpack Controller
"""

import pytest
import socket
from unittest.mock import Mock, patch, MagicMock
from devices.wolfpack_controller import WolfpackController, WolfpackRoute

class TestWolfpackController:
    
    def setup_method(self):
        """Setup test fixtures"""
        self.controller = WolfpackController("192.168.1.70", 5000)
    
    def test_initialization(self):
        """Test controller initialization"""
        assert self.controller.host == "192.168.1.70"
        assert self.controller.port == 5000
        assert self.controller.connected == False
        assert len(self.controller.routes) == 0
    
    @patch('socket.socket')
    def test_connect_success(self, mock_socket):
        """Test successful connection"""
        mock_sock = Mock()
        mock_socket.return_value = mock_sock
        
        result = self.controller.connect()
        
        assert result == True
        assert self.controller.connected == True
        mock_sock.connect.assert_called_once_with(("192.168.1.70", 5000))
    
    @patch('socket.socket')
    def test_connect_failure(self, mock_socket):
        """Test connection failure"""
        mock_sock = Mock()
        mock_sock.connect.side_effect = socket.error("Connection failed")
        mock_socket.return_value = mock_sock
        
        result = self.controller.connect()
        
        assert result == False
        assert self.controller.connected == False
    
    def test_switch_input_to_output(self):
        """Test video switching"""
        with patch.object(self.controller, '_send_command') as mock_send:
            mock_send.return_value = "OK"
            self.controller.connected = True
            
            result = self.controller.switch_input_to_output(1, 2)
            
            assert result == True
            mock_send.assert_called_once_with("SWI01O02")
            assert 2 in self.controller.routes
            assert self.controller.routes[2].input == 1
    
    def test_recall_preset(self):
        """Test preset recall"""
        with patch.object(self.controller, '_send_command') as mock_send:
            mock_send.return_value = "OK"
            self.controller.connected = True
            
            result = self.controller.recall_preset(5)
            
            assert result == True
            mock_send.assert_called_once_with("PR05")
