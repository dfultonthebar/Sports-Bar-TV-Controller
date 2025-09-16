
"""
Metrics Collector
=================

Collects and manages performance metrics for the AI bridge system.
"""

import time
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from collections import defaultdict, deque
import json
import threading

logger = logging.getLogger(__name__)

@dataclass
class MetricPoint:
    """A single metric data point"""
    timestamp: float
    value: float
    tags: Dict[str, str] = field(default_factory=dict)

@dataclass
class MetricSeries:
    """A series of metric points"""
    name: str
    points: deque = field(default_factory=lambda: deque(maxlen=1000))
    
    def add_point(self, value: float, tags: Dict[str, str] = None):
        """Add a metric point"""
        point = MetricPoint(
            timestamp=time.time(),
            value=value,
            tags=tags or {}
        )
        self.points.append(point)
    
    def get_recent_values(self, seconds: int = 300) -> List[float]:
        """Get values from the last N seconds"""
        cutoff_time = time.time() - seconds
        return [
            point.value for point in self.points
            if point.timestamp >= cutoff_time
        ]
    
    def get_average(self, seconds: int = 300) -> float:
        """Get average value over the last N seconds"""
        values = self.get_recent_values(seconds)
        return sum(values) / len(values) if values else 0.0
    
    def get_latest(self) -> Optional[float]:
        """Get the latest value"""
        return self.points[-1].value if self.points else None

