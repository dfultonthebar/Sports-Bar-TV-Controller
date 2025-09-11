"""
Atlas Audio Label Management Web Interface
Flask blueprint for managing Atlas Atmosphere input/output labels and hardware sync
"""

from flask import Blueprint, render_template, request, jsonify, redirect, url_for
import json
import logging
from pathlib import Path
from typing import Dict, Any
from devices.atlas_atmosphere import AtlasAtmosphereController

# Configure logging
logger = logging.getLogger(__name__)

class AtlasWebLabelManager:
    """
    Web Label Management System for Atlas Atmosphere Audio Controller
    Handles web interface for CRUD operations and hardware sync
    """
    
    def __init__(self, labels_file: str = "config/atlas_labels.json", atlas_host: str = "192.168.1.50"):
        self.labels_file = labels_file
        self.atlas_host = atlas_host
        self.atlas_controller = None
        self.labels_data = {}
        self.load_labels()
    
    def get_atlas_controller(self):
        """Get or create Atlas controller instance"""
        if not self.atlas_controller:
            self.atlas_controller = AtlasAtmosphereController(self.atlas_host)
        return self.atlas_controller
    
    def load_labels(self):
        """Load labels from file"""
        try:
            if Path(self.labels_file).exists():
                with open(self.labels_file, 'r') as f:
                    self.labels_data = json.load(f)
            else:
                self.create_default_labels()
                self.save_labels()
        except Exception as e:
            logger.error(f"Failed to load Atlas labels: {e}")
            self.create_default_labels()
    
    def create_default_labels(self):
        """Create default labels structure for Atlas Atmosphere"""
        self.labels_data = {
            'inputs': {str(i): f"Audio Input {i}" for i in range(1, 17)},  # 16 audio inputs
            'outputs': {str(i): f"Zone {i}" for i in range(1, 9)},  # 8 audio zones
            'device_info': {
                'model': 'Atlas Atmosphere',
                'total_inputs': 16,
                'total_outputs': 8,
                'last_updated': '',
                'hardware_sync_enabled': True
            }
        }
    
    def save_labels(self):
        """Save labels to file"""
        try:
            Path(self.labels_file).parent.mkdir(parents=True, exist_ok=True)
            import time
            self.labels_data['device_info']['last_updated'] = time.strftime('%Y-%m-%d %H:%M:%S')
            with open(self.labels_file, 'w') as f:
                json.dump(self.labels_data, f, indent=2)
            logger.info(f"Saved Atlas labels to {self.labels_file}")
        except Exception as e:
            logger.error(f"Failed to save Atlas labels: {e}")
    
    def get_all_labels(self) -> Dict[str, Any]:
        """Get all labels"""
        return self.labels_data.copy()
    
    def update_input_label(self, input_num: int, label: str):
        """Update input label"""
        if 1 <= input_num <= 16:
            self.labels_data['inputs'][str(input_num)] = label
            self.save_labels()
            return True
        return False
    
    def update_output_label(self, output_num: int, label: str):
        """Update output label (zone)"""
        if 1 <= output_num <= 8:
            self.labels_data['outputs'][str(output_num)] = label
            self.save_labels()
            return True
        return False
    
    def bulk_update_labels(self, input_labels: Dict[str, str] = None, output_labels: Dict[str, str] = None):
        """Bulk update labels"""
        if input_labels:
            for input_num, label in input_labels.items():
                if 1 <= int(input_num) <= 16:
                    self.labels_data['inputs'][input_num] = label
        if output_labels:
            for output_num, label in output_labels.items():
                if 1 <= int(output_num) <= 8:
                    self.labels_data['outputs'][output_num] = label
        self.save_labels()
    
    def sync_with_hardware(self, direction: str = "upload") -> bool:
        """
        Sync labels with Atlas hardware
        
        Args:
            direction: "upload" to send labels to hardware, "download" to get from hardware
            
        Returns:
            bool: Success status
        """
        try:
            controller = self.get_atlas_controller()
            
            if direction == "upload":
                # Update controller's label manager with current data
                controller.label_manager.labels_data = self.labels_data.copy()
                return controller.upload_labels_to_hardware()
            elif direction == "download":
                success = controller.sync_labels_from_hardware()
                if success:
                    # Update local data with synced labels
                    self.labels_data = controller.get_labels()
                    self.save_labels()
                return success
            else:
                logger.error(f"Invalid sync direction: {direction}")
                return False
                
        except Exception as e:
            logger.error(f"Hardware sync failed: {e}")
            return False

