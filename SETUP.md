# 🚀 Setup Guide - Rateio.Top MVP

Complete guide to set up the database, backend, and frontend for the Rateio.Top application.

---

## 📋 Prerequisites

Before starting, ensure you have:

- **Node.js 22+** installed ([Download](https://nodejs.org/))
- **pnpm** package manager installed:
  ```bash
  npm install -g pnpm
  ```
- **MySQL database** (local or remote)
  - Local: Install MySQL Server or use Docker
  - Remote: Have connection string ready

---

## 🗄️ Database Setup

### Option 1: Local MySQL

1. **Install MySQL** (if not already installed)
   - Windows: Download from [MySQL Downloads](https://dev.mysql.com/downloads/mysql/)
   - macOS: `brew install mysql` or use MySQL Installer
   - Linux: `sudo apt-get install mysql-server` (Ubuntu/Debian)

2. **Start MySQL service**
   ```bash
   # Windows (as Administrator)
   net start MySQL80
   
   # macOS
   brew services start mysql
   
   # Linux
   sudo systemctl start mysql
   ```

3. **Create database**
   ```bash
   mysql -u root -p
   ```
   ```sql
   CREATE DATABASE rateio_top_mvp;
   CREATE USER 'rateio_user'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON rateio_top_mvp.* TO 'rateio_user'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

### Option 2: Docker MySQL

```bash
docker run --name rateio-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=rateio_top_mvp \
  -e MYSQL_USER=rateio_user \
  -e MYSQL_PASSWORD=your_password \
  -p 3306:3306 \
  -d mysql:8.0
```

### Option 3: Remote MySQL (Cloud)

Use your cloud provider's MySQL service (AWS RDS, Google Cloud SQL, etc.) and get the connection string.

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL=mysql://rateio_user:your_password@localhost:3306/rateio_top_mvp

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# App ID (for OAuth - optional if using email/password)
VITE_APP_ID=your-app-id

# OAuth Server URL (optional if using email/password)
OAUTH_SERVER_URL=https://your-oauth-server.com

# OAuth Portal URL (optional if using email/password)
VITE_OAUTH_PORTAL_URL=https://your-oauth-portal.com

# Owner OpenID (for admin access)
OWNER_OPEN_ID=your-open-id

# Pagar.me API (for Pix payments)
PAGARME_API_KEY=your-pagarme-api-key
PAGARME_ACCOUNT_ID=your-pagarme-account-id
PAGARME_WEBHOOK_URL=https://your-public-url/api/webhook/pagarme

# Development Mode (set to "true" to bypass auth)
VITE_DEV_MODE=false

# Node Environment
NODE_ENV=development
```

**Important:** Never commit `.env` to version control!

---

## 📦 Installation

1. **Clone/Navigate to the project**
   ```bash
   cd rateio_top_mvp
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Install bcrypt** (required for password hashing)
   ```bash
   pnpm add bcrypt
   pnpm add -D @types/bcrypt
   ```

---

## 🗃️ Database Migrations

### Generate Migration (if schema changed)

When you modify `drizzle/schema.ts`, generate a new migration:

```bash
pnpm drizzle-kit generate
```

This creates a new SQL file in `drizzle/` directory.

### Run Migrations

**Option 1: Push schema directly (recommended for development)**
```bash
pnpm db:push
```

This command:
- Generates migration files from schema changes
- Applies migrations to your database
- Creates all tables and columns

**Option 2: Run migrations manually**

1. Generate migration:
   ```bash
   pnpm drizzle-kit generate
   ```

2. Apply migration:
   ```bash
   pnpm drizzle-kit migrate
   ```

### Verify Database Setup

Check that tables were created:

```bash
mysql -u rateio_user -p rateio_top_mvp
```

```sql
SHOW TABLES;
-- Should show: users, rateios, participants, paymentIntents, transactions, rateioEvents

DESCRIBE users;
-- Should show columns including: id, openId, name, email, password, loginMethod, role, etc.
```

---

## 🔧 Backend Setup

The backend runs on **Express + tRPC** and serves both API and frontend.

### Start Development Server

```bash
pnpm dev
```

This will:
- Start the Express server
- Set up Vite dev server for frontend
- Enable hot-reload for both frontend and backend
- Server runs on `http://localhost:3000` (or next available port)

### Backend Structure

```
server/
├── _core/
│   ├── index.ts          # Express server entry point
│   ├── context.ts        # tRPC context
│   ├── trpc.ts           # tRPC setup
│   ├── sdk.ts            # Auth SDK (OAuth + sessions)
│   ├── password.ts       # Password hashing utilities
│   └── env.ts            # Environment variables
├── routers.ts            # tRPC routers (API endpoints)
├── db.ts                 # Database queries
└── pagarme.ts            # Pagar.me integration
```

### API Endpoints

All API calls go through tRPC at `/api/trpc`:

- `auth.login` - Email/password login
- `auth.register` - Create new account
- `auth.me` - Get current user
- `auth.logout` - Logout
- `rateio.create` - Create new rateio
- `rateio.getById` - Get rateio details
- `participant.create` - Add participant
- `payment.createIntent` - Generate Pix QR code

---

## 🎨 Frontend Setup

The frontend is built with **React 19 + Vite + Tailwind CSS**.

### Development

The frontend is automatically served by the backend in development mode:

```bash
pnpm dev
```

Then open: `http://localhost:3000`

### Frontend Structure

```
client/src/
├── pages/
│   ├── Home.tsx          # Landing page
│   ├── Login.tsx         # Login/Register page
│   ├── CreateRateio.tsx  # Create rateio form
│   └── ...
├── components/
│   ├── ui/               # shadcn/ui components
│   └── ...
└── lib/
    └── trpc.ts           # tRPC client setup
```

### Build for Production

```bash
pnpm build
```

This creates:
- `dist/index.js` - Backend bundle
- `dist/public/` - Frontend static files

### Run Production Build

```bash
pnpm start
```

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] Database connection works (`pnpm db:push` succeeds)
- [ ] All tables created (check with `SHOW TABLES`)
- [ ] Backend starts (`pnpm dev` runs without errors)
- [ ] Frontend loads (`http://localhost:3000` shows homepage)
- [ ] Can register new account (`/login` → Register tab)
- [ ] Can login (`/login` → Login tab)
- [ ] Session persists (refresh page, still logged in)

---

## 🐛 Troubleshooting

### "DATABASE_URL is required"

**Problem:** Missing database connection string.

**Solution:** Create `.env` file with `DATABASE_URL=mysql://...`

### "Cannot connect to database"

**Problem:** MySQL not running or wrong credentials.

**Solution:**
- Check MySQL is running: `mysql -u root -p`
- Verify connection string format: `mysql://user:password@host:port/database`
- Test connection: `mysql -u rateio_user -p rateio_top_mvp`

### "Table already exists" error

**Problem:** Tables were partially created.

**Solution:**
```bash
# Drop and recreate (WARNING: deletes all data!)
mysql -u rateio_user -p rateio_top_mvp
DROP DATABASE rateio_top_mvp;
CREATE DATABASE rateio_top_mvp;
EXIT;
pnpm db:push
```

### "bcrypt module not found"

**Problem:** bcrypt not installed.

**Solution:**
```bash
pnpm add bcrypt @types/bcrypt
```

### Port 3000 already in use

**Problem:** Another application is using port 3000.

**Solution:**
- Change port: `PORT=3001 pnpm dev`
- Or kill process: `lsof -ti:3000 | xargs kill` (macOS/Linux)

### Frontend shows blank page

**Problem:** Build error or missing dependencies.

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm dev
```

---

## 📝 Next Steps

1. **Add password field migration** (if not already done):
   ```bash
   pnpm drizzle-kit generate
   pnpm db:push
   ```

2. **Test registration:**
   - Go to `http://localhost:3000/login`
   - Click "Registrar" tab
   - Create an account

3. **Test login:**
   - Use the account you just created
   - Login and verify you're redirected to home

4. **Create a rateio:**
   - Click "Criar Novo Rateio"
   - Fill in the form and submit

---

## 🔐 Security Notes

- **Never commit `.env` file** to version control
- **Change JWT_SECRET** in production
- **Use strong passwords** for database users
- **Enable SSL** for production database connections
- **Set VITE_DEV_MODE=false** in production

---

## 📚 Additional Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [tRPC Docs](https://trpc.io/)
- [React 19 Docs](https://react.dev/)
- [Pagar.me API Docs](https://docs.pagar.me/)

---

**Need help?** Check the main `README.md` for more details about the application architecture and features.


