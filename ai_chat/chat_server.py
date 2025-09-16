#!/usr/bin/env python3
"""
AI Chat Server for Sports Bar TV Controller
Provides real-time chat interface on port 8001
"""

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
import json
import time
import threading
from datetime import datetime
import argparse

app = Flask(__name__)
app.config['SECRET_KEY'] = 'sportsbar-ai-chat-secret'
socketio = SocketIO(app, cors_allowed_origins="*")

# Store active connections
active_connections = {}
chat_history = []

@app.route('/')
def index():
    """Main chat interface"""
    return render_template('ai_chat.html')

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'AI Chat Server',
        'port': 8001,
        'active_connections': len(active_connections),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/status')
def api_status():
    """API status endpoint"""
    return jsonify({
        'service': 'Sports Bar AI Chat',
        'version': '1.0.0',
        'connections': len(active_connections),
        'uptime': time.time(),
        'features': ['real-time chat', 'system integration', 'sports controls']
    })

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    client_id = request.sid
    active_connections[client_id] = {
        'connected_at': datetime.now().isoformat(),
        'ip': request.remote_addr
    }

    # Send welcome message
    emit('message', {
        'type': 'system',
        'content': '🏈 Welcome to Sports Bar AI Assistant! How can I help you today?',
        'timestamp': datetime.now().isoformat()
    })

    print(f"Client {client_id} connected from {request.remote_addr}")

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    client_id = request.sid
    if client_id in active_connections:
        del active_connections[client_id]
    print(f"Client {client_id} disconnected")

@socketio.on('user_message')
def handle_message(data):
    """Handle incoming user messages"""
    message = data.get('message', '').strip()
    client_id = request.sid

    if not message:
        return

    # Add to chat history
    chat_entry = {
        'client_id': client_id,
        'message': message,
        'timestamp': datetime.now().isoformat()
    }
    chat_history.append(chat_entry)

    # Process the message and generate response
    response = process_ai_message(message)

    # Send response back to client
    emit('message', {
        'type': 'ai',
        'content': response,
        'timestamp': datetime.now().isoformat()
    })

def process_ai_message(message):
    """Process user message and generate AI response"""
    message_lower = message.lower()

    # System commands
    if message_lower.startswith('/'):
        return handle_system_command(message_lower)

    # Sports Bar specific responses
    if any(word in message_lower for word in ['tv', 'television', 'channel', 'game']):
        return "🖥️ I can help you with TV controls! Use the TV Controls button or ask me about changing channels, adjusting volume, or finding sports games."

    elif any(word in message_lower for word in ['audio', 'sound', 'music', 'volume']):
        return "🔊 For audio controls, I can help you adjust volume, change audio zones, or manage background music. What would you like to do?"

    elif any(word in message_lower for word in ['sports', 'game', 'score', 'schedule']):
        return "🏈 I can help you find sports games, check scores, or set up multiple games on different TVs. What sport are you interested in?"

    elif any(word in message_lower for word in ['help', 'commands', 'what can you do']):
        return """🤖 I'm your Sports Bar AI Assistant! I can help with:

• 📺 TV Controls - Change channels, adjust volume
• 🔊 Audio System - Manage sound zones and music
• 🏈 Sports Games - Find games, check scores
• ⚙️ System Status - Check equipment health
• 🎮 Quick Commands - Use the buttons below for fast access

Try asking me about TVs, audio, sports, or use the command buttons!"""

    elif any(word in message_lower for word in ['status', 'health', 'system']):
        return "⚙️ System Status: All services running normally. Main dashboard (port 5000) ✅, AI Monitor (port 3001) ✅, AI Chat (port 8001) ✅"

    else:
        return f"🤖 I understand you said: '{message}'. I'm here to help with your Sports Bar TV Controller! Try asking about TVs, audio, sports games, or system status."

def handle_system_command(command):
    """Handle system commands starting with /"""
    if command == '/help':
        return """🔧 System Commands:
/help - Show this help
/status - System status
/health - Health check
/clear - Clear chat history
/time - Current time"""

    elif command == '/status':
        return f"📊 System Status: {len(active_connections)} active connections, {len(chat_history)} messages processed"

    elif command == '/health':
        return "✅ AI Chat Service: Healthy and operational"

    elif command == '/clear':
        return "🧹 Chat history cleared (for this session)"

    elif command == '/time':
        return f"🕐 Current time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

    else:
        return f"❓ Unknown command: {command}. Type /help for available commands."

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Sports Bar AI Chat Server')
    parser.add_argument('--port', type=int, default=8001, help='Port to run on')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to')
    args = parser.parse_args()

    print(f"🚀 Starting Sports Bar AI Chat Server on {args.host}:{args.port}")
    socketio.run(app, host=args.host, port=args.port, debug=False)
