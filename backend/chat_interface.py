
"""
AI Chat Interface for System Troubleshooting and Feature Design
Provides intelligent assistance for Sports Bar TV Controller operations
"""

import asyncio
import json
import logging
import time
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
from pathlib import Path
import yaml
from datetime import datetime, timedelta

@dataclass
class ChatMessage:
    """Represents a chat message"""
    role: str  # 'user', 'assistant', 'system'
    content: str
    timestamp: float
    context: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.context is None:
            self.context = {}
        if self.timestamp == 0:
            self.timestamp = time.time()

@dataclass
class TroubleshootingSession:
    """Represents a troubleshooting session"""
    session_id: str
    user_id: str
    issue_category: str
    messages: List[ChatMessage]
    status: str = "active"  # active, resolved, escalated
    created_at: float = 0
    resolved_at: float = 0
    
    def __post_init__(self):
        if self.created_at == 0:
            self.created_at = time.time()

class SystemKnowledgeBase:
    """Knowledge base for system troubleshooting and assistance"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.knowledge_base = self._initialize_knowledge_base()
        self.troubleshooting_flows = self._initialize_troubleshooting_flows()
        
    def _initialize_knowledge_base(self) -> Dict[str, Any]:
        """Initialize the system knowledge base"""
        return {
            "tv_control": {
                "common_issues": [
                    {
                        "issue": "TV not responding to commands",
                        "causes": [
                            "Network connectivity issues",
                            "Incorrect IP address configuration",
                            "TV in standby mode",
                            "Firewall blocking communication"
                        ],
                        "solutions": [
                            "Check network connectivity with ping test",
                            "Verify TV IP address in subnet configuration",
                            "Power cycle the TV",
                            "Check firewall settings on network"
                        ]
                    },
                    {
                        "issue": "IR commands not working",
                        "causes": [
                            "Global Cache device offline",
                            "Incorrect IR codes",
                            "IR blaster positioning",
                            "Device not in line of sight"
                        ],
                        "solutions": [
                            "Check Global Cache connectivity",
                            "Verify IR code database",
                            "Reposition IR blaster",
                            "Clear line of sight to device"
                        ]
                    }
                ],
                "configuration_help": {
                    "tv_discovery": "Use the TV discovery system to automatically find TVs on your network. Go to Settings > Network > TV Discovery and scan your subnet ranges.",
                    "subnet_setup": "Configure your network subnets: TVs (192.168.1.1-32), Inputs (192.168.1.40-60), Hardware (192.168.1.80-100)",
                    "cable_box_setup": "Add cable boxes through Settings > Devices > Cable Boxes. Ensure Global Cache IP is configured correctly."
                }
            },
            "network": {
                "subnet_ranges": {
                    "tv_devices": "192.168.1.1-32",
                    "input_devices": "192.168.1.40-60", 
                    "hardware_control": "192.168.1.80-100",
                    "management": "192.168.1.200-220"
                },
                "common_ports": {
                    "global_cache": 4998,
                    "tv_control": [80, 443, 8080, 7001, 7002],
                    "streaming_devices": [8008, 8080, 8443]
                }
            },
            "features": {
                "tv_discovery": {
                    "description": "Automatically discover TVs and streaming devices on your network",
                    "usage": "Navigate to Network > Discovery and select your subnet range to scan"
                },
                "cable_box_control": {
                    "description": "Control cable boxes via IR commands through Global Cache devices",
                    "usage": "Configure cable boxes in Settings > Devices, then use the remote control interface"
                },
                "subnet_management": {
                    "description": "Manage IP address ranges for different device types",
                    "usage": "Access Network > Subnets to view and modify IP range assignments"
                }
            }
        }
    
    def _initialize_troubleshooting_flows(self) -> Dict[str, List[Dict[str, Any]]]:
        """Initialize guided troubleshooting flows"""
        return {
            "tv_not_responding": [
                {
                    "step": 1,
                    "question": "Is the TV powered on and displaying content?",
                    "yes_action": "proceed_to_network_check",
                    "no_action": "check_power_connection"
                },
                {
                    "step": 2,
                    "question": "Can you ping the TV's IP address?",
                    "yes_action": "check_port_connectivity",
                    "no_action": "check_network_configuration"
                },
                {
                    "step": 3,
                    "question": "Are the TV control ports (80, 443, 8080) accessible?",
                    "yes_action": "check_api_compatibility",
                    "no_action": "check_firewall_settings"
                }
            ],
            "ir_commands_failing": [
                {
                    "step": 1,
                    "question": "Is the Global Cache device powered on and connected?",
                    "yes_action": "test_global_cache_connection",
                    "no_action": "check_global_cache_power"
                },
                {
                    "step": 2,
                    "question": "Can you connect to the Global Cache device on port 4998?",
                    "yes_action": "test_ir_transmission",
                    "no_action": "check_network_connectivity"
                },
                {
                    "step": 3,
                    "question": "Is the IR blaster positioned correctly and in line of sight?",
                    "yes_action": "check_ir_codes",
                    "no_action": "reposition_ir_blaster"
                }
            ],
            "network_discovery_issues": [
                {
                    "step": 1,
                    "question": "Are you scanning the correct subnet range?",
                    "yes_action": "check_network_permissions",
                    "no_action": "configure_correct_subnet"
                },
                {
                    "step": 2,
                    "question": "Do you have network scanning permissions?",
                    "yes_action": "check_device_visibility",
                    "no_action": "request_network_permissions"
                },
                {
                    "step": 3,
                    "question": "Are the devices powered on and connected to the network?",
                    "yes_action": "manual_device_addition",
                    "no_action": "power_on_devices"
                }
            ]
        }
    
    def get_knowledge_for_category(self, category: str) -> Dict[str, Any]:
        """Get knowledge base information for a category"""
        return self.knowledge_base.get(category, {})
    
    def get_troubleshooting_flow(self, issue_type: str) -> List[Dict[str, Any]]:
        """Get troubleshooting flow for an issue type"""
        return self.troubleshooting_flows.get(issue_type, [])
    
    def search_knowledge_base(self, query: str) -> List[Dict[str, Any]]:
        """Search knowledge base for relevant information"""
        results = []
        query_lower = query.lower()
        
        # Search through all categories
        for category, content in self.knowledge_base.items():
            if isinstance(content, dict):
                for subcategory, items in content.items():
                    if isinstance(items, list):
                        for item in items:
                            if isinstance(item, dict):
                                # Search in issue descriptions and solutions
                                if any(query_lower in str(value).lower() for value in item.values()):
                                    results.append({
                                        "category": category,
                                        "subcategory": subcategory,
                                        "content": item,
                                        "relevance_score": self._calculate_relevance(query_lower, item)
                                    })
                    elif isinstance(items, dict):
                        for key, value in items.items():
                            if query_lower in key.lower() or query_lower in str(value).lower():
                                results.append({
                                    "category": category,
                                    "subcategory": subcategory,
                                    "key": key,
                                    "content": value,
                                    "relevance_score": self._calculate_relevance(query_lower, {key: value})
                                })
        
        # Sort by relevance score
        results.sort(key=lambda x: x["relevance_score"], reverse=True)
        return results[:10]  # Return top 10 results
    
    def _calculate_relevance(self, query: str, content: Dict[str, Any]) -> float:
        """Calculate relevance score for search results"""
        score = 0.0
        content_str = json.dumps(content).lower()
        
        # Exact matches get higher scores
        if query in content_str:
            score += 10.0
        
        # Word matches
        query_words = query.split()
        for word in query_words:
            if word in content_str:
                score += 1.0
        
        return score

class ChatAssistant:
    """AI-powered chat assistant for troubleshooting and feature guidance"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.knowledge_base = SystemKnowledgeBase()
        self.active_sessions: Dict[str, TroubleshootingSession] = {}
        self.system_context = self._initialize_system_context()
        
    def _initialize_system_context(self) -> Dict[str, Any]:
        """Initialize system context for the assistant"""
        return {
            "system_name": "Sports Bar TV Controller",
            "capabilities": [
                "TV discovery and control",
                "Cable box IR control via Global Cache",
                "Network subnet management", 
                "Device configuration",
                "Troubleshooting assistance"
            ],
            "supported_devices": [
                "Smart TVs (LG, Samsung, Sony, etc.)",
                "Cable boxes and set-top boxes",
                "Streaming devices (Roku, Apple TV, Chromecast)",
                "Global Cache iTach IR controllers",
                "Network switches and routers"
            ]
        }
    
    async def start_chat_session(self, user_id: str, issue_category: str = "general") -> str:
        """Start a new chat session"""
        session_id = f"session_{user_id}_{int(time.time())}"
        
        session = TroubleshootingSession(
            session_id=session_id,
            user_id=user_id,
            issue_category=issue_category,
            messages=[]
        )
        
        # Add welcome message
        welcome_message = self._generate_welcome_message(issue_category)
        session.messages.append(ChatMessage(
            role="assistant",
            content=welcome_message,
            timestamp=time.time()
        ))
        
        self.active_sessions[session_id] = session
        self.logger.info(f"Started chat session {session_id} for user {user_id}")
        
        return session_id
    
    def _generate_welcome_message(self, category: str) -> str:
        """Generate welcome message based on category"""
        base_message = "Hello! I'm your Sports Bar TV Controller assistant. I'm here to help you with "
        
        category_messages = {
            "tv_control": "TV discovery, configuration, and control issues.",
            "network": "network configuration and connectivity problems.",
            "cable_box": "cable box setup and IR control issues.",
            "general": "any questions about the system."
        }
        
        specific_message = category_messages.get(category, "any questions you might have.")
        
        return f"{base_message}{specific_message}\n\nWhat can I help you with today?"
    
    async def process_message(self, session_id: str, user_message: str) -> str:
        """Process user message and generate response"""
        session = self.active_sessions.get(session_id)
        if not session:
            return "Session not found. Please start a new chat session."
        
        # Add user message to session
        session.messages.append(ChatMessage(
            role="user",
            content=user_message,
            timestamp=time.time()
        ))
        
        # Generate response
        response = await self._generate_response(session, user_message)
        
        # Add assistant response to session
        session.messages.append(ChatMessage(
            role="assistant",
            content=response,
            timestamp=time.time()
        ))
        
        return response
    
    async def _generate_response(self, session: TroubleshootingSession, user_message: str) -> str:
        """Generate intelligent response to user message"""
        user_message_lower = user_message.lower()
        
        # Check for specific issue patterns
        if any(keyword in user_message_lower for keyword in ["tv not working", "tv not responding", "can't control tv"]):
            return await self._handle_tv_control_issue(session, user_message)
        
        elif any(keyword in user_message_lower for keyword in ["ir not working", "remote not working", "cable box"]):
            return await self._handle_ir_control_issue(session, user_message)
        
        elif any(keyword in user_message_lower for keyword in ["network", "discovery", "can't find", "subnet"]):
            return await self._handle_network_issue(session, user_message)
        
        elif any(keyword in user_message_lower for keyword in ["how to", "setup", "configure", "install"]):
            return await self._handle_configuration_help(session, user_message)
        
        else:
            return await self._handle_general_query(session, user_message)
    
    async def _handle_tv_control_issue(self, session: TroubleshootingSession, message: str) -> str:
        """Handle TV control related issues"""
        response = "I can help you troubleshoot TV control issues. Let me guide you through some steps:\n\n"
        
        # Get troubleshooting flow
        flow = self.knowledge_base.get_troubleshooting_flow("tv_not_responding")
        if flow:
            first_step = flow[0]
            response += f"**Step 1:** {first_step['question']}\n\n"
            response += "Please let me know your answer, and I'll guide you to the next step."
        
        # Add relevant knowledge
        tv_knowledge = self.knowledge_base.get_knowledge_for_category("tv_control")
        if tv_knowledge.get("common_issues"):
            response += "\n\n**Common TV Control Issues:**\n"
            for issue in tv_knowledge["common_issues"][:2]:  # Show first 2 issues
                response += f"• {issue['issue']}\n"
        
        return response
    
    async def _handle_ir_control_issue(self, session: TroubleshootingSession, message: str) -> str:
        """Handle IR control related issues"""
        response = "I'll help you troubleshoot IR control issues with your cable box or other devices.\n\n"
        
        # Get troubleshooting flow
        flow = self.knowledge_base.get_troubleshooting_flow("ir_commands_failing")
        if flow:
            first_step = flow[0]
            response += f"**Step 1:** {first_step['question']}\n\n"
        
        response += "**Quick Checks:**\n"
        response += "• Ensure Global Cache device is powered on\n"
        response += "• Check network connectivity to Global Cache (usually 192.168.1.80)\n"
        response += "• Verify IR blaster is positioned correctly\n"
        response += "• Confirm line of sight to the target device\n\n"
        response += "Which of these areas would you like me to help you check first?"
        
        return response
    
    async def _handle_network_issue(self, session: TroubleshootingSession, message: str) -> str:
        """Handle network and discovery related issues"""
        response = "I can help with network configuration and device discovery issues.\n\n"
        
        network_knowledge = self.knowledge_base.get_knowledge_for_category("network")
        if network_knowledge.get("subnet_ranges"):
            response += "**Network Subnet Configuration:**\n"
            for purpose, range_info in network_knowledge["subnet_ranges"].items():
                response += f"• {purpose.replace('_', ' ').title()}: {range_info}\n"
        
        response += "\n**Common Network Issues:**\n"
        response += "• Device discovery not finding TVs - Check subnet range configuration\n"
        response += "• Network connectivity problems - Verify IP addresses and routing\n"
        response += "• Permission issues - Ensure network scanning permissions\n\n"
        response += "What specific network issue are you experiencing?"
        
        return response
    
    async def _handle_configuration_help(self, session: TroubleshootingSession, message: str) -> str:
        """Handle configuration and setup help"""
        response = "I'll help you with system configuration. Here are the main areas:\n\n"
        
        features = self.knowledge_base.get_knowledge_for_category("features")
        if features:
            response += "**Available Features:**\n"
            for feature, info in features.items():
                response += f"• **{feature.replace('_', ' ').title()}**: {info.get('description', '')}\n"
                if info.get('usage'):
                    response += f"  Usage: {info['usage']}\n"
                response += "\n"
        
        response += "Which feature would you like help configuring?"
        
        return response
    
    async def _handle_general_query(self, session: TroubleshootingSession, message: str) -> str:
        """Handle general queries using knowledge base search"""
        # Search knowledge base
        search_results = self.knowledge_base.search_knowledge_base(message)
        
        if search_results:
            response = "I found some relevant information that might help:\n\n"
            
            for i, result in enumerate(search_results[:3], 1):  # Show top 3 results
                response += f"**{i}. {result['category'].title()} - {result.get('subcategory', '').title()}**\n"
                
                if isinstance(result['content'], dict):
                    if 'issue' in result['content']:
                        response += f"Issue: {result['content']['issue']}\n"
                        if 'solutions' in result['content']:
                            response += f"Solutions: {', '.join(result['content']['solutions'][:2])}\n"
                    else:
                        response += f"{result['content']}\n"
                else:
                    response += f"{result['content']}\n"
                response += "\n"
            
            response += "Would you like more details about any of these topics?"
        else:
            response = "I understand you're asking about the Sports Bar TV Controller system. "
            response += "Could you provide more specific details about what you need help with? "
            response += "For example:\n\n"
            response += "• TV control issues\n"
            response += "• Cable box setup\n"
            response += "• Network configuration\n"
            response += "• Device discovery\n"
            response += "• IR remote control problems"
        
        return response
    
    def get_session_history(self, session_id: str) -> Optional[List[Dict[str, Any]]]:
        """Get chat session history"""
        session = self.active_sessions.get(session_id)
        if not session:
            return None
        
        return [
            {
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp,
                "formatted_time": datetime.fromtimestamp(msg.timestamp).strftime("%Y-%m-%d %H:%M:%S")
            }
            for msg in session.messages
        ]
    
    def end_session(self, session_id: str, resolution_status: str = "resolved") -> bool:
        """End a chat session"""
        session = self.active_sessions.get(session_id)
        if not session:
            return False
        
        session.status = resolution_status
        session.resolved_at = time.time()
        
        # Move to archived sessions (in a real implementation, this would go to a database)
        self.logger.info(f"Ended chat session {session_id} with status: {resolution_status}")
        
        # Remove from active sessions
        del self.active_sessions[session_id]
        
        return True
    
    def get_active_sessions(self) -> Dict[str, Dict[str, Any]]:
        """Get all active chat sessions"""
        return {
            session_id: {
                "user_id": session.user_id,
                "issue_category": session.issue_category,
                "status": session.status,
                "created_at": session.created_at,
                "message_count": len(session.messages),
                "last_activity": session.messages[-1].timestamp if session.messages else session.created_at
            }
            for session_id, session in self.active_sessions.items()
        }

