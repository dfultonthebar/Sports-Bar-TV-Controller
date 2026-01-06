
#!/bin/bash
echo "🔄 Restarting Sports Bar AI Assistant Local Server"
echo "================================================="

# Stop any running processes
echo "🛑 Stopping existing servers..."
pkill -f "npm start" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null  
pkill -f "next" 2>/dev/null
sleep 2

# Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git pull origin main

# Install dependencies if needed
echo "📦 Checking dependencies..."
npm install

# Run database migrations/setup if needed
echo "🗄️ Setting up database..."
npx prisma generate
npx prisma db push

# Check Wolf Pack inputs are configured
echo "🔍 Verifying Wolf Pack inputs..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.wolfPackInput.findMany().then(inputs => {
  console.log('Wolf Pack Inputs:', inputs.length);
  inputs.forEach(input => console.log(\`- Channel \${input.channelNumber}: \${input.label}\`));
  prisma.\$disconnect();
}).catch(err => {
  console.log('Database not ready yet, will setup during startup');
  prisma.\$disconnect();
});
"

# Restart the server
echo "🚀 Starting server..."
npm run dev
