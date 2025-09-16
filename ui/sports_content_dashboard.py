"""
Sports Content Dashboard - Content management interface
"""

import logging
from flask import Flask, render_template, jsonify

logger = logging.getLogger(__name__)

class SportsContentDashboard:
    """Dashboard for managing sports content"""
    
    def __init__(self, content_manager=None):
        self.content_manager = content_manager
        self.app = Flask(__name__)
        self._setup_routes()
    
    def _setup_routes(self):
        """Setup routes for sports content"""
        
        @self.app.route('/sports')
        def sports_index():
            return render_template('sports_dashboard.html')
        
        @self.app.route('/api/sports/content')
        def api_sports_content():
            return jsonify({'content': [], 'status': 'ok'})
    
    def run(self, host='0.0.0.0', port=5001):
        self.app.run(host=host, port=port)
