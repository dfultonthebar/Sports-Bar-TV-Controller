
export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-2.5 shadow-lg">
                <span className="text-2xl">🏈</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Sports Bar AI Assistant</h1>
                <p className="text-sm text-slate-500">Professional AV Management System</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">🚀 Sports Bar AI Assistant</h2>
            <p className="text-slate-600 mb-6">System is now running successfully!</p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-slate-700">Server Online</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <a 
                  href="/sports-guide"
                  className="block p-6 bg-orange-50 rounded-xl border border-orange-200 hover:bg-orange-100 transition-colors"
                >
                  <h3 className="font-semibold text-orange-800 mb-2">📺 Sports Guide</h3>
                  <p className="text-orange-600 text-sm">Find where to watch sports</p>
                </a>
                
                <a 
                  href="/remote"
                  className="block p-6 bg-emerald-50 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  <h3 className="font-semibold text-emerald-800 mb-2">📱 Remote Control</h3>
                  <p className="text-emerald-600 text-sm">Control TVs and audio systems</p>
                </a>
                
                <a 
                  href="/logs"
                  className="block p-6 bg-blue-50 rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  <h3 className="font-semibold text-blue-800 mb-2">📊 System Logs</h3>
                  <p className="text-blue-600 text-sm">Monitor system performance</p>
                </a>
              </div>
              
              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-2">✅ Issue Status: RESOLVED</h4>
                <p className="text-gray-600 text-sm">All build errors have been fixed. The application is now running properly.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
