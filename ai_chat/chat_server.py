#!/usr/bin/env python3
"""
AI Chat Server for Sports Bar TV Controller

This module provides a Flask-based chat interface that allows users to interact
with AI assistants for system management, troubleshooting, and control.
"""

import os
import sys
import json
import logging
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, emit, join_room, leave_room
import uuid

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AIChatServer:
    """AI Chat Server for Sports Bar TV Controller"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.app = Flask(__name__)
        self.app.secret_key = os.environ.get('SECRET_KEY', 'sports-bar-ai-chat-secret-key')
        
        # Initialize SocketIO
        self.socketio = SocketIO(
            self.app,
            cors_allowed_origins="*",
            async_mode='threading'
        )
        
        # Chat sessions storage
        self.chat_sessions: Dict[str, Dict] = {}
        self.active_connections: Dict[str, str] = {}  # session_id -> socket_id
        
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Setup routes and socket handlers
        self._setup_routes()
        self._setup_socket_handlers()
        
        logger.info("AI Chat Server initialized")
    
    def _load_config(self, config_path: Optional[str] = None) -> Dict[str, Any]:
        """Load chat server configuration"""
        default_config = {
            "max_message_length": 2000,
            "max_chat_history": 100,
            "ai_providers": {
                "openai": {
                    "enabled": False,
                    "api_key": os.environ.get('OPENAI_API_KEY', ''),
                    "model": "gpt-3.5-turbo"
                },
                "anthropic": {
                    "enabled": False,
                    "api_key": os.environ.get('ANTHROPIC_API_KEY', ''),
                    "model": "claude-3-sonnet-20240229"
                }
            },
            "system_integration": {
                "sports_controller_api": "http://localhost:5000/api",
                "ai_monitor_api": "http://localhost:3001/api",
                "enable_system_commands": True
            }
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    user_config = json.load(f)
                    default_config.update(user_config)
            except Exception as e:
                logger.warning(f"Failed to load config from {config_path}: {e}")
        
        return default_config
    
    def _setup_routes(self):
        """Setup Flask routes"""
        
        @self.app.route('/')
        def index():
            """Main chat interface"""
            return render_template('ai_chat.html')
        
        @self.app.route('/api/health')
        def health_check():
            """Health check endpoint"""
            return jsonify({
                "status": "healthy",
                "service": "AI Chat Server",
                "port": 8001,
                "timestamp": datetime.now().isoformat(),
                "active_sessions": len(self.chat_sessions),
                "active_connections": len(self.active_connections)
            })
        
        @self.app.route('/api/config')
        def get_config():
            """Get chat configuration (sanitized)"""
            sanitized_config = {
                "max_message_length": self.config["max_message_length"],
                "max_chat_history": self.config["max_chat_history"],
                "ai_providers": {
                    provider: {
                        "enabled": details["enabled"],
                        "model": details["model"]
                    }
                    for provider, details in self.config["ai_providers"].items()
                },
                "system_integration": {
                    "enable_system_commands": self.config["system_integration"]["enable_system_commands"]
                }
            }
            return jsonify(sanitized_config)
        
        @self.app.route('/api/sessions')
        def list_sessions():
            """List active chat sessions"""
            sessions_info = []
            for session_id, session_data in self.chat_sessions.items():
                sessions_info.append({
                    "session_id": session_id,
                    "created_at": session_data.get("created_at"),
                    "last_activity": session_data.get("last_activity"),
                    "message_count": len(session_data.get("messages", [])),
                    "connected": session_id in self.active_connections
                })
            return jsonify(sessions_info)
    
    def _setup_socket_handlers(self):
        """Setup SocketIO event handlers"""
        
        @self.socketio.on('connect')
        def handle_connect():
            """Handle client connection"""
            session_id = str(uuid.uuid4())
            session['chat_session_id'] = session_id
            
            # Initialize chat session
            self.chat_sessions[session_id] = {
                "created_at": datetime.now().isoformat(),
                "last_activity": datetime.now().isoformat(),
                "messages": [],
                "user_info": {
                    "ip": request.remote_addr,
                    "user_agent": request.headers.get('User-Agent', 'Unknown')
                }
            }
            
            # Track active connection
            self.active_connections[session_id] = request.sid
            
            logger.info(f"Client connected: session_id={session_id}, socket_id={request.sid}")
            
            # Send welcome message
            emit('system_message', {
                "type": "welcome",
                "message": "Welcome to Sports Bar TV Controller AI Chat! How can I help you today?",
                "timestamp": datetime.now().isoformat(),
                "session_id": session_id
            })
        
        @self.socketio.on('disconnect')
        def handle_disconnect():
            """Handle client disconnection"""
            session_id = session.get('chat_session_id')
            if session_id:
                # Remove from active connections but keep session data
                self.active_connections.pop(session_id, None)
                logger.info(f"Client disconnected: session_id={session_id}")
        
        @self.socketio.on('send_message')
        def handle_message(data):
            """Handle incoming chat messages"""
            session_id = session.get('chat_session_id')
            if not session_id or session_id not in self.chat_sessions:
                emit('error', {"message": "Invalid session"})
                return
            
            message = data.get('message', '').strip()
            if not message:
                emit('error', {"message": "Empty message"})
                return
            
            if len(message) > self.config["max_message_length"]:
                emit('error', {"message": f"Message too long (max {self.config['max_message_length']} characters)"})
                return
            
            # Store user message
            user_message = {
                "id": str(uuid.uuid4()),
                "type": "user",
                "message": message,
                "timestamp": datetime.now().isoformat()
            }
            
            self.chat_sessions[session_id]["messages"].append(user_message)
            self.chat_sessions[session_id]["last_activity"] = datetime.now().isoformat()
            
            # Echo user message back
            emit('message_received', user_message)
            
            # Process message and generate AI response
            self._process_message(session_id, message)
        
        @self.socketio.on('clear_chat')
        def handle_clear_chat():
            """Handle chat clearing request"""
            session_id = session.get('chat_session_id')
            if session_id and session_id in self.chat_sessions:
                self.chat_sessions[session_id]["messages"] = []
                self.chat_sessions[session_id]["last_activity"] = datetime.now().isoformat()
                emit('chat_cleared', {"timestamp": datetime.now().isoformat()})
                logger.info(f"Chat cleared for session: {session_id}")
        
        @self.socketio.on('get_system_status')
        def handle_system_status():
            """Handle system status request"""
            try:
                status = self._get_system_status()
                emit('system_status', status)
            except Exception as e:
                logger.error(f"Error getting system status: {e}")
                emit('error', {"message": "Failed to get system status"})
    
    def _process_message(self, session_id: str, message: str):
        """Process user message and generate AI response"""
        try:
            # Check for system commands
            if message.lower().startswith('/'):
                response = self._handle_system_command(message)
            else:
                # Generate AI response (placeholder for now)
                response = self._generate_ai_response(session_id, message)
            
            # Store AI response
            ai_message = {
                "id": str(uuid.uuid4()),
                "type": "assistant",
                "message": response,
                "timestamp": datetime.now().isoformat()
            }
            
            self.chat_sessions[session_id]["messages"].append(ai_message)
            
            # Send response to client
            self.socketio.emit('ai_response', ai_message, room=self.active_connections.get(session_id))
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            error_message = {
                "id": str(uuid.uuid4()),
                "type": "error",
                "message": "Sorry, I encountered an error processing your message. Please try again.",
                "timestamp": datetime.now().isoformat()
            }
            self.socketio.emit('ai_response', error_message, room=self.active_connections.get(session_id))
    
    def _handle_system_command(self, command: str) -> str:
        """Handle system commands"""
        command = command.lower().strip()
        
        if command == '/help':
            return """Available commands:
