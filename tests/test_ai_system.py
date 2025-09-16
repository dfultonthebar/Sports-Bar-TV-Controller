
"""
Tests for the AI system components
"""

import pytest
import asyncio
import json
import tempfile
import os
from unittest.mock import Mock, patch, AsyncMock
from pathlib import Path

# Import the modules to test
from backend.chat_interface import ChatInterfaceManager, ChatAssistant, SystemKnowledgeBase
from backend.system_diagnosis import SystemDiagnostics, SystemMetrics
from backend.rules_engine import RulesEngine, Rule, RuleCondition, RuleAction
from backend.firewall_manager import FirewallManager, FirewallStatus

class TestChatInterface:
    """Test the chat interface functionality"""
    
    @pytest.fixture
    def chat_manager(self):
        return ChatInterfaceManager()
    
    @pytest.fixture
    def knowledge_base(self):
        return SystemKnowledgeBase()
    
    def test_knowledge_base_initialization(self, knowledge_base):
        """Test that knowledge base initializes correctly"""
        assert "tv_control" in knowledge_base.knowledge_base
        assert "network" in knowledge_base.knowledge_base
        assert "features" in knowledge_base.knowledge_base
        
        # Test that common issues are loaded
        tv_issues = knowledge_base.knowledge_base["tv_control"]["common_issues"]
        assert len(tv_issues) > 0
        assert any("TV not responding" in issue["issue"] for issue in tv_issues)
    
    def test_knowledge_base_search(self, knowledge_base):
        """Test knowledge base search functionality"""
        results = knowledge_base.search_knowledge_base("TV not responding")
        assert len(results) > 0
        
        # Check that results have required fields
        for result in results:
            assert "category" in result
            assert "content" in result
            assert "relevance_score" in result
    
    @pytest.mark.asyncio
    async def test_chat_session_creation(self, chat_manager):
        """Test creating a chat session"""
        session_info = await chat_manager.create_chat_session("test_user", "tv_control")
        
        assert "session_id" in session_info
        assert session_info["status"] == "active"
        assert session_info["initial_message"] is not None
    
    @pytest.mark.asyncio
    async def test_chat_message_processing(self, chat_manager):
        """Test processing chat messages"""
        # Create session
        session_info = await chat_manager.create_chat_session("test_user", "tv_control")
        session_id = session_info["session_id"]
        
        # Send message
        response = await chat_manager.send_message(session_id, "My TV is not working")
        
        assert "response" in response
        assert "timestamp" in response
        assert len(response["response"]) > 0

class TestSystemDiagnostics:
    """Test the system diagnostics functionality"""
    
    @pytest.fixture
    def diagnostics(self):
        return SystemDiagnostics()
    
    def test_system_metrics_collection(self, diagnostics):
        """Test collecting system metrics"""
        metrics = diagnostics.get_system_metrics()
        
        assert isinstance(metrics, SystemMetrics)
        assert metrics.cpu_percent >= 0
        assert metrics.memory_percent >= 0
        assert metrics.disk_percent >= 0
        assert metrics.process_count > 0
        assert metrics.uptime_seconds > 0
    
    def test_service_status_check(self, diagnostics):
        """Test checking service status"""
        # Test with a common service
        status = diagnostics.get_service_status("ssh")
        
        assert status.name == "ssh"
        assert status.status in ["running", "stopped", "unknown"]
    
    def test_network_diagnostics(self, diagnostics):
        """Test network diagnostics"""
        network_diags = diagnostics.get_network_diagnostics()
        
        assert isinstance(network_diags, list)
        # Should have at least one network interface
        assert len(network_diags) >= 0
    
    def test_port_connectivity(self, diagnostics):
        """Test port connectivity testing"""
        # Test localhost SSH port (commonly available)
        result = diagnostics.test_port_connectivity("localhost", 22, timeout=2)
        assert isinstance(result, bool)
    
    def test_comprehensive_diagnostics(self, diagnostics):
        """Test running comprehensive diagnostics"""
        results = diagnostics.run_comprehensive_diagnostics()
        
        assert isinstance(results, list)
        assert len(results) > 0
        
        # Check that results have required fields
        for result in results:
            assert hasattr(result, 'test_name')
            assert hasattr(result, 'status')
            assert hasattr(result, 'message')
            assert hasattr(result, 'severity')
            assert result.status in ["pass", "warning", "fail"]
    
    def test_system_health_summary(self, diagnostics):
        """Test system health summary"""
        health = diagnostics.get_system_health_summary()
        
        assert "overall_status" in health
        assert "health_score" in health
        assert "total_tests" in health
        assert "status_counts" in health
        assert "diagnostics" in health
        
        assert health["overall_status"] in ["HEALTHY", "WARNING", "DEGRADED", "CRITICAL"]
        assert 0 <= health["health_score"] <= 100

