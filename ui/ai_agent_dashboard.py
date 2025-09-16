"""
AI Agent Dashboard - AI system management interface
"""

import logging
from flask import Flask, render_template, jsonify

logger = logging.getLogger(__name__)

class AIAgentDashboard:
    """Dashboard for AI agent management"""
    
    def __init__(self, system_manager=None):
        self.system_manager = system_manager
        self.app = Flask(__name__)
        self._setup_routes()
    
    def _setup_routes(self):
        """Setup routes for AI agent"""
        
        @self.app.route('/ai')
        def ai_index():
            return render_template('ai_dashboard.html')
        
        @self.app.route('/api/ai/status')
        def api_ai_status():
            return jsonify({'status': 'running', 'agents': []})
    
    def run(self, host='0.0.0.0', port=5002):
        self.app.run(host=host, port=port)

def create_ai_dashboard_templates():
    """Create AI dashboard templates"""
    from pathlib import Path
    template_dir = Path('templates')
    template_dir.mkdir(exist_ok=True)
    print("AI dashboard templates created")
