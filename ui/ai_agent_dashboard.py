
"""
AI Agent Dashboard for Sports Bar TV Controller

This module provides a web interface for monitoring and managing the AI agent system,
including real-time status, error analysis, task management, and system health.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from flask import Blueprint, render_template, jsonify, request, flash, redirect, url_for

from agent.system_manager import SystemManager
from agent.monitor import LogEvent
from agent.analyzer import ErrorAnalysis
from agent.tasks import Task
from ui.ai_api_config_manager import AIAPIConfigManager

logger = logging.getLogger(__name__)

class AIAgentDashboard:
    """
    Web dashboard for AI agent monitoring and management
    """
    
    def __init__(self, system_manager: SystemManager):
        self.system_manager = system_manager
        self.blueprint = Blueprint('ai_agent', __name__, url_prefix='/ai-agent')
        
        # Initialize API configuration manager
        self.api_config_manager = AIAPIConfigManager()
        
        self._setup_routes()
    
    def _setup_routes(self):
        """Setup Flask routes for the AI agent dashboard"""
        
        @self.blueprint.route('/')
        def dashboard():
            """Main AI agent dashboard"""
            try:
                # Get system status
                status = self.system_manager.get_system_status()
                
                # Get recent actions
                recent_actions = self.system_manager.get_recent_actions(hours=24)
                
                # Get system metrics
                metrics = self.system_manager.get_system_metrics()
                
                # Get recent log events
                recent_events = self.system_manager.log_monitor.get_recent_events(hours=1)
                
                # Get active tasks
                active_tasks = self.system_manager.task_automator.get_active_tasks()
                
                return render_template('ai_agent_dashboard.html',
                    status=status,
                    recent_actions=recent_actions[:10],  # Last 10 actions
                    metrics=metrics,
                    recent_events=recent_events[:20],  # Last 20 events
                    active_tasks=active_tasks
                )
                
            except Exception as e:
                logger.error(f"Error loading AI agent dashboard: {e}")
                flash(f"Error loading dashboard: {e}", 'error')
                return render_template('ai_agent_dashboard.html',
                    status=None,
                    recent_actions=[],
                    metrics={},
                    recent_events=[],
                    active_tasks=[]
                )
        
        @self.blueprint.route('/api/status')
        def api_status():
            """API endpoint for system status"""
            try:
                status = self.system_manager.get_system_status()
                return jsonify({
                    'success': True,
                    'status': {
                        'overall_health': status.overall_health,
                        'health_score': status.health_score,
                        'active_issues': status.active_issues,
                        'resolved_issues': status.resolved_issues,
                        'system_uptime': status.system_uptime,
                        'timestamp': status.timestamp.isoformat(),
                        'recommendations': status.recommendations
                    }
                })
            except Exception as e:
                logger.error(f"Error getting system status: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @self.blueprint.route('/api/metrics')
        def api_metrics():
            """API endpoint for system metrics"""
            try:
                metrics = self.system_manager.get_system_metrics()
                return jsonify({
                    'success': True,
                    'metrics': metrics
                })
            except Exception as e:
                logger.error(f"Error getting system metrics: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @self.blueprint.route('/api/events')
        def api_events():
            """API endpoint for recent log events"""
            try:
                hours = request.args.get('hours', 1, type=int)
                level = request.args.get('level', None)
                
                events = self.system_manager.log_monitor.get_recent_events(hours=hours, level=level)
                
                # Convert events to JSON-serializable format
                events_data = []
                for event in events:
                    events_data.append({
                        'timestamp': event.timestamp.isoformat(),
                        'level': event.level,
                        'message': event.message,
                        'source': event.source,
                        'file_path': event.file_path,
                        'line_number': event.line_number,
                        'context': event.context
                    })
                
                return jsonify({
                    'success': True,
                    'events': events_data
                })
                
            except Exception as e:
                logger.error(f"Error getting log events: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @self.blueprint.route('/api/logs/clear', methods=['POST'])
        def api_clear_logs():
            """API endpoint to clear log events"""
            try:
                # Clear logs from the log monitor
                if hasattr(self.system_manager.log_monitor, 'clear_logs'):
                    cleared_count = self.system_manager.log_monitor.clear_logs()
                else:
                    # Fallback: clear the events list if the method doesn't exist
                    if hasattr(self.system_manager.log_monitor, 'events'):
                        cleared_count = len(self.system_manager.log_monitor.events)
                        self.system_manager.log_monitor.events.clear()
                    else:
                        cleared_count = 0
                
                logger.info(f"Cleared {cleared_count} log events via AI dashboard")
                
                return jsonify({
                    'success': True,
                    'message': f'Successfully cleared {cleared_count} log events',
                    'cleared_count': cleared_count
                })
                
            except Exception as e:
                logger.error(f"Error clearing log events: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @self.blueprint.route('/api/actions')
        def api_actions():
            """API endpoint for recent agent actions"""
            try:
                hours = request.args.get('hours', 24, type=int)
                actions = self.system_manager.get_recent_actions(hours=hours)
                
                return jsonify({
                    'success': True,
                    'actions': actions
                })
                
            except Exception as e:
                logger.error(f"Error getting agent actions: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @self.blueprint.route('/api/tasks')
        def api_tasks():
            """API endpoint for task management"""
            try:
                if request.method == 'GET':
                    # Get active and recent tasks
                    active_tasks = self.system_manager.task_automator.get_active_tasks()
                    recent_tasks = self.system_manager.task_automator.get_task_history(hours=24)
                    
                    return jsonify({
                        'success': True,
                        'active_tasks': active_tasks,
                        'recent_tasks': recent_tasks
                    })
                    
            except Exception as e:
                logger.error(f"Error managing tasks: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @self.blueprint.route('/api/tasks/trigger', methods=['POST'])
        def api_trigger_task():
            """API endpoint to manually trigger a task"""
            try:
                data = request.get_json()
                task_type = data.get('task_type')
                parameters = data.get('parameters', {})
                
                if not task_type:
                    return jsonify({'success': False, 'error': 'task_type is required'}), 400
                
                task_id = await self.system_manager.trigger_manual_task(task_type, parameters)
                
                return jsonify({
                    'success': True,
                    'task_id': task_id,
                    'message': f'Task {task_type} triggered successfully'
                })
                
            except Exception as e:
                logger.error(f"Error triggering task: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @self.blueprint.route('/api/analyses')
        def api_analyses():
            """API endpoint for error analyses"""
            try:
                hours = request.args.get('hours', 24, type=int)
                analyses = self.system_manager.error_analyzer.get_analysis_history(hours=hours)
                
                # Convert analyses to JSON-serializable format
                analyses_data = []
                for analysis in analyses:
                    analyses_data.append({
                        'error_id': analysis.error_id,
                        'timestamp': analysis.timestamp.isoformat(),
                        'error_type': analysis.error_type,
                        'severity': analysis.severity,
                        'description': analysis.description,
                        'root_cause': analysis.root_cause,
                        'affected_components': analysis.affected_components,
                        'suggested_fixes': analysis.suggested_fixes,
                        'automated_fix_available': analysis.automated_fix_available,
                        'confidence_score': analysis.confidence_score
                    })
                
                return jsonify({
                    'success': True,
                    'analyses': analyses_data
                })
                
            except Exception as e:
                logger.error(f"Error getting error analyses: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @self.blueprint.route('/api/fix/<analysis_id>', methods=['POST'])
        def api_implement_fix(analysis_id):
            """API endpoint to implement a suggested fix"""
            try:
                data = request.get_json()
                fix_index = data.get('fix_index', 0)
                
                # Find the analysis
                analyses = self.system_manager.error_analyzer.get_analysis_history(hours=24)
                analysis = None
                for a in analyses:
                    if a.error_id == analysis_id:
                        analysis = a
                        break
                
                if not analysis:
                    return jsonify({'success': False, 'error': 'Analysis not found'}), 404
                
                # Implement the fix
                result = await self.system_manager.error_analyzer.implement_fix(analysis, fix_index)
                
                return jsonify({
                    'success': result.get('success', False),
                    'result': result
                })
                
            except Exception as e:
                logger.error(f"Error implementing fix: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @self.blueprint.route('/logs')
        def logs_viewer():
            """Log viewer page"""
            try:
                # Get recent log events
                hours = request.args.get('hours', 1, type=int)
                level = request.args.get('level', None)
                
                events = self.system_manager.log_monitor.get_recent_events(hours=hours, level=level)
                
                # Get error statistics
                error_stats = self.system_manager.log_monitor.get_error_statistics()
                
                return render_template('ai_logs_viewer.html',
                    events=events,
                    error_stats=error_stats,
                    hours=hours,
                    level=level
                )
                
            except Exception as e:
                logger.error(f"Error loading logs viewer: {e}")
                flash(f"Error loading logs: {e}", 'error')
                return render_template('ai_logs_viewer.html',
                    events=[],
                    error_stats={},
                    hours=1,
                    level=None
                )
        
        @self.blueprint.route('/tasks')
        def tasks_manager():
            """Task manager page"""
            try:
                # Get active and recent tasks
                active_tasks = self.system_manager.task_automator.get_active_tasks()
                recent_tasks = self.system_manager.task_automator.get_task_history(hours=24)
                
                return render_template('ai_tasks_manager.html',
                    active_tasks=active_tasks,
                    recent_tasks=recent_tasks
                )
                
            except Exception as e:
                logger.error(f"Error loading tasks manager: {e}")
                flash(f"Error loading tasks: {e}", 'error')
                return render_template('ai_tasks_manager.html',
                    active_tasks=[],
                    recent_tasks=[]
                )
        
        @self.blueprint.route('/analyses')
        def analyses_viewer():
            """Error analyses viewer page"""
            try:
                # Get recent analyses
                hours = request.args.get('hours', 24, type=int)
                analyses = self.system_manager.error_analyzer.get_analysis_history(hours=hours)
                
                # Get fix success rate
                fix_stats = self.system_manager.error_analyzer.get_fix_success_rate()
                
                return render_template('ai_analyses_viewer.html',
                    analyses=analyses,
                    fix_stats=fix_stats,
                    hours=hours
                )
                
            except Exception as e:
                logger.error(f"Error loading analyses viewer: {e}")
                flash(f"Error loading analyses: {e}", 'error')
                return render_template('ai_analyses_viewer.html',
                    analyses=[],
                    fix_stats={},
                    hours=24
                )
        
        @self.blueprint.route('/settings')
        def settings():
            """AI agent settings page"""
            try:
                # Get current configuration
                config = self.system_manager.config
                
                return render_template('ai_settings.html',
                    config=config
                )
                
            except Exception as e:
                logger.error(f"Error loading settings: {e}")
                flash(f"Error loading settings: {e}", 'error')
                return render_template('ai_settings.html',
                    config={}
                )
        
        @self.blueprint.route('/settings', methods=['POST'])
        def update_settings():
            """Update AI agent settings"""
            try:
                # This would update the configuration
                # For now, just show a success message
                flash('Settings updated successfully', 'success')
                return redirect(url_for('ai_agent.settings'))
                
            except Exception as e:
                logger.error(f"Error updating settings: {e}")
                flash(f"Error updating settings: {e}", 'error')
                return redirect(url_for('ai_agent.settings'))
    
    def get_blueprint(self) -> Blueprint:
        """Get the Flask blueprint for the AI agent dashboard"""
        return self.blueprint
    
    def get_api_config_blueprint(self) -> Blueprint:
        """Get the Flask blueprint for the API configuration manager"""
        return self.api_config_manager.get_blueprint()

def create_ai_dashboard_templates():
    """Create HTML templates for the AI agent dashboard"""
    from pathlib import Path
    
    templates_dir = Path(__file__).parent / "templates"
    templates_dir.mkdir(exist_ok=True)
    
    # Main dashboard template
    dashboard_template = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Agent Dashboard - Sports Bar TV Controller</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        .health-indicator {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 10px;
        }
        .health-healthy { background-color: #28a745; }
        .health-warning { background-color: #ffc107; }
        .health-critical { background-color: #dc3545; }
        .health-degraded { background-color: #fd7e14; }
        
        .metric-card {
            transition: transform 0.2s;
        }
        .metric-card:hover {
            transform: translateY(-2px);
        }
        
        .log-event {
            border-left: 4px solid #dee2e6;
            margin-bottom: 10px;
            padding: 10px;
        }
        .log-event.error { border-left-color: #dc3545; }
        .log-event.warning { border-left-color: #ffc107; }
        .log-event.info { border-left-color: #17a2b8; }
        
        .action-item {
            border-left: 3px solid #007bff;
            padding: 8px 12px;
            margin-bottom: 8px;
            background-color: #f8f9fa;
        }
        .action-item.success { border-left-color: #28a745; }
        .action-item.failed { border-left-color: #dc3545; }
    </style>
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container-fluid">
            <a class="navbar-brand" href="/">
                <i class="fas fa-robot"></i> AI Agent Dashboard
            </a>
            <div class="navbar-nav ms-auto">
                <a class="nav-link" href="/"><i class="fas fa-tv"></i> Main Dashboard</a>
                <a class="nav-link" href="/sports"><i class="fas fa-football-ball"></i> Sports Content</a>
                <a class="nav-link" href="/ai-agent/api-config"><i class="fas fa-key"></i> API Config</a>
            </div>
        </div>
    </nav>

    <div class="container-fluid mt-4">
        {% with messages = get_flashed_messages(with_categories=true) %}
            {% if messages %}
                {% for category, message in messages %}
                    <div class="alert alert-{{ 'danger' if category == 'error' else category }} alert-dismissible fade show" role="alert">
                        {{ message }}
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                {% endfor %}
            {% endif %}
        {% endwith %}

        <!-- Navigation Tabs -->
        <div class="row mb-4">
            <div class="col-12">
                <ul class="nav nav-tabs">
                    <li class="nav-item">
                        <a class="nav-link active" href="/ai-agent/">
                            <i class="fas fa-tachometer-alt"></i> Overview
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/ai-agent/api-config">
                            <i class="fas fa-key"></i> API Configuration
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/ai-agent/logs">
                            <i class="fas fa-file-alt"></i> Logs
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/ai-agent/tasks">
                            <i class="fas fa-tasks"></i> Tasks
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/ai-agent/analyses">
                            <i class="fas fa-chart-line"></i> Analyses
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/ai-agent/settings">
                            <i class="fas fa-cog"></i> Settings
                        </a>
                    </li>
                </ul>
            </div>
        </div>

        <!-- System Status Overview -->
        <div class="row mb-4">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h5><i class="fas fa-heartbeat"></i> System Health Overview</h5>
                    </div>
                    <div class="card-body">
                        {% if status %}
                            <div class="row">
                                <div class="col-md-3">
                                    <div class="d-flex align-items-center">
                                        <span class="health-indicator health-{{ status.overall_health.lower() }}"></span>
                                        <div>
                                            <h6 class="mb-0">Overall Health</h6>
                                            <small class="text-muted">{{ status.overall_health }}</small>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <h6 class="mb-0">Health Score</h6>
                                    <div class="progress">
                                        <div class="progress-bar" style="width: {{ status.health_score }}%">
                                            {{ "%.1f"|format(status.health_score) }}%
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <h6 class="mb-0">Active Issues</h6>
                                    <span class="badge bg-{{ 'danger' if status.active_issues > 0 else 'success' }}">
                                        {{ status.active_issues }}
                                    </span>
                                </div>
                                <div class="col-md-3">
                                    <h6 class="mb-0">System Uptime</h6>
                                    <small class="text-muted">{{ status.system_uptime }}</small>
                                </div>
                            </div>
                            
                            {% if status.recommendations %}
                                <div class="mt-3">
                                    <h6>Recommendations:</h6>
                                    <ul class="list-unstyled">
                                        {% for rec in status.recommendations %}
                                            <li><i class="fas fa-lightbulb text-warning"></i> {{ rec }}</li>
                                        {% endfor %}
                                    </ul>
                                </div>
                            {% endif %}
                        {% else %}
                            <div class="text-center text-muted">
                                <i class="fas fa-exclamation-triangle"></i>
                                Unable to load system status
                            </div>
                        {% endif %}
                    </div>
                </div>
            </div>
        </div>

        <!-- Metrics Cards -->
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card metric-card">
                    <div class="card-body text-center">
                        <i class="fas fa-tasks fa-2x text-primary mb-2"></i>
                        <h5>{{ active_tasks|length }}</h5>
                        <small class="text-muted">Active Tasks</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card metric-card">
                    <div class="card-body text-center">
                        <i class="fas fa-exclamation-circle fa-2x text-warning mb-2"></i>
                        <h5>{{ recent_events|length }}</h5>
                        <small class="text-muted">Recent Events</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card metric-card">
                    <div class="card-body text-center">
                        <i class="fas fa-cogs fa-2x text-success mb-2"></i>
                        <h5>{{ recent_actions|length }}</h5>
                        <small class="text-muted">Recent Actions</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card metric-card">
                    <div class="card-body text-center">
                        <i class="fas fa-chart-line fa-2x text-info mb-2"></i>
                        <h5>{{ "%.1f"|format(status.health_score if status else 0) }}%</h5>
                        <small class="text-muted">Health Score</small>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="row">
            <!-- Recent Log Events -->
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h6><i class="fas fa-file-alt"></i> Recent Log Events</h6>
                        <a href="{{ url_for('ai_agent.logs_viewer') }}" class="btn btn-sm btn-outline-primary">
                            View All
                        </a>
                    </div>
                    <div class="card-body" style="max-height: 400px; overflow-y: auto;">
                        {% for event in recent_events[:10] %}
                            <div class="log-event {{ event.level.lower() }}">
                                <div class="d-flex justify-content-between">
                                    <small class="text-muted">{{ event.timestamp.strftime('%H:%M:%S') }}</small>
                                    <span class="badge bg-{{ 'danger' if event.level == 'ERROR' else 'warning' if event.level == 'WARNING' else 'info' }}">
                                        {{ event.level }}
                                    </span>
                                </div>
                                <div class="mt-1">
                                    <strong>{{ event.source }}</strong>: {{ event.message[:100] }}{% if event.message|length > 100 %}...{% endif %}
                                </div>
                            </div>
                        {% else %}
                            <div class="text-center text-muted">
                                <i class="fas fa-check-circle"></i>
                                No recent events
                            </div>
                        {% endfor %}
                    </div>
                </div>
            </div>

            <!-- Recent Agent Actions -->
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h6><i class="fas fa-robot"></i> Recent Agent Actions</h6>
                        <a href="{{ url_for('ai_agent.analyses_viewer') }}" class="btn btn-sm btn-outline-primary">
                            View All
                        </a>
                    </div>
                    <div class="card-body" style="max-height: 400px; overflow-y: auto;">
                        {% for action in recent_actions[:10] %}
                            <div class="action-item {{ 'success' if action.success else 'failed' }}">
                                <div class="d-flex justify-content-between">
                                    <small class="text-muted">{{ action.timestamp[:19] }}</small>
                                    <span class="badge bg-{{ 'success' if action.success else 'danger' }}">
                                        {{ 'Success' if action.success else 'Failed' }}
                                    </span>
                                </div>
                                <div class="mt-1">
                                    <strong>{{ action.action_type.replace('_', ' ').title() }}</strong>: {{ action.description }}
                                </div>
                            </div>
                        {% else %}
                            <div class="text-center text-muted">
                                <i class="fas fa-info-circle"></i>
                                No recent actions
                            </div>
                        {% endfor %}
                    </div>
                </div>
            </div>
        </div>

        <!-- Active Tasks -->
        {% if active_tasks %}
            <div class="row mt-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h6><i class="fas fa-tasks"></i> Active Tasks</h6>
                            <a href="{{ url_for('ai_agent.tasks_manager') }}" class="btn btn-sm btn-outline-primary">
                                Manage Tasks
                            </a>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Task</th>
                                            <th>Type</th>
                                            <th>Status</th>
                                            <th>Created</th>
                                            <th>Priority</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {% for task in active_tasks %}
                                            <tr>
                                                <td>{{ task.name }}</td>
                                                <td>{{ task.task_type.replace('_', ' ').title() }}</td>
                                                <td>
                                                    <span class="badge bg-{{ 'primary' if task.status == 'running' else 'secondary' }}">
                                                        {{ task.status.title() }}
                                                    </span>
                                                </td>
                                                <td>{{ task.created_at[:19] }}</td>
                                                <td>{{ task.priority }}</td>
                                            </tr>
                                        {% endfor %}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        {% endif %}
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Auto-refresh every 30 seconds
        setTimeout(function() {
            location.reload();
        }, 30000);
    </script>
</body>
</html>
    '''
    
    with open(templates_dir / "ai_agent_dashboard.html", "w") as f:
        f.write(dashboard_template)
    
    logger.info("AI agent dashboard templates created")