# Create Flask blueprint
atlas_label_bp = Blueprint('atlas_labels', __name__, url_prefix='/atlas/labels')
atlas_label_manager = AtlasWebLabelManager()

@atlas_label_bp.route('/')
def atlas_label_editor():
    """Main Atlas label editor page"""
    return render_template('atlas_label_editor.html')

@atlas_label_bp.route('/api/labels')
def get_atlas_labels():
    """API endpoint to get all Atlas labels"""
    try:
        labels = atlas_label_manager.get_all_labels()
        return jsonify(labels)
    except Exception as e:
        logger.error(f"Get Atlas labels API error: {e}")
        return jsonify({'error': str(e)}), 500

@atlas_label_bp.route('/api/labels/input/<int:input_num>', methods=['PUT'])
def update_atlas_input_label(input_num):
    """API endpoint to update Atlas input label"""
    try:
        data = request.get_json()
        label = data.get('label', '').strip()
        
        if not label:
            return jsonify({'error': 'Label cannot be empty'}), 400
        
        if not (1 <= input_num <= 16):
            return jsonify({'error': 'Input number must be between 1 and 16'}), 400
        
        success = atlas_label_manager.update_input_label(input_num, label)
        if success:
            return jsonify({'success': True, 'input': input_num, 'label': label})
        else:
            return jsonify({'error': 'Failed to update input label'}), 500
    
    except Exception as e:
        logger.error(f"Update Atlas input label API error: {e}")
        return jsonify({'error': str(e)}), 500

@atlas_label_bp.route('/api/labels/output/<int:output_num>', methods=['PUT'])
def update_atlas_output_label(output_num):
    """API endpoint to update Atlas output label (zone)"""
    try:
        data = request.get_json()
        label = data.get('label', '').strip()
        
        if not label:
            return jsonify({'error': 'Label cannot be empty'}), 400
        
        if not (1 <= output_num <= 8):
            return jsonify({'error': 'Zone number must be between 1 and 8'}), 400
        
        success = atlas_label_manager.update_output_label(output_num, label)
        if success:
            return jsonify({'success': True, 'output': output_num, 'label': label})
        else:
            return jsonify({'error': 'Failed to update zone label'}), 500
    
    except Exception as e:
        logger.error(f"Update Atlas output label API error: {e}")
        return jsonify({'error': str(e)}), 500

@atlas_label_bp.route('/api/labels/bulk', methods=['PUT'])
def bulk_update_atlas_labels():
    """API endpoint for bulk Atlas label updates"""
    try:
        data = request.get_json()
        input_labels = data.get('inputs', {})
        output_labels = data.get('outputs', {})
        
        # Validate input labels
        for input_num, label in input_labels.items():
            if not (1 <= int(input_num) <= 16):
                return jsonify({'error': f'Invalid input number: {input_num}'}), 400
            if not label.strip():
                return jsonify({'error': f'Empty label for input {input_num}'}), 400
        
        # Validate output labels
        for output_num, label in output_labels.items():
            if not (1 <= int(output_num) <= 8):
                return jsonify({'error': f'Invalid zone number: {output_num}'}), 400
            if not label.strip():
                return jsonify({'error': f'Empty label for zone {output_num}'}), 400
        
        atlas_label_manager.bulk_update_labels(input_labels, output_labels)
        return jsonify({'success': True, 'updated_inputs': len(input_labels), 'updated_outputs': len(output_labels)})
    
    except Exception as e:
        logger.error(f"Bulk update Atlas labels API error: {e}")
        return jsonify({'error': str(e)}), 500

@atlas_label_bp.route('/api/hardware/sync', methods=['POST'])
def sync_atlas_hardware():
    """API endpoint to sync labels with Atlas hardware"""
    try:
        data = request.get_json()
        direction = data.get('direction', 'upload')  # 'upload' or 'download'
        
        if direction not in ['upload', 'download']:
            return jsonify({'error': 'Direction must be "upload" or "download"'}), 400
        
        success = atlas_label_manager.sync_with_hardware(direction)
        
        if success:
            action = "uploaded to" if direction == "upload" else "downloaded from"
            return jsonify({'success': True, 'message': f'Labels successfully {action} Atlas hardware'})
        else:
            return jsonify({'error': 'Hardware sync failed'}), 500
    
    except Exception as e:
        logger.error(f"Atlas hardware sync API error: {e}")
        return jsonify({'error': str(e)}), 500

