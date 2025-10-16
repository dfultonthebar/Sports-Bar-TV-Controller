
# Testing Checklist - Sports Bar TV Controller
## NUC13ANHi5 Production Deployment

**System**: Intel NUC13ANHi5 (i5-1340P)  
**Date**: _______________  
**Tester**: _______________

---

## Pre-Deployment Testing

### System Requirements Check

- [ ] Ubuntu Server 22.04 LTS installed
- [ ] System has internet connectivity
- [ ] SSH access configured
- [ ] Firewall configured (ports 22, 80, 443, 3000)
- [ ] System updated (`sudo apt update && sudo apt upgrade`)

### Hardware Verification

- [ ] CPU: Intel i5-1340P detected (`lscpu`)
- [ ] RAM: 16GB available (`free -h`)
- [ ] Storage: 512GB SSD with sufficient space (`df -h`)
- [ ] Network: 2.5GbE LAN connected (`ip addr`)
- [ ] GPU: Intel Iris Xe detected (`lspci | grep VGA`)

---

## Installation Testing

### Phase 1: System Setup

- [ ] Node.js 20.x installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] PM2 installed globally (`pm2 --version`)
- [ ] PostgreSQL 15 installed (`psql --version`)
- [ ] Ollama installed (`ollama --version`)
- [ ] Intel GPU tools installed (`intel_gpu_top --version`)
- [ ] Monitoring tools installed (`htop`, `sysstat`)
- [ ] Kernel parameters updated for GPU (`cat /proc/cmdline | grep i915`)

**Notes**: _______________________________________________

### Phase 2: Ollama Setup

- [ ] Ollama service running (`systemctl status ollama`)
- [ ] Ollama configured for Intel GPU
- [ ] Environment variables set correctly
- [ ] Models downloaded: llama3.2:3b
- [ ] Models downloaded: qwen2.5:3b
- [ ] Model inference test successful
- [ ] Ollama API responding (`curl http://localhost:11434/api/tags`)

**Model Test Results**:
- llama3.2:3b response time: _____ seconds
- qwen2.5:3b response time: _____ seconds

**Notes**: _______________________________________________

### Phase 3: Application Deployment

- [ ] Repository cloned to /opt/sports-bar-tv
- [ ] Dependencies installed (`npm ci`)
- [ ] PostgreSQL database created
- [ ] Database user created with correct permissions
- [ ] .env file generated
- [ ] Database migrations run successfully
- [ ] Next.js build completed
- [ ] PM2 ecosystem configured
- [ ] Application started with PM2
- [ ] 10 PM2 instances running in cluster mode

**Build Time**: _____ minutes  
**Notes**: _______________________________________________

### Phase 4: Data Migration

- [ ] SSH connection to old system successful
- [ ] Database backup created
- [ ] Environment variables backed up
- [ ] Knowledge base backed up
- [ ] PM2 configuration backed up
- [ ] Ollama models list backed up
- [ ] Database restored to new system
- [ ] Knowledge base restored
- [ ] Ollama models pulled
- [ ] Application restarted after migration

**Migration Time**: _____ minutes  
**Backup Location**: _______________________________________________  
**Notes**: _______________________________________________

### Phase 5: Performance Setup

- [ ] PostgreSQL optimized for 12-core CPU
- [ ] Performance monitoring scripts created
- [ ] Automated performance reports configured
- [ ] Weekly optimization cron job set up
- [ ] Benchmarking tools installed
- [ ] Initial performance check run

**Notes**: _______________________________________________

---

## Functional Testing

### System Health Checks

#### CPU and Memory
- [ ] CPU usage at idle: _____ %
- [ ] CPU usage under load: _____ %
- [ ] Memory usage at idle: _____ GB
- [ ] Memory usage under load: _____ GB
- [ ] Load average acceptable: _____
- [ ] No CPU throttling detected

#### Services Status
- [ ] PostgreSQL running (`systemctl status postgresql`)
- [ ] Ollama running (`systemctl status ollama`)
- [ ] PM2 running (`pm2 status`)
- [ ] All PM2 instances online
- [ ] Nginx running (if configured)

#### Storage and Network
- [ ] Disk space sufficient (> 50% free)
- [ ] Disk I/O performance acceptable
- [ ] Network connectivity stable
- [ ] DNS resolution working
- [ ] Internet access available

**Notes**: _______________________________________________

### Database Testing

#### Connection Tests
- [ ] PostgreSQL accepting connections
- [ ] Database exists: sportsbar_tv
- [ ] User can connect: sportsbar
- [ ] Tables created successfully
- [ ] Data migrated correctly

#### Performance Tests
```bash
# Run these commands and record results
sudo -u postgres psql -d sportsbar_tv -c "SELECT COUNT(*) FROM users;"
```
- [ ] User count: _____ (should match old system)

```bash
sudo -u postgres psql -d sportsbar_tv -c "SELECT pg_size_pretty(pg_database_size('sportsbar_tv'));"
```
- [ ] Database size: _____ (should be similar to old system)

```bash
sudo -u postgres psql -d sportsbar_tv -c "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';"
```
- [ ] Active connections: _____

