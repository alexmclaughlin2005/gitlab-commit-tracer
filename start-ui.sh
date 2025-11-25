#!/bin/bash

# GitLab Commit Tracer - UI Startup Script

echo "🚀 Starting GitLab Commit Tracer..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "✅ .env file created!"
    echo "❗ Please edit .env with your GitLab credentials before continuing."
    echo ""
    echo "Required variables:"
    echo "  - GITLAB_URL (e.g., https://gitlab.com)"
    echo "  - GITLAB_TOKEN (your personal access token)"
    echo "  - GITLAB_PROJECT_ID (e.g., namespace/project-name)"
    echo ""
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Start the server
echo "🌐 Starting server on http://localhost:3000..."
echo "📊 Dashboard will be available at http://localhost:3000"
echo "🔧 API endpoints at http://localhost:3000/api"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev:server
