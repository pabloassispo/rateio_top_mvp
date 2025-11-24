# ⚡ Quick Start Guide

## Option 1: Docker Database Setup 🐳

### Setup in 3 Minutes

```bash
# 1. Start MySQL database in Docker
docker-compose up -d

# 2. Configure local .env file
# DATABASE_URL=mysql://rateio_user:rateio_password@localhost:3306/rateio_top_mvp

# 3. Install dependencies locally
pnpm install
pnpm add bcrypt @types/bcrypt

# 4. Run migrations locally
pnpm db:push

# 5. Start application locally
pnpm dev

# 6. Access application
# Open: http://localhost:3000
```

**📖 For detailed Docker instructions, see [DOCKER.md](./DOCKER.md)**

---

## Option 2: Local Setup

### Setup in 5 Minutes

### 1. Install Dependencies

```bash
pnpm install
pnpm add bcrypt @types/bcrypt
```

### 2. Setup Database

Create `.env` file:

```env
DATABASE_URL=mysql://root:password@localhost:3306/rateio_top_mvp
JWT_SECRET=change-this-to-random-string
NODE_ENV=development
```

### 3. Create Database

```bash
# Using MySQL CLI
mysql -u root -p
CREATE DATABASE rateio_top_mvp;
EXIT;
```

### 4. Run Migrations

```bash
pnpm db:push
```

This will:
- Generate migration files from `drizzle/schema.ts`
- Apply migrations to your database
- Create all tables including the new `password` field

### 5. Start Development Server

```bash
pnpm dev
```

Open: http://localhost:3000

### 6. Test Login

1. Go to http://localhost:3000/login
2. Click "Registrar" tab
3. Create an account
4. Login with your credentials

---

## Common Commands

### Docker Commands (Database Only)
```bash
# Start MySQL database
docker-compose up -d

# View logs
docker-compose logs -f mysql

# Stop database
docker-compose down

# Access MySQL CLI
docker-compose exec mysql mysql -u rateio_user -p rateio_top_mvp
```

### Local Commands
```bash
# Development
pnpm dev              # Start dev server (backend + frontend)

# Database
pnpm db:push          # Generate and apply migrations
pnpm drizzle-kit generate  # Generate migration only
pnpm drizzle-kit migrate   # Apply migrations only

# Build
pnpm build            # Build for production
pnpm start            # Run production build

# Code Quality
pnpm check            # Type check
pnpm format           # Format code
```

---

## Troubleshooting

**"DATABASE_URL is required"**
→ Create `.env` file with `DATABASE_URL=mysql://...`

**"Cannot connect to database"**
→ Check MySQL is running: `mysql -u root -p`

**"bcrypt module not found"**
→ Run: `pnpm add bcrypt @types/bcrypt`

**Port 3000 in use**
→ Set `PORT=3001` in `.env` or kill process on port 3000

---

For detailed setup instructions, see [SETUP.md](./SETUP.md)


