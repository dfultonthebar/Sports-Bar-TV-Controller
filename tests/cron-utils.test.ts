/**
 * Cron Utilities Test Suite
 *
 * Tests for cron expression validation and parsing utilities
 */

import {
  isValidCronExpression,
  getNextExecution,
  describeCronExpression,
  getNextExecutions,
  validateCronWithMessage,
  getCronExecutionInfo,
  getCronPreset,
  listCronPresets,
  CRON_PRESETS
} from '@/lib/cron-utils'

describe('Cron Utilities', () => {
  describe('isValidCronExpression', () => {
    test('validates correct cron expressions', () => {
      expect(isValidCronExpression('0 19 * * 1')).toBe(true)
      expect(isValidCronExpression('*/30 * * * *')).toBe(true)
      expect(isValidCronExpression('0 6 * * *')).toBe(true)
      expect(isValidCronExpression('0 12 * * 1-5')).toBe(true)
      expect(isValidCronExpression('*/15 * * * *')).toBe(true)
    })

    test('rejects invalid cron expressions', () => {
      expect(isValidCronExpression('invalid')).toBe(false)
      expect(isValidCronExpression('99 99 99 99 99')).toBe(false)
      expect(isValidCronExpression('')).toBe(false)
      expect(isValidCronExpression('* *')).toBe(false) // Too few fields
      expect(isValidCronExpression('not a cron')).toBe(false)
    })

    test('validates NFL game day schedules', () => {
      expect(isValidCronExpression('0 12 * * 0')).toBe(true) // Sunday noon
      expect(isValidCronExpression('0 20 * * 0')).toBe(true) // Sunday Night Football
      expect(isValidCronExpression('0 20 * * 1')).toBe(true) // Monday Night Football
      expect(isValidCronExpression('0 20 * * 4')).toBe(true) // Thursday Night Football
    })
  })

  describe('getNextExecution', () => {
    test('gets next execution time for valid cron', () => {
      const next = getNextExecution('0 12 * * *')
      expect(next).toBeInstanceOf(Date)
      expect(next!.getHours()).toBe(12)
      expect(next!.getMinutes()).toBe(0)
    })

    test('returns null for invalid cron expression', () => {
      const next = getNextExecution('invalid')
      expect(next).toBeNull()
    })

    test('calculates Monday 7 PM correctly', () => {
      const next = getNextExecution('0 19 * * 1')
      expect(next).toBeInstanceOf(Date)
      expect(next!.getDay()).toBe(1) // Monday
      expect(next!.getHours()).toBe(19)
    })

    test('calculates every 30 minutes', () => {
      const next = getNextExecution('*/30 * * * *')
      expect(next).toBeInstanceOf(Date)
      // Should be either 0 or 30 minutes
      expect([0, 30]).toContain(next!.getMinutes())
    })
  })

  describe('describeCronExpression', () => {
    test('describes common cron patterns', () => {
      expect(describeCronExpression('0 6 * * *')).toBe('Daily at 6 AM')
      expect(describeCronExpression('0 19 * * 1')).toBe('Every Monday at 7 PM')
      expect(describeCronExpression('*/30 * * * *')).toBe('Every 30 minutes')
      expect(describeCronExpression('0 12 * * 1-5')).toBe('Weekdays at noon')
    })

    test('describes NFL schedules', () => {
      expect(describeCronExpression('0 12 * * 0')).toBe('Every Sunday at noon')
      expect(describeCronExpression('0 20 * * 0')).toBe('Every Sunday at 8 PM (Sunday Night Football)')
      expect(describeCronExpression('0 20 * * 1')).toBe('Every Monday at 8 PM (Monday Night Football)')
      expect(describeCronExpression('0 20 * * 4')).toBe('Every Thursday at 8 PM (Thursday Night Football)')
    })

    test('returns "Custom schedule" for unknown patterns', () => {
      expect(describeCronExpression('13 14 15 * *')).toBe('Custom schedule')
    })
  })

  describe('getNextExecutions', () => {
    test('gets multiple future executions', () => {
      const executions = getNextExecutions('0 12 * * *', 3)
      expect(executions).toHaveLength(3)
      executions.forEach((exec) => {
        expect(exec).toBeInstanceOf(Date)
        expect(exec.getHours()).toBe(12)
      })
    })

    test('gets 5 executions by default', () => {
      const executions = getNextExecutions('0 0 * * *')
      expect(executions).toHaveLength(5)
    })

    test('returns empty array for invalid cron', () => {
      const executions = getNextExecutions('invalid')
      expect(executions).toHaveLength(0)
    })

    test('future executions are in chronological order', () => {
      const executions = getNextExecutions('0 12 * * *', 3)
      for (let i = 1; i < executions.length; i++) {
        expect(executions[i].getTime()).toBeGreaterThan(executions[i - 1].getTime())
      }
    })
  })

  describe('validateCronWithMessage', () => {
    test('returns valid for correct cron', () => {
      const result = validateCronWithMessage('0 19 * * 1')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    test('returns error message for invalid cron', () => {
      const result = validateCronWithMessage('invalid')
      expect(result.isValid).toBe(false)
      expect(result.error).toBeDefined()
      expect(typeof result.error).toBe('string')
    })
  })

  describe('getCronExecutionInfo', () => {
    test('returns complete execution info for valid cron', () => {
      const info = getCronExecutionInfo('0 19 * * 1')
      expect(info.isValid).toBe(true)
      expect(info.nextRun).toBeInstanceOf(Date)
      expect(info.description).toBe('Every Monday at 7 PM')
      expect(info.upcomingRuns).toHaveLength(5)
      expect(info.error).toBeUndefined()
    })

    test('returns error info for invalid cron', () => {
      const info = getCronExecutionInfo('invalid')
      expect(info.isValid).toBe(false)
      expect(info.nextRun).toBeNull()
      expect(info.description).toBe('Invalid cron expression')
      expect(info.upcomingRuns).toHaveLength(0)
      expect(info.error).toBeDefined()
    })
  })

  describe('CRON_PRESETS', () => {
    test('contains all expected presets', () => {
      expect(CRON_PRESETS.DAILY_OPENING).toBe('0 9 * * *')
      expect(CRON_PRESETS.DAILY_CLOSING).toBe('0 2 * * *')
      expect(CRON_PRESETS.NFL_SUNDAY_EARLY).toBe('0 12 * * 0')
      expect(CRON_PRESETS.NFL_SUNDAY_NIGHT).toBe('0 20 * * 0')
      expect(CRON_PRESETS.NFL_MONDAY_NIGHT).toBe('0 20 * * 1')
      expect(CRON_PRESETS.NFL_THURSDAY_NIGHT).toBe('0 20 * * 4')
    })

    test('all presets are valid cron expressions', () => {
      Object.values(CRON_PRESETS).forEach((preset) => {
        expect(isValidCronExpression(preset)).toBe(true)
      })
    })
  })

  describe('getCronPreset', () => {
    test('returns preset cron expression', () => {
      expect(getCronPreset('NFL_SUNDAY_EARLY')).toBe('0 12 * * 0')
      expect(getCronPreset('DAILY_OPENING')).toBe('0 9 * * *')
    })

    test('returns null for unknown preset', () => {
      expect(getCronPreset('UNKNOWN' as any)).toBeNull()
    })
  })

  describe('listCronPresets', () => {
    test('returns array of all presets with descriptions', () => {
      const presets = listCronPresets()
      expect(Array.isArray(presets)).toBe(true)
      expect(presets.length).toBeGreaterThan(0)

      presets.forEach((preset) => {
        expect(preset).toHaveProperty('name')
        expect(preset).toHaveProperty('cron')
        expect(preset).toHaveProperty('description')
        expect(typeof preset.name).toBe('string')
        expect(typeof preset.cron).toBe('string')
        expect(typeof preset.description).toBe('string')
      })
    })

    test('includes NFL presets in list', () => {
      const presets = listCronPresets()
      const nflPresets = presets.filter((p) => p.name.includes('NFL'))
      expect(nflPresets.length).toBeGreaterThan(0)
    })
  })

  describe('Real-world sports bar scenarios', () => {
    test('Monday Night Football setup (7 PM prep)', () => {
      const cron = '0 19 * * 1'
      expect(isValidCronExpression(cron)).toBe(true)

      const next = getNextExecution(cron)
      expect(next).toBeInstanceOf(Date)
      expect(next!.getDay()).toBe(1) // Monday
      expect(next!.getHours()).toBe(19)
    })

    test('Sunday NFL early games (noon)', () => {
      const cron = '0 12 * * 0'
      expect(isValidCronExpression(cron)).toBe(true)

      const next = getNextExecution(cron)
      expect(next).toBeInstanceOf(Date)
      expect(next!.getDay()).toBe(0) // Sunday
      expect(next!.getHours()).toBe(12)
    })

    test('Weekday happy hour setup (4:30 PM)', () => {
      const cron = '30 16 * * 1-5'
      expect(isValidCronExpression(cron)).toBe(true)

      const next = getNextExecution(cron)
      expect(next).toBeInstanceOf(Date)
      expect([1, 2, 3, 4, 5]).toContain(next!.getDay()) // Monday-Friday
      expect(next!.getHours()).toBe(16)
      expect(next!.getMinutes()).toBe(30)
    })

    test('Health check every 15 minutes', () => {
      const cron = '*/15 * * * *'
      expect(isValidCronExpression(cron)).toBe(true)

      const executions = getNextExecutions(cron, 4)
      expect(executions).toHaveLength(4)

      // Check they're 15 minutes apart
      for (let i = 1; i < executions.length; i++) {
        const diff = executions[i].getTime() - executions[i - 1].getTime()
        expect(diff).toBe(15 * 60 * 1000) // 15 minutes in milliseconds
      }
    })

    test('Daily closing routine (2 AM)', () => {
      const cron = '0 2 * * *'
      expect(isValidCronExpression(cron)).toBe(true)

      const next = getNextExecution(cron)
      expect(next).toBeInstanceOf(Date)
      expect(next!.getHours()).toBe(2)
      expect(next!.getMinutes()).toBe(0)
    })
  })
})
