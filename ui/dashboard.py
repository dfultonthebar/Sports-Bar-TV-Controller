
"""
Flask Web Dashboard for Sports Bar AV Control
Features sync toggle, preset controls, and per-TV manual switching
Enhanced with AI Agent System capabilities
"""
from flask import Flask, render_template_string, request, redirect, url_for, jsonify
from flask_socketio import SocketIO, emit
from core.event_bus import event_bus, EventType, Event
import json
import logging

# Try to import AI Agent System components, fall back to basic imports if not available
try:
    from core.av_manager import AVManager
    from core.network_config import NetworkConfigManager
    from backend.label_manager import label_bp, create_label_templates
    from backend.atlas_label_manager import atlas_label_bp, create_atlas_label_templates
    AI_AGENT_AVAILABLE = True
except ImportError:
    AI_AGENT_AVAILABLE = False

logger = logging.getLogger(__name__)

# Initialize Flask app for backward compatibility
app = Flask(__name__)

# Shared AV state
shared_state = {
    "routes": {},
    "sync_enabled": True,
    "available_inputs": {},
    "available_outputs": {},
    "presets": {}
}

# AI Agent System Dashboard Class (when available)
if AI_AGENT_AVAILABLE:
    class SportsBarDashboard:
        """
        Sports Bar AV Control Dashboard with AI Agent System
        
        Features:
        - Real-time AV route display
        - Preset trigger buttons (Big Game, Chill, Multi-Game)
        - Sync mode toggle (ON/OFF control)
        - Per-TV manual controls with dropdowns
        - Responsive design for tablets/touchscreens
        - WebSocket real-time updates
        - AI Agent System integration
        """
        
        def __init__(self, av_manager: AVManager, host: str = "0.0.0.0", port: int = 5000):
            self.av_manager = av_manager
            self.host = host
            self.port = port
            
            # Initialize network config manager
            self.network_manager = NetworkConfigManager()
            
            # Initialize Flask app
            self.app = Flask(__name__, 
                            template_folder='templates',
                            static_folder='static')
            self.app.config['SECRET_KEY'] = 'sportsbar_av_control_2024'
            
            # Initialize SocketIO
            self.socketio = SocketIO(self.app, cors_allowed_origins="*")
            
            # Register blueprints
            self.app.register_blueprint(label_bp)
            self.app.register_blueprint(atlas_label_bp)
            
            # Setup routes
            self._setup_routes()
            self._setup_socketio_events()
            
            # Subscribe to event bus
            event_bus.subscribe_all(self._handle_av_event)
            
            logger.info(f"AI Agent Dashboard initialized on {host}:{port}")
        
        def run(self, debug: bool = False):
            """Run the dashboard server"""
            logger.info(f"Starting Sports Bar Dashboard on {self.host}:{self.port}")
            self.socketio.run(self.app, host=self.host, port=self.port, debug=debug)
        
        # ... (AI Agent System methods would be implemented here)

# Backward compatibility event handler
def handle_event(event):
    """Handle events from AV Manager"""
    if event["type"] == "route_update":
        shared_state["routes"] = event["routes"]
        shared_state["sync_enabled"] = event.get("sync_enabled", True)
    elif event["type"] == "sync_toggle":
        shared_state["sync_enabled"] = event["sync_enabled"]

event_bus.subscribe(handle_event)

# Routes
@app.route("/")
def index():
    """Main dashboard page"""
    return render_template_string(DASHBOARD_TEMPLATE, **shared_state)

@app.route("/toggle_sync")
def toggle_sync():
    """Toggle sync mode on/off"""
    try:
        # Import here to avoid circular imports
        from main import manager
        
        if manager.sync_enabled:
            manager.disable_sync()
        else:
            manager.enable_sync()
            
        return redirect(url_for("index"))
    except Exception as e:
        return f"Error toggling sync: {e}", 500

@app.route("/preset/<name>")
def preset(name):
    """Recall a preset"""
    try:
        from main import manager
        success = manager.recall_preset(name)
        if success:
            return redirect(url_for("index"))
        else:
            return f"Failed to recall preset: {name}", 400
    except Exception as e:
        return f"Error recalling preset: {e}", 500

