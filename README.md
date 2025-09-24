
# 🏈 Sports Bar AI Assistant

AI-powered assistant for sports bar AV system management with Wolf Pack Matrix Control integration.

## 🚀 Features

- **📄 Document Upload**: Upload and manage AV system documentation
- **🤖 AI Chat**: Get intelligent troubleshooting assistance 
- **🎛️ Matrix Control**: Wolf Pack Matrix IP control and configuration
- **🔧 System Enhancement**: System management and API key configuration

## 🛠️ Quick Deploy on Server

### Method 1: Direct GitHub Clone
```bash
# Clone the repository
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller

# Run the installer
chmod +x install.sh
./install.sh
```

### Method 2: One-Line Install
```bash
curl -fsSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
```

## 📋 Management Commands

```bash
# Start the application
./start.sh

# Stop the application  
./stop.sh

# Restart the application
./restart.sh

# View logs
./logs.sh

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
