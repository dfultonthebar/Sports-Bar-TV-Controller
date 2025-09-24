
# 🏈 Sports Bar AI Assistant

AI-powered assistant for sports bar AV system management with Wolf Pack Matrix Control integration.

## 🚀 Features

- **📄 Document Upload**: Upload and manage AV system documentation
- **🤖 AI Chat**: Get intelligent troubleshooting assistance 
- **🎛️ Matrix Control**: Wolf Pack Matrix IP control and configuration
- **🔧 System Enhancement**: System management and API key configuration

## 🛠️ Quick Deploy on Server

### 🚀 RECOMMENDED: Complete Fresh Installation
```bash
# Download the fresh installer
curl -o fresh_sports_bar_install.sh https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/fresh_install.sh
chmod +x fresh_sports_bar_install.sh

# Run the fresh installer (clears old install, downloads fresh, installs)
./fresh_sports_bar_install.sh
```

### Alternative Installation Methods

#### Method 1: Clone and Fresh Install
```bash
# Clone the repository
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller

# Run the fresh installer (clears and reinstalls)
chmod +x fresh_install.sh
./fresh_install.sh
```

#### Method 2: Fixed Installation (for existing clone)
```bash
# Clone the repository
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller

# Run the FIXED installer (resolves yarn configuration issues)
chmod +x install_fixed.sh
./install_fixed.sh
```

#### Method 3: One-Line Install (Original - may have issues)
```bash
curl -fsSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
```

> **Note**: The **Fresh Installation** method is recommended as it completely clears any previous installations and ensures a clean setup.

## 📋 Management Commands

```bash
# Check application status
./status.sh

# Start the application manually
yarn dev > server.log 2>&1 &

# Stop the application  
pkill -f "next"

# Restart the application
pkill -f "next" && yarn dev > server.log 2>&1 &

# View logs
tail -f server.log

# Deploy updates from GitHub
./deploy.sh
```

## 🌐 Access Your Application

- Local: http://localhost:3000
- Remote: http://YOUR_SERVER_IP:3000

## 🔧 Technical Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: NextAuth.js
- **UI Components**: Radix UI, Lucide React

## 📁 Project Structure

```
sports-bar-ai-assistant/
├── src/
│   ├── app/                 # Next.js app directory
│   ├── components/          # React components
│   └── lib/                 # Utility libraries
├── prisma/                  # Database schema
├── public/                  # Static assets
└── scripts/                 # Management scripts
```

## 🐛 Troubleshooting

### Application won't start:
```bash
./logs.sh  # Check logs for errors
./restart.sh  # Restart services
```

### Database issues:
```bash
cd src && npx prisma db push
```

### Port already in use:
```bash
./stop.sh  # Stop all services
./start.sh  # Start fresh
```

## 📞 Support

For issues or questions, check the logs first:
```bash
./logs.sh
```

---
**Sports Bar AI Assistant** - Streamlining AV system management with AI-powered assistance.
