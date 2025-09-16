"""
Event Bus - System-wide event management
"""

import logging
from typing import Dict, List, Callable, Any

logger = logging.getLogger(__name__)

class EventBus:
    """System-wide event bus for component communication"""
    
    def __init__(self):
        self.listeners: Dict[str, List[Callable]] = {}
    
    def subscribe(self, event_type: str, callback: Callable):
        """Subscribe to an event type"""
        if event_type not in self.listeners:
            self.listeners[event_type] = []
        self.listeners[event_type].append(callback)
        logger.debug(f"Subscribed to event: {event_type}")
    
    def publish(self, event_type: str, data: Any = None):
        """Publish an event"""
        if event_type in self.listeners:
            for callback in self.listeners[event_type]:
                try:
                    callback(data)
                except Exception as e:
                    logger.error(f"Error in event callback: {e}")
        logger.debug(f"Published event: {event_type}")

# Global event bus instance
event_bus = EventBus()