@app.route("/switch_av", methods=["POST"])
def switch_av():
    """Manual AV switching"""
    try:
        input_num = int(request.form.get("input"))
        output_num = int(request.form.get("output"))
        volume = float(request.form.get("volume", 0.7))
        
        from main import manager
        success = manager.switch_av(input_num, output_num, volume)
        
        if success:
            return redirect(url_for("index"))
        else:
            return "AV switch failed", 400
    except Exception as e:
        return f"Error switching AV: {e}", 500

@app.route("/api/status")
def api_status():
    """API endpoint for current status"""
    return jsonify(shared_state)

@app.route("/api/inputs")
def api_inputs():
    """API endpoint for available inputs"""
    try:
        from main import manager
        inputs = manager.get_available_inputs()
        return jsonify(inputs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/outputs")
def api_outputs():
    """API endpoint for available outputs"""
    try:
        from main import manager
        outputs = manager.get_available_outputs()
        return jsonify(outputs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# HTML Template
DASHBOARD_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sports Bar AV Control</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 30px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        }
        .status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255, 255, 255, 0.2);
            padding: 15px 25px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .sync-status {
            font-size: 1.2em;
            font-weight: bold;
        }
        .sync-enabled {
            color: #4CAF50;
        }
        .sync-disabled {
            color: #f44336;
        }
        .btn {
            background: linear-gradient(45deg, #FF6B6B, #4ECDC4);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }
        .btn-secondary {
            background: linear-gradient(45deg, #667eea, #764ba2);
        }
        .btn-danger {
            background: linear-gradient(45deg, #f44336, #e91e63);
        }
        .control-section {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 25px;
            margin-bottom: 25px;
        }
        .section-title {
            font-size: 1.5em;
            margin-bottom: 20px;
            border-bottom: 2px solid rgba(255, 255, 255, 0.3);
            padding-bottom: 10px;
        }
        .presets {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .manual-controls {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        .tv-control {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 20px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        select, input {
            width: 100%;
            padding: 10px;
            border: none;
            border-radius: 5px;
            background: rgba(255, 255, 255, 0.9);
            color: #333;
            font-size: 16px;
        }
        .routes-table {
            width: 100%;
            border-collapse: collapse;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            overflow: hidden;
        }
        .routes-table th,
        .routes-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }
        .routes-table th {
            background: rgba(255, 255, 255, 0.2);
            font-weight: bold;
        }
        .live-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            background: #4CAF50;
            border-radius: 50%;
            margin-right: 10px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏈 Sports Bar AV Control</h1>
        
        <!-- Status Bar -->
        <div class="status-bar">
            <div class="sync-status">
                <span class="live-indicator"></span>
                Sync Mode: 
                <span class="{{ 'sync-enabled' if sync_enabled else 'sync-disabled' }}">
                    {{ 'Enabled' if sync_enabled else 'Disabled' }}
                </span>
            </div>
            <a href="{{ url_for('toggle_sync') }}" class="btn {{ 'btn-danger' if sync_enabled else 'btn-secondary' }}">
                {{ 'Turn OFF Sync' if sync_enabled else 'Turn ON Sync' }}
            </a>
        </div>

        <!-- Presets Section -->
        <div class="control-section">
            <h2 class="section-title">🎮 Quick Presets</h2>
            <div class="presets">
                <a href="{{ url_for('preset', name='big_game') }}" class="btn">🏆 Big Game</a>
                <a href="{{ url_for('preset', name='chill') }}" class="btn btn-secondary">🎵 Chill Mode</a>
                <a href="{{ url_for('preset', name='multi_game') }}" class="btn">📺 Multi Game</a>
                <a href="{{ url_for('preset', name='closing') }}" class="btn btn-danger">🌙 Closing Time</a>
            </div>
        </div>

        <!-- Manual Controls Section -->
        <div class="control-section">
            <h2 class="section-title">🎛️ Manual TV Controls</h2>
            <div class="manual-controls">
                <!-- TV 1 Control -->
                <div class="tv-control">
                    <h3>📺 Main Bar TV</h3>
                    <form method="POST" action="{{ url_for('switch_av') }}">
                        <div class="form-group">
                            <label for="input1">Source:</label>
                            <select name="input" id="input1" required>
                                <option value="">Select Source...</option>
                                <option value="1">ESPN (Input 1)</option>
                                <option value="2">FOX Sports (Input 2)</option>
                                <option value="3">Menu Channel (Input 3)</option>
                                <option value="4">Music Stream (Input 4)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="volume1">Volume:</label>
                            <input type="range" name="volume" id="volume1" min="0" max="1" step="0.1" value="0.7">
                        </div>
                        <input type="hidden" name="output" value="1">
                        <button type="submit" class="btn">Apply to Main Bar TV</button>
                    </form>
                </div>

                <!-- TV 2 Control -->
                <div class="tv-control">
                    <h3>🌴 Patio TV</h3>
                    <form method="POST" action="{{ url_for('switch_av') }}">
                        <div class="form-group">
                            <label for="input2">Source:</label>
                            <select name="input" id="input2" required>
                                <option value="">Select Source...</option>
                                <option value="1">ESPN (Input 1)</option>
                                <option value="2">FOX Sports (Input 2)</option>
                                <option value="3">Menu Channel (Input 3)</option>
                                <option value="4">Music Stream (Input 4)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="volume2">Volume:</label>
                            <input type="range" name="volume" id="volume2" min="0" max="1" step="0.1" value="0.7">
                        </div>
                        <input type="hidden" name="output" value="2">
                        <button type="submit" class="btn">Apply to Patio TV</button>
                    </form>
                </div>

                <!-- TV 3 Control -->
                <div class="tv-control">
                    <h3>🍽️ Dining TV</h3>
                    <form method="POST" action="{{ url_for('switch_av') }}">
                        <div class="form-group">
                            <label for="input3">Source:</label>
                            <select name="input" id="input3" required>
                                <option value="">Select Source...</option>
                                <option value="1">ESPN (Input 1)</option>
                                <option value="2">FOX Sports (Input 2)</option>
                                <option value="3">Menu Channel (Input 3)</option>
                                <option value="4">Music Stream (Input 4)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="volume3">Volume:</label>
                            <input type="range" name="volume" id="volume3" min="0" max="1" step="0.1" value="0.5">
                        </div>
                        <input type="hidden" name="output" value="3">
                        <button type="submit" class="btn">Apply to Dining TV</button>
                    </form>
                </div>

                <!-- TV 4 Control -->
                <div class="tv-control">
                    <h3>🏠 Private Room TV</h3>
                    <form method="POST" action="{{ url_for('switch_av') }}">
                        <div class="form-group">
                            <label for="input4">Source:</label>
                            <select name="input" id="input4" required>
                                <option value="">Select Source...</option>
                                <option value="1">ESPN (Input 1)</option>
                                <option value="2">FOX Sports (Input 2)</option>
                                <option value="3">Menu Channel (Input 3)</option>
                                <option value="4">Music Stream (Input 4)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="volume4">Volume:</label>
                            <input type="range" name="volume" id="volume4" min="0" max="1" step="0.1" value="0.6">
                        </div>
                        <input type="hidden" name="output" value="4">
                        <button type="submit" class="btn">Apply to Private Room</button>
                    </form>
                </div>
            </div>
        </div>

        <!-- Current Routes Section -->
        <div class="control-section">
            <h2 class="section-title">📊 Current Routes</h2>
            <table class="routes-table">
                <thead>
                    <tr>
                        <th>TV Output</th>
                        <th>Current Input</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {% if routes %}
                        {% for output, input in routes.items() %}
                        <tr>
                            <td>Output {{ output }}</td>
                            <td>Input {{ input }}</td>
                            <td><span class="live-indicator"></span>Active</td>
                        </tr>
                        {% endfor %}
                    {% else %}
                        <tr>
                            <td colspan="3" style="text-align: center; opacity: 0.7;">No routing data available</td>
                        </tr>
                    {% endif %}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <p>Sports Bar AV Control System | Real-time sync {{ 'enabled' if sync_enabled else 'disabled' }}</p>
        </div>
    </div>

    <script>
        // Auto-refresh every 30 seconds
        setTimeout(function() {
            location.reload();
        }, 30000);

        // Update volume display
        document.querySelectorAll('input[type="range"]').forEach(function(slider) {
            slider.addEventListener('input', function() {
                const value = Math.round(this.value * 100);
                this.title = value + '%';
            });
        });
    </script>
</body>
</html>
"""

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
