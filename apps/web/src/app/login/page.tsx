'use client'

/**
 * Login Page
 *
 * Simple PIN-based authentication page with:
 * - Numeric keypad for PIN entry
 * - Visual feedback (dots for entered digits)
 * - Role display after successful login
 * - Error messages for failed attempts
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/logger'

export default function LoginPage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleNumberClick = (num: number) => {
    if (pin.length < 4) {
      setPin(pin + num.toString())
      setError('')
    }
  }

  const handleClear = () => {
    setPin('')
    setError('')
  }

  const handleSubmit = async () => {
    if (pin.length !== 4) {
      setError('Please enter a 4-digit PIN')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Login successful - redirect to home or stored redirect URL
        const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/'
        logger.info(`Login successful, redirecting to: ${redirectUrl}`)
        router.push(redirectUrl)
      } else {
        setError(data.error || 'Invalid PIN. Please try again.')
        setPin('')
      }
    } catch (err) {
      logger.error('Login error:', err)
      setError('Login failed. Please try again.')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-700">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Sports Bar TV Controller
          </h1>
          <p className="text-gray-400 text-sm">
            Enter your PIN to continue
          </p>
        </div>

        {/* PIN Display */}
        <div className="flex justify-center gap-3 mb-8">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-4 h-4 rounded-full transition-all ${
                index < pin.length
                  ? 'bg-blue-500 scale-110'
                  : 'bg-gray-600 scale-100'
              }`}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num)}
              disabled={loading || pin.length >= 4}
              className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-2xl font-semibold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {num}
            </button>
          ))}

          {/* Clear Button */}
          <button
            onClick={handleClear}
            disabled={loading || pin.length === 0}
            className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-lg font-semibold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            Clear
          </button>

          {/* Zero Button */}
          <button
            onClick={() => handleNumberClick(0)}
            disabled={loading || pin.length >= 4}
            className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-2xl font-semibold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            0
          </button>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={loading || pin.length !== 4}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-lg font-semibold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </span>
            ) : (
              'Login'
            )}
          </button>
        </div>

        {/* Footer Info */}
        <div className="text-center text-gray-500 text-xs">
          <p className="mb-1">Default PINs (change in production):</p>
          <p>STAFF: 1234 • ADMIN: 9999</p>
        </div>
      </div>
    </div>
  )
}