@atlas_label_bp.route('/api/presets/audio-zones')
def get_atlas_audio_presets():
    """Get predefined audio zone preset templates"""
    try:
        presets = {
            'sports_bar_zones': {
                'name': 'Sports Bar Audio Zones',
                'description': 'Standard sports bar audio zone configuration',
                'inputs': {
                    '1': 'ESPN Audio Feed',
                    '2': 'Fox Sports Audio',
                    '3': 'NBC Sports Audio',
                    '4': 'Local Sports Radio',
                    '5': 'Background Music',
                    '6': 'Jukebox/Spotify',
                    '7': 'DJ Microphone',
                    '8': 'Announcements',
                    '9': 'Game Audio 1',
                    '10': 'Game Audio 2',
                    '11': 'Streaming Audio',
                    '12': 'Auxiliary Input',
                    '13': 'Karaoke System',
                    '14': 'Live Music',
                    '15': 'Weather Radio',
                    '16': 'Emergency Broadcast'
                },
                'outputs': {
                    '1': 'Main Bar Area',
                    '2': 'Dining Section',
                    '3': 'Patio/Outdoor',
                    '4': 'Pool Table Area',
                    '5': 'VIP Section',
                    '6': 'Kitchen/Staff',
                    '7': 'Restroom Area',
                    '8': 'Private Room'
                }
            },
            'restaurant_zones': {
                'name': 'Restaurant Audio Zones',
                'description': 'Restaurant-focused audio zone setup',
                'inputs': {
                    '1': 'Background Music',
                    '2': 'Dining Ambiance',
                    '3': 'Kitchen Audio',
                    '4': 'Host Station',
                    '5': 'Bar Music',
                    '6': 'Patio Music',
                    '7': 'Manager Mic',
                    '8': 'Announcements',
                    '9': 'Live Entertainment',
                    '10': 'Special Events',
                    '11': 'Streaming Service',
                    '12': 'Radio Station',
                    '13': 'Seasonal Music',
                    '14': 'Promotional Audio',
                    '15': 'Emergency Alert',
                    '16': 'Auxiliary'
                },
                'outputs': {
                    '1': 'Main Dining',
                    '2': 'Bar Seating',
                    '3': 'Outdoor Patio',
                    '4': 'Private Dining',
                    '5': 'Waiting Area',
                    '6': 'Kitchen',
                    '7': 'Staff Areas',
                    '8': 'Restrooms'
                }
            },
            'event_venue': {
                'name': 'Event Venue Setup',
                'description': 'Multi-purpose event venue configuration',
                'inputs': {
                    '1': 'Main PA System',
                    '2': 'Wireless Mic 1',
                    '3': 'Wireless Mic 2',
                    '4': 'DJ Input',
                    '5': 'Band/Live Music',
                    '6': 'Presentation Audio',
                    '7': 'Video Playback',
                    '8': 'Background Music',
                    '9': 'Ceremony Music',
                    '10': 'Dance Music',
                    '11': 'Ambient Sound',
                    '12': 'Special Effects',
                    '13': 'Announcements',
                    '14': 'Emergency System',
                    '15': 'Auxiliary 1',
                    '16': 'Auxiliary 2'
                },
                'outputs': {
                    '1': 'Main Event Space',
                    '2': 'Stage Area',
                    '3': 'Dance Floor',
                    '4': 'Bar Area',
                    '5': 'Lounge/VIP',
                    '6': 'Outdoor Space',
                    '7': 'Foyer/Entrance',
                    '8': 'Staff/Back of House'
                }
            }
        }
        
        return jsonify(presets)
    
    except Exception as e:
        logger.error(f"Atlas audio presets API error: {e}")
        return jsonify({'error': str(e)}), 500

