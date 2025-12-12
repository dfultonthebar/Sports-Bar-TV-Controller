'use client'

import { useState, useEffect } from 'react'
import SportsBarHeader from '@/components/SportsBarHeader'
import SportsBarLayout from '@/components/SportsBarLayout'
import {
  ArrowLeft,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  Database,
  Box,
  Tv,
  Radio,
  Users,
  List,
  TestTube
} from 'lucide-react'
import Link from 'next/link'

import { logger } from '@/lib/logger'
interface TestSuite {
  id: string
  name: string
  description: string
  safe: boolean
}

interface TestResult {
  success: boolean
  suite: string
  safeMode: boolean
  duration: number
  exitCode: number
  testResults?: any
  stdout?: string
  stderr?: string
}

export default function AdminTestsPage() {
  const [suites, setSuites] = useState<TestSuite[]>([])
  const [selectedSuite, setSelectedSuite] = useState<string>('all')
  const [safeMode, setSafeMode] = useState<boolean>(true)
  const [running, setRunning] = useState<boolean>(false)
  const [lastResult, setLastResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTestSuites()
  }, [])

  const loadTestSuites = async () => {
    try {
      const response = await fetch('/api/tests/run')
      if (response.ok) {
        const data = await response.json()
        setSuites(data.suites || [])
      }
    } catch (error) {
      logger.error('Error loading test suites:', error)
    } finally {
      setLoading(false)
    }
  }

  const runTests = async () => {
    setRunning(true)
    setLastResult(null)

    try {
      const response = await fetch('/api/tests/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suite: selectedSuite,
          safeMode
        })
      })

      const result = await response.json()
      setLastResult(result)
    } catch (error: any) {
      setLastResult({
        success: false,
        suite: selectedSuite,
        safeMode,
        duration: 0,
        exitCode: 1,
        stderr: error.message
      })
    } finally {
      setRunning(false)
    }
  }

  const getSuiteIcon = (suiteId: string) => {
    switch (suiteId) {
      case 'api': return <Radio className="w-5 h-5" />
      case 'database': return <Database className="w-5 h-5" />
      case 'matrix': return <Box className="w-5 h-5" />
      case 'hardware': return <Box className="w-5 h-5" />
      case 'firetv': return <Tv className="w-5 h-5" />
      case 'scenarios': return <Users className="w-5 h-5" />
      case 'all': return <List className="w-5 h-5" />
      default: return <CheckCircle className="w-5 h-5" />
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    const seconds = (ms / 1000).toFixed(2)
    return `${seconds}s`
  }

  if (loading) {
    return (
      <SportsBarLayout>
        <div className="min-h-screen bg-gradient-to-br from-sportsBar-900 via-sportsBar-800 to-sportsBar-900 flex items-center justify-center">
          <div className="text-white text-xl">Loading test suites...</div>
        </div>
      </SportsBarLayout>
    )
  }

  return (
    <SportsBarLayout>
      <div className="min-h-screen bg-gradient-to-br from-sportsBar-900 via-sportsBar-800 to-sportsBar-900">
        <SportsBarHeader
          title="System Integration Tests"
          subtitle="Run and monitor integration test suites"
          icon={<TestTube className="w-6 h-6" />}
        />

        <main className="container mx-auto px-4 py-8">
          {/* Back Button */}
          <div className="mb-6">
            <Link
              href="/system-health"
              className="inline-flex items-center space-x-2 text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to System Health</span>
            </Link>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              System Integration Tests
            </h1>
            <p className="text-slate-300">
              Run integration tests to verify system components and workflows
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Test Configuration */}
            <div className="lg:col-span-1">
              <div className="card p-6">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Test Configuration
                </h2>

                {/* Safe Mode Toggle */}
                <div className="mb-6">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={safeMode}
                      onChange={(e) => setSafeMode(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-600 text-emerald-500 focus:ring-2 focus:ring-emerald-500"
                      disabled={running}
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        <span className="text-white font-medium">Safe Mode</span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        Skip hardware tests to avoid affecting physical devices
                      </p>
                    </div>
                  </label>
                </div>

                {/* Test Suite Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Test Suite
                  </label>
                  <select
                    value={selectedSuite}
                    onChange={(e) => setSelectedSuite(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    disabled={running}
                  >
                    {suites.map(suite => (
                      <option key={suite.id} value={suite.id}>
                        {suite.name}
                        {!suite.safe && safeMode ? ' (Disabled in Safe Mode)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-slate-400 mt-2">
                    {suites.find(s => s.id === selectedSuite)?.description}
                  </p>
                </div>

                {/* Run Button */}
                <button
                  onClick={runTests}
                  disabled={running}
                  className={`w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                    running
                      ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {running ? (
                    <>
                      <Clock className="w-5 h-5 animate-spin" />
                      <span>Running Tests...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      <span>Run Tests</span>
                    </>
                  )}
                </button>
              </div>

              {/* Available Test Suites */}
              <div className="card p-6 mt-6">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Available Test Suites
                </h2>
                <div className="space-y-2">
                  {suites.map(suite => (
                    <div
                      key={suite.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                        selectedSuite === suite.id
                          ? 'bg-emerald-600/20 border border-emerald-500'
                          : 'bg-slate-700/50'
                      } ${
                        !suite.safe && safeMode
                          ? 'opacity-50'
                          : ''
                      }`}
                    >
                      <div className="text-emerald-400">
                        {getSuiteIcon(suite.id)}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-medium">{suite.name}</div>
                        <div className="text-xs text-slate-400">{suite.description}</div>
                      </div>
                      {!suite.safe && (
                        <div title="Requires hardware access">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Test Results */}
            <div className="lg:col-span-2">
              <div className="card p-6">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Test Results
                </h2>

                {!lastResult && !running && (
                  <div className="text-center py-12">
                    <Play className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">
                      No tests have been run yet. Select a test suite and click "Run Tests" to begin.
                    </p>
                  </div>
                )}

                {running && (
                  <div className="text-center py-12">
                    <Clock className="w-16 h-16 text-emerald-400 mx-auto mb-4 animate-spin" />
                    <p className="text-white text-lg mb-2">Running {selectedSuite} tests...</p>
                    <p className="text-slate-400">This may take up to 2 minutes</p>
                  </div>
                )}

                {lastResult && !running && (
                  <div className="space-y-4">
                    {/* Overall Status */}
                    <div className={`p-4 rounded-lg border-2 ${
                      lastResult.success
                        ? 'bg-emerald-900/20 border-emerald-500'
                        : 'bg-red-900/20 border-red-500'
                    }`}>
                      <div className="flex items-center space-x-3">
                        {lastResult.success ? (
                          <CheckCircle className="w-8 h-8 text-emerald-400" />
                        ) : (
                          <XCircle className="w-8 h-8 text-red-400" />
                        )}
                        <div>
                          <div className="text-white font-semibold text-lg">
                            {lastResult.success ? 'All Tests Passed' : 'Tests Failed'}
                          </div>
                          <div className="text-slate-300 text-sm">
                            Suite: {lastResult.suite} | Duration: {formatDuration(lastResult.duration)}
                            {lastResult.safeMode && ' | Safe Mode: ON'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Results */}
                    {lastResult.testResults && (
                      <div className="bg-slate-700/50 rounded-lg p-4">
                        <h3 className="text-white font-semibold mb-3">Detailed Results</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-800 rounded p-3">
                            <div className="text-slate-400 text-sm">Total Tests</div>
                            <div className="text-white text-2xl font-bold">
                              {lastResult.testResults.numTotalTests || 0}
                            </div>
                          </div>
                          <div className="bg-emerald-900/30 rounded p-3">
                            <div className="text-slate-400 text-sm">Passed</div>
                            <div className="text-emerald-400 text-2xl font-bold">
                              {lastResult.testResults.numPassedTests || 0}
                            </div>
                          </div>
                          <div className="bg-red-900/30 rounded p-3">
                            <div className="text-slate-400 text-sm">Failed</div>
                            <div className="text-red-400 text-2xl font-bold">
                              {lastResult.testResults.numFailedTests || 0}
                            </div>
                          </div>
                          <div className="bg-slate-800 rounded p-3">
                            <div className="text-slate-400 text-sm">Exit Code</div>
                            <div className="text-white text-2xl font-bold">
                              {lastResult.exitCode}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Test Output */}
                    {lastResult.stdout && (
                      <div className="bg-slate-800 rounded-lg p-4">
                        <h3 className="text-white font-semibold mb-2">Test Output</h3>
                        <pre className="text-xs text-slate-300 overflow-x-auto max-h-96 overflow-y-auto">
                          {lastResult.stdout}
                        </pre>
                      </div>
                    )}

                    {/* Errors */}
                    {lastResult.stderr && (
                      <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
                        <h3 className="text-red-400 font-semibold mb-2">Errors</h3>
                        <pre className="text-xs text-red-300 overflow-x-auto max-h-48 overflow-y-auto">
                          {lastResult.stderr}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </SportsBarLayout>
  )
}
