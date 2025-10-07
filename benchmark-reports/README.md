# Benchmark Reports

This directory contains system benchmark reports for the Sports Bar TV Controller application.

## Files

- `baseline-report-*.md` - Markdown format baseline reports
- `baseline-report-*.json` - JSON format baseline reports (machine-readable)
- `comparison-template.md` - Template for comparing old vs new system performance

## Running Benchmarks

To run a comprehensive system benchmark:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
./scripts/system-benchmark.sh
```

The benchmark will take approximately 15-20 minutes and will test:
1. Hardware specifications
2. CPU performance
3. Disk I/O performance
4. Memory performance
5. PostgreSQL database performance
6. Ollama AI performance
7. Next.js application performance
8. System health checks

## Comparing Systems

After running benchmarks on both the old and new systems:

1. Review both baseline reports
2. Copy `comparison-template.md` to a new file
3. Fill in the values from both reports
4. Calculate improvement percentages
5. Add analysis and recommendations

## Report Format

### Markdown Reports
Human-readable reports with formatted tables and sections.

### JSON Reports
Machine-readable reports for automated processing and analysis.

Structure:
```json
{
  "benchmark_metadata": { ... },
  "results": {
    "hardware": { ... },
    "cpu_performance": { ... },
    "disk_io": { ... },
    "memory": { ... },
    "postgresql": { ... },
    "ollama": { ... },
    "nextjs": { ... },
    "system_health": { ... }
  }
}
```

## Notes

- Benchmarks should be run during low-activity periods for accurate results
- Ensure all services (PostgreSQL, Ollama, PM2) are running before benchmarking
- Keep historical reports for trend analysis
- Compare reports from similar system states (same load, same time of day)

