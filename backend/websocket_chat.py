
"""
WebSocket Chat Interface for Sports Bar TV Controller
Provides real-time chat interface using FastAPI WebSockets
"""

import asyncio
import json
import logging
import time
from typing import Dict, List, Set, Optional, Any
from datetime import datetime
import uuid

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse
import uvicorn

from chat_interface import ChatInterfaceManager
from system_diagnosis import SystemDiagnostics
from rules_engine import RulesEngine

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections for the chat interface"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_sessions: Dict[str, str] = {}  # websocket_id -> chat_session_id
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.connection_metadata[client_id] = {
            "connected_at": datetime.now().isoformat(),
            "last_activity": datetime.now().isoformat(),
            "message_count": 0
        }
        logger.info(f"Client {client_id} connected")
    
    def disconnect(self, client_id: str):
        """Remove a WebSocket connection"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.user_sessions:
            del self.user_sessions[client_id]
        if client_id in self.connection_metadata:
            del self.connection_metadata[client_id]
        logger.info(f"Client {client_id} disconnected")
    
    async def send_personal_message(self, message: str, client_id: str):
        """Send a message to a specific client"""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            try:
                await websocket.send_text(message)
                self._update_activity(client_id)
                return True
            except Exception as e:
                logger.error(f"Error sending message to {client_id}: {e}")
                return False
        return False
    
    async def send_json_message(self, data: Dict[str, Any], client_id: str):
        """Send a JSON message to a specific client"""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            try:
                await websocket.send_json(data)
                self._update_activity(client_id)
                return True
            except Exception as e:
                logger.error(f"Error sending JSON message to {client_id}: {e}")
                return False
        return False
    
    async def broadcast(self, message: str, exclude_client: Optional[str] = None):
        """Broadcast a message to all connected clients"""
        disconnected_clients = []
        
        for client_id, websocket in self.active_connections.items():
            if client_id != exclude_client:
                try:
                    await websocket.send_text(message)
                    self._update_activity(client_id)
                except Exception as e:
                    logger.error(f"Error broadcasting to {client_id}: {e}")
                    disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)
    
    async def broadcast_json(self, data: Dict[str, Any], exclude_client: Optional[str] = None):
        """Broadcast a JSON message to all connected clients"""
        disconnected_clients = []
        
        for client_id, websocket in self.active_connections.items():
            if client_id != exclude_client:
                try:
                    await websocket.send_json(data)
                    self._update_activity(client_id)
                except Exception as e:
                    logger.error(f"Error broadcasting JSON to {client_id}: {e}")
                    disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)
    
    def _update_activity(self, client_id: str):
        """Update last activity for a client"""
        if client_id in self.connection_metadata:
            self.connection_metadata[client_id]["last_activity"] = datetime.now().isoformat()
            self.connection_metadata[client_id]["message_count"] += 1
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics"""
        return {
            "total_connections": len(self.active_connections),
            "active_sessions": len(self.user_sessions),
            "connections": {
                client_id: metadata 
                for client_id, metadata in self.connection_metadata.items()
            }
        }

