'use client'

import { useState } from 'react'

export default function TestUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string>('')
  const [result, setResult] = useState<any>(null)

  const handleUpload = async () => {
    if (!file) {
      setStatus('No file selected')
      return
    }

    setStatus('Uploading...')

    try {
      const formData = new FormData()
      formData.append('layout', file)
      formData.append('name', 'Test Layout')
      formData.append('autoDetect', 'false')

      const response = await fetch('/api/bartender/layout/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      setResult(data)
      setStatus(data.success ? 'Upload successful!' : 'Upload failed: ' + data.error)
    } catch (error: any) {
      setStatus('Error: ' + error.message)
      setResult({ error: error.message })
    }
  }

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Upload Page</h1>

      <div className="space-y-4">
        <div>
          <label className="block mb-2">Select image file (PNG, SVG, JPG):</label>
          <input
            type="file"
            accept="image/*,.svg"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm border rounded p-2"
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={!file}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
        >
          Upload
        </button>

        {status && (
          <div className={`p-4 rounded ${status.includes('successful') ? 'bg-green-100' : status.includes('Error') || status.includes('failed') ? 'bg-red-100' : 'bg-yellow-100'}`}>
            {status}
          </div>
        )}

        {result && (
          <pre className="p-4 bg-gray-100 rounded overflow-auto text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}