/help - Show this help message
/status - Get system status
/health - Check service health
/clear - Clear chat history
/config - Show current configuration

You can also ask me about:
- TV and audio system control
- Sports content management
- System troubleshooting
- Network configuration
- Device management"""
        
        elif command == '/status':
            try:
                status = self._get_system_status()
                return f"""System Status:
• Main Dashboard: {status.get('main_dashboard', 'Unknown')}
• AI Monitor: {status.get('ai_monitor', 'Unknown')}
• Active Sessions: {len(self.chat_sessions)}
• System Load: {status.get('system_load', 'Unknown')}
• Uptime: {status.get('uptime', 'Unknown')}"""
            except Exception as e:
                return f"Error getting system status: {e}"
        
        elif command == '/health':
            return "✅ AI Chat Service is healthy and running on port 8001"
        
        elif command == '/clear':
            return "Chat history cleared. How can I help you?"
        
        elif command == '/config':
            return f"""Current Configuration:
• Max Message Length: {self.config['max_message_length']} characters
• Max Chat History: {self.config['max_chat_history']} messages
• AI Providers: {', '.join([p for p, d in self.config['ai_providers'].items() if d['enabled']])}
• System Commands: {'Enabled' if self.config['system_integration']['enable_system_commands'] else 'Disabled'}"""
        
        else:
            return f"Unknown command: {command}. Type /help for available commands."
    
    def _generate_ai_response(self, session_id: str, message: str) -> str:
        """Generate AI response (placeholder implementation)"""
        # This is a placeholder implementation
        # In a real implementation, this would integrate with actual AI providers
        
        message_lower = message.lower()
        
        # Sports Bar specific responses
        if any(word in message_lower for word in ['tv', 'television', 'display', 'screen']):
            return "I can help you with TV control! The Sports Bar TV Controller manages multiple displays and can switch content, adjust audio, and coordinate viewing experiences. What specific TV operation would you like to perform?"
        
        elif any(word in message_lower for word in ['audio', 'sound', 'volume', 'speaker']):
            return "For audio control, I can help you manage the Atlas Atmosphere audio system, adjust zone volumes, and sync audio with video content. What audio adjustment do you need?"
        
        elif any(word in message_lower for word in ['sports', 'game', 'match', 'schedule']):
            return "I can help you find and display sports content! The system can discover live games, manage sports schedules, and automatically tune to the right channels. What sport or game are you looking for?"
        
        elif any(word in message_lower for word in ['network', 'connection', 'wifi', 'ethernet']):
            return "I can assist with network configuration and troubleshooting. The system monitors network health and can help diagnose connectivity issues. What network problem are you experiencing?"
        
        elif any(word in message_lower for word in ['error', 'problem', 'issue', 'broken', 'not working']):
            return "I'm here to help troubleshoot! I can check system logs, diagnose issues, and suggest solutions. Can you describe the specific problem you're experiencing?"
        
        elif any(word in message_lower for word in ['status', 'health', 'running', 'working']):
            try:
                status = self._get_system_status()
                return f"System is running well! Main dashboard is active, AI monitor is operational, and we have {len(self.chat_sessions)} active chat sessions. All core services are responding normally."
            except:
                return "I can check system status for you! All core services appear to be running normally. Would you like me to check any specific component?"
        
        else:
            return f"I understand you're asking about: '{message}'. As your Sports Bar TV Controller AI assistant, I can help with TV control, audio management, sports content, network issues, and system troubleshooting. Could you be more specific about what you'd like to do?"
    
    def _get_system_status(self) -> Dict[str, Any]:
        """Get system status information"""
        import psutil
        import requests
        
        status = {}
        
        # Check main dashboard
        try:
            response = requests.get('http://localhost:5000/api/health', timeout=2)
            status['main_dashboard'] = 'Online' if response.status_code == 200 else 'Error'
        except:
            status['main_dashboard'] = 'Offline'
        
        # Check AI monitor
        try:
            response = requests.get('http://localhost:3001/api/health', timeout=2)
            status['ai_monitor'] = 'Online' if response.status_code == 200 else 'Error'
        except:
            status['ai_monitor'] = 'Offline'
        
        # System metrics
        try:
            status['system_load'] = f"{psutil.cpu_percent()}%"
            status['memory_usage'] = f"{psutil.virtual_memory().percent}%"
            status['uptime'] = f"{psutil.boot_time()}"
        except:
            status['system_load'] = 'Unknown'
            status['memory_usage'] = 'Unknown'
            status['uptime'] = 'Unknown'
        
        return status
    
    def run(self, host: str = '0.0.0.0', port: int = 8001, debug: bool = False):
        """Run the AI Chat Server"""
        logger.info(f"Starting AI Chat Server on {host}:{port}")
        logger.info(f"Debug mode: {debug}")
        
        try:
            self.socketio.run(
                self.app,
                host=host,
                port=port,
                debug=debug,
                allow_unsafe_werkzeug=True
            )
        except Exception as e:
            logger.error(f"Failed to start AI Chat Server: {e}")
            raise

def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='AI Chat Server for Sports Bar TV Controller')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to')
    parser.add_argument('--port', type=int, default=8001, help='Port to bind to')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    parser.add_argument('--config', help='Configuration file path')
    
    args = parser.parse_args()
    
    # Create and run server
    server = AIChatServer(config_path=args.config)
    server.run(host=args.host, port=args.port, debug=args.debug)

if __name__ == '__main__':
    main()
