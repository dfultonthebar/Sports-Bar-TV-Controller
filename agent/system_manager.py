
"""
Intelligent System Manager for Sports Bar TV Controller

This module provides high-level system management, coordination between
AI agent components, and intelligent decision-making capabilities.
"""

import os
import json
import logging
import asyncio
import threading
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from pathlib import Path

from .monitor import LogMonitor, LogEvent
from .analyzer import ErrorAnalyzer, ErrorAnalysis
from .tasks import TaskAutomator, Task

logger = logging.getLogger(__name__)

@dataclass
class SystemStatus:
    """Represents overall system status"""
    timestamp: datetime
    overall_health: str  # 'HEALTHY', 'WARNING', 'CRITICAL', 'DEGRADED'
    health_score: float  # 0-100
    active_issues: int
    resolved_issues: int
    system_uptime: str
    components: Dict[str, Any]
    recommendations: List[str]

@dataclass
class AgentAction:
    """Represents an action taken by the AI agent"""
    action_id: str
    timestamp: datetime
    action_type: str
    description: str
    trigger: str
    parameters: Dict[str, Any]
    result: Optional[Dict[str, Any]] = None
    success: bool = False

class SystemManager:
    """
    Central AI system manager that coordinates all agent components
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.project_root = Path(__file__).parent.parent
        
        # Initialize components
        self.log_monitor = LogMonitor(
            log_directories=self.config.get("log_directories", ["logs/", "backend/logs/"]),
            config=self.config.get("monitor_config", {})
        )
        self.error_analyzer = ErrorAnalyzer(
            config=self.config.get("analyzer_config", {})
        )
        self.task_automator = TaskAutomator(
            config=self.config.get("task_config", {})
        )
        
        # System state
        self.running = False
        self.start_time = None
        self.action_history = []
        self.system_metrics = {}
        self.alert_callbacks = []
        
        # Configuration
        self.auto_fix_enabled = self.config.get("auto_fix_enabled", True)
        self.auto_fix_risk_threshold = self.config.get("auto_fix_risk_threshold", "MEDIUM")
        self.health_check_interval = self.config.get("health_check_interval_minutes", 15)
        self.maintenance_interval = self.config.get("maintenance_interval_hours", 24)
        
        # Threading
        self.management_thread = None
        self.last_health_check = None
        self.last_maintenance = None
        
        # Set up event handlers
        self.log_monitor.add_event_callback(self._handle_log_event)
        
        logger.info("SystemManager initialized")
    
    async def start(self):
        """Start the AI system manager"""
        if self.running:
            logger.warning("SystemManager is already running")
            return
        
        self.running = True
        self.start_time = datetime.now()
        
        logger.info("Starting AI System Manager...")
        
        # Start log monitoring
        self.log_monitor.start_monitoring()
        
        # Start management loop
        self.management_thread = threading.Thread(target=self._management_loop, daemon=True)
        self.management_thread.start()
        
        # Schedule initial tasks
        await self._schedule_initial_tasks()
        
        logger.info("AI System Manager started successfully")
    
    async def stop(self):
        """Stop the AI system manager"""
        if not self.running:
            return
        
        logger.info("Stopping AI System Manager...")
        
        self.running = False
        
        # Stop log monitoring
        self.log_monitor.stop_monitoring()
        
        # Wait for management thread
        if self.management_thread and self.management_thread.is_alive():
            self.management_thread.join(timeout=10)
        
        logger.info("AI System Manager stopped")
    
    def _management_loop(self):
        """Main management loop"""
        while self.running:
            try:
                # Run async management tasks
                asyncio.run(self._run_management_cycle())
                
                # Sleep before next cycle
                asyncio.run(asyncio.sleep(60))  # Run every minute
                
            except Exception as e:
                logger.error(f"Error in management loop: {e}")
                asyncio.run(asyncio.sleep(60))
    
    async def _run_management_cycle(self):
        """Run one cycle of management tasks"""
        try:
            now = datetime.now()
            
            # Periodic health checks
            if (not self.last_health_check or 
                now - self.last_health_check > timedelta(minutes=self.health_check_interval)):
                await self._perform_health_check()
                self.last_health_check = now
            
            # Periodic maintenance
            if (not self.last_maintenance or 
                now - self.last_maintenance > timedelta(hours=self.maintenance_interval)):
                await self._perform_maintenance()
                self.last_maintenance = now
            
            # Process pending analyses
            await self._process_pending_analyses()
            
            # Update system metrics
            await self._update_system_metrics()
            
            # Clean up old data
            await self._cleanup_old_data()
            
        except Exception as e:
            logger.error(f"Error in management cycle: {e}")
    
    async def _handle_log_event(self, log_event: LogEvent):
        """Handle log events from the monitor"""
        try:
            # Only analyze error-level events
            if log_event.level not in ['ERROR', 'CRITICAL']:
                return
            
            logger.info(f"Analyzing log event: {log_event.message[:100]}...")
            
            # Analyze the error
            analysis = await self.error_analyzer.analyze_error(log_event)
            if not analysis:
                return
            
            # Record the action
            action = AgentAction(
                action_id=f"analysis_{int(datetime.now().timestamp())}",
                timestamp=datetime.now(),
                action_type="error_analysis",
                description=f"Analyzed error: {analysis.error_type}",
                trigger="log_event",
                parameters={"log_event_id": log_event.timestamp.isoformat()},
                result=asdict(analysis),
                success=True
            )
            self.action_history.append(action)
            
            # Determine if automatic fix should be attempted
            if (self.auto_fix_enabled and 
                analysis.automated_fix_available and 
                analysis.severity != 'CRITICAL' and
                analysis.confidence_score > 0.7):
                
                await self._attempt_automatic_fix(analysis)
            
            # Send alerts for high-severity issues
            if analysis.severity in ['HIGH', 'CRITICAL']:
                await self._send_alert(analysis)
            
        except Exception as e:
            logger.error(f"Error handling log event: {e}")
    
    async def _attempt_automatic_fix(self, analysis: ErrorAnalysis):
        """Attempt to automatically fix an error"""
        try:
            logger.info(f"Attempting automatic fix for error: {analysis.error_id}")
            
            # Get fix suggestions
            fix_suggestions = analysis.context.get('fix_suggestions', [])
            if not fix_suggestions:
                return
            
            # Find the safest fix
            safe_fixes = [
                fix for fix in fix_suggestions 
                if fix.get('risk_level', 'HIGH') in ['LOW', 'MEDIUM']
            ]
            
            if not safe_fixes:
                logger.info("No safe automatic fixes available")
                return
            
            # Attempt the first safe fix
            fix_result = await self.error_analyzer.implement_fix(analysis, 0)
            
            # Record the action
            action = AgentAction(
                action_id=f"autofix_{int(datetime.now().timestamp())}",
                timestamp=datetime.now(),
                action_type="automatic_fix",
                description=f"Attempted automatic fix for {analysis.error_type}",
                trigger="error_analysis",
                parameters={"analysis_id": analysis.error_id},
                result=fix_result,
                success=fix_result.get('success', False)
            )
            self.action_history.append(action)
            
            if fix_result.get('success'):
                logger.info(f"Automatic fix successful for error: {analysis.error_id}")
            else:
                logger.warning(f"Automatic fix failed for error: {analysis.error_id}")
            
        except Exception as e:
            logger.error(f"Error attempting automatic fix: {e}")
    
    async def _send_alert(self, analysis: ErrorAnalysis):
        """Send alert for high-severity issues"""
        try:
            alert_data = {
                "timestamp": datetime.now().isoformat(),
                "severity": analysis.severity,
                "error_type": analysis.error_type,
                "description": analysis.description,
                "affected_components": analysis.affected_components,
                "suggested_fixes": analysis.suggested_fixes,
                "analysis_id": analysis.error_id
            }
            
            # Notify callbacks
            for callback in self.alert_callbacks:
                try:
                    await callback(alert_data)
                except Exception as e:
                    logger.error(f"Error in alert callback: {e}")
            
            logger.info(f"Alert sent for {analysis.severity} error: {analysis.error_type}")
            
        except Exception as e:
            logger.error(f"Error sending alert: {e}")
    
    async def _perform_health_check(self):
        """Perform comprehensive system health check"""
        try:
            logger.info("Performing system health check...")
            
            # Create health check task
            task = self.task_automator.create_maintenance_task(
                "health_check",
                {"comprehensive": True}
            )
            
            # Execute task
            task_id = await self.task_automator.schedule_task(task)
            
            # Wait for completion (with timeout)
            timeout = 60  # 1 minute timeout
            start_time = datetime.now()
            
            while datetime.now() - start_time < timedelta(seconds=timeout):
                task_status = self.task_automator.get_task_status(task_id)
                if task_status and task_status['status'] in ['completed', 'failed']:
                    break
                await asyncio.sleep(1)
            
            # Record action
            action = AgentAction(
                action_id=f"health_check_{int(datetime.now().timestamp())}",
                timestamp=datetime.now(),
                action_type="health_check",
                description="Performed comprehensive system health check",
                trigger="scheduled",
                parameters={"task_id": task_id},
                success=True
            )
            self.action_history.append(action)
            
        except Exception as e:
            logger.error(f"Error performing health check: {e}")
    
    async def _perform_maintenance(self):
        """Perform routine system maintenance"""
        try:
            logger.info("Performing system maintenance...")
            
            # Schedule maintenance tasks
            maintenance_tasks = [
                ("log_cleanup", {"days_to_keep": 30}),
                ("cache_cleanup", {}),
                ("device_status_check", {})
            ]
            
            for action, params in maintenance_tasks:
                task = self.task_automator.create_maintenance_task(action, params)
                await self.task_automator.schedule_task(task)
            
            # Record action
            action = AgentAction(
                action_id=f"maintenance_{int(datetime.now().timestamp())}",
                timestamp=datetime.now(),
                action_type="maintenance",
                description="Performed routine system maintenance",
                trigger="scheduled",
                parameters={"tasks_scheduled": len(maintenance_tasks)},
                success=True
            )
            self.action_history.append(action)
            
        except Exception as e:
            logger.error(f"Error performing maintenance: {e}")
    
    async def _schedule_initial_tasks(self):
        """Schedule initial tasks when system starts"""
        try:
            # Schedule content discovery task
            content_task = self.task_automator.create_content_discovery_task(
                "update_content_cache",
                {"initial_load": True}
            )
            await self.task_automator.schedule_task(content_task)
            
            # Schedule initial health check
            health_task = self.task_automator.create_maintenance_task(
                "health_check",
                {"startup_check": True}
            )
            await self.task_automator.schedule_task(health_task)
            
            logger.info("Initial tasks scheduled")
            
        except Exception as e:
            logger.error(f"Error scheduling initial tasks: {e}")
    
    async def _process_pending_analyses(self):
        """Process any pending error analyses"""
        try:
            # Get recent analyses that might need follow-up
            recent_analyses = self.error_analyzer.get_analysis_history(hours=1)
            
            for analysis in recent_analyses:
                # Check if analysis needs follow-up action
                if (analysis.severity == 'CRITICAL' and 
                    not analysis.automated_fix_available):
                    
                    # Create manual intervention task
                    task = Task(
                        task_id=f"manual_{int(datetime.now().timestamp())}",
                        name=f"Manual Intervention Required: {analysis.error_type}",
                        description=f"Critical error requires manual attention: {analysis.description}",
                        task_type="manual_intervention",
                        priority=10,
                        created_at=datetime.now(),
                        scheduled_at=None,
                        completed_at=None,
                        status="pending",
                        parameters={"analysis_id": analysis.error_id}
                    )
                    
                    await self.task_automator.schedule_task(task)
            
        except Exception as e:
            logger.error(f"Error processing pending analyses: {e}")
    
    async def _update_system_metrics(self):
        """Update system performance metrics"""
        try:
            # Get log monitor health
            log_health = self.log_monitor.get_system_health()
            
            # Get error statistics
            error_stats = self.log_monitor.get_error_statistics()
            
            # Get task statistics
            active_tasks = len(self.task_automator.get_active_tasks())
            recent_tasks = len(self.task_automator.get_task_history(hours=24))
            
            # Calculate uptime
            uptime = datetime.now() - self.start_time if self.start_time else timedelta(0)
            
            self.system_metrics = {
                "timestamp": datetime.now().isoformat(),
                "uptime_seconds": int(uptime.total_seconds()),
                "log_health": log_health,
                "error_statistics": error_stats,
                "active_tasks": active_tasks,
                "recent_tasks": recent_tasks,
                "total_actions": len(self.action_history),
                "successful_actions": len([a for a in self.action_history if a.success])
            }
            
        except Exception as e:
            logger.error(f"Error updating system metrics: {e}")
    
    async def _cleanup_old_data(self):
        """Clean up old data to prevent memory leaks"""
        try:
            # Clean up old actions (keep last 1000)
            if len(self.action_history) > 1000:
                self.action_history = self.action_history[-1000:]
            
            # Clean up old tasks
            await self.task_automator.cleanup_old_tasks()
            
        except Exception as e:
            logger.error(f"Error cleaning up old data: {e}")
    
    # Public API methods
    def get_system_status(self) -> SystemStatus:
        """Get current system status"""
        try:
            # Get component health
            log_health = self.log_monitor.get_system_health()
            
            # Calculate overall health
            health_score = log_health.get('health_score', 100)
            
            if health_score >= 90:
                overall_health = "HEALTHY"
            elif health_score >= 70:
                overall_health = "WARNING"
            elif health_score >= 50:
                overall_health = "DEGRADED"
            else:
                overall_health = "CRITICAL"
            
            # Count issues
            recent_analyses = self.error_analyzer.get_analysis_history(hours=24)
            active_issues = len([a for a in recent_analyses if a.severity in ['HIGH', 'CRITICAL']])
            resolved_issues = len([a for a in self.action_history if a.action_type == 'automatic_fix' and a.success])
            
            # Generate recommendations
            recommendations = self._generate_recommendations()
            
            # Calculate uptime
            uptime = datetime.now() - self.start_time if self.start_time else timedelta(0)
            uptime_str = str(uptime).split('.')[0]  # Remove microseconds
            
            return SystemStatus(
                timestamp=datetime.now(),
                overall_health=overall_health,
                health_score=health_score,
                active_issues=active_issues,
                resolved_issues=resolved_issues,
                system_uptime=uptime_str,
                components={
                    "log_monitor": log_health,
                    "error_analyzer": {"active": True},
                    "task_automator": {"active_tasks": len(self.task_automator.get_active_tasks())},
                    "system_manager": {"running": self.running}
                },
                recommendations=recommendations
            )
            
        except Exception as e:
            logger.error(f"Error getting system status: {e}")
            return SystemStatus(
                timestamp=datetime.now(),
                overall_health="UNKNOWN",
                health_score=0,
                active_issues=0,
                resolved_issues=0,
                system_uptime="Unknown",
                components={},
                recommendations=["Error retrieving system status"]
            )
    
    def _generate_recommendations(self) -> List[str]:
        """Generate system recommendations"""
        recommendations = []
        
        try:
            # Check recent error patterns
            recent_analyses = self.error_analyzer.get_analysis_history(hours=24)
            
            # Group errors by type
            error_types = {}
            for analysis in recent_analyses:
                error_types[analysis.error_type] = error_types.get(analysis.error_type, 0) + 1
            
            # Recommend fixes for frequent errors
            for error_type, count in error_types.items():
                if count >= 3:
                    recommendations.append(f"Frequent {error_type} detected ({count} times) - consider investigating root cause")
            
            # Check system resources
            if self.system_metrics:
                log_health = self.system_metrics.get('log_health', {})
                if log_health.get('recent_errors', 0) > 10:
                    recommendations.append("High error rate detected - review system logs")
                
                if log_health.get('recent_warnings', 0) > 20:
                    recommendations.append("Many warnings detected - system may need attention")
            
            # Check task performance
            active_tasks = len(self.task_automator.get_active_tasks())
            if active_tasks > 10:
                recommendations.append("Many active tasks - system may be overloaded")
            
            # Default recommendation if none generated
            if not recommendations:
                recommendations.append("System appears healthy - continue monitoring")
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            recommendations.append("Error generating recommendations")
        
        return recommendations
    
    def add_alert_callback(self, callback: Callable[[Dict[str, Any]], None]):
        """Add callback for system alerts"""
        self.alert_callbacks.append(callback)
    
    def remove_alert_callback(self, callback: Callable[[Dict[str, Any]], None]):
        """Remove alert callback"""
        if callback in self.alert_callbacks:
            self.alert_callbacks.remove(callback)
    
    def get_recent_actions(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get recent agent actions"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        recent_actions = [
            action for action in self.action_history
            if action.timestamp >= cutoff_time
        ]
        
        return [asdict(action) for action in recent_actions]
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """Get current system metrics"""
        return self.system_metrics.copy() if self.system_metrics else {}
    
    async def trigger_manual_task(self, task_type: str, parameters: Dict[str, Any] = None) -> str:
        """Manually trigger a task"""
        try:
            if task_type == "content_discovery":
                task = self.task_automator.create_content_discovery_task(
                    parameters.get('action', 'discover_live_games'),
                    parameters
                )
            elif task_type == "maintenance":
                task = self.task_automator.create_maintenance_task(
                    parameters.get('action', 'health_check'),
                    parameters
                )
            else:
                raise ValueError(f"Unknown task type: {task_type}")
            
            task_id = await self.task_automator.schedule_task(task)
            
            # Record action
            action = AgentAction(
                action_id=f"manual_trigger_{int(datetime.now().timestamp())}",
                timestamp=datetime.now(),
                action_type="manual_trigger",
                description=f"Manually triggered {task_type} task",
                trigger="user_request",
                parameters={"task_id": task_id, "task_type": task_type},
                success=True
            )
            self.action_history.append(action)
            
            return task_id
            
        except Exception as e:
            logger.error(f"Error triggering manual task: {e}")
            raise
