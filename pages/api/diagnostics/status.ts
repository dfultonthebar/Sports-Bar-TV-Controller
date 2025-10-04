
import { PrismaClient } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get recent health checks
    const recentChecks = await prisma.systemHealthCheck.findMany({
      take: 10,
      orderBy: { timestamp: 'desc' }
    });

    // Get open issues
    const openIssues = await prisma.issue.findMany({
      where: { status: 'open' },
      orderBy: [
        { severity: 'desc' },
        { timestamp: 'desc' }
      ],
      take: 20
    });

    // Get recent diagnostic runs
    const recentRuns = await prisma.diagnosticRun.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' }
    });

    // Get system metrics for last 24 hours
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const metrics = await prisma.systemMetric.findMany({
      where: {
        timestamp: { gte: dayAgo }
      },
      orderBy: { timestamp: 'desc' },
      take: 100
    });

    // Get active learning patterns
    const patterns = await prisma.learningPattern.findMany({
      where: { isActive: true },
      orderBy: { lastSeen: 'desc' },
      take: 10
    });

    // Calculate statistics
    const stats = {
      totalChecks: await prisma.systemHealthCheck.count(),
      totalIssues: await prisma.issue.count(),
      openIssues: openIssues.length,
      criticalIssues: openIssues.filter(i => i.severity === 'critical').length,
      totalRuns: await prisma.diagnosticRun.count(),
      lastRun: recentRuns[0]?.timestamp || null,
      healthyChecks: recentChecks.filter(c => c.status === 'healthy').length,
      warningChecks: recentChecks.filter(c => c.status === 'warning').length,
      criticalChecks: recentChecks.filter(c => c.status === 'critical').length
    };

    res.status(200).json({
      success: true,
      stats,
      recentChecks,
      openIssues,
      recentRuns,
      metrics,
      patterns,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    await prisma.$disconnect();
  }
}