```bash
sudo -u postgres psql -d sportsbar_tv -c "SELECT datname, blks_hit*100/(blks_hit+blks_read) as cache_hit_ratio FROM pg_stat_database WHERE datname = 'sportsbar_tv';"
```
- [ ] Cache hit ratio: _____ % (should be > 95%)

**Notes**: _______________________________________________

### Application Testing

#### API Endpoints
```bash
# Test homepage
curl -I http://localhost:3000
```
- [ ] Homepage returns 200 OK
- [ ] Response time: _____ ms

```bash
# Test health endpoint
curl http://localhost:3000/api/health
```
- [ ] Health check returns success
- [ ] Response time: _____ ms

```bash
# Test chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, test message"}'
```
- [ ] Chat endpoint responds
- [ ] Response time: _____ ms
- [ ] AI response is coherent

**Notes**: _______________________________________________

#### PM2 Monitoring
```bash
pm2 status
```
- [ ] All instances online
- [ ] CPU usage distributed across instances
- [ ] Memory usage per instance: _____ MB
- [ ] Restart count: _____ (should be 0 or low)

```bash
pm2 logs sports-bar-tv --lines 50
```
- [ ] No critical errors in logs
- [ ] No memory leaks detected
- [ ] No connection errors

**Notes**: _______________________________________________

### AI Chat Testing

#### Ollama Direct Tests
```bash
# Test llama3.2:3b
time ollama run llama3.2:3b "What is the capital of France?"
```
- [ ] Response received
- [ ] Response time: _____ seconds
- [ ] Response is accurate

```bash
# Test qwen2.5:3b
time ollama run qwen2.5:3b "What is 2+2?"
```
- [ ] Response received
- [ ] Response time: _____ seconds
- [ ] Response is accurate

#### Application Chat Tests
```bash
# Test through application API
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What sports are popular in bars?"}' \
  -w "\nTime: %{time_total}s\n"
```
- [ ] Response received
- [ ] Response time: _____ seconds
- [ ] Response is relevant and coherent
- [ ] No errors in response

**Sample Responses**:
- Question 1: _______________________________________________
- Answer 1: _______________________________________________
- Question 2: _______________________________________________
- Answer 2: _______________________________________________

**Notes**: _______________________________________________

### Browser Testing

#### Homepage
- [ ] Homepage loads correctly
- [ ] No console errors
- [ ] All images load
- [ ] Navigation works
- [ ] Responsive design works

#### TV Control Interface
- [ ] TV control panel displays
- [ ] Channel selection works
- [ ] Volume controls work
- [ ] Input switching works
- [ ] No JavaScript errors

#### AI Chat Interface
- [ ] Chat interface displays
- [ ] Can send messages
- [ ] Receives responses
- [ ] Response time acceptable (< 5s)
- [ ] Chat history persists
- [ ] No UI glitches

#### Streaming Integrations
- [ ] YouTube integration works
- [ ] Twitch integration works
- [ ] ESPN integration works
- [ ] NFL Sunday Ticket integration works
- [ ] Stream selection works
- [ ] Playback controls work

**Notes**: _______________________________________________

---

## Performance Testing

### Load Testing

#### Apache Bench Test
```bash
ab -n 1000 -c 10 http://localhost:3000/
```
- [ ] Test completed successfully
- [ ] Requests per second: _____
- [ ] Time per request: _____ ms
- [ ] Failed requests: _____ (should be 0)
- [ ] 95th percentile: _____ ms

#### Concurrent Users Test
```bash
ab -n 5000 -c 50 http://localhost:3000/
```
- [ ] Test completed successfully
- [ ] Requests per second: _____
- [ ] Time per request: _____ ms
- [ ] Failed requests: _____ (should be 0)
- [ ] CPU usage during test: _____ %
- [ ] Memory usage during test: _____ GB

**Notes**: _______________________________________________

### Benchmark Tests

#### CPU Benchmark
```bash
sysbench cpu --cpu-max-prime=20000 --threads=12 run
```
- [ ] Benchmark completed
- [ ] Events per second: _____
- [ ] Total time: _____ seconds

#### Memory Benchmark
```bash
sysbench memory --memory-total-size=10G --threads=12 run
```
- [ ] Benchmark completed
- [ ] Transfer rate: _____ MB/s
- [ ] Total time: _____ seconds

#### Disk I/O Benchmark
```bash
sysbench fileio --file-total-size=2G --file-test-mode=rndrw --threads=12 run
```
- [ ] Benchmark completed
- [ ] Read throughput: _____ MB/s
- [ ] Write throughput: _____ MB/s
- [ ] Total time: _____ seconds

#### Database Benchmark
```bash
pgbench -c 10 -j 4 -t 1000 sportsbar_tv
```
- [ ] Benchmark completed
- [ ] TPS (transactions per second): _____
- [ ] Latency average: _____ ms
- [ ] Latency 95th percentile: _____ ms

**Notes**: _______________________________________________

