
#!/bin/bash

# Sports Bar AI Assistant Status Script
echo "🏈 Sports Bar AI Assistant Status Check"
echo "======================================"

# Check if server is running
SERVER_PIDS=$(ps aux | grep -v grep | grep next | awk '{print $2}')

if [ -n "$SERVER_PIDS" ]; then
    echo "✅ Server Status: RUNNING"
    echo "📍 Server PIDs: $SERVER_PIDS"
    echo "🌐 Application URL: http://localhost:3001"
    
    # Test connection
    if curl -s http://localhost:3001 > /dev/null; then
        echo "✅ Connection Test: SUCCESS"
    else
        echo "❌ Connection Test: FAILED"
    fi
    
    echo ""
    echo "📋 Management Commands:"
    echo "   Stop Server:    pkill -f \"next\""
    echo "   Restart Server: pkill -f \"next\" && yarn dev > server.log 2>&1 &"
    echo "   View Logs:      tail -f server.log"
    echo "   Check Status:   ./status.sh"
else
    echo "❌ Server Status: NOT RUNNING"
    echo ""
    echo "🚀 To start the server:"
    echo "   cd /home/ubuntu/Sports-Bar-TV-Controller"
    echo "   yarn dev > server.log 2>&1 &"
fi

echo ""
echo "📁 Project Directory: /home/ubuntu/Sports-Bar-TV-Controller"
echo "📊 Database File: dev.db"

# Check database file
if [ -f "prisma/dev.db" ]; then
    echo "✅ Database: EXISTS"
else
    echo "❌ Database: MISSING (run 'yarn prisma db push')"
fi

echo ""
echo "🎯 Quick Access: http://localhost:3001"
