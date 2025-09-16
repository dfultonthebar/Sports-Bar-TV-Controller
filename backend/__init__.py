
"""
Sports Bar TV Controller - Backend Module
Enhanced backend system with comprehensive device management and automation
"""

from .discovery import TVDiscoveryService, NetworkScanner, DiscoveredDevice
from .subnet_manager import SubnetManager, SubnetRange
from .cable_box import CableBoxManager, CableBoxDevice, GlobalCacheController, IRCode
from .chat_interface import ChatInterfaceManager, ChatAssistant, SystemKnowledgeBase
from .github_auto import GitHubAutoManager, GitHubRepository, FileAnalyzer

__version__ = "2.0.0"
__author__ = "Sports Bar TV Controller Team"

# Export main classes for easy importing
__all__ = [
    # Discovery system
    "TVDiscoveryService",
    "NetworkScanner", 
    "DiscoveredDevice",
    
    # Subnet management
    "SubnetManager",
    "SubnetRange",
    
    # Cable box control
    "CableBoxManager",
    "CableBoxDevice", 
    "GlobalCacheController",
    "IRCode",
    
    # AI chat interface
    "ChatInterfaceManager",
    "ChatAssistant",
    "SystemKnowledgeBase",
    
    # GitHub automation
    "GitHubAutoManager",
    "GitHubRepository",
    "FileAnalyzer"
]

# Module metadata
BACKEND_FEATURES = [
    "TV Discovery and Network Scanning",
    "Network Subnet Management", 
    "Cable Box IR Control via Global Cache",
    "AI-Powered Chat Interface for Troubleshooting",
    "Automated GitHub File Corrections and Branch Merging"
]

def get_backend_info():
    """Get information about backend capabilities"""
    return {
        "version": __version__,
        "author": __author__,
        "features": BACKEND_FEATURES,
        "modules": __all__
    }