class TestRulesEngine:
    """Test the rules engine functionality"""
    
    @pytest.fixture
    def temp_rules_dir(self):
        """Create a temporary directory for rules"""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield temp_dir
    
    @pytest.fixture
    def rules_engine(self, temp_rules_dir):
        return RulesEngine(temp_rules_dir)
    
    def test_rules_engine_initialization(self, rules_engine):
        """Test rules engine initialization"""
        assert isinstance(rules_engine.rules, dict)
        assert rules_engine.evaluator is not None
        assert rules_engine.executor is not None
    
    def test_rule_creation_and_storage(self, rules_engine):
        """Test creating and storing rules"""
        # Create a test rule
        rule = Rule(
            id="test_rule",
            name="Test Rule",
            description="A test rule",
            conditions=[
                RuleCondition(field="test.value", operator="gt", value=50)
            ],
            actions=[
                RuleAction(type="log", parameters={"message": "Test triggered"})
            ]
        )
        
        # Add rule
        success = rules_engine.add_rule(rule)
        assert success
        assert "test_rule" in rules_engine.rules
    
    def test_rule_evaluation(self, rules_engine):
        """Test rule evaluation"""
        # Create a test rule
        rule = Rule(
            id="test_rule",
            name="Test Rule",
            description="A test rule",
            conditions=[
                RuleCondition(field="system.cpu_percent", operator="gt", value=50.0)
            ],
            actions=[
                RuleAction(type="log", parameters={"message": "CPU high"})
            ]
        )
        
        rules_engine.add_rule(rule, save_to_file=False)
        
        # Test context that should match
        context = {"system": {"cpu_percent": 75.0}}
        results = rules_engine.evaluate_rules(context)
        
        assert len(results) == 1
        assert results[0].rule_id == "test_rule"
        assert results[0].matched == True
    
    def test_rule_yaml_loading(self, temp_rules_dir):
        """Test loading rules from YAML files"""
        # Create a test YAML rule file
        rule_yaml = """
id: yaml_test_rule
name: YAML Test Rule
description: A rule loaded from YAML
category: test
enabled: true
conditions:
  - field: test.value
    operator: eq
    value: "test"
actions:
  - type: log
    parameters:
      message: "YAML rule triggered"
"""
        
        yaml_file = Path(temp_rules_dir) / "test_rule.yaml"
        with open(yaml_file, 'w') as f:
            f.write(rule_yaml)
        
        # Create rules engine and load rules
        engine = RulesEngine(temp_rules_dir)
        
        assert "yaml_test_rule" in engine.rules
        assert engine.rules["yaml_test_rule"].name == "YAML Test Rule"
    
    def test_rule_statistics(self, rules_engine):
        """Test getting rule statistics"""
        # Add some test rules
        for i in range(3):
            rule = Rule(
                id=f"test_rule_{i}",
                name=f"Test Rule {i}",
                description="A test rule",
                conditions=[],
                actions=[],
                enabled=i < 2  # First 2 enabled, last one disabled
            )
            rules_engine.add_rule(rule, save_to_file=False)
        
        stats = rules_engine.get_rule_statistics()
        
        assert stats["total_rules"] == 3
        assert stats["enabled_rules"] == 2
        assert stats["disabled_rules"] == 1

