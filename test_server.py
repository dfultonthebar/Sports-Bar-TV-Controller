#!/usr/bin/env python3
"""
Test Server for AI API Configuration
====================================

Simple test server to verify the AI API configuration interface works.
"""

import sys
import os
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from flask import Flask
from ui.ai_api_config_manager import AIAPIConfigManager

def create_test_app():
    """Create a test Flask application"""
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'test-secret-key-for-development'
    app.config['DEBUG'] = True
    
    # Set template folder
    template_dir = project_root / 'ui' / 'templates'
    app.template_folder = str(template_dir)
    
    # Set static folder
    static_dir = project_root / 'static'
    app.static_folder = str(static_dir)
    
    # Create API config manager
    api_config_manager = AIAPIConfigManager()
    
    # Register blueprint
    app.register_blueprint(api_config_manager.get_blueprint())
    
    # Add a simple root route
    @app.route('/')
    def index():
        return '''
        <h1>AI API Configuration Test Server</h1>
        <p>Test server for the AI API configuration interface.</p>
        <ul>
            <li><a href="/ai-agent/api-config">AI API Configuration</a></li>
            <li><a href="/ai-agent/api/providers">API: Get Providers</a></li>
            <li><a href="/ai-agent/api/system/status">API: System Status</a></li>
        </ul>
        '''
    
    return app

if __name__ == '__main__':
    app = create_test_app()
    print("Starting test server...")
    print("Visit: http://localhost:5001/ai-agent/api-config")
    app.run(host='0.0.0.0', port=5001, debug=True)
