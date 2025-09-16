
"""
Task Automation and Content Discovery Assistant

This module provides intelligent task automation, content discovery assistance,
and system management capabilities for the Sports Bar TV Controller.
"""

import os
import json
import logging
import asyncio
import aiohttp
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from pathlib import Path

logger = logging.getLogger(__name__)

@dataclass
class Task:
    """Represents an automated task"""
    task_id: str
    name: str
    description: str
    task_type: str
    priority: int
    created_at: datetime
    scheduled_at: Optional[datetime]
    completed_at: Optional[datetime]
    status: str  # 'pending', 'running', 'completed', 'failed'
    parameters: Dict[str, Any]
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@dataclass
class ContentRecommendation:
    """Represents a content recommendation"""
    content_id: str
    title: str
    description: str
    content_type: str  # 'live_game', 'upcoming_game', 'trending'
    provider: str
    deep_link: str
    relevance_score: float
    metadata: Dict[str, Any]

class TaskAutomator:
    """
    Intelligent task automation system for sports bar operations
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.tasks = {}
        self.task_history = []
        self.content_cache = {}
        self.project_root = Path(__file__).parent.parent
        
        # Task execution settings
        self.max_concurrent_tasks = self.config.get("max_concurrent_tasks", 5)
        self.task_timeout = self.config.get("task_timeout_seconds", 300)
        
        # Content discovery settings
        self.content_refresh_interval = self.config.get("content_refresh_minutes", 15)
        self.last_content_refresh = None
        
        logger.info("TaskAutomator initialized")
    
    async def schedule_task(self, task: Task) -> str:
        """Schedule a task for execution"""
        self.tasks[task.task_id] = task
        logger.info(f"Scheduled task: {task.name} ({task.task_id})")
        
        # Execute immediately if not scheduled for later
        if not task.scheduled_at or task.scheduled_at <= datetime.now():
            asyncio.create_task(self._execute_task(task.task_id))
        
        return task.task_id
    
    async def _execute_task(self, task_id: str):
        """Execute a specific task"""
        if task_id not in self.tasks:
            logger.error(f"Task not found: {task_id}")
            return
        
        task = self.tasks[task_id]
        task.status = 'running'
        
        try:
            logger.info(f"Executing task: {task.name}")
            
            # Route to appropriate handler based on task type
            if task.task_type == 'content_discovery':
                result = await self._handle_content_discovery_task(task)
            elif task.task_type == 'system_maintenance':
                result = await self._handle_maintenance_task(task)
            elif task.task_type == 'device_check':
                result = await self._handle_device_check_task(task)
            elif task.task_type == 'log_analysis':
                result = await self._handle_log_analysis_task(task)
            elif task.task_type == 'preset_optimization':
                result = await self._handle_preset_optimization_task(task)
            else:
                result = {"error": f"Unknown task type: {task.task_type}"}
            
            task.result = result
            task.status = 'completed'
            task.completed_at = datetime.now()
            
            logger.info(f"Task completed: {task.name}")
            
        except Exception as e:
            task.error = str(e)
            task.status = 'failed'
            task.completed_at = datetime.now()
            logger.error(f"Task failed: {task.name}, error: {e}")
        
        # Move to history
        self.task_history.append(task)
        if task_id in self.tasks:
            del self.tasks[task_id]
    
    async def _handle_content_discovery_task(self, task: Task) -> Dict[str, Any]:
        """Handle content discovery tasks"""
        action = task.parameters.get('action', 'discover_live_games')
        
        if action == 'discover_live_games':
            return await self._discover_live_games(task.parameters)
        elif action == 'find_specific_game':
            return await self._find_specific_game(task.parameters)
        elif action == 'get_trending_content':
            return await self._get_trending_content(task.parameters)
        elif action == 'update_content_cache':
            return await self._update_content_cache()
        else:
            return {"error": f"Unknown content discovery action: {action}"}
    
    async def _discover_live_games(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Discover currently live games"""
        try:
            # This would integrate with the existing sports content discovery system
            from services.content_discovery_manager import ContentDiscoveryManager
            
            # Create a temporary content manager (in real implementation, this would be injected)
            content_manager = ContentDiscoveryManager({})
            
            # Get live games
            live_games = await self._get_live_games_from_apis()
            
            # Generate recommendations
            recommendations = []
            for game in live_games:
                recommendation = ContentRecommendation(
                    content_id=game.get('id', ''),
                    title=game.get('title', ''),
                    description=game.get('description', ''),
                    content_type='live_game',
                    provider=game.get('provider', ''),
                    deep_link=game.get('deep_link', ''),
                    relevance_score=self._calculate_relevance_score(game),
                    metadata=game
                )
                recommendations.append(recommendation)
            
            # Sort by relevance
            recommendations.sort(key=lambda x: x.relevance_score, reverse=True)
            
            return {
                "live_games_found": len(recommendations),
                "recommendations": [asdict(rec) for rec in recommendations[:10]],
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error discovering live games: {e}")
            return {"error": str(e)}
    
    async def _find_specific_game(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Find a specific game by team or league"""
        try:
            team = parameters.get('team', '')
            league = parameters.get('league', '')
            sport = parameters.get('sport', '')
            
            # Search for games matching criteria
            matching_games = await self._search_games(team=team, league=league, sport=sport)
            
            if not matching_games:
                return {
                    "found": False,
                    "message": f"No games found for criteria: team={team}, league={league}, sport={sport}"
                }
            
            # Return best match
            best_match = matching_games[0]
            return {
                "found": True,
                "game": best_match,
                "deep_link": best_match.get('deep_link', ''),
                "provider": best_match.get('provider', ''),
                "start_time": best_match.get('start_time', ''),
                "status": best_match.get('status', '')
            }
            
        except Exception as e:
            logger.error(f"Error finding specific game: {e}")
            return {"error": str(e)}
    
    async def _get_trending_content(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Get trending sports content"""
        try:
            # Analyze recent searches and popular content
            trending_topics = await self._analyze_trending_topics()
            
            # Get content for trending topics
            trending_content = []
            for topic in trending_topics:
                content = await self._get_content_for_topic(topic)
                trending_content.extend(content)
            
            # Sort by trending score
            trending_content.sort(key=lambda x: x.get('trending_score', 0), reverse=True)
            
            return {
                "trending_topics": trending_topics,
                "trending_content": trending_content[:15],
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting trending content: {e}")
            return {"error": str(e)}
    
    async def _handle_maintenance_task(self, task: Task) -> Dict[str, Any]:
        """Handle system maintenance tasks"""
        action = task.parameters.get('action', 'health_check')
        
        if action == 'health_check':
            return await self._perform_health_check()
        elif action == 'log_cleanup':
            return await self._cleanup_logs()
        elif action == 'cache_cleanup':
            return await self._cleanup_cache()
        elif action == 'device_status_check':
            return await self._check_device_status()
        else:
            return {"error": f"Unknown maintenance action: {action}"}
    
    async def _perform_health_check(self) -> Dict[str, Any]:
        """Perform comprehensive system health check"""
        try:
            health_status = {
                "timestamp": datetime.now().isoformat(),
                "overall_status": "HEALTHY",
                "components": {}
            }
            
            # Check disk space
            disk_usage = await self._check_disk_usage()
            health_status["components"]["disk"] = disk_usage
            
            # Check memory usage
            memory_usage = await self._check_memory_usage()
            health_status["components"]["memory"] = memory_usage
            
            # Check service status
            service_status = await self._check_service_status()
            health_status["components"]["services"] = service_status
            
            # Check device connectivity
            device_status = await self._check_device_connectivity()
            health_status["components"]["devices"] = device_status
            
            # Determine overall status
            component_statuses = [comp.get("status", "UNKNOWN") for comp in health_status["components"].values()]
            if "CRITICAL" in component_statuses:
                health_status["overall_status"] = "CRITICAL"
            elif "WARNING" in component_statuses:
                health_status["overall_status"] = "WARNING"
            
            return health_status
            
        except Exception as e:
            logger.error(f"Error performing health check: {e}")
            return {"error": str(e)}
    
    async def _handle_device_check_task(self, task: Task) -> Dict[str, Any]:
        """Handle device check tasks"""
        try:
            device_name = task.parameters.get('device_name', 'all')
            
            if device_name == 'all':
                return await self._check_all_devices()
            else:
                return await self._check_specific_device(device_name)
                
        except Exception as e:
            logger.error(f"Error checking devices: {e}")
            return {"error": str(e)}
    
    async def _handle_log_analysis_task(self, task: Task) -> Dict[str, Any]:
        """Handle log analysis tasks"""
        try:
            analysis_type = task.parameters.get('analysis_type', 'error_summary')
            hours = task.parameters.get('hours', 24)
            
            if analysis_type == 'error_summary':
                return await self._analyze_error_patterns(hours)
            elif analysis_type == 'performance_analysis':
                return await self._analyze_performance_metrics(hours)
            elif analysis_type == 'usage_patterns':
                return await self._analyze_usage_patterns(hours)
            else:
                return {"error": f"Unknown analysis type: {analysis_type}"}
                
        except Exception as e:
            logger.error(f"Error analyzing logs: {e}")
            return {"error": str(e)}
    
    async def _handle_preset_optimization_task(self, task: Task) -> Dict[str, Any]:
        """Handle preset optimization tasks"""
        try:
            # Analyze preset usage patterns
            usage_data = await self._analyze_preset_usage()
            
            # Generate optimization suggestions
            suggestions = await self._generate_preset_suggestions(usage_data)
            
            return {
                "usage_analysis": usage_data,
                "optimization_suggestions": suggestions,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error optimizing presets: {e}")
            return {"error": str(e)}
    
    # Helper methods for content discovery
    async def _get_live_games_from_apis(self) -> List[Dict[str, Any]]:
        """Get live games from sports APIs"""
        # Placeholder implementation - would integrate with actual APIs
        return [
            {
                "id": "game_1",
                "title": "Lakers vs Warriors",
                "description": "NBA Regular Season",
                "provider": "ESPN+",
                "deep_link": "espn://game/12345",
                "start_time": datetime.now().isoformat(),
                "status": "live",
                "league": "NBA",
                "sport": "basketball"
            }
        ]
    
    def _calculate_relevance_score(self, game: Dict[str, Any]) -> float:
        """Calculate relevance score for a game"""
        score = 0.5  # Base score
        
        # Boost for live games
        if game.get('status') == 'live':
            score += 0.3
        
        # Boost for popular leagues
        popular_leagues = ['NFL', 'NBA', 'MLB', 'NHL', 'Premier League']
        if game.get('league') in popular_leagues:
            score += 0.2
        
        # Boost for prime time
        now = datetime.now()
        if 18 <= now.hour <= 23:  # 6 PM to 11 PM
            score += 0.1
        
        return min(score, 1.0)
    
    async def _search_games(self, team: str = '', league: str = '', sport: str = '') -> List[Dict[str, Any]]:
        """Search for games matching criteria"""
        # Placeholder implementation
        all_games = await self._get_live_games_from_apis()
        
        matching_games = []
        for game in all_games:
            if team and team.lower() not in game.get('title', '').lower():
                continue
            if league and league.lower() != game.get('league', '').lower():
                continue
            if sport and sport.lower() != game.get('sport', '').lower():
                continue
            matching_games.append(game)
        
        return matching_games
    
    # Helper methods for system maintenance
    async def _check_disk_usage(self) -> Dict[str, Any]:
        """Check disk usage"""
        import shutil
        
        try:
            total, used, free = shutil.disk_usage("/")
            usage_percent = (used / total) * 100
            
            status = "HEALTHY"
            if usage_percent > 90:
                status = "CRITICAL"
            elif usage_percent > 80:
                status = "WARNING"
            
            return {
                "status": status,
                "usage_percent": round(usage_percent, 2),
                "total_gb": round(total / (1024**3), 2),
                "used_gb": round(used / (1024**3), 2),
                "free_gb": round(free / (1024**3), 2)
            }
        except Exception as e:
            return {"status": "ERROR", "error": str(e)}
    
    async def _check_memory_usage(self) -> Dict[str, Any]:
        """Check memory usage"""
        try:
            import psutil
            
            memory = psutil.virtual_memory()
            usage_percent = memory.percent
            
            status = "HEALTHY"
            if usage_percent > 90:
                status = "CRITICAL"
            elif usage_percent > 80:
                status = "WARNING"
            
            return {
                "status": status,
                "usage_percent": usage_percent,
                "total_gb": round(memory.total / (1024**3), 2),
                "available_gb": round(memory.available / (1024**3), 2)
            }
        except ImportError:
            return {"status": "UNKNOWN", "error": "psutil not available"}
        except Exception as e:
            return {"status": "ERROR", "error": str(e)}
    
    async def _check_service_status(self) -> Dict[str, Any]:
        """Check service status"""
        # Placeholder implementation
        return {
            "status": "HEALTHY",
            "services": {
                "sportsbar-controller": "running",
                "web-dashboard": "running",
                "content-discovery": "running"
            }
        }
    
    async def _check_device_connectivity(self) -> Dict[str, Any]:
        """Check device connectivity"""
        # Placeholder implementation
        return {
            "status": "HEALTHY",
            "devices": {
                "wolfpack_matrix": "connected",
                "atlas_processor": "connected"
            }
        }
    
    # Task management methods
    def create_content_discovery_task(self, action: str, parameters: Dict[str, Any] = None) -> Task:
        """Create a content discovery task"""
        task_id = f"content_{int(datetime.now().timestamp())}"
        
        return Task(
            task_id=task_id,
            name=f"Content Discovery: {action}",
            description=f"Automated content discovery task: {action}",
            task_type="content_discovery",
            priority=5,
            created_at=datetime.now(),
            scheduled_at=None,
            completed_at=None,
            status="pending",
            parameters={"action": action, **(parameters or {})}
        )
    
    def create_maintenance_task(self, action: str, parameters: Dict[str, Any] = None) -> Task:
        """Create a maintenance task"""
        task_id = f"maint_{int(datetime.now().timestamp())}"
        
        return Task(
            task_id=task_id,
            name=f"Maintenance: {action}",
            description=f"Automated maintenance task: {action}",
            task_type="system_maintenance",
            priority=3,
            created_at=datetime.now(),
            scheduled_at=None,
            completed_at=None,
            status="pending",
            parameters={"action": action, **(parameters or {})}
        )
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific task"""
        if task_id in self.tasks:
            return asdict(self.tasks[task_id])
        
        # Check history
        for task in self.task_history:
            if task.task_id == task_id:
                return asdict(task)
        
        return None
    
    def get_active_tasks(self) -> List[Dict[str, Any]]:
        """Get all active tasks"""
        return [asdict(task) for task in self.tasks.values()]
    
    def get_task_history(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get task history"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        recent_tasks = [
            task for task in self.task_history
            if task.created_at >= cutoff_time
        ]
        
        return [asdict(task) for task in recent_tasks]
    
    async def cleanup_old_tasks(self):
        """Clean up old completed tasks"""
        cutoff_time = datetime.now() - timedelta(days=7)
        
        self.task_history = [
            task for task in self.task_history
            if task.created_at >= cutoff_time
        ]
        
        logger.info(f"Cleaned up old tasks, {len(self.task_history)} tasks remaining in history")
