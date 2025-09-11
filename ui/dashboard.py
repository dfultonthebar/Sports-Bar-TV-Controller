
"""
Sports Bar AV Control Dashboard
Flask web dashboard with real-time route display, preset controls, sync toggle, and per-TV manual controls
"""

from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
import json
import logging
import threading
import time
from typing import Dict, Any
from pathlib import Path

from core.av_manager import AVManager
from core.event_bus import event_bus, EventType, Event
from backend.label_manager import label_bp, create_label_templates

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SportsBarDashboard:
    """
    Sports Bar AV Control Dashboard
    
    Features:
    - Real-time AV route display
    - Preset trigger buttons (Big Game, Chill, Multi-Game)
    - Sync mode toggle (ON/OFF control)
    - Per-TV manual controls with dropdowns
    - Responsive design for tablets/touchscreens
    - WebSocket real-time updates
    """
    
    def __init__(self, av_manager: AVManager, host: str = "0.0.0.0", port: int = 5000):
        self.av_manager = av_manager
        self.host = host
        self.port = port
        
        # Initialize Flask app
        self.app = Flask(__name__, 
                        template_folder='templates',
                        static_folder='static')
        self.app.config['SECRET_KEY'] = 'sportsbar_av_control_2024'
        
        # Initialize SocketIO
        self.socketio = SocketIO(self.app, cors_allowed_origins="*")
        
        # Register blueprints
        self.app.register_blueprint(label_bp)
        
        # Setup routes
        self._setup_routes()
        self._setup_socketio_events()
        
        # Subscribe to event bus
        event_bus.subscribe_all(self._handle_av_event)
        
        logger.info(f"Dashboard initialized on {host}:{port}")
    
    def _setup_routes(self):
        """Setup Flask routes"""
        
        @self.app.route('/')
        def index():
            """Main dashboard page"""
            return render_template('dashboard.html')
        
        @self.app.route('/api/status')
        def get_status():
            """Get current system status"""
            try:
                status = {
                    'system': self.av_manager.get_system_status(),
                    'presets': {
                        pid: {
                            'id': preset.id,
                            'name': preset.name,
                            'description': preset.description
                        }
                        for pid, preset in self.av_manager.get_presets().items()
                    },
                    'mappings': {
                        output: {
                            'video_output': mapping.video_output,
                            'audio_zone': mapping.audio_zone,
                            'name': f'TV {output}'
                        }
                        for output, mapping in self.av_manager.get_mappings().items()
                    },
                    'current_routes': self._get_current_routes()
                }
                return jsonify(status)
            except Exception as e:
                logger.error(f"Status API error: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/preset/<int:preset_id>', methods=['POST'])
        def recall_preset(preset_id):
            """Recall a preset"""
            try:
                success = self.av_manager.recall_preset(preset_id)
                return jsonify({'success': success})
            except Exception as e:
                logger.error(f"Preset recall API error: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/sync', methods=['POST'])
        def toggle_sync():
            """Toggle sync mode"""
            try:
                data = request.get_json()
                enabled = data.get('enabled', True)
                self.av_manager.set_sync_enabled(enabled)
                return jsonify({'success': True, 'sync_enabled': enabled})
            except Exception as e:
                logger.error(f"Sync toggle API error: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/manual_route', methods=['POST'])
        def manual_route():
            """Manual video/audio routing"""
            try:
                data = request.get_json()
                output = data.get('output')
                input_num = data.get('input')
                
                # Validate input/output ranges for 36x36 matrix
                if not (1 <= input_num <= 36):
                    return jsonify({'error': f'Invalid input number: {input_num}. Must be 1-36'}), 400
                if not (1 <= output <= 36):
                    return jsonify({'error': f'Invalid output number: {output}. Must be 1-36'}), 400
                
                success = False
                if self.av_manager.wolfpack and self.av_manager.wolfpack.connected:
                    success = self.av_manager.wolfpack.switch_input_to_output(input_num, output)
                
                return jsonify({'success': success})
            except Exception as e:
                logger.error(f"Manual route API error: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/labels')
        def get_labels():
            """Get all input/output labels"""
            try:
                labels = {}
                if self.av_manager.wolfpack:
                    labels = self.av_manager.wolfpack.get_all_labels()
                return jsonify(labels)
            except Exception as e:
                logger.error(f"Labels API error: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/labels/input/<int:input_num>', methods=['PUT'])
        def update_input_label(input_num):
            """Update input label"""
            try:
                data = request.get_json()
                label = data.get('label', '').strip()
                
                if not label:
                    return jsonify({'error': 'Label cannot be empty'}), 400
                
                if not (1 <= input_num <= 36):
                    return jsonify({'error': 'Input number must be between 1 and 36'}), 400
                
                if self.av_manager.wolfpack:
                    self.av_manager.wolfpack.set_input_label(input_num, label)
                    return jsonify({'success': True, 'input': input_num, 'label': label})
                else:
                    return jsonify({'error': 'Wolfpack controller not available'}), 500
                
            except Exception as e:
                logger.error(f"Update input label API error: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/labels/output/<int:output_num>', methods=['PUT'])
        def update_output_label(output_num):
            """Update output label"""
            try:
                data = request.get_json()
                label = data.get('label', '').strip()
                
                if not label:
                    return jsonify({'error': 'Label cannot be empty'}), 400
                
                if not (1 <= output_num <= 36):
                    return jsonify({'error': 'Output number must be between 1 and 36'}), 400
                
                if self.av_manager.wolfpack:
                    self.av_manager.wolfpack.set_output_label(output_num, label)
                    return jsonify({'success': True, 'output': output_num, 'label': label})
                else:
                    return jsonify({'error': 'Wolfpack controller not available'}), 500
                
            except Exception as e:
                logger.error(f"Update output label API error: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/volume', methods=['POST'])
        def set_volume():
            """Set zone volume"""
            try:
                data = request.get_json()
                zone_id = data.get('zone_id')
                volume = data.get('volume')
                
                success = False
                if self.av_manager.atmosphere and self.av_manager.atmosphere.connected:
                    success = self.av_manager.atmosphere.set_zone_volume(zone_id, volume)
                
                return jsonify({'success': success})
            except Exception as e:
                logger.error(f"Volume API error: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/mute', methods=['POST'])
        def toggle_mute():
            """Toggle zone mute"""
            try:
                data = request.get_json()
                zone_id = data.get('zone_id')
                muted = data.get('muted', True)
                
                success = False
                if self.av_manager.atmosphere and self.av_manager.atmosphere.connected:
                    success = self.av_manager.atmosphere.mute_zone(zone_id, muted)
                
                return jsonify({'success': success})
            except Exception as e:
                logger.error(f"Mute API error: {e}")
                return jsonify({'error': str(e)}), 500
    
    def _setup_socketio_events(self):
        """Setup SocketIO event handlers"""
        
        @self.socketio.on('connect')
        def handle_connect():
            """Handle client connection"""
            logger.info("Client connected to dashboard")
            # Send initial status
            emit('status_update', self._get_dashboard_status())
        
        @self.socketio.on('disconnect')
        def handle_disconnect():
            """Handle client disconnection"""
            logger.info("Client disconnected from dashboard")
        
        @self.socketio.on('request_status')
        def handle_status_request():
            """Handle status request from client"""
            emit('status_update', self._get_dashboard_status())
    
    def _handle_av_event(self, event: Event):
        """Handle events from AV system and broadcast to clients"""
        try:
            # Convert event to dashboard update
            update_data = {
                'type': event.type.value,
                'source': event.source,
                'data': event.data,
                'timestamp': event.timestamp
            }
            
            # Broadcast to all connected clients
            self.socketio.emit('av_event', update_data)
            
            # Send updated status for certain events
            if event.type in [EventType.VIDEO_ROUTE_CHANGED, 
                            EventType.AUDIO_ROUTE_CHANGED,
                            EventType.PRESET_RECALLED,
                            EventType.SYNC_STATUS_CHANGED]:
                self.socketio.emit('status_update', self._get_dashboard_status())
            
        except Exception as e:
            logger.error(f"Event handling error: {e}")
    
    def _get_current_routes(self) -> Dict[str, Any]:
        """Get current routing state"""
        routes = {
            'video': {},
            'audio': {}
        }
        
        try:
            # Get video routes
            if self.av_manager.wolfpack and self.av_manager.wolfpack.connected:
                wolfpack_routes = self.av_manager.wolfpack.get_current_routes()
                for output, route in wolfpack_routes.items():
                    routes['video'][output] = route.input
            
            # Get audio routes
            if self.av_manager.atmosphere and self.av_manager.atmosphere.connected:
                atmosphere_zones = self.av_manager.atmosphere.get_all_zones()
                for zone_id, zone in atmosphere_zones.items():
                    routes['audio'][zone_id] = {
                        'source': zone.source,
                        'volume': zone.volume,
                        'muted': zone.muted
                    }
        
        except Exception as e:
            logger.error(f"Route retrieval error: {e}")
        
        return routes
    
    def _get_dashboard_status(self) -> Dict[str, Any]:
        """Get complete dashboard status"""
        return {
            'system_status': self.av_manager.get_system_status(),
            'current_routes': self._get_current_routes(),
            'presets': {
                pid: {
                    'id': preset.id,
                    'name': preset.name,
                    'description': preset.description
                }
                for pid, preset in self.av_manager.get_presets().items()
            },
            'mappings': {
                output: {
                    'video_output': mapping.video_output,
                    'audio_zone': mapping.audio_zone,
                    'name': f'TV {output}'
                }
                for output, mapping in self.av_manager.get_mappings().items()
            }
        }
    
    def run(self, debug: bool = False):
        """Run the dashboard server"""
        logger.info(f"Starting Sports Bar Dashboard on {self.host}:{self.port}")
        self.socketio.run(self.app, host=self.host, port=self.port, debug=debug)

# Create templates directory and files
def create_dashboard_templates():
    """Create HTML templates for the dashboard"""
    templates_dir = Path("ui/templates")
    templates_dir.mkdir(parents=True, exist_ok=True)
    
    # Main dashboard template
    dashboard_html = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sports Bar AV Control</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.0.1/socket.io.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        
        .status-item {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ff4444;
        }
        
        .status-indicator.connected {
            background: #44ff44;
        }
        
        .sync-toggle {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .toggle-switch {
            position: relative;
            width: 60px;
            height: 30px;
            background: #ccc;
            border-radius: 15px;
            cursor: pointer;
            transition: background 0.3s;
        }
        
        .toggle-switch.active {
            background: #44ff44;
        }
        
        .toggle-slider {
            position: absolute;
            top: 3px;
            left: 3px;
            width: 24px;
            height: 24px;
            background: white;
            border-radius: 50%;
            transition: transform 0.3s;
        }
        
        .toggle-switch.active .toggle-slider {
            transform: translateX(30px);
        }
        
        .presets-section {
            margin-bottom: 30px;
        }
        
        .presets-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .preset-card {
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
            border: 2px solid transparent;
        }
        
        .preset-card:hover {
            background: rgba(255,255,255,0.2);
            border-color: #44ff44;
            transform: translateY(-2px);
        }
        
        .preset-card h3 {
            margin-bottom: 10px;
            font-size: 1.3em;
        }
        
        .preset-card p {
            opacity: 0.8;
            font-size: 0.9em;
        }
        
        .tv-controls {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        
        .tv-card {
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 10px;
        }
        
        .tv-card h3 {
            margin-bottom: 15px;
            text-align: center;
        }
        
        .control-group {
            margin-bottom: 15px;
        }
        
        .control-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        
        .control-group select,
        .control-group input[type="range"] {
            width: 100%;
            padding: 8px;
            border: none;
            border-radius: 5px;
            background: rgba(255,255,255,0.9);
            color: #333;
        }
        
        .volume-display {
            text-align: center;
            margin-top: 5px;
            font-size: 0.9em;
        }
        
        .mute-button {
            width: 100%;
            padding: 10px;
            border: none;
            border-radius: 5px;
            background: #ff4444;
            color: white;
            cursor: pointer;
            font-weight: bold;
            transition: background 0.3s;
        }
        
        .mute-button.muted {
            background: #666;
        }
        
        .mute-button:hover {
            opacity: 0.8;
        }
        
        @media (max-width: 768px) {
            .status-bar {
                flex-direction: column;
                gap: 15px;
            }
            
            .presets-grid {
                grid-template-columns: 1fr;
            }
            
            .tv-controls {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏈 Sports Bar AV Control</h1>
            <p>Professional Audio/Video Management System</p>
            <div style="margin-top: 15px;">
                <a href="/labels/" target="_blank" style="color: #44ff44; text-decoration: none; font-weight: bold; padding: 8px 16px; background: rgba(255,255,255,0.1); border-radius: 5px; margin-right: 10px;">
                    🎛️ Label Editor
                </a>
                <a href="/labels/visual-map" target="_blank" style="color: #44ff44; text-decoration: none; font-weight: bold; padding: 8px 16px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                    🗺️ Visual Map
                </a>
            </div>
        </div>
        
        <div class="status-bar">
            <div class="status-item">
                <div class="status-indicator" id="wolfpack-status"></div>
                <span>Video Matrix</span>
            </div>
            <div class="status-item">
                <div class="status-indicator" id="atmosphere-status"></div>
                <span>Audio Processor</span>
            </div>
            <div class="sync-toggle">
                <span>Bi-Directional Sync:</span>
                <div class="toggle-switch" id="sync-toggle">
                    <div class="toggle-slider"></div>
                </div>
            </div>
        </div>
        
        <div class="presets-section">
            <h2>Quick Presets</h2>
            <div class="presets-grid" id="presets-grid">
                <!-- Presets will be loaded here -->
            </div>
        </div>
        
        <div class="tv-controls-section">
            <h2>Individual TV Controls</h2>
            <div class="tv-controls" id="tv-controls">
                <!-- TV controls will be loaded here -->
            </div>
        </div>
    </div>

    <script>
        // Initialize Socket.IO connection
        const socket = io();
        
        let currentStatus = {};
        
        // Socket event handlers
        socket.on('connect', function() {
            console.log('Connected to dashboard');
            socket.emit('request_status');
        });
        
        socket.on('status_update', function(data) {
            currentStatus = data;
            updateDashboard(data);
        });
        
        socket.on('av_event', function(event) {
            console.log('AV Event:', event);
            // Handle real-time events
            showNotification(`${event.source}: ${event.type}`, 'info');
        });
        
        // Update dashboard with current status
        function updateDashboard(status) {
            updateStatusIndicators(status.system_status);
            updatePresets(status.presets);
            updateTVControls(status.mappings, status.current_routes);
            updateSyncToggle(status.system_status.sync_enabled);
        }
        
        // Update status indicators
        function updateStatusIndicators(systemStatus) {
            const wolfpackStatus = document.getElementById('wolfpack-status');
            const atmosphereStatus = document.getElementById('atmosphere-status');
            
            wolfpackStatus.className = 'status-indicator' + 
                (systemStatus.wolfpack_connected ? ' connected' : '');
            atmosphereStatus.className = 'status-indicator' + 
                (systemStatus.atmosphere_connected ? ' connected' : '');
        }
        
        // Update presets
        function updatePresets(presets) {
            const presetsGrid = document.getElementById('presets-grid');
            presetsGrid.innerHTML = '';
            
            Object.values(presets).forEach(preset => {
                const presetCard = document.createElement('div');
                presetCard.className = 'preset-card';
                presetCard.innerHTML = `
                    <h3>${preset.name}</h3>
                    <p>${preset.description}</p>
                `;
                presetCard.onclick = () => recallPreset(preset.id);
                presetsGrid.appendChild(presetCard);
            });
        }
        
        // Update TV controls with dynamic labels
        function updateTVControls(mappings, routes) {
            const tvControls = document.getElementById('tv-controls');
            tvControls.innerHTML = '';
            
            // Load labels first
            fetch('/api/labels')
                .then(response => response.json())
                .then(labels => {
                    Object.values(mappings).forEach(mapping => {
                        const tvCard = document.createElement('div');
                        tvCard.className = 'tv-card';
                        
                        const currentVideoInput = routes.video[mapping.video_output] || 'Unknown';
                        const currentAudioRoute = routes.audio[mapping.audio_zone] || {};
                        
                        // Generate input options dynamically from labels
                        let inputOptions = '';
                        for (let i = 1; i <= 36; i++) {
                            const inputLabel = labels.inputs && labels.inputs[i.toString()] ? labels.inputs[i.toString()] : `Input ${i}`;
                            const selected = currentVideoInput == i ? 'selected' : '';
                            inputOptions += `<option value="${i}" ${selected}>${i}: ${inputLabel}</option>`;
                        }
                        
                        // Use custom output label if available
                        const outputLabel = labels.outputs && labels.outputs[mapping.video_output.toString()] ? 
                                          labels.outputs[mapping.video_output.toString()] : mapping.name;
                        
                        tvCard.innerHTML = `
                            <h3>${outputLabel}</h3>
                            <div class="control-group">
                                <label>Video Input:</label>
                                <select onchange="changeVideoInput(${mapping.video_output}, this.value)">
                                    ${inputOptions}
                                </select>
                            </div>
                            <div class="control-group">
                                <label>Volume:</label>
                                <input type="range" min="0" max="1" step="0.1" 
                                       value="${currentAudioRoute.volume || 0.5}"
                                       onchange="changeVolume(${mapping.audio_zone}, this.value)">
                                <div class="volume-display">${Math.round((currentAudioRoute.volume || 0.5) * 100)}%</div>
                            </div>
                            <div class="control-group">
                                <button class="mute-button ${currentAudioRoute.muted ? 'muted' : ''}"
                                        onclick="toggleMute(${mapping.audio_zone}, ${!currentAudioRoute.muted})">
                                    ${currentAudioRoute.muted ? 'UNMUTE' : 'MUTE'}
                                </button>
                            </div>
                        `;
                        
                        tvControls.appendChild(tvCard);
                    });
                })
                .catch(error => {
                    console.error('Failed to load labels:', error);
                    // Fallback to original behavior with all 36 inputs
                    updateTVControlsFallback(mappings, routes);
                });
        }
        
        // Fallback TV controls update without labels
        function updateTVControlsFallback(mappings, routes) {
            const tvControls = document.getElementById('tv-controls');
            tvControls.innerHTML = '';
            
            Object.values(mappings).forEach(mapping => {
                const tvCard = document.createElement('div');
                tvCard.className = 'tv-card';
                
                const currentVideoInput = routes.video[mapping.video_output] || 'Unknown';
                const currentAudioRoute = routes.audio[mapping.audio_zone] || {};
                
                // Generate all 36 input options
                let inputOptions = '';
                for (let i = 1; i <= 36; i++) {
                    const selected = currentVideoInput == i ? 'selected' : '';
                    inputOptions += `<option value="${i}" ${selected}>Input ${i}</option>`;
                }
                
                tvCard.innerHTML = `
                    <h3>${mapping.name}</h3>
                    <div class="control-group">
                        <label>Video Input:</label>
                        <select onchange="changeVideoInput(${mapping.video_output}, this.value)">
                            ${inputOptions}
                        </select>
                    </div>
                    <div class="control-group">
                        <label>Volume:</label>
                        <input type="range" min="0" max="1" step="0.1" 
                               value="${currentAudioRoute.volume || 0.5}"
                               onchange="changeVolume(${mapping.audio_zone}, this.value)">
                        <div class="volume-display">${Math.round((currentAudioRoute.volume || 0.5) * 100)}%</div>
                    </div>
                    <div class="control-group">
                        <button class="mute-button ${currentAudioRoute.muted ? 'muted' : ''}"
                                onclick="toggleMute(${mapping.audio_zone}, ${!currentAudioRoute.muted})">
                            ${currentAudioRoute.muted ? 'UNMUTE' : 'MUTE'}
                        </button>
                    </div>
                `;
                
                tvControls.appendChild(tvCard);
            });
        }
        
        // Update sync toggle
        function updateSyncToggle(syncEnabled) {
            const syncToggle = document.getElementById('sync-toggle');
            syncToggle.className = 'toggle-switch' + (syncEnabled ? ' active' : '');
        }
        
        // Control functions
        function recallPreset(presetId) {
            fetch(`/api/preset/${presetId}`, { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showNotification(`Preset ${presetId} activated`, 'success');
                    } else {
                        showNotification('Failed to activate preset', 'error');
                    }
                });
        }
        
        function changeVideoInput(output, input) {
            fetch('/api/manual_route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ output: parseInt(output), input: parseInt(input) })
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    showNotification('Failed to change video input', 'error');
                }
            });
        }
        
        function changeVolume(zoneId, volume) {
            fetch('/api/volume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ zone_id: parseInt(zoneId), volume: parseFloat(volume) })
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    showNotification('Failed to change volume', 'error');
                }
            });
        }
        
        function toggleMute(zoneId, muted) {
            fetch('/api/mute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ zone_id: parseInt(zoneId), muted: muted })
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    showNotification('Failed to toggle mute', 'error');
                }
            });
        }
        
        // Sync toggle handler
        document.getElementById('sync-toggle').onclick = function() {
            const currentSync = currentStatus.system_status?.sync_enabled || false;
            fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !currentSync })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification(`Sync ${data.sync_enabled ? 'enabled' : 'disabled'}`, 'info');
                } else {
                    showNotification('Failed to toggle sync', 'error');
                }
            });
        };
        
        // Notification system
        function showNotification(message, type) {
            // Simple notification - could be enhanced with a proper notification library
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    </script>
</body>
</html>'''
    
    with open(templates_dir / "dashboard.html", "w") as f:
        f.write(dashboard_html)

# Example usage
if __name__ == "__main__":
    # Create templates
    create_dashboard_templates()
    
    # Initialize AV Manager
    av_manager = AVManager("config/mappings.yaml")
    av_manager.initialize_devices()
    
    # Initialize Dashboard
    dashboard = SportsBarDashboard(av_manager)
    
    # Connect devices in a separate thread
    def connect_devices():
        time.sleep(2)  # Give dashboard time to start
        av_manager.connect_devices()
    
    device_thread = threading.Thread(target=connect_devices, daemon=True)
    device_thread.start()
    
    # Run dashboard
    dashboard.run(debug=True)
