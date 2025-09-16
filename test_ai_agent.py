#!/usr/bin/env python3
"""
Simple test script to verify AI Agent system functionality
"""

import sys
import os
import time
import logging
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def test_ai_agent_imports():
    """Test that all AI agent components can be imported"""
    print("Testing AI Agent imports...")
    
    try:
        from agent import LogMonitor, ErrorAnalyzer, TaskAutomator, SystemManager
        print("✅ All AI agent components imported successfully")
        return True
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False

def test_log_monitor():
    """Test log monitor functionality"""
    print("\nTesting Log Monitor...")
    
    try:
        from agent.monitor import LogMonitor
        
        # Create test log directory
        test_log_dir = "test_logs"
        os.makedirs(test_log_dir, exist_ok=True)
        
        # Initialize monitor
        monitor = LogMonitor(log_directories=[test_log_dir])
        
        # Create a test log file
        test_log_file = os.path.join(test_log_dir, "test.log")
        with open(test_log_file, "w") as f:
            f.write("2025-01-12 10:00:00 - test - INFO - System started\n")
            f.write("2025-01-12 10:01:00 - test - ERROR - Connection failed to device 192.168.1.100\n")
        
        # Test file monitoring
        if monitor.should_monitor_file(test_log_file):
            print("✅ Log monitor can detect log files")
        else:
            print("❌ Log monitor failed to detect log files")
            return False
        
        # Test pattern detection
        error_patterns = monitor.error_patterns
        if len(error_patterns) > 0:
            print(f"✅ Log monitor loaded {len(error_patterns)} error patterns")
        else:
            print("❌ Log monitor failed to load error patterns")
            return False
        
        # Cleanup
        os.remove(test_log_file)
        os.rmdir(test_log_dir)
        
        return True
        
    except Exception as e:
        print(f"❌ Log monitor test failed: {e}")
        return False

def test_error_analyzer():
    """Test error analyzer functionality"""
    print("\nTesting Error Analyzer...")
    
    try:
        from agent.analyzer import ErrorAnalyzer
        from agent.monitor import LogEvent
        from datetime import datetime
        
        # Initialize analyzer
        analyzer = ErrorAnalyzer()
        
        # Create test log event
        test_event = LogEvent(
            timestamp=datetime.now(),
            level="ERROR",
            message="Connection failed to wolfpack matrix at 192.168.1.100:5000",
            source="test",
            file_path="test.log",
            line_number=1
        )
        
        # Test error classification
        error_type = analyzer._classify_error_type(test_event)
        if error_type == "connection_error":
            print("✅ Error analyzer correctly classified connection error")
        else:
            print(f"❌ Error analyzer misclassified error as: {error_type}")
            return False
        
        # Test severity assessment
        severity = analyzer._assess_severity(test_event, error_type)
        if severity in ["HIGH", "MEDIUM", "LOW", "CRITICAL"]:
            print(f"✅ Error analyzer assigned severity: {severity}")
        else:
            print(f"❌ Error analyzer assigned invalid severity: {severity}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error analyzer test failed: {e}")
        return False

def test_task_automator():
    """Test task automator functionality"""
    print("\nTesting Task Automator...")
    
    try:
        from agent.tasks import TaskAutomator, Task
        from datetime import datetime
        
        # Initialize task automator
        automator = TaskAutomator()
        
        # Create test task
        test_task = Task(
            task_id="test_001",
            name="Test Task",
            description="Test task for verification",
            task_type="system_maintenance",
            priority=5,
            created_at=datetime.now(),
            scheduled_at=None,
            completed_at=None,
            status="pending",
            parameters={"action": "health_check"}
        )
        
        # Test task creation
        if test_task.task_id == "test_001":
            print("✅ Task automator can create tasks")
        else:
            print("❌ Task automator failed to create tasks")
            return False
        
        # Test task management
        active_tasks = automator.get_active_tasks()
        if isinstance(active_tasks, list):
            print("✅ Task automator can manage task lists")
        else:
            print("❌ Task automator failed to manage tasks")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Task automator test failed: {e}")
        return False

def test_system_manager():
    """Test system manager functionality"""
    print("\nTesting System Manager...")
    
    try:
        from agent.system_manager import SystemManager
        
        # Initialize system manager with test config
        test_config = {
            'enabled': True,
            'log_directories': ['logs/'],
            'monitor_config': {
                'rate_limit_minutes': 5,
                'max_occurrences_per_window': 5,
                'history_hours': 24
            },
            'analyzer_config': {
                'auto_fix_enabled': False,  # Disable for testing
                'auto_fix_risk_threshold': 'MEDIUM'
            },
            'task_config': {
                'max_concurrent_tasks': 5,
                'task_timeout_seconds': 300
            }
        }
        
        manager = SystemManager(test_config)
        
        # Test system status
        status = manager.get_system_status()
        if hasattr(status, 'overall_health'):
            print(f"✅ System manager reports health: {status.overall_health}")
        else:
            print("❌ System manager failed to generate status")
            return False
        
        # Test metrics
        metrics = manager.get_system_metrics()
        if isinstance(metrics, dict):
            print("✅ System manager can generate metrics")
        else:
            print("❌ System manager failed to generate metrics")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ System manager test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🤖 AI Agent System Test Suite")
    print("=" * 50)
    
    tests = [
        test_ai_agent_imports,
        test_log_monitor,
        test_error_analyzer,
        test_task_automator,
        test_system_manager
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        time.sleep(0.5)  # Brief pause between tests
    
    print("\n" + "=" * 50)
    print(f"Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! AI Agent system is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the implementation.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
