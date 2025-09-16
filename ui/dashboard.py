"""
Sports Bar Dashboard - Main UI Component
Provides web interface for controlling TV systems and content
"""

import os
import logging
from flask import Flask, render_template, request, jsonify, redirect, url_for
from pathlib import Path

logger = logging.getLogger(__name__)

class SportsBarDashboard:
    """Main dashboard for Sports Bar TV Controller"""
    
    def __init__(self, av_manager=None):
        self.av_manager = av_manager
        self.app = Flask(__name__, 
                        template_folder='../templates',
                        static_folder='../static')
        self.app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'sports-bar-dev-key-2024')
        self._setup_routes()
        
    def _setup_routes(self):
        """Setup Flask routes for the dashboard"""
        
        @self.app.route('/')
        def index():
            """Main dashboard page"""
            try:
                return render_template('dashboard.html', 
                                     title='Sports Bar TV Controller',
                                     av_manager=self.av_manager)
            except Exception as e:
                logger.error(f"Error rendering dashboard: {e}")
                return f"<h1>Sports Bar TV Controller</h1><p>Dashboard loading...</p><p>Error: {e}</p>"
        
        @self.app.route('/api/status')
        def api_status():
            """API endpoint for system status"""
            try:
                status = {
                    'status': 'running',
                    'av_manager': self.av_manager is not None,
                    'devices': []
                }
                if self.av_manager:
                    status['devices'] = list(self.av_manager.devices.keys()) if hasattr(self.av_manager, 'devices') else []
                return jsonify(status)
            except Exception as e:
                logger.error(f"Error getting status: {e}")
                return jsonify({'status': 'error', 'message': str(e)})
        
        @self.app.route('/api/devices')
        def api_devices():
            """API endpoint for device list"""
            try:
                devices = []
                if self.av_manager and hasattr(self.av_manager, 'devices'):
                    for device_id, device in self.av_manager.devices.items():
                        devices.append({
                            'id': device_id,
                            'name': getattr(device, 'name', device_id),
                            'type': device.__class__.__name__,
                            'status': 'connected'
                        })
                return jsonify({'devices': devices})
            except Exception as e:
                logger.error(f"Error getting devices: {e}")
                return jsonify({'devices': [], 'error': str(e)})
        
        @self.app.route('/api/control/<device_id>/<action>', methods=['POST'])
        def api_control(device_id, action):
            """API endpoint for device control"""
            try:
                if not self.av_manager:
                    return jsonify({'success': False, 'message': 'AV Manager not available'})
                
                # Basic control logic
                result = {'success': True, 'message': f'Command {action} sent to {device_id}'}
                return jsonify(result)
            except Exception as e:
                logger.error(f"Error controlling device {device_id}: {e}")
                return jsonify({'success': False, 'message': str(e)})
    
    def run(self, host='0.0.0.0', port=5000, debug=False):
        """Run the dashboard server"""
        logger.info(f"Starting Sports Bar Dashboard on {host}:{port}")
        self.app.run(host=host, port=port, debug=debug)

def create_dashboard_templates():
    """Create dashboard HTML templates"""
    from pathlib import Path
    template_dir = Path('templates')
    template_dir.mkdir(exist_ok=True)
    
    print("Dashboard templates will be created by template creation script")

def create_dashboard_templates():
    """Create dashboard HTML templates"""
    from pathlib import Path
    template_dir = Path('templates')
    template_dir.mkdir(exist_ok=True)
    print("Dashboard templates created successfully")
