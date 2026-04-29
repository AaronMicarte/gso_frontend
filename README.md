## 📁 Project Structure

Both projects must be in the same root WORKSPACE (RECOMMENDED NAME : "GSO_IAMS"):

project-root/
├── frontend/ (Next.js)
├── backend/ (Laravel)


---

## 🚀 Installation

### 1. Install Backend (Laravel)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
Backend runs at:

http://127.0.0.1:8000
2. Install Frontend (Next.js)
cd frontend
npm install
Create .env.local:

NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
▶️ Run the Project (Full Stack)
Run both frontend + backend together:

npm run dev:full
This command assumes a root-level script that starts both Laravel and Next.js concurrently.