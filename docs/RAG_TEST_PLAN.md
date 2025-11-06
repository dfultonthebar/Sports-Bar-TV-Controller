# RAG System Test Plan

**Date:** November 6, 2025
**Purpose:** Comprehensive testing of the RAG documentation system after indexing new documentation

## Test Categories

### Category 1: Memory Monitoring Queries

**Test Questions:**

1. **Q:** "How do I monitor memory usage?"
   - **Expected:** Information about monitor-memory.sh script, cron job, thresholds
   - **Source:** MEMORY_MONITORING.md

2. **Q:** "What do I do if memory usage is high?"
   - **Expected:** Troubleshooting steps, heap dump capture, manual restart
   - **Source:** MEMORY_MONITORING.md

3. **Q:** "How do I analyze memory trends?"
   - **Expected:** analyze-memory.sh script, statistics, spike detection
   - **Source:** MEMORY_MONITORING.md

4. **Q:** "What are the memory alert thresholds?"
   - **Expected:** OK (0-800MB), WARNING (800-900MB), CRITICAL (>900MB)
   - **Source:** MEMORY_MONITORING.md

5. **Q:** "How do I check for memory leaks?"
   - **Expected:** Analysis patterns, heap dump, event loop checks
   - **Source:** MEMORY_MONITORING.md, RESTART_ANALYSIS.md

### Category 2: Performance & Restart Analysis

**Test Questions:**

6. **Q:** "Why was my app restarting 95 times?"
   - **Expected:** Manual restarts (SIGINT), development iteration, not crashes
   - **Source:** RESTART_ANALYSIS.md

7. **Q:** "How do I fix PM2 restart issues?"
   - **Expected:** Check if manual restarts, build step, health monitor fixes
   - **Source:** RESTART_ANALYSIS.md

8. **Q:** "What caused the health monitor duplicate initialization?"
   - **Expected:** Singleton pattern fix, SIGINT handlers, cleanup
   - **Source:** RESTART_ANALYSIS.md, recent performance docs

9. **Q:** "How do I monitor PM2 events?"
   - **Expected:** monitor-pm2-events.sh script, log location
   - **Source:** MEMORY_MONITORING.md

### Category 3: API Documentation

**Test Questions:**

10. **Q:** "What are the main API endpoints?"
    - **Expected:** Fire TV, DirecTV, CEC, Matrix, Audio endpoints
    - **Source:** API_REVIEW_SUMMARY_NOV_2025.md, API_ENDPOINT_CATEGORIZATION.md

11. **Q:** "How do I control Fire TV devices?"
    - **Expected:** /api/firetv/connect, /api/firetv/command, ADB commands
    - **Source:** API_ENDPOINT_CATEGORIZATION.md

12. **Q:** "What authentication is required for API calls?"
    - **Expected:** NextAuth.js, PIN-based auth, session storage
    - **Source:** SECURITY_ARCHITECTURE.md, API_DOCUMENTATION_AUDIT_REPORT.md

13. **Q:** "How does rate limiting work?"
    - **Expected:** withRateLimit middleware, RateLimitConfigs, token bucket
    - **Source:** API_DOCUMENTATION_AUDIT_REPORT.md, SECURITY_ARCHITECTURE.md

14. **Q:** "How do I validate API request bodies?"
    - **Expected:** validateRequestBody, Zod schemas, common bug warning
    - **Source:** API_DOCUMENTATION_AUDIT_REPORT.md

### Category 4: System Architecture

**Test Questions:**

15. **Q:** "What database does the system use?"
    - **Expected:** Drizzle ORM with SQLite, production.db location
    - **Source:** SYSTEM_ARCHITECTURE.md, DATABASE_SCHEMA.md

16. **Q:** "How does the health monitoring system work?"
    - **Expected:** FireTVHealthMonitor, singleton pattern, 30s interval
    - **Source:** SERVICE_ARCHITECTURE.md

17. **Q:** "What is the singleton pattern used for?"
    - **Expected:** Prevent duplicate service initialization, health monitors
    - **Source:** SERVICE_ARCHITECTURE.md, RESTART_ANALYSIS.md