### Performance Metrics Summary

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| Homepage Load Time | < 500ms | _____ | _____ |
| API Response Time | < 200ms | _____ | _____ |
| AI Chat Response | < 3s | _____ | _____ |
| Database Query | < 50ms | _____ | _____ |
| CPU Usage (idle) | < 10% | _____ | _____ |
| CPU Usage (load) | < 80% | _____ | _____ |
| Memory Usage | < 8GB | _____ | _____ |
| Disk Space Free | > 50% | _____ | _____ |
| Cache Hit Ratio | > 95% | _____ | _____ |
| Requests/Second | > 100 | _____ | _____ |

**Overall Performance Rating**: _____ / 10

**Notes**: _______________________________________________

---

## Security Testing

### Firewall Configuration
- [ ] UFW enabled
- [ ] Only necessary ports open
- [ ] SSH port configured correctly
- [ ] HTTP/HTTPS ports open (if needed)
- [ ] Application port configured correctly

### Database Security
- [ ] PostgreSQL password changed from default
- [ ] Database user has minimal required permissions
- [ ] PostgreSQL not accessible from external network
- [ ] Connection string in .env is secure

### Application Security
- [ ] SESSION_SECRET is strong and unique
- [ ] API keys are not exposed in logs
- [ ] No sensitive data in error messages
- [ ] HTTPS configured (if applicable)
- [ ] CORS configured correctly

### System Security
- [ ] System packages up to date
- [ ] Unattended upgrades configured
- [ ] No unnecessary services running
- [ ] SSH key authentication configured (recommended)
- [ ] Fail2ban configured (recommended)

**Notes**: _______________________________________________

---

## Monitoring and Alerts

### Monitoring Setup
- [ ] Performance monitoring script works
- [ ] Automated hourly reports configured
- [ ] Weekly optimization cron job set up
- [ ] Log rotation configured
- [ ] Disk space monitoring active

### Alert Configuration
- [ ] Email alerts configured (if applicable)
- [ ] CPU usage alerts set up
- [ ] Memory usage alerts set up
- [ ] Disk space alerts set up
- [ ] Service down alerts set up

**Notes**: _______________________________________________

---

## Backup and Recovery

### Backup Testing
- [ ] Database backup script works
- [ ] Knowledge base backup works
- [ ] Environment variables backed up
- [ ] PM2 configuration backed up
- [ ] Backup location accessible
- [ ] Backup retention policy configured

### Recovery Testing
- [ ] Database restore tested
- [ ] Knowledge base restore tested
- [ ] Application restart after restore works
- [ ] Data integrity verified after restore

**Notes**: _______________________________________________

---

## Rollback Testing

### Rollback Preparation
- [ ] Old system still accessible
- [ ] Old system backup verified
- [ ] Rollback procedure documented
- [ ] Rollback tested (if possible)

### Rollback Checklist (if needed)
- [ ] Stop services on new system
- [ ] Restart services on old system
- [ ] Verify old system functionality
- [ ] Update DNS/routing (if applicable)
- [ ] Document rollback reason

**Notes**: _______________________________________________

---

## Final Verification

### Pre-Production Checklist
- [ ] All tests passed
- [ ] Performance meets expectations
- [ ] No critical errors in logs
- [ ] Monitoring configured and working
- [ ] Backups configured and tested
- [ ] Documentation updated
- [ ] Team trained on new system
- [ ] Rollback plan ready

### Production Readiness
- [ ] System stable for 24 hours
- [ ] No memory leaks detected
- [ ] No performance degradation over time
- [ ] All features working as expected
- [ ] User acceptance testing completed
- [ ] Go-live plan documented

**Notes**: _______________________________________________

---

## Sign-Off

### Testing Summary

**Total Tests**: _____  
**Tests Passed**: _____  
**Tests Failed**: _____  
**Pass Rate**: _____ %

**Critical Issues**: _____  
**Major Issues**: _____  
**Minor Issues**: _____

**Overall Status**: ☐ PASS ☐ FAIL ☐ CONDITIONAL PASS

**Conditions for Conditional Pass**: _______________________________________________

### Recommendations

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Approvals

**Tested By**: _______________  
**Date**: _______________  
**Signature**: _______________

**Reviewed By**: _______________  
**Date**: _______________  
**Signature**: _______________

**Approved for Production**: ☐ YES ☐ NO ☐ WITH CONDITIONS

**Production Go-Live Date**: _______________

---

## Post-Deployment Monitoring

### First 24 Hours
- [ ] Hour 1: System check completed
- [ ] Hour 4: System check completed
- [ ] Hour 8: System check completed
- [ ] Hour 12: System check completed
- [ ] Hour 24: System check completed

### First Week
- [ ] Day 1: Full system review
- [ ] Day 3: Performance review
- [ ] Day 7: Comprehensive review

### Issues Encountered

| Date/Time | Issue | Severity | Resolution | Status |
|-----------|-------|----------|------------|--------|
| _____ | _____ | _____ | _____ | _____ |
| _____ | _____ | _____ | _____ | _____ |
| _____ | _____ | _____ | _____ | _____ |

---

**Document Version**: 1.0  
**Last Updated**: October 7, 2025  
**Next Review Date**: _______________