class MetricsCollector:
    """
    Collects and manages performance metrics for the AI bridge system.
    
    Features:
    - Real-time metric collection
    - Time-series data storage
    - Aggregation and analysis
    - Performance monitoring
    - Alert threshold checking
    """
    
    def __init__(self, max_points_per_series: int = 1000):
        self.max_points_per_series = max_points_per_series
        self.metrics: Dict[str, MetricSeries] = {}
        self.counters: Dict[str, int] = defaultdict(int)
        self.gauges: Dict[str, float] = {}
        
        # Performance tracking
        self.start_time = time.time()
        self.lock = threading.Lock()
        
        # Alert thresholds
        self.alert_thresholds = {
            'response_time_ms': 30000,  # 30 seconds
            'error_rate': 0.1,          # 10%
            'queue_size': 50,           # 50 tasks
            'memory_usage_mb': 1000     # 1GB
        }
        
        # Initialize core metrics
        self._initialize_core_metrics()
    
    def _initialize_core_metrics(self):
        """Initialize core system metrics"""
        core_metrics = [
            'tasks_submitted',
            'tasks_completed',
            'tasks_failed',
            'response_time_ms',
            'queue_size',
            'active_providers',
            'memory_usage_mb',
            'cpu_usage_percent'
        ]
        
        for metric_name in core_metrics:
            self.metrics[metric_name] = MetricSeries(
                name=metric_name,
                points=deque(maxlen=self.max_points_per_series)
            )
    
    def record_metric(self, name: str, value: float, tags: Dict[str, str] = None):
        """Record a metric value"""
        with self.lock:
            if name not in self.metrics:
                self.metrics[name] = MetricSeries(
                    name=name,
                    points=deque(maxlen=self.max_points_per_series)
                )
            
            self.metrics[name].add_point(value, tags)
    
    def increment_counter(self, name: str, value: int = 1, tags: Dict[str, str] = None):
        """Increment a counter metric"""
        with self.lock:
            self.counters[name] += value
            # Also record as time series
            self.record_metric(name, self.counters[name], tags)
    
    def set_gauge(self, name: str, value: float, tags: Dict[str, str] = None):
        """Set a gauge metric value"""
        with self.lock:
            self.gauges[name] = value
            # Also record as time series
            self.record_metric(name, value, tags)
    
    def record_task_metrics(self, task_data: Dict[str, Any]):
        """Record metrics for a completed task"""
        # Task completion
        if task_data.get('success', False):
            self.increment_counter('tasks_completed')
        else:
            self.increment_counter('tasks_failed')
        
        # Response time
        if 'execution_time' in task_data:
            response_time_ms = task_data['execution_time'] * 1000
            self.record_metric('response_time_ms', response_time_ms, {
                'provider': task_data.get('provider', 'unknown'),
                'task_type': task_data.get('task_type', 'unknown')
            })
        
        # Provider-specific metrics
        if 'provider' in task_data:
            provider = task_data['provider']
            self.increment_counter(f'provider_{provider}_requests')
            
            if task_data.get('success', False):
                self.increment_counter(f'provider_{provider}_success')
            else:
                self.increment_counter(f'provider_{provider}_errors')
    
    def record_provider_metrics(self, provider_name: str, metrics_data: Dict[str, Any]):
        """Record provider-specific metrics"""
        tags = {'provider': provider_name}
        
        for metric_name, value in metrics_data.items():
            full_metric_name = f'provider_{metric_name}'
            self.record_metric(full_metric_name, value, tags)
    
    def record_system_metrics(self, system_data: Dict[str, Any]):
        """Record system-level metrics"""
        # Queue metrics
        if 'queue_size' in system_data:
            self.set_gauge('queue_size', system_data['queue_size'])
        
        if 'active_tasks' in system_data:
            self.set_gauge('active_tasks', system_data['active_tasks'])
        
        # Provider metrics
        if 'active_providers' in system_data:
            self.set_gauge('active_providers', system_data['active_providers'])
        
        # Resource metrics
        if 'memory_usage_mb' in system_data:
            self.set_gauge('memory_usage_mb', system_data['memory_usage_mb'])
        
        if 'cpu_usage_percent' in system_data:
            self.set_gauge('cpu_usage_percent', system_data['cpu_usage_percent'])
    
    def record_metrics(self, metrics_data: Dict[str, Any]):
        """Record a batch of metrics"""
        timestamp = metrics_data.get('timestamp', time.time())
        
        # System metrics
        if 'active_tasks' in metrics_data:
            self.set_gauge('active_tasks', metrics_data['active_tasks'])
        
        if 'completed_tasks' in metrics_data:
            self.set_gauge('total_completed_tasks', metrics_data['completed_tasks'])
        
        if 'queue_size' in metrics_data:
            self.set_gauge('queue_size', metrics_data['queue_size'])
        
        # Provider health metrics
        if 'provider_health' in metrics_data:
            for provider_name, health_data in metrics_data['provider_health'].items():
                tags = {'provider': provider_name}
                
                if 'success_rate' in health_data:
                    self.record_metric('provider_success_rate', health_data['success_rate'], tags)
                
                if 'avg_response_time' in health_data:
                    self.record_metric('provider_avg_response_time', health_data['avg_response_time'], tags)
                
                if 'total_requests' in health_data:
                    self.record_metric('provider_total_requests', health_data['total_requests'], tags)
    
    def get_metric_summary(self, metric_name: str, seconds: int = 300) -> Dict[str, Any]:
        """Get summary statistics for a metric"""
        if metric_name not in self.metrics:
            return {'error': f'Metric {metric_name} not found'}
        
        series = self.metrics[metric_name]
        values = series.get_recent_values(seconds)
        
        if not values:
            return {'error': f'No data for metric {metric_name}'}
        
        return {
            'name': metric_name,
            'count': len(values),
            'latest': values[-1] if values else None,
            'average': sum(values) / len(values),
            'min': min(values),
            'max': max(values),
            'sum': sum(values),
            'time_range_seconds': seconds
        }
    
    def get_all_metrics_summary(self, seconds: int = 300) -> Dict[str, Any]:
        """Get summary for all metrics"""
        summary = {
            'timestamp': time.time(),
            'time_range_seconds': seconds,
            'uptime_seconds': time.time() - self.start_time,
            'metrics': {}
        }
        
        for metric_name in self.metrics:
            summary['metrics'][metric_name] = self.get_metric_summary(metric_name, seconds)
        
        # Add counter values
        summary['counters'] = self.counters.copy()
        
        # Add gauge values
        summary['gauges'] = self.gauges.copy()
        
        return summary
    
    def get_performance_report(self) -> Dict[str, Any]:
        """Generate a comprehensive performance report"""
        report = {
            'timestamp': time.time(),
            'uptime_seconds': time.time() - self.start_time,
            'system_health': 'healthy',  # Will be determined by checks
            'alerts': [],
            'performance_metrics': {},
            'provider_performance': {},
            'recommendations': []
        }
        
        # System performance metrics
        response_time_summary = self.get_metric_summary('response_time_ms', 300)
        if 'average' in response_time_summary:
            report['performance_metrics']['avg_response_time_ms'] = response_time_summary['average']
            
            # Check response time alert
            if response_time_summary['average'] > self.alert_thresholds['response_time_ms']:
                report['alerts'].append({
                    'type': 'high_response_time',
                    'message': f"Average response time ({response_time_summary['average']:.1f}ms) exceeds threshold",
                    'severity': 'warning'
                })
                report['system_health'] = 'degraded'
        
        # Error rate calculation
        completed = self.counters.get('tasks_completed', 0)
        failed = self.counters.get('tasks_failed', 0)
        total_tasks = completed + failed
        
        if total_tasks > 0:
            error_rate = failed / total_tasks
            report['performance_metrics']['error_rate'] = error_rate
            
            if error_rate > self.alert_thresholds['error_rate']:
                report['alerts'].append({
                    'type': 'high_error_rate',
                    'message': f"Error rate ({error_rate:.1%}) exceeds threshold",
                    'severity': 'critical'
                })
                report['system_health'] = 'unhealthy'
        
        # Queue size check
        queue_size = self.gauges.get('queue_size', 0)
        report['performance_metrics']['queue_size'] = queue_size
        
        if queue_size > self.alert_thresholds['queue_size']:
            report['alerts'].append({
                'type': 'high_queue_size',
                'message': f"Queue size ({queue_size}) exceeds threshold",
                'severity': 'warning'
            })
        
        # Provider performance
        for metric_name, series in self.metrics.items():
            if metric_name.startswith('provider_') and 'success_rate' in metric_name:
                provider_name = metric_name.replace('provider_success_rate', '').strip('_')
                if provider_name:
                    latest_success_rate = series.get_latest()
                    if latest_success_rate is not None:
                        if provider_name not in report['provider_performance']:
                            report['provider_performance'][provider_name] = {}
                        report['provider_performance'][provider_name]['success_rate'] = latest_success_rate
        
        # Generate recommendations
        if report['system_health'] != 'healthy':
            if any(alert['type'] == 'high_response_time' for alert in report['alerts']):
                report['recommendations'].append("Consider adding more AI providers or increasing worker count")
            
            if any(alert['type'] == 'high_error_rate' for alert in report['alerts']):
                report['recommendations'].append("Check provider configurations and API keys")
            
            if any(alert['type'] == 'high_queue_size' for alert in report['alerts']):
                report['recommendations'].append("Increase processing capacity or implement task prioritization")
        
        return report
    
    def export_metrics(self, format: str = 'json', time_range_seconds: int = 3600) -> str:
        """Export metrics in specified format"""
        if format.lower() == 'json':
            return self._export_json(time_range_seconds)
        elif format.lower() == 'prometheus':
            return self._export_prometheus()
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    def _export_json(self, time_range_seconds: int) -> str:
        """Export metrics as JSON"""
        export_data = {
            'timestamp': time.time(),
            'time_range_seconds': time_range_seconds,
            'metrics': {}
        }
        
        cutoff_time = time.time() - time_range_seconds
        
        for metric_name, series in self.metrics.items():
            points = [
                {
                    'timestamp': point.timestamp,
                    'value': point.value,
                    'tags': point.tags
                }
                for point in series.points
                if point.timestamp >= cutoff_time
            ]
            
            if points:
                export_data['metrics'][metric_name] = points
        
        return json.dumps(export_data, indent=2)
    
    def _export_prometheus(self) -> str:
        """Export metrics in Prometheus format"""
        lines = []
        
        # Export counters
        for name, value in self.counters.items():
            prometheus_name = name.replace('-', '_').replace('.', '_')
            lines.append(f"# TYPE {prometheus_name} counter")
            lines.append(f"{prometheus_name} {value}")
        
        # Export gauges
        for name, value in self.gauges.items():
            prometheus_name = name.replace('-', '_').replace('.', '_')
            lines.append(f"# TYPE {prometheus_name} gauge")
            lines.append(f"{prometheus_name} {value}")
        
        # Export latest values from time series
        for metric_name, series in self.metrics.items():
            latest = series.get_latest()
            if latest is not None:
                prometheus_name = metric_name.replace('-', '_').replace('.', '_')
                lines.append(f"# TYPE {prometheus_name} gauge")
                lines.append(f"{prometheus_name} {latest}")
        
        return '\n'.join(lines)
    
    def clear_metrics(self, older_than_seconds: int = 3600):
        """Clear old metrics data"""
        cutoff_time = time.time() - older_than_seconds
        
        with self.lock:
            for series in self.metrics.values():
                # Remove old points
                while series.points and series.points[0].timestamp < cutoff_time:
                    series.points.popleft()
    
    def set_alert_threshold(self, metric_name: str, threshold: float):
        """Set alert threshold for a metric"""
        self.alert_thresholds[metric_name] = threshold
    
    def get_alert_thresholds(self) -> Dict[str, float]:
        """Get current alert thresholds"""
        return self.alert_thresholds.copy()