18. **Q:** "How does the Fire TV connection manager work?"
    - **Expected:** Connection pooling, keep-alive, cleanup intervals
    - **Source:** SERVICE_ARCHITECTURE.md

19. **Q:** "What hardware does the system control?"
    - **Expected:** Fire TV (ADB), DirecTV (IP), IR blasters, CEC, HDMI matrix
    - **Source:** SYSTEM_ARCHITECTURE.md, SERVICE_ARCHITECTURE.md

### Category 5: Deployment & Configuration

**Test Questions:**

20. **Q:** "How do I deploy the application?"
    - **Expected:** npm run build, PM2 restart, port 3001
    - **Source:** DEPLOYMENT_ARCHITECTURE.md

21. **Q:** "What is the PM2 configuration?"
    - **Expected:** ecosystem.config.js, max_memory_restart, port settings
    - **Source:** DEPLOYMENT_ARCHITECTURE.md

22. **Q:** "Where is the production database located?"
    - **Expected:** /home/ubuntu/sports-bar-data/production.db
    - **Source:** DEPLOYMENT_ARCHITECTURE.md, DATABASE_SCHEMA.md

23. **Q:** "How do I configure environment variables?"
    - **Expected:** .env file, database URL, API keys
    - **Source:** DEPLOYMENT_ARCHITECTURE.md

### Category 6: Troubleshooting

**Test Questions:**

24. **Q:** "What do I do when a TV doesn't respond?"
    - **Expected:** Check device status, restart service, ADB connection
    - **Source:** TROUBLESHOOTING_GUIDE.md

25. **Q:** "How do I debug Fire TV connection issues?"
    - **Expected:** ADB connect, check network, device status API
    - **Source:** TROUBLESHOOTING_GUIDE.md

26. **Q:** "How do I check system logs?"
    - **Expected:** pm2 logs, memory-monitor.log, pm2-events.log
    - **Source:** TROUBLESHOOTING_GUIDE.md, MEMORY_MONITORING.md

27. **Q:** "What do I do if the database is locked?"
    - **Expected:** SQLite integrity check, restart application
    - **Source:** TROUBLESHOOTING_GUIDE.md

### Category 7: User Guides

**Test Questions:**

28. **Q:** "How do I change TV channels as a bartender?"
    - **Expected:** Channel presets, remote selector, quick access
    - **Source:** BARTENDER_QUICK_START.md

29. **Q:** "How do I configure a new Fire TV device?"
    - **Expected:** Add device, enable ADB, configure network
    - **Source:** DEVICE_CONFIGURATION_GUIDE.md

30. **Q:** "How do I set up channel presets?"
    - **Expected:** Channel preset UI, mapping to devices
    - **Source:** BARTENDER_QUICK_START.md, DEVICE_CONFIGURATION_GUIDE.md

### Category 8: Security

**Test Questions:**

31. **Q:** "What security measures are in place?"
    - **Expected:** Rate limiting, input validation, authentication
    - **Source:** SECURITY_ARCHITECTURE.md

32. **Q:** "How does input validation prevent attacks?"
    - **Expected:** Zod schemas, validateRequestBody, XSS prevention
    - **Source:** SECURITY_ARCHITECTURE.md

33. **Q:** "What is the authentication flow?"
    - **Expected:** NextAuth.js, PIN validation, session management
    - **Source:** SECURITY_ARCHITECTURE.md

### Category 9: Database Schema

**Test Questions:**

34. **Q:** "What tables exist in the database?"
    - **Expected:** FireTVDevice, DirecTVDevice, CableBox, ChannelPreset, etc.
    - **Source:** DATABASE_SCHEMA.md

35. **Q:** "How are Fire TV devices stored?"
    - **Expected:** FireTVDevice table, ipAddress, adbPort, status fields
    - **Source:** DATABASE_SCHEMA.md

36. **Q:** "How do channel presets work?"
    - **Expected:** ChannelPreset table, deviceId, channelNumber mapping
    - **Source:** DATABASE_SCHEMA.md

### Category 10: System Admin Tasks

**Test Questions:**