class ChatInterfaceManager:
    """High-level manager for the chat interface system"""
    
    def __init__(self):
        self.assistant = ChatAssistant()
        self.logger = logging.getLogger(__name__)
        
    async def create_chat_session(self, user_id: str, issue_category: str = "general") -> Dict[str, Any]:
        """Create a new chat session"""
        session_id = await self.assistant.start_chat_session(user_id, issue_category)
        
        # Get initial message
        history = self.assistant.get_session_history(session_id)
        
        return {
            "session_id": session_id,
            "status": "active",
            "initial_message": history[-1] if history else None
        }
    
    async def send_message(self, session_id: str, message: str) -> Dict[str, Any]:
        """Send message to chat session"""
        response = await self.assistant.process_message(session_id, message)
        
        return {
            "session_id": session_id,
            "response": response,
            "timestamp": time.time()
        }
    
    def get_session_info(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session information and history"""
        history = self.assistant.get_session_history(session_id)
        if not history:
            return None
        
        return {
            "session_id": session_id,
            "message_history": history,
            "message_count": len(history)
        }
    
    def close_session(self, session_id: str) -> bool:
        """Close a chat session"""
        return self.assistant.end_session(session_id)

# Example usage and testing
if __name__ == "__main__":
    async def main():
        # Initialize chat interface
        chat_manager = ChatInterfaceManager()
        
        # Create a test session
        session_info = await chat_manager.create_chat_session("test_user", "tv_control")
        session_id = session_info["session_id"]
        
        print("Chat Session Started")
        print(f"Initial message: {session_info['initial_message']['content']}")
        
        # Test some interactions
        test_messages = [
            "My TV is not responding to commands",
            "The cable box remote is not working",
            "How do I configure network subnets?"
        ]
        
        for message in test_messages:
            print(f"\nUser: {message}")
            response = await chat_manager.send_message(session_id, message)
            print(f"Assistant: {response['response']}")
        
        # Close session
        chat_manager.close_session(session_id)
        print("\nSession closed")
    
    asyncio.run(main())
