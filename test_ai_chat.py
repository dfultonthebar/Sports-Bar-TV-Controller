#!/usr/bin/env python3
"""
Test script for AI Chat Service

This script tests the AI Chat Service integration with the Sports Bar TV Controller system.
"""

import requests
import time
import json
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

def test_ai_chat_service():
    """Test AI Chat Service endpoints"""
    base_url = "http://localhost:8001"
    
    print("🧪 Testing AI Chat Service...")
    print("=" * 50)
    
    # Test health endpoint
    try:
        response = requests.get(f"{base_url}/api/health", timeout=5)
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ Health Check: {health_data['status']}")
            print(f"   Service: {health_data['service']}")
            print(f"   Port: {health_data['port']}")
            print(f"   Active Sessions: {health_data['active_sessions']}")
        else:
            print(f"❌ Health Check Failed: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health Check Failed: {e}")
        return False
    
    # Test config endpoint
    try:
        response = requests.get(f"{base_url}/api/config", timeout=5)
        if response.status_code == 200:
            config_data = response.json()
            print(f"✅ Configuration: Loaded successfully")
            print(f"   Max Message Length: {config_data['max_message_length']}")
            print(f"   System Commands: {config_data['system_integration']['enable_system_commands']}")
        else:
            print(f"❌ Configuration Failed: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Configuration Failed: {e}")
    
    # Test sessions endpoint
    try:
        response = requests.get(f"{base_url}/api/sessions", timeout=5)
        if response.status_code == 200:
            sessions_data = response.json()
            print(f"✅ Sessions: {len(sessions_data)} active sessions")
        else:
            print(f"❌ Sessions Failed: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Sessions Failed: {e}")
    
    # Test main page
    try:
        response = requests.get(f"{base_url}/", timeout=5)
        if response.status_code == 200:
            print(f"✅ Main Page: Accessible")
            print(f"   Content Length: {len(response.text)} bytes")
        else:
            print(f"❌ Main Page Failed: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Main Page Failed: {e}")
    
    print("=" * 50)
    return True

def test_system_integration():
    """Test integration with existing system services"""
    print("🔗 Testing System Integration...")
    print("=" * 50)
    
    services = [
        ("Main Dashboard", "http://localhost:5000/api/health", 5000),
        ("AI Monitor", "http://localhost:3001/api/health", 3001),
        ("AI Chat", "http://localhost:8001/api/health", 8001)
    ]
    
    results = {}
    
    for service_name, url, port in services:
        try:
            response = requests.get(url, timeout=3)
            if response.status_code == 200:
                print(f"✅ {service_name} (:{port}): Online")
                results[service_name] = "Online"
            else:
                print(f"⚠️  {service_name} (:{port}): HTTP {response.status_code}")
                results[service_name] = f"HTTP {response.status_code}"
        except requests.exceptions.ConnectionError:
            print(f"❌ {service_name} (:{port}): Offline")
            results[service_name] = "Offline"
        except Exception as e:
            print(f"❌ {service_name} (:{port}): Error - {e}")
            results[service_name] = f"Error: {e}"
    
    print("=" * 50)
    
    # Summary
    online_services = sum(1 for status in results.values() if status == "Online")
    total_services = len(results)
    
    print(f"📊 System Status Summary:")
    print(f"   Services Online: {online_services}/{total_services}")
    
    if online_services == total_services:
        print("🎉 All services are running successfully!")
    elif online_services > 0:
        print("⚠️  Some services are running, system partially operational")
    else:
        print("❌ No services are responding")
    
    return results

def main():
    """Main test function"""
    print("🏈 Sports Bar TV Controller - AI Chat Service Test")
    print("=" * 60)
    
    # Test AI Chat Service
    chat_success = test_ai_chat_service()
    
    print()
    
    # Test System Integration
    integration_results = test_system_integration()
    
    print()
    print("=" * 60)
    
    if chat_success and integration_results.get("AI Chat") == "Online":
        print("✅ AI Chat Service test completed successfully!")
        print("🚀 Service is ready for production use")
        
        print("\n📋 Next Steps:")
        print("   1. Access the chat interface at: http://localhost:8001")
        print("   2. Test the chat functionality in your browser")
        print("   3. Try system commands like /help, /status")
        print("   4. Integrate with existing dashboard navigation")
        
        return True
    else:
        print("❌ AI Chat Service test failed!")
        print("🔧 Please check the service logs and configuration")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