@atlas_label_bp.route('/api/presets/apply/<preset_name>', methods=['POST'])
def apply_atlas_preset(preset_name):
    """Apply a preset template to Atlas labels"""
    try:
        # Get presets
        response = get_atlas_audio_presets()
        presets_data = response.get_json()
        
        if preset_name not in presets_data:
            return jsonify({'error': f'Preset "{preset_name}" not found'}), 404
        
        preset = presets_data[preset_name]
        
        # Apply the preset labels
        atlas_label_manager.bulk_update_labels(
            input_labels=preset.get('inputs', {}),
            output_labels=preset.get('outputs', {})
        )
        
        return jsonify({
            'success': True, 
            'message': f'Applied preset: {preset["name"]}',
            'description': preset['description']
        })
    
    except Exception as e:
        logger.error(f"Apply Atlas preset API error: {e}")
        return jsonify({'error': str(e)}), 500

# Template creation functions
def create_atlas_label_templates():
    """Create HTML templates for Atlas label management"""
    templates_dir = Path("ui/templates")
    templates_dir.mkdir(parents=True, exist_ok=True)
    
    # Atlas Label Editor Template
    atlas_label_editor_html = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Atlas Atmosphere - Audio Label Editor</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #2c1810 0%, #8B4513 50%, #D2691E 100%);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            color: #FFD700;
        }
        
        .header p {
            font-size: 1.2em;
            color: #FFA500;
        }
        
        .nav-tabs {
            display: flex;
            justify-content: center;
            margin-bottom: 30px;
            gap: 10px;
        }
        
        .nav-tab {
            padding: 12px 24px;
            background: rgba(255,165,0,0.2);
            border: 2px solid #FFD700;
            border-radius: 8px;
            color: white;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            transition: all 0.3s;
        }
        
        .nav-tab.active {
            background: rgba(255,215,0,0.3);
            border-color: #FFA500;
            box-shadow: 0 0 15px rgba(255,215,0,0.5);
        }
        
        .nav-tab:hover {
            background: rgba(255,165,0,0.3);
            transform: translateY(-2px);
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .labels-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        
        .labels-section {
            background: rgba(139,69,19,0.3);
            border: 2px solid #D2691E;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        
        .labels-section h2 {
            margin-bottom: 20px;
            text-align: center;
            font-size: 1.5em;
            color: #FFD700;
            border-bottom: 2px solid #FFA500;
            padding-bottom: 10px;
        }
        
        .device-info {
            background: rgba(255,215,0,0.1);
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
            border: 1px solid #FFD700;
        }
        
        .device-info h3 {
            color: #FFD700;
            margin-bottom: 10px;
        }
        
        .device-info p {
            color: #FFA500;
            margin: 5px 0;
        }
        
        .label-item {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
            gap: 15px;
        }
        
        .label-number {
            min-width: 50px;
            text-align: center;
            font-weight: bold;
            background: rgba(255,215,0,0.2);
            border: 1px solid #FFD700;
            padding: 8px;
            border-radius: 5px;
            color: #FFD700;
        }
        
        .label-input {
            flex: 1;
            padding: 10px;
            border: 2px solid #D2691E;
            border-radius: 5px;
            background: rgba(255,255,255,0.9);
            color: #333;
            font-size: 14px;
            font-weight: bold;
        }
        
        .label-input:focus {
            outline: none;
            border-color: #FFD700;
            box-shadow: 0 0 10px rgba(255,215,0,0.5);
        }
        
        .save-button {
            background: linear-gradient(45deg, #FFD700, #FFA500);
            color: #333;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }
        
        .save-button:hover {
            background: linear-gradient(45deg, #FFA500, #FF8C00);
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.4);
        }
        
        .bulk-actions {
            text-align: center;
            margin: 30px 0;
        }
        
        .bulk-button {
            background: linear-gradient(45deg, #8B4513, #D2691E);
            color: white;
            border: 2px solid #FFD700;
            padding: 15px 30px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            margin: 0 10px 10px 10px;
            transition: all 0.3s;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        
        .bulk-button:hover {
            background: linear-gradient(45deg, #D2691E, #FF8C00);
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.4);
        }
        
        .hardware-sync {
            background: rgba(255,215,0,0.1);
            border: 2px solid #FFD700;
            padding: 20px;
            border-radius: 15px;
            margin: 20px 0;
            text-align: center;
        }
        
        .hardware-sync h3 {
            color: #FFD700;
            margin-bottom: 15px;
        }
        
        .sync-button {
            background: linear-gradient(45deg, #32CD32, #228B22);
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            margin: 0 10px;
            transition: all 0.3s;
        }
        
        .sync-button:hover {
            background: linear-gradient(45deg, #228B22, #006400);
            transform: translateY(-2px);
        }
        
        .sync-button.download {
            background: linear-gradient(45deg, #4169E1, #0000CD);
        }
        
        .sync-button.download:hover {
            background: linear-gradient(45deg, #0000CD, #000080);
        }
        
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            transform: translateX(400px);
            transition: transform 0.3s;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        
        .notification.show {
            transform: translateX(0);
        }
        
        .notification.success {
            background: linear-gradient(45deg, #32CD32, #228B22);
        }
        
        .notification.error {
            background: linear-gradient(45deg, #DC143C, #B22222);
        }
        
        .search-box {
            width: 100%;
            padding: 12px;
            margin-bottom: 20px;
            border: 2px solid #D2691E;
            border-radius: 8px;
            background: rgba(255,255,255,0.9);
            color: #333;
            font-size: 16px;
            font-weight: bold;
        }
        
        .search-box::placeholder {
            color: #666;
        }
        
        .search-box:focus {
            outline: none;
            border-color: #FFD700;
            box-shadow: 0 0 10px rgba(255,215,0,0.5);
        }
        
        @media (max-width: 768px) {
            .labels-grid {
                grid-template-columns: 1fr;
            }
            
            .nav-tabs {
                flex-direction: column;
                align-items: center;
            }
            
            .label-item {
                flex-direction: column;
                align-items: stretch;
            }
            
            .label-number {
                text-align: left;
            }
            
            .bulk-button {
                display: block;
                margin: 10px auto;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎵 Atlas Atmosphere Audio Label Editor</h1>
            <p>Customize Audio Input and Zone Labels for Professional DSP Control</p>
        </div>
        
        <div class="nav-tabs">
            <button class="nav-tab active" onclick="showTab('labels')">Edit Labels</button>
            <button class="nav-tab" onclick="showTab('presets')">Audio Presets</button>
            <button class="nav-tab" onclick="showTab('hardware')">Hardware Sync</button>
        </div>
        
        <div id="labels-tab" class="tab-content active">
            <div class="device-info">
                <h3>🎛️ Atlas Atmosphere DSP</h3>
                <p><strong>Audio Inputs:</strong> 16 channels</p>
                <p><strong>Audio Zones:</strong> 8 zones</p>
                <p><strong>Last Updated:</strong> <span id="last-updated">Loading...</span></p>
            </div>
            
            <div class="labels-grid">
                <div class="labels-section">
                    <h2>🎤 Audio Input Sources</h2>
                    <input type="text" class="search-box" placeholder="Search audio inputs..." onkeyup="filterLabels('inputs', this.value)">
                    <div id="inputs-container">
                        <!-- Input labels will be loaded here -->
                    </div>
                </div>
                
                <div class="labels-section">
                    <h2>🔊 Audio Output Zones</h2>
                    <input type="text" class="search-box" placeholder="Search audio zones..." onkeyup="filterLabels('outputs', this.value)">
                    <div id="outputs-container">
                        <!-- Output labels will be loaded here -->
                    </div>
                </div>
            </div>
            
            <div class="bulk-actions">
                <button class="bulk-button" onclick="saveAllLabels()">💾 Save All Changes</button>
                <button class="bulk-button" onclick="resetToDefaults()">🔄 Reset to Defaults</button>
                <button class="bulk-button" onclick="exportLabels()">📤 Export Labels</button>
                <button class="bulk-button" onclick="importLabels()">📥 Import Labels</button>
            </div>
        </div>
        
        <div id="presets-tab" class="tab-content">
            <div style="text-align: center; padding: 50px;">
                <h2>⚡ Audio Zone Presets</h2>
                <p>Pre-configured audio labeling templates for different venue types</p>
                <button class="bulk-button" onclick="loadAudioPresets()">Load Audio Presets</button>
                <div id="presets-container" style="margin-top: 30px;">
                    <!-- Presets will be loaded here -->
                </div>
            </div>
        </div>
        
        <div id="hardware-tab" class="tab-content">
            <div class="hardware-sync">
                <h3>🔗 Atlas Hardware Synchronization</h3>
                <p>Sync labels directly with your Atlas Atmosphere DSP hardware</p>
                <div style="margin: 20px 0;">
                    <button class="sync-button" onclick="syncWithHardware('upload')">
                        ⬆️ Upload Labels to Hardware
                    </button>
                    <button class="sync-button download" onclick="syncWithHardware('download')">
                        ⬇️ Download Labels from Hardware
                    </button>
                </div>
                <p style="font-size: 0.9em; color: #FFA500; margin-top: 15px;">
                    <strong>Note:</strong> Ensure your Atlas Atmosphere DSP is connected and accessible on the network.
                </p>
            </div>
        </div>
    </div>
    
    <div id="notification" class="notification"></div>
    
    <script>
        let currentLabels = {};
        let unsavedChanges = {};
        
        // Load labels on page load
        document.addEventListener('DOMContentLoaded', function() {
            loadLabels();
        });
        
        // Tab switching
        function showTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab
            document.getElementById(tabName + '-tab').classList.add('active');
            event.target.classList.add('active');
        }
        
        // Load labels from API
        async function loadLabels() {
            try {
                const response = await fetch('/atlas/labels/api/labels');
                const data = await response.json();
                currentLabels = data;
                renderLabels();
                updateLastUpdated();
            } catch (error) {
                showNotification('Failed to load labels: ' + error.message, 'error');
            }
        }
        
        function updateLastUpdated() {
            const lastUpdated = currentLabels.device_info?.last_updated || 'Never';
            document.getElementById('last-updated').textContent = lastUpdated;
        }
        
        // Render labels in the UI
        function renderLabels() {
            renderInputs();
            renderOutputs();
        }
        
        function renderInputs() {
            const container = document.getElementById('inputs-container');
            container.innerHTML = '';
            
            for (let i = 1; i <= 16; i++) {
                const label = currentLabels.inputs[i.toString()] || `Audio Input ${i}`;
                const item = createLabelItem(i, label, 'input');
                container.appendChild(item);
            }
        }
        
        function renderOutputs() {
            const container = document.getElementById('outputs-container');
            container.innerHTML = '';
            
            for (let i = 1; i <= 8; i++) {
                const label = currentLabels.outputs[i.toString()] || `Zone ${i}`;
                const item = createLabelItem(i, label, 'output');
                container.appendChild(item);
            }
        }
        
        function createLabelItem(number, label, type) {
            const item = document.createElement('div');
            item.className = 'label-item';
            const displayType = type === 'input' ? 'IN' : 'ZONE';
            item.innerHTML = `
                <div class="label-number">${displayType} ${number}</div>
                <input type="text" class="label-input" value="${label}" 
                       onchange="updateLabel(${number}, this.value, '${type}')"
                       data-number="${number}" data-type="${type}">
                <button class="save-button" onclick="saveLabel(${number}, '${type}')">Save</button>
            `;
            return item;
        }
        
        function updateLabel(number, value, type) {
            if (!unsavedChanges[type]) {
                unsavedChanges[type] = {};
            }
            unsavedChanges[type][number.toString()] = value;
        }
        
        async function saveLabel(number, type) {
            const input = document.querySelector(`input[data-number="${number}"][data-type="${type}"]`);
            const label = input.value.trim();
            
            if (!label) {
                showNotification('Label cannot be empty', 'error');
                return;
            }
            
            try {
                const endpoint = `/atlas/labels/api/labels/${type}/${number}`;
                const response = await fetch(endpoint, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ label: label })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    const displayType = type === 'input' ? 'Input' : 'Zone';
                    showNotification(`${displayType} ${number} label updated`, 'success');
                    // Update local data
                    currentLabels[type + 's'][number.toString()] = label;
                    // Remove from unsaved changes
                    if (unsavedChanges[type]) {
                        delete unsavedChanges[type][number.toString()];
                    }
                    updateLastUpdated();
                } else {
                    showNotification('Failed to update label: ' + result.error, 'error');
                }
            } catch (error) {
                showNotification('Failed to update label: ' + error.message, 'error');
            }
        }
        
        async function saveAllLabels() {
            if (Object.keys(unsavedChanges).length === 0) {
                showNotification('No changes to save', 'error');
                return;
            }
            
            try {
                const response = await fetch('/atlas/labels/api/labels/bulk', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(unsavedChanges)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification(`Saved ${result.updated_inputs} input and ${result.updated_outputs} zone labels`, 'success');
                    unsavedChanges = {};
                    loadLabels(); // Reload to sync
                } else {
                    showNotification('Failed to save labels: ' + result.error, 'error');
                }
            } catch (error) {
                showNotification('Failed to save labels: ' + error.message, 'error');
            }
        }
        
        async function syncWithHardware(direction) {
            try {
                showNotification(`${direction === 'upload' ? 'Uploading to' : 'Downloading from'} Atlas hardware...`, 'success');
                
                const response = await fetch('/atlas/labels/api/hardware/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ direction: direction })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification(result.message, 'success');
                    if (direction === 'download') {
                        loadLabels(); // Reload labels after download
                    }
                } else {
                    showNotification('Hardware sync failed: ' + result.error, 'error');
                }
            } catch (error) {
                showNotification('Hardware sync failed: ' + error.message, 'error');
            }
        }
        
        function filterLabels(type, searchTerm) {
            const container = document.getElementById(type + '-container');
            const items = container.querySelectorAll('.label-item');
            
            items.forEach(item => {
                const input = item.querySelector('.label-input');
                const label = input.value.toLowerCase();
                const number = input.dataset.number;
                
                if (label.includes(searchTerm.toLowerCase()) || number.includes(searchTerm)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        }
        
        async function loadAudioPresets() {
            try {
                const response = await fetch('/atlas/labels/api/presets/audio-zones');
                const presets = await response.json();
                
                const container = document.getElementById('presets-container');
                container.innerHTML = '';
                
                Object.keys(presets).forEach(presetKey => {
                    const preset = presets[presetKey];
                    const presetDiv = document.createElement('div');
                    presetDiv.style.cssText = `
                        background: rgba(139,69,19,0.3);
                        border: 2px solid #D2691E;
                        padding: 20px;
                        margin: 15px;
                        border-radius: 10px;
                        text-align: left;
                    `;
                    
                    presetDiv.innerHTML = `
                        <h3 style="color: #FFD700; margin-bottom: 10px;">${preset.name}</h3>
                        <p style="color: #FFA500; margin-bottom: 15px;">${preset.description}</p>
                        <button class="bulk-button" onclick="applyPreset('${presetKey}')">
                            Apply This Preset
                        </button>
                    `;
                    
                    container.appendChild(presetDiv);
                });
                
            } catch (error) {
                showNotification('Failed to load presets: ' + error.message, 'error');
            }
        }
        
        async function applyPreset(presetName) {
            try {
                const response = await fetch(`/atlas/labels/api/presets/apply/${presetName}`, {
                    method: 'POST'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification(result.message, 'success');
                    loadLabels(); // Reload to show applied preset
                } else {
                    showNotification('Failed to apply preset: ' + result.error, 'error');
                }
            } catch (error) {
                showNotification('Failed to apply preset: ' + error.message, 'error');
            }
        }
        
        function resetToDefaults() {
            if (confirm('Are you sure you want to reset all labels to defaults? This cannot be undone.')) {
                showNotification('Reset functionality would be implemented here', 'error');
            }
        }
        
        function exportLabels() {
            const dataStr = JSON.stringify(currentLabels, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'atlas_atmosphere_labels.json';
            link.click();
            URL.revokeObjectURL(url);
            showNotification('Labels exported successfully', 'success');
        }
        
        function importLabels() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        try {
                            const importedLabels = JSON.parse(e.target.result);
                            showNotification('Import functionality would be implemented here', 'error');
                        } catch (error) {
                            showNotification('Invalid JSON file', 'error');
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        }
        
        function showNotification(message, type) {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.className = `notification ${type} show`;
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 4000);
        }
    </script>
</body>
</html>'''
    
    with open(templates_dir / "atlas_label_editor.html", "w") as f:
        f.write(atlas_label_editor_html)

if __name__ == "__main__":
    create_atlas_label_templates()
    print("✅ Created Atlas label management templates")
