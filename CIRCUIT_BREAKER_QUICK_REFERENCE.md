# Circuit Breaker - Quick Reference Guide

## Quick Status Check
```bash
curl http://localhost:3001/api/circuit-breaker/status | jq .
```

## Monitor Specific Circuit
```bash
# ESPN API
curl -s http://localhost:3001/api/circuit-breaker/status | jq '.circuitBreakers["espn-api"]'

# TheSportsDB API
curl -s http://localhost:3001/api/circuit-breaker/status | jq '.circuitBreakers["thesportsdb-api"]'
```

## Run Tests
```bash
# Full test suite
npm test -- tests/integration/circuit-breaker.test.ts

# Test live APIs
curl "http://localhost:3001/api/sports-guide/test-providers?date=2025-11-03"
```

## Load Testing
```bash
/tmp/circuit-breaker-load-test.sh
```

## Check System Health
```bash
# Circuit breaker health summary
curl -s http://localhost:3001/api/circuit-breaker/status | jq '{healthy: .healthy, summary: .summary, openCircuits: .openCircuits}'

# PM2 status
pm2 status sports-bar-tv-controller
```

## View Logs
```bash
# Recent circuit breaker logs
pm2 logs sports-bar-tv-controller --lines 100 | grep -i circuit

# API call logs
pm2 logs sports-bar-tv-controller --lines 100 | grep -E "(ESPN|TheSportsDB)"
```

## Test Report Location
- Full Report: `/home/ubuntu/Sports-Bar-TV-Controller/CIRCUIT_BREAKER_TEST_REPORT.md`
- Status Snapshot: `/tmp/circuit-breaker-status-full.json`

## Key Metrics to Monitor

### Healthy System Indicators
- All circuits in "closed" state
- Successes > 0, Failures = 0
- No timeouts or rejects
- Mean latency within expected range:
  - ESPN API: 200-500ms
  - TheSportsDB API: 700-1000ms

### Warning Signs
- Circuit state: "open" or "half_open"
- Failure count increasing
- Timeouts > 0
- Fallback count increasing
- Mean latency > 2000ms

## Emergency Response

### If Circuit is Open
1. Check external API status
2. Review recent error logs
3. Verify network connectivity
4. Wait for reset timeout (30s)
5. Monitor circuit state transition

### If High Latency
1. Check network conditions
2. Verify external API performance
3. Review system resources
4. Consider increasing timeout values if persistent

## Monitoring Dashboard
Access real-time circuit breaker status at:
```
http://localhost:3001/api/circuit-breaker/status
```

## Support
- Test Report: `CIRCUIT_BREAKER_TEST_REPORT.md`
- System Guardian: Available for diagnostics
- Next Review: December 3, 2025
