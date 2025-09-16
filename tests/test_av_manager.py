
"""
Unit tests for AV Manager
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from core.av_manager import AVManager, AVMapping, AVPreset

class TestAVManager:
    
    def setup_method(self):
        """Setup test fixtures"""
        with patch.object(AVManager, 'load_configuration'):
            self.av_manager = AVManager("test_config.yaml")
    
    def test_initialization(self):
        """Test AV manager initialization"""
        assert self.av_manager.sync_enabled == True
        assert len(self.av_manager.mappings) == 0
        assert len(self.av_manager.presets) == 0
    
    def test_sync_toggle(self):
        """Test sync enable/disable"""
        self.av_manager.set_sync_enabled(False)
        assert self.av_manager.sync_enabled == False
        
        self.av_manager.set_sync_enabled(True)
        assert self.av_manager.sync_enabled == True
    
    def test_preset_recall(self):
        """Test preset recall functionality"""
        # Create test preset
        preset = AVPreset(
            id=1,
            name="Test Preset",
            description="Test",
            video_routes={1: 1, 2: 2},
            audio_routes={1: 1, 2: 2},
            audio_volumes={1: 0.7, 2: 0.7},
            audio_mutes={1: False, 2: False}
        )
        self.av_manager.presets[1] = preset
        
        # Mock devices
        self.av_manager.wolfpack = Mock()
        self.av_manager.wolfpack.connected = True
        self.av_manager.wolfpack.switch_input_to_output.return_value = True
        
        self.av_manager.atmosphere = Mock()
        self.av_manager.atmosphere.connected = True
        self.av_manager.atmosphere.route_source_to_zone.return_value = True
        self.av_manager.atmosphere.set_zone_volume.return_value = True
        self.av_manager.atmosphere.mute_zone.return_value = True
        
        result = self.av_manager.recall_preset(1)
        
        assert result == True
        assert self.av_manager.wolfpack.switch_input_to_output.call_count == 2
        assert self.av_manager.atmosphere.route_source_to_zone.call_count == 2
