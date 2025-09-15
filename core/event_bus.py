
"""
Simple pub-sub event bus for passing AV state updates to UI dashboard
"""
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, Optional


class EventType(Enum):
    """Types of installation events"""
    GIT_OPERATION = "git_operation"
    BUILD_PROCESS = "build_process"
    DEPLOYMENT = "deployment"
    SERVICE_START = "service_start"
    HEALTH_CHECK = "health_check"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"
    VIDEO_ROUTE = "video_route"
    AUDIO_ROUTE = "audio_route"
    PRESET_RECALL = "preset_recall"
    SYNC_STATUS = "sync_status"


@dataclass
class Event:
    """Represents an event in the AV system"""
    event_id: str
    timestamp: datetime
    event_type: EventType
    source: str
    message: str
    context: Dict[str, Any] = field(default_factory=dict)
    severity: str = "INFO"
    phase: Optional[str] = None
    process_id: Optional[int] = None


# For backward compatibility, alias Event as InstallationEvent
InstallationEvent = Event


class EventBus:
    """Simple pub-sub event bus for passing AV state to UI"""
    def __init__(self):
        self.subscribers = []

    def subscribe(self, func):
        """Subscribe a function to receive events"""
        self.subscribers.append(func)

    def publish(self, event: dict):
        """Publish an event to all subscribers"""
        for sub in self.subscribers:
            try:
                sub(event)
            except Exception as e:
                print(f"EventBus error: {e}")


# Helper functions for creating specific event types
def create_video_route_event(source: str, input_id: int, output_id: int) -> dict:
    """Create a video route change event"""
    return {
        "event_id": f"video_route_{source}_{input_id}_{output_id}_{int(datetime.now().timestamp())}",
        "timestamp": datetime.now().isoformat(),
        "event_type": "video_route",
        "source": source,
        "message": f"Video route changed: Input {input_id} -> Output {output_id}",
        "context": {
            "input_id": input_id,
            "output_id": output_id,
            "device": source
        }
    }


def create_audio_route_event(source: str, input_id: int, zone_id: int) -> dict:
    """Create an audio route change event"""
    return {
        "event_id": f"audio_route_{source}_{input_id}_{zone_id}_{int(datetime.now().timestamp())}",
        "timestamp": datetime.now().isoformat(),
        "event_type": "audio_route",
        "source": source,
        "message": f"Audio route changed: Input {input_id} -> Zone {zone_id}",
        "context": {
            "input_id": input_id,
            "zone_id": zone_id,
            "device": source
        }
    }


def create_preset_event(source: str, preset_id: str, preset_name: str) -> dict:
    """Create a preset recall event"""
    return {
        "event_id": f"preset_{source}_{preset_id}_{int(datetime.now().timestamp())}",
        "timestamp": datetime.now().isoformat(),
        "event_type": "preset_recall",
        "source": source,
        "message": f"Preset recalled: {preset_name} (ID: {preset_id})",
        "context": {
            "preset_id": preset_id,
            "preset_name": preset_name
        }
    }


def create_sync_status_event(source: str, enabled: bool) -> dict:
    """Create a sync status change event"""
    status = "enabled" if enabled else "disabled"
    return {
        "event_id": f"sync_status_{source}_{status}_{int(datetime.now().timestamp())}",
        "timestamp": datetime.now().isoformat(),
        "event_type": "sync_status",
        "source": source,
        "message": f"Bi-directional sync {status}",
        "context": {
            "sync_enabled": enabled
        }
    }


# Singleton instance
event_bus = EventBus()