37. **Q:** "How do I perform system maintenance?"
    - **Expected:** Log rotation, database cleanup, PM2 updates
    - **Source:** SYSTEM_ADMIN_GUIDE.md

38. **Q:** "How do I backup the database?"
    - **Expected:** SQLite backup commands, backup location
    - **Source:** SYSTEM_ADMIN_GUIDE.md

39. **Q:** "How do I monitor system health?"
    - **Expected:** PM2 monit, memory dashboard, health checks
    - **Source:** SYSTEM_ADMIN_GUIDE.md, MEMORY_MONITORING.md

40. **Q:** "How do I update the application?"
    - **Expected:** git pull, npm install, npm run build, PM2 restart
    - **Source:** SYSTEM_ADMIN_GUIDE.md

## Test Execution Instructions

### Manual Testing

For each question:
1. Query the RAG system via API or CLI
2. Record the answer
3. Verify accuracy against source documentation
4. Check that source documents are cited
5. Assess answer quality (1-5 scale)

### API Testing

```bash
# Test via API
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR_QUESTION_HERE"}' | jq '.answer'
```

### CLI Testing

```bash
# Test via CLI
npm run rag:test "YOUR_QUESTION_HERE"
```

### Automated Testing Script

```bash
#!/bin/bash

# Test all questions and save results
for question in "${questions[@]}"; do
  echo "Testing: $question"
  result=$(npm run rag:test "$question" 2>&1)
  echo "$result" >> rag-test-results.txt
  echo "---" >> rag-test-results.txt
done
```

## Success Criteria

### Response Quality

- **Accuracy:** Answer must be factually correct (100% required)
- **Completeness:** Answer addresses all parts of the question (80%+ required)
- **Source Citation:** Relevant source documents cited (100% required)
- **Relevance:** Answer is on-topic and helpful (90%+ required)
- **Clarity:** Answer is clear and well-formatted (80%+ required)

### Performance Metrics

- **Response Time:** <5 seconds per query
- **Similarity Score:** >0.3 for retrieved chunks
- **Top-K Retrieval:** 5 most relevant chunks
- **Token Efficiency:** Answer <500 tokens for concise queries

### System Metrics

- **Documents Indexed:** All new documentation (12+ files)
- **Chunks Created:** Appropriate chunking (750 tokens, 100 overlap)
- **Tech Tags:** Correctly detected and applied
- **Vector Store Size:** Reasonable growth from baseline

## Documentation Gaps to Identify

During testing, look for:

1. **Unanswerable Questions:** Questions the RAG cannot answer well
2. **Missing Topics:** Important topics not covered in docs
3. **Ambiguous Documentation:** Unclear or conflicting information
4. **Outdated Information:** Docs that need updates
5. **Example Deficiencies:** Topics needing more examples
6. **Cross-Reference Issues:** Missing links between related topics

## Test Results Template

```markdown
### Test Result: [Question Number]

**Question:** [Question text]
**Expected Topic:** [Expected answer topic]
**Source Document:** [Expected source file]

**Actual Answer:**
[RAG system answer]

**Sources Cited:**
- [Document 1]
- [Document 2]

**Quality Assessment:**
- Accuracy: [1-5]
- Completeness: [1-5]
- Relevance: [1-5]
- Clarity: [1-5]
- **Overall: [1-5]**

**Notes:**
[Any observations or issues]

**Pass/Fail:** [PASS/FAIL]
```

## Reporting

After testing, create a report with:

1. **Executive Summary**
   - Total questions tested
   - Pass rate
   - Average quality score
   - System performance

2. **Detailed Results**
   - Per-question results
   - Failed queries and reasons
   - Performance metrics

3. **Documentation Gaps**
   - Missing topics
   - Unclear documentation
   - Recommended additions

4. **Recommendations**
   - Documentation improvements
   - RAG configuration tuning
   - Tech tag adjustments
   - Query pattern optimization

## Next Steps

1. Execute test plan (all 40 questions)
2. Analyze results
3. Identify documentation gaps
4. Update documentation as needed
5. Re-test failed queries
6. Create RAG usage guide for team
