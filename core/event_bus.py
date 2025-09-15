
"""
Simple pub-sub event bus for passing AV state updates to UI dashboard
"""
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

# Singleton instance
event_bus = EventBus()