class TestFirewallManager:
    """Test the firewall manager functionality"""
    
    @pytest.fixture
    def firewall_manager(self):
        # Use dry run mode for testing
        return FirewallManager(dry_run=True)
    
    def test_firewall_manager_initialization(self, firewall_manager):
        """Test firewall manager initialization"""
        assert firewall_manager.dry_run == True
        assert len(firewall_manager.ai_service_ports) > 0
        assert len(firewall_manager.trusted_ranges) > 0
    
    @patch('subprocess.run')
    def test_ufw_status_check(self, mock_run, firewall_manager):
        """Test checking UFW status"""
        # Mock UFW status command
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "Status: active"
        
        is_active = firewall_manager.is_ufw_active()
        assert is_active == True
    
    @patch('subprocess.run')
    def test_ufw_detailed_status(self, mock_run, firewall_manager):
        """Test getting detailed UFW status"""
        # Mock UFW status verbose command
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = """
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere
80/tcp                     ALLOW IN    Anywhere
"""
        
        status = firewall_manager.get_ufw_status()
        
        assert isinstance(status, FirewallStatus)
        assert status.active == True
        assert status.default_incoming == "deny"
        assert status.default_outgoing == "allow"
        assert len(status.rules) >= 0
    
    def test_port_allow_dry_run(self, firewall_manager):
        """Test allowing ports in dry run mode"""
        result = firewall_manager.allow_port(8001, 'tcp')
        assert result == True  # Should succeed in dry run mode
    
    def test_ai_service_configuration(self, firewall_manager):
        """Test configuring AI service access"""
        results = firewall_manager.configure_ai_service_access()
        
        assert isinstance(results, dict)
        # In dry run mode, all operations should succeed
        for service, success in results.items():
            if service != "error":
                assert success == True
    
    def test_ai_service_status(self, firewall_manager):
        """Test getting AI service status"""
        status = firewall_manager.get_ai_service_status()
        
        assert "firewall_active" in status
        assert "ai_service_rules" in status
        assert "ai_service_ports" in status
        assert "trusted_ranges" in status

class TestIntegration:
    """Integration tests for the AI system"""
    
    @pytest.mark.asyncio
    async def test_chat_with_diagnostics_integration(self):
        """Test integration between chat interface and diagnostics"""
        chat_manager = ChatInterfaceManager()
        
        # Create session
        session_info = await chat_manager.create_chat_session("test_user", "general")
        session_id = session_info["session_id"]
        
        # Ask about system health
        response = await chat_manager.send_message(session_id, "What is the system health?")
        
        assert "response" in response
        assert len(response["response"]) > 0
    
    def test_rules_engine_with_diagnostics_context(self):
        """Test rules engine with real diagnostics context"""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create rules engine
            engine = RulesEngine(temp_dir)
            
            # Create a rule for high CPU usage
            rule = Rule(
                id="cpu_test",
                name="CPU Test",
                description="Test CPU monitoring",
                conditions=[
                    RuleCondition(field="system.cpu_percent", operator="gt", value=0.0)
                ],
                actions=[
                    RuleAction(type="log", parameters={"message": "CPU check"})
                ]
            )
            
            engine.add_rule(rule, save_to_file=False)
            
            # Get real system metrics
            diagnostics = SystemDiagnostics()
            metrics = diagnostics.get_system_metrics()
            
            context = {
                "system": {
                    "cpu_percent": metrics.cpu_percent,
                    "memory_percent": metrics.memory_percent,
                    "disk_percent": metrics.disk_percent
                }
            }
            
            # Evaluate rules
            results = engine.evaluate_rules(context)
            
            assert len(results) == 1
            assert results[0].rule_id == "cpu_test"
            # Should match since CPU is always > 0
            assert results[0].matched == True

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
