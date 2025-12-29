#!/usr/bin/env python3
import json
import sys
import re
from datetime import datetime, timedelta
from collections import Counter, defaultdict
from typing import Dict, List, Any
import statistics

class LogPatternAnalyzer:
    def __init__(self):
        self.error_patterns = {
            'network_timeout': r'timeout|connection.*refused|network.*error',
            'device_failure': r'device.*not.*found|hardware.*failure|connection.*lost',
            'authentication': r'auth.*failed|unauthorized|invalid.*credentials',
            'performance': r'slow.*response|high.*latency|timeout',
            'configuration': r'config.*error|setting.*invalid|parameter.*missing'
        }

        self.severity_keywords = {
            'critical': ['critical', 'fatal', 'emergency', 'system failure', 'crash'],
            'high': ['error', 'exception', 'failed', 'unable', 'denied'],
            'medium': ['warning', 'deprecated', 'retry', 'fallback'],
            'low': ['info', 'debug', 'trace', 'notice']
        }

    def analyze_logs(self, logs_data):
        try:
            logs = logs_data.get('logs', [])
            if not logs:
                return self._empty_analysis()

            analysis = {
                'severity': self._calculate_overall_severity(logs),
                'summary': self._generate_summary(logs),
                'patterns': self._identify_patterns(logs),
                'recommendations': self._generate_recommendations(logs),
                'anomalies': self._detect_anomalies(logs),
                'insights': self._extract_insights(logs),
                'confidence': self._calculate_confidence(logs)
            }

            return analysis

        except Exception as e:
            return {
                'severity': 'medium',
                'summary': f'Analysis failed: {str(e)}',
                'patterns': [],
                'recommendations': ['Review log analysis system'],
                'anomalies': [],
                'insights': [],
                'confidence': 0.1
            }

    def _empty_analysis(self):
        return {
            'severity': 'low',
            'summary': 'No logs available for analysis',
            'patterns': [],
            'recommendations': ['Enable logging for better system monitoring'],
            'anomalies': [],
            'insights': ['System appears inactive or logging disabled'],
            'confidence': 0.0
        }

    def _calculate_overall_severity(self, logs):
        severity_counts = Counter()

        for log in logs:
            level = log.get('level', '').lower()
            severity_counts[level] += 1

        total_logs = len(logs)
        if total_logs == 0:
            return 'low'

        error_rate = (severity_counts['error'] + severity_counts['critical']) / total_logs

        if error_rate > 0.2:
            return 'critical'
        elif error_rate > 0.1:
            return 'high'
        elif error_rate > 0.05:
            return 'medium'
        else:
            return 'low'

    def _generate_summary(self, logs):
        total_logs = len(logs)
        error_logs = [log for log in logs if log.get('level') in ['error', 'critical']]
        user_actions = [log for log in logs if log.get('category') == 'user_interaction']
        device_ops = [log for log in logs if log.get('category') == 'hardware']

        summary_parts = [
            f"Analyzed {total_logs} log entries",
            f"{len(error_logs)} errors detected" if error_logs else "No errors detected",
            f"{len(user_actions)} user interactions recorded",
            f"{len(device_ops)} device operations logged"
        ]

        if error_logs:
            most_common_error = Counter(log.get('message', '') for log in error_logs).most_common(1)
            if most_common_error:
                summary_parts.append(f"Most frequent error: {most_common_error[0][0][:50]}...")

        return ". ".join(summary_parts)

    def _identify_patterns(self, logs):
        patterns = []

        # Time-based patterns
        hour_distribution = defaultdict(int)
        for log in logs:
            try:
                timestamp = datetime.fromisoformat(log.get('timestamp', '').replace('Z', '+00:00'))
                hour_distribution[timestamp.hour] += 1
            except:
                continue

        if hour_distribution:
            peak_hour = max(hour_distribution, key=hour_distribution.get)
            patterns.append(f"Peak activity at hour {peak_hour}:00")

        # Error patterns
        error_messages = [log.get('message', '') for log in logs if log.get('level') in ['error', 'critical']]
        for pattern_name, regex in self.error_patterns.items():
            if any(re.search(regex, msg, re.IGNORECASE) for msg in error_messages):
                patterns.append(f"Detected {pattern_name.replace('_', ' ')} pattern")

        # Device patterns
        device_logs = [log for log in logs if log.get('deviceType')]
        if device_logs:
            device_counter = Counter(log.get('deviceType') for log in device_logs)
            most_active = device_counter.most_common(1)[0]
            patterns.append(f"Most active device type: {most_active[0]} ({most_active[1]} operations)")

        return patterns[:5]  # Limit to top 5 patterns

    def _generate_recommendations(self, logs):
        recommendations = []

        error_logs = [log for log in logs if log.get('level') in ['error', 'critical']]
        error_rate = len(error_logs) / len(logs) if logs else 0

        if error_rate > 0.1:
            recommendations.append("High error rate detected - investigate system stability")

        # Performance recommendations
        perf_logs = [log for log in logs if log.get('duration') is not None]
        if perf_logs:
            avg_duration = statistics.mean(log.get('duration', 0) for log in perf_logs)
            if avg_duration > 5000:
                recommendations.append("Average response time is high - optimize slow operations")

        # Device recommendations
        device_errors = [log for log in error_logs if log.get('deviceType')]
        if device_errors:
            error_devices = Counter(log.get('deviceType') for log in device_errors)
            for device, count in error_devices.most_common(2):
                recommendations.append(f"Check {device} device - {count} errors detected")

        # Security recommendations
        security_logs = [log for log in logs if log.get('category') == 'security']
        if security_logs:
            recommendations.append("Security events detected - review access logs")

        return recommendations[:5]  # Limit to top 5 recommendations

    def _detect_anomalies(self, logs):
        anomalies = []

        # Detect rapid succession of errors
        error_times = []
        for log in logs:
            if log.get('level') in ['error', 'critical']:
                try:
                    timestamp = datetime.fromisoformat(log.get('timestamp', '').replace('Z', '+00:00'))
                    error_times.append(timestamp)
                except:
                    continue

        error_times.sort()
        rapid_errors = 0
        for i in range(1, len(error_times)):
            if error_times[i] - error_times[i-1] < timedelta(seconds=10):
                rapid_errors += 1

        if rapid_errors > 3:
            anomalies.append(f"Detected {rapid_errors} rapid error sequences")

        # Detect unusual user activity
        user_actions = [log for log in logs if log.get('category') == 'user_interaction']
        if len(user_actions) > 100:
            anomalies.append("Unusually high user activity detected")

        # Detect performance anomalies
        perf_logs = [log for log in logs if log.get('duration') is not None]
        if perf_logs:
            durations = [log.get('duration', 0) for log in perf_logs]
            if durations:
                avg_duration = statistics.mean(durations)
                outliers = [d for d in durations if d > avg_duration * 3]
                if outliers:
                    anomalies.append(f"Detected {len(outliers)} performance outliers")

        return anomalies

    def _extract_insights(self, logs):
        insights = []

        # User behavior insights
        user_logs = [log for log in logs if log.get('category') == 'user_interaction']
        if user_logs:
            actions = Counter(log.get('action', '') for log in user_logs)
            top_action = actions.most_common(1)[0] if actions else None
            if top_action:
                insights.append(f"Most frequent user action: {top_action[0]} ({top_action[1]} times)")

        # System health insights
        total_operations = len([log for log in logs if log.get('success') is not None])
        successful_operations = len([log for log in logs if log.get('success') is True])

        if total_operations > 0:
            success_rate = (successful_operations / total_operations) * 100
            if success_rate > 95:
                insights.append(f"Excellent system reliability: {success_rate:.1f}% success rate")
            elif success_rate > 85:
                insights.append(f"Good system reliability: {success_rate:.1f}% success rate")
            else:
                insights.append(f"System reliability concerns: {success_rate:.1f}% success rate")

        # Time-based insights
        if logs:
            time_span_hours = self._calculate_time_span(logs)
            if time_span_hours:
                insights.append(f"Analysis covers {time_span_hours:.1f} hours of system activity")

        return insights

    def _calculate_time_span(self, logs):
        timestamps = []
        for log in logs:
            try:
                timestamp = datetime.fromisoformat(log.get('timestamp', '').replace('Z', '+00:00'))
                timestamps.append(timestamp)
            except:
                continue

        if len(timestamps) < 2:
            return 0

        timestamps.sort()
        time_span = timestamps[-1] - timestamps[0]
        return time_span.total_seconds() / 3600  # Convert to hours

    def _calculate_confidence(self, logs):
        if len(logs) == 0:
            return 0.0
        elif len(logs) < 10:
            return 0.3
        elif len(logs) < 50:
            return 0.6
        elif len(logs) < 100:
            return 0.8
        else:
            return 0.95

def main():
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        logs_data = json.loads(input_data)

        analyzer = LogPatternAnalyzer()
        result = analyzer.analyze_logs(logs_data)

        print(json.dumps(result, indent=2))

    except Exception as e:
        error_result = {
            'severity': 'medium',
            'summary': f'Analysis failed: {str(e)}',
            'patterns': [],
            'recommendations': ['Check log analysis system'],
            'anomalies': [],
            'insights': [],
            'confidence': 0.1
        }
        print(json.dumps(error_result, indent=2))

if __name__ == '__main__':
    main()