class WebSocketChatServer:
    """WebSocket chat server with AI assistant integration"""
    
    def __init__(self):
        self.app = FastAPI(title="Sports Bar TV Controller Chat Interface")
        self.connection_manager = ConnectionManager()
        self.chat_manager = ChatInterfaceManager()
        self.diagnostics = SystemDiagnostics()
        self.rules_engine = RulesEngine("backend/rules")
        
        # Setup routes
        self._setup_routes()
        
        # Background tasks
        self.background_tasks_running = False
    
    def _setup_routes(self):
        """Setup FastAPI routes"""
        
        @self.app.get("/")
        async def get_chat_interface():
            """Serve the chat interface HTML"""
            return HTMLResponse(content=self._get_chat_html(), status_code=200)
        
        @self.app.websocket("/ws/{client_id}")
        async def websocket_endpoint(websocket: WebSocket, client_id: str):
            """WebSocket endpoint for chat"""
            await self.connection_manager.connect(websocket, client_id)
            
            try:
                # Create chat session
                session_info = await self.chat_manager.create_chat_session(client_id, "general")
                session_id = session_info["session_id"]
                self.connection_manager.user_sessions[client_id] = session_id
                
                # Send welcome message
                welcome_data = {
                    "type": "welcome",
                    "session_id": session_id,
                    "message": session_info["initial_message"]["content"],
                    "timestamp": datetime.now().isoformat()
                }
                await self.connection_manager.send_json_message(welcome_data, client_id)
                
                # Listen for messages
                while True:
                    data = await websocket.receive_text()
                    await self._handle_websocket_message(client_id, data)
                    
            except WebSocketDisconnect:
                self.connection_manager.disconnect(client_id)
                logger.info(f"Client {client_id} disconnected")
            except Exception as e:
                logger.error(f"Error in websocket connection for {client_id}: {e}")
                self.connection_manager.disconnect(client_id)
        
        @self.app.get("/api/stats")
        async def get_stats():
            """Get chat server statistics"""
            return {
                "connections": self.connection_manager.get_connection_stats(),
                "rules_engine": self.rules_engine.get_rule_statistics(),
                "timestamp": datetime.now().isoformat()
            }
        
        @self.app.get("/api/health")
        async def get_health():
            """Get system health status"""
            return self.diagnostics.get_system_health_summary()
        
        @self.app.post("/api/diagnose")
        async def run_diagnostics():
            """Run system diagnostics"""
            results = self.diagnostics.run_comprehensive_diagnostics()
            return {
                "diagnostics": [
                    {
                        "test_name": result.test_name,
                        "status": result.status,
                        "message": result.message,
                        "severity": result.severity,
                        "timestamp": result.timestamp
                    }
                    for result in results
                ],
                "timestamp": datetime.now().isoformat()
            }
    
    async def _handle_websocket_message(self, client_id: str, message: str):
        """Handle incoming WebSocket message"""
        try:
            # Try to parse as JSON
            try:
                data = json.loads(message)
                message_type = data.get("type", "chat")
                content = data.get("message", message)
            except json.JSONDecodeError:
                # Treat as plain text message
                message_type = "chat"
                content = message
            
            session_id = self.connection_manager.user_sessions.get(client_id)
            if not session_id:
                await self.connection_manager.send_json_message({
                    "type": "error",
                    "message": "No active chat session"
                }, client_id)
                return
            
            if message_type == "chat":
                # Handle chat message
                response = await self.chat_manager.send_message(session_id, content)
                
                # Send response back to client
                response_data = {
                    "type": "response",
                    "message": response["response"],
                    "timestamp": response["timestamp"],
                    "session_id": session_id
                }
                await self.connection_manager.send_json_message(response_data, client_id)
                
            elif message_type == "system_check":
                # Handle system diagnostics request
                health = self.diagnostics.get_system_health_summary()
                
                response_data = {
                    "type": "system_status",
                    "data": health,
                    "timestamp": datetime.now().isoformat()
                }
                await self.connection_manager.send_json_message(response_data, client_id)
                
            elif message_type == "rules_evaluate":
                # Handle rules evaluation request
                context = data.get("context", {})
                if not context:
                    # Use current system state as context
                    metrics = self.diagnostics.get_system_metrics()
                    context = {
                        "system": {
                            "cpu_percent": metrics.cpu_percent,
                            "memory_percent": metrics.memory_percent,
                            "disk_percent": metrics.disk_percent
                        },
                        "timestamp": time.time()
                    }
                
                results = self.rules_engine.evaluate_rules(context)
                
                response_data = {
                    "type": "rules_results",
                    "data": [
                        {
                            "rule_id": result.rule_id,
                            "matched": result.matched,
                            "actions_executed": result.actions_executed,
                            "error": result.error
                        }
                        for result in results
                    ],
                    "timestamp": datetime.now().isoformat()
                }
                await self.connection_manager.send_json_message(response_data, client_id)
                
            else:
                # Unknown message type
                await self.connection_manager.send_json_message({
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                }, client_id)
                
        except Exception as e:
            logger.error(f"Error handling message from {client_id}: {e}")
            await self.connection_manager.send_json_message({
                "type": "error",
                "message": "Error processing message"
            }, client_id)
    
    def _get_chat_html(self) -> str:
        """Get the chat interface HTML"""
        return """
<!DOCTYPE html>
<html>
<head>
    <title>Sports Bar TV Controller - AI Assistant</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background-color: #2c3e50;
            color: white;
            padding: 20px;
            text-align: center;
        }
        .chat-container {
            height: 400px;
            overflow-y: auto;
            padding: 20px;
            border-bottom: 1px solid #eee;
        }
        .message {
            margin-bottom: 15px;
            padding: 10px;
            border-radius: 5px;
        }
        .user-message {
            background-color: #3498db;
            color: white;
            margin-left: 50px;
            text-align: right;
        }
        .assistant-message {
            background-color: #ecf0f1;
            color: #2c3e50;
            margin-right: 50px;
        }
        .system-message {
            background-color: #f39c12;
            color: white;
            text-align: center;
            font-style: italic;
        }
        .input-container {
            padding: 20px;
            display: flex;
            gap: 10px;
        }
        #messageInput {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
        }
        button {
            padding: 10px 20px;
            background-color: #3498db;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover {
            background-color: #2980b9;
        }
        .status {
            padding: 10px 20px;
            background-color: #27ae60;
            color: white;
            text-align: center;
            font-size: 14px;
        }
        .status.disconnected {
            background-color: #e74c3c;
        }
        .controls {
            padding: 10px 20px;
            background-color: #f8f9fa;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .controls button {
            font-size: 14px;
            padding: 5px 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏟️ Sports Bar TV Controller</h1>
            <p>AI Assistant for System Management</p>
        </div>
        
        <div id="status" class="status">Connecting...</div>
        
        <div class="controls">
            <button onclick="checkSystemHealth()">System Health</button>
            <button onclick="runDiagnostics()">Run Diagnostics</button>
            <button onclick="evaluateRules()">Evaluate Rules</button>
            <button onclick="clearChat()">Clear Chat</button>
        </div>
        
        <div id="chatContainer" class="chat-container">
            <!-- Messages will appear here -->
        </div>
        
        <div class="input-container">
            <input type="text" id="messageInput" placeholder="Ask me about TV control, network issues, or system problems..." 
                   onkeypress="handleKeyPress(event)">
            <button onclick="sendMessage()">Send</button>
        </div>
    </div>

    <script>
        let ws = null;
        let clientId = 'client_' + Math.random().toString(36).substr(2, 9);
        let connected = false;

        function connect() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/${clientId}`;
            
            ws = new WebSocket(wsUrl);
            
            ws.onopen = function(event) {
                connected = true;
                updateStatus('Connected', true);
                addSystemMessage('Connected to AI Assistant');
            };
            
            ws.onmessage = function(event) {
                const data = JSON.parse(event.data);
                handleMessage(data);
            };
            
            ws.onclose = function(event) {
                connected = false;
                updateStatus('Disconnected', false);
                addSystemMessage('Disconnected from server');
                
                // Try to reconnect after 3 seconds
                setTimeout(connect, 3000);
            };
            
            ws.onerror = function(error) {
                console.error('WebSocket error:', error);
                addSystemMessage('Connection error occurred');
            };
        }

        function handleMessage(data) {
            switch(data.type) {
                case 'welcome':
                    addAssistantMessage(data.message);
                    break;
                case 'response':
                    addAssistantMessage(data.message);
                    break;
                case 'system_status':
                    displaySystemStatus(data.data);
                    break;
                case 'rules_results':
                    displayRulesResults(data.data);
                    break;
                case 'error':
                    addSystemMessage('Error: ' + data.message);
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        }

        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (message && connected) {
                addUserMessage(message);
                
                const data = {
                    type: 'chat',
                    message: message
                };
                
                ws.send(JSON.stringify(data));
                input.value = '';
            }
        }

        function checkSystemHealth() {
            if (connected) {
                const data = { type: 'system_check' };
                ws.send(JSON.stringify(data));
            }
        }

        function runDiagnostics() {
            if (connected) {
                addSystemMessage('Running system diagnostics...');
                fetch('/api/diagnose', { method: 'POST' })
                    .then(response => response.json())
                    .then(data => {
                        displayDiagnostics(data.diagnostics);
                    })
                    .catch(error => {
                        addSystemMessage('Error running diagnostics: ' + error.message);
                    });
            }
        }

        function evaluateRules() {
            if (connected) {
                const data = { type: 'rules_evaluate' };
                ws.send(JSON.stringify(data));
            }
        }

        function clearChat() {
            document.getElementById('chatContainer').innerHTML = '';
        }

        function handleKeyPress(event) {
            if (event.key === 'Enter') {
                sendMessage();
            }
        }

        function addUserMessage(message) {
            addMessage(message, 'user-message');
        }

        function addAssistantMessage(message) {
            addMessage(message, 'assistant-message');
        }

        function addSystemMessage(message) {
            addMessage(message, 'system-message');
        }

        function addMessage(message, className) {
            const container = document.getElementById('chatContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + className;
            messageDiv.innerHTML = message.replace(/\\n/g, '<br>');
            container.appendChild(messageDiv);
            container.scrollTop = container.scrollHeight;
        }

        function updateStatus(text, isConnected) {
            const status = document.getElementById('status');
            status.textContent = text;
            status.className = 'status' + (isConnected ? '' : ' disconnected');
        }

        function displaySystemStatus(data) {
            let message = `<strong>System Health: ${data.overall_status}</strong><br>`;
            message += `Health Score: ${data.health_score}%<br>`;
            message += `Total Tests: ${data.total_tests}<br>`;
            message += `Passed: ${data.status_counts.pass}, `;
            message += `Warnings: ${data.status_counts.warning}, `;
            message += `Failed: ${data.status_counts.fail}`;
            
            addAssistantMessage(message);
        }

        function displayRulesResults(results) {
            let message = '<strong>Rules Evaluation Results:</strong><br>';
            
            const matched = results.filter(r => r.matched);
            const failed = results.filter(r => r.error);
            
            message += `Total Rules: ${results.length}<br>`;
            message += `Matched: ${matched.length}<br>`;
            message += `Errors: ${failed.length}<br><br>`;
            
            if (matched.length > 0) {
                message += '<strong>Matched Rules:</strong><br>';
                matched.forEach(result => {
                    message += `• ${result.rule_id}: ${result.actions_executed.join(', ')}<br>`;
                });
            }
            
            addAssistantMessage(message);
        }

        function displayDiagnostics(diagnostics) {
            let message = '<strong>System Diagnostics:</strong><br>';
            
            const failed = diagnostics.filter(d => d.status === 'fail');
            const warnings = diagnostics.filter(d => d.status === 'warning');
            const passed = diagnostics.filter(d => d.status === 'pass');
            
            message += `Failed: ${failed.length}, Warnings: ${warnings.length}, Passed: ${passed.length}<br><br>`;
            
            if (failed.length > 0) {
                message += '<strong>Failed Tests:</strong><br>';
                failed.forEach(test => {
                    message += `❌ ${test.test_name}: ${test.message}<br>`;
                });
                message += '<br>';
            }
            
            if (warnings.length > 0) {
                message += '<strong>Warnings:</strong><br>';
                warnings.forEach(test => {
                    message += `⚠️ ${test.test_name}: ${test.message}<br>`;
                });
            }
            
            addAssistantMessage(message);
        }

        // Connect when page loads
        connect();
    </script>
</body>
</html>
        """
    
    async def start_background_tasks(self):
        """Start background tasks"""
        if self.background_tasks_running:
            return
        
        self.background_tasks_running = True
        
        # Start periodic system monitoring
        asyncio.create_task(self._periodic_system_monitoring())
        
        # Start periodic rules evaluation
        asyncio.create_task(self._periodic_rules_evaluation())
    
    async def _periodic_system_monitoring(self):
        """Periodic system monitoring task"""
        while self.background_tasks_running:
            try:
                # Get system health
                health = self.diagnostics.get_system_health_summary()
                
                # Broadcast critical issues
                if health["overall_status"] in ["CRITICAL", "DEGRADED"]:
                    alert_data = {
                        "type": "system_alert",
                        "status": health["overall_status"],
                        "health_score": health["health_score"],
                        "message": f"System status: {health['overall_status']} (Score: {health['health_score']}%)",
                        "timestamp": datetime.now().isoformat()
                    }
                    await self.connection_manager.broadcast_json(alert_data)
                
                # Wait 60 seconds before next check
                await asyncio.sleep(60)
                
            except Exception as e:
                logger.error(f"Error in system monitoring task: {e}")
                await asyncio.sleep(60)
    
    async def _periodic_rules_evaluation(self):
        """Periodic rules evaluation task"""
        while self.background_tasks_running:
            try:
                # Get current system state
                metrics = self.diagnostics.get_system_metrics()
                context = {
                    "system": {
                        "cpu_percent": metrics.cpu_percent,
                        "memory_percent": metrics.memory_percent,
                        "disk_percent": metrics.disk_percent,
                        "process_count": metrics.process_count,
                        "uptime_seconds": metrics.uptime_seconds
                    },
                    "timestamp": time.time()
                }
                
                # Evaluate rules
                results = self.rules_engine.evaluate_rules(context)
                
                # Broadcast rule matches that have actions
                for result in results:
                    if result.matched and result.actions_executed:
                        alert_data = {
                            "type": "rule_triggered",
                            "rule_id": result.rule_id,
                            "actions": result.actions_executed,
                            "timestamp": result.timestamp
                        }
                        await self.connection_manager.broadcast_json(alert_data)
                
                # Wait 30 seconds before next evaluation
                await asyncio.sleep(30)
                
            except Exception as e:
                logger.error(f"Error in rules evaluation task: {e}")
                await asyncio.sleep(30)
    
    def run(self, host: str = "0.0.0.0", port: int = 8001):
        """Run the WebSocket chat server"""
        logger.info(f"Starting WebSocket chat server on {host}:{port}")
        
        # Start background tasks
        asyncio.create_task(self.start_background_tasks())
        
        # Run the server
        uvicorn.run(self.app, host=host, port=port, log_level="info")

# Example usage
if __name__ == "__main__":
    server = WebSocketChatServer()
    server.run()
