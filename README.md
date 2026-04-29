## ⚙️ Project Overview

This project is composed of two main applications:

- **Frontend** → Next.js (UI / Client Application)
- **Backend** → API Server (Node.js / Express or equivalent)

Both applications are required for the system to function properly.

---

## 📁 Project Structure

The project must be organized like this:

project-root/
│
├── frontend/ # Next.js application
├── backend/ # API server
└── package.json (root scripts)


⚠️ IMPORTANT:
- Both `frontend` and `backend` folders must be in the **same root directory**
- The system depends on cross-communication between both services

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd project-root
2. Install dependencies
Frontend
cd frontend
npm install
Backend
cd ../backend
npm install
Root (if applicable)
cd ..
npm install
▶️ Running the Project
To start both frontend and backend simultaneously:

npm run dev:full
This command will:

Start the frontend (Next.js) server

Start the backend API server

Run both services concurrently for development

🌐 Access URLs
Once running:

Frontend: http://localhost:3000

Backend API: http://localhost:<backend-port>

🧠 Important Notes
Both frontend and backend must be running for full functionality

Do NOT run frontend alone if API-dependent features are used

Ensure both services share correct environment configurations

Keep both folders inside the same workspace directory

⚙️ Available Scripts
Root (Recommended)
npm run dev:full   # Runs both frontend + backend
Frontend
npm run dev        # Start frontend only
npm run build      # Build production version
npm run start      # Run production build
Backend
npm run dev        # Start backend only
🔐 Environment Variables
Each service requires its own environment file:

Frontend
/frontend/.env.local
Backend
/backend/.env
Make sure both are properly configured before running the system.

🧩 Features
Requisition and Issue Slip (RIS) generation

Property Accountability (PAR / ICS)

Inventory tracking system

Issuance and acknowledgment workflow

Print-ready government forms (A4 format)

Role-based access control (if enabled)

Audit-friendly transaction history

🛠 Tech Stack
Frontend
Next.js

React

TypeScript

Tailwind CSS

Backend
Node.js / Express (or equivalent)

REST API

Database integration (MySQL/PostgreSQL/etc.)

⚠️ Troubleshooting
Common Issues
1. Blank page / API not working

Ensure backend is running

Check .env API URL configuration

2. Port already in use

npx kill-port 3000
3. Dependencies issues

rm -rf node_modules
npm install
4. dev:full not working

Ensure both frontend and backend exist in the same directory

Check root package.json scripts

📄 License
This project is intended for Academic Purposes Only.

