
"""
Event Bus System
Simple pub-sub event system for passing AV state updates to UI dashboard
"""

import threading
import logging
from typing import Dict, List, Callable, Any
from dataclasses import dataclass
from enum import Enum
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EventType(Enum):
    """Event type enumeration"""
    VIDEO_ROUTE_CHANGED = "video_route_changed"
    AUDIO_ROUTE_CHANGED = "audio_route_changed"
    VOLUME_CHANGED = "volume_changed"
    MUTE_CHANGED = "mute_changed"
    PRESET_RECALLED = "preset_recalled"
    SYNC_STATUS_CHANGED = "sync_status_changed"
    DEVICE_STATUS_CHANGED = "device_status_changed"

@dataclass
class Event:
    """Event data structure"""
    type: EventType
    source: str  # Device or component that generated the event
    data: Dict[str, Any]
    timestamp: float = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()

class EventBus:
    """
    Simple pub-sub event bus for AV system communication
    
    Features:
    - Thread-safe event publishing and subscription
    - Type-safe event handling
    - Automatic cleanup of dead subscribers
    - Event history for debugging
    - Wildcard subscriptions
    """
    
    def __init__(self, max_history: int = 1000):
        self.subscribers: Dict[EventType, List[Callable]] = {}
        self.wildcard_subscribers: List[Callable] = []
        self.event_history: List[Event] = []
        self.max_history = max_history
        self.lock = threading.Lock()
        
        logger.info("Event bus initialized")
    
    def subscribe(self, event_type: EventType, callback: Callable[[Event], None]):
        """
        Subscribe to specific event type
        
        Args:
            event_type: Type of event to subscribe to
            callback: Function to call when event occurs
        """
        with self.lock:
            if event_type not in self.subscribers:
                self.subscribers[event_type] = []
            
            self.subscribers[event_type].append(callback)
            logger.debug(f"Subscribed to {event_type.value}")
    
    def subscribe_all(self, callback: Callable[[Event], None]):
        """
        Subscribe to all events (wildcard subscription)
        
        Args:
            callback: Function to call for any event
        """
        with self.lock:
            self.wildcard_subscribers.append(callback)
            logger.debug("Subscribed to all events")
    
    def unsubscribe(self, event_type: EventType, callback: Callable[[Event], None]):
        """
        Unsubscribe from specific event type
        
        Args:
            event_type: Type of event to unsubscribe from
            callback: Callback function to remove
        """
        with self.lock:
            if event_type in self.subscribers:
                try:
                    self.subscribers[event_type].remove(callback)
                    logger.debug(f"Unsubscribed from {event_type.value}")
                except ValueError:
                    logger.warning(f"Callback not found for {event_type.value}")
    
    def publish(self, event: Event):
        """
        Publish an event to all subscribers
        
        Args:
            event: Event to publish
        """
        with self.lock:
            # Add to history
            self.event_history.append(event)
            if len(self.event_history) > self.max_history:
                self.event_history.pop(0)
            
            logger.debug(f"Publishing event: {event.type.value} from {event.source}")
            
            # Notify specific subscribers
            if event.type in self.subscribers:
                dead_callbacks = []
                for callback in self.subscribers[event.type]:
                    try:
                        callback(event)
                    except Exception as e:
                        logger.error(f"Subscriber callback error: {e}")
                        dead_callbacks.append(callback)
                
                # Remove dead callbacks
                for dead_callback in dead_callbacks:
                    self.subscribers[event.type].remove(dead_callback)
            
            # Notify wildcard subscribers
            dead_callbacks = []
            for callback in self.wildcard_subscribers:
                try:
                    callback(event)
                except Exception as e:
                    logger.error(f"Wildcard subscriber callback error: {e}")
                    dead_callbacks.append(callback)
            
            # Remove dead wildcard callbacks
            for dead_callback in dead_callbacks:
                self.wildcard_subscribers.remove(dead_callback)
    
    def get_recent_events(self, count: int = 10) -> List[Event]:
        """Get recent events from history"""
        with self.lock:
            return self.event_history[-count:] if self.event_history else []
    
    def get_events_by_type(self, event_type: EventType, count: int = 10) -> List[Event]:
        """Get recent events of specific type"""
        with self.lock:
            filtered_events = [e for e in self.event_history if e.type == event_type]
            return filtered_events[-count:] if filtered_events else []
    
    def clear_history(self):
        """Clear event history"""
        with self.lock:
            self.event_history.clear()
            logger.info("Event history cleared")
    
    def get_subscriber_count(self, event_type: EventType = None) -> int:
        """Get number of subscribers for event type or total"""
        with self.lock:
            if event_type:
                return len(self.subscribers.get(event_type, []))
            else:
                total = sum(len(subs) for subs in self.subscribers.values())
                total += len(self.wildcard_subscribers)
                return total

# Convenience functions for common event types
def create_video_route_event(source: str, input_num: int, output_num: int) -> Event:
    """Create video route changed event"""
    return Event(
        type=EventType.VIDEO_ROUTE_CHANGED,
        source=source,
        data={
            'input': input_num,
            'output': output_num
        }
    )

def create_audio_route_event(source: str, source_id: int, zone_id: int) -> Event:
    """Create audio route changed event"""
    return Event(
        type=EventType.AUDIO_ROUTE_CHANGED,
        source=source,
        data={
            'source_id': source_id,
            'zone_id': zone_id
        }
    )

def create_volume_event(source: str, zone_id: int, volume: float) -> Event:
    """Create volume changed event"""
    return Event(
        type=EventType.VOLUME_CHANGED,
        source=source,
        data={
            'zone_id': zone_id,
            'volume': volume
        }
    )

def create_mute_event(source: str, zone_id: int, muted: bool) -> Event:
    """Create mute changed event"""
    return Event(
        type=EventType.MUTE_CHANGED,
        source=source,
        data={
            'zone_id': zone_id,
            'muted': muted
        }
    )

def create_preset_event(source: str, preset_id: int, preset_name: str = None) -> Event:
    """Create preset recalled event"""
    return Event(
        type=EventType.PRESET_RECALLED,
        source=source,
        data={
            'preset_id': preset_id,
            'preset_name': preset_name
        }
    )

def create_sync_status_event(source: str, sync_enabled: bool) -> Event:
    """Create sync status changed event"""
    return Event(
        type=EventType.SYNC_STATUS_CHANGED,
        source=source,
        data={
            'sync_enabled': sync_enabled
        }
    )

def create_device_status_event(source: str, device_type: str, connected: bool) -> Event:
    """Create device status changed event"""
    return Event(
        type=EventType.DEVICE_STATUS_CHANGED,
        source=source,
        data={
            'device_type': device_type,
            'connected': connected
        }
    )

# Global event bus instance
event_bus = EventBus()

# Example usage
if __name__ == "__main__":
    # Example subscriber
    def handle_video_route(event: Event):
        print(f"Video route changed: Input {event.data['input']} -> Output {event.data['output']}")
    
    def handle_all_events(event: Event):
        print(f"Event: {event.type.value} from {event.source} at {event.timestamp}")
    
    # Subscribe to events
    event_bus.subscribe(EventType.VIDEO_ROUTE_CHANGED, handle_video_route)
    event_bus.subscribe_all(handle_all_events)
    
    # Publish test events
    video_event = create_video_route_event("wolfpack", 1, 2)
    event_bus.publish(video_event)
    
    audio_event = create_audio_route_event("atmosphere", 1, 3)
    event_bus.publish(audio_event)
    
    # Check recent events
    recent = event_bus.get_recent_events(5)
    print(f"Recent events: {len(recent)}")
