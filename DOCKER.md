# 🐳 Docker Setup Guide

Complete guide for running MySQL database with Docker for Rateio.Top MVP.

**Note:** This docker-compose setup only includes the MySQL database. Run your application locally while using Docker for the database.

---

## 📋 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

Install Docker: https://docs.docker.com/get-docker/

---

## 🚀 Quick Start

### Start Database Only

1. **Create `.env` file** (optional, or use defaults)

2. **Start MySQL database:**
   ```bash
   docker-compose up -d
   ```

3. **Configure your local `.env` file:**
   ```env
   DATABASE_URL=mysql://rateio_user:rateio_password@localhost:3306/rateio_top_mvp
   ```

4. **Run database migrations locally:**
   ```bash
   pnpm db:push
   ```

5. **Start your application locally:**
   ```bash
   pnpm dev
   ```

6. **Access:**
   - App: http://localhost:3000 (running locally)
   - MySQL: localhost:3306 (running in Docker)

---

## 📝 Environment Variables

Create a `.env` file in the project root:

```env
# MySQL Configuration (for docker-compose)
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=rateio_top_mvp
MYSQL_USER=rateio_user
MYSQL_PASSWORD=rateio_password
MYSQL_PORT=3306
```

**Note:** Application environment variables should be in your local `.env` file (not docker-compose), since the app runs locally.

---

## 🎯 Common Commands

### Start Database
```bash
# Start MySQL
docker-compose up -d

# View logs
docker-compose logs -f mysql

# Stop database
docker-compose down

# Remove volumes (⚠️ deletes database data)
docker-compose down -v
```

### Database Operations
```bash
# Access MySQL CLI
docker-compose exec mysql mysql -u rateio_user -p rateio_top_mvp

# Backup database
docker-compose exec mysql mysqldump -u rateio_user -p rateio_top_mvp > backup.sql

# Restore database
docker-compose exec -T mysql mysql -u rateio_user -p rateio_top_mvp < backup.sql

# Run migrations (locally, not in container)
pnpm db:push
```


---

## 📦 Volumes

The setup includes persistent volumes:

### `mysql_data`
- **Location:** `/var/lib/mysql` in container
- **Purpose:** Stores MySQL database files
- **Persists:** Database data survives container restarts
- **Backup:** Located at Docker volume `rateio_mysql_data`


---

## 🔧 Configuration

### MySQL Configuration

Custom MySQL settings can be added to `docker/mysql/my.cnf`:

```ini
[mysqld]
max_connections=200
innodb_buffer_pool_size=256M
```

### Port Configuration

Change MySQL port in docker-compose.yml or `.env`:
```env
MYSQL_PORT=3306    # MySQL port
```

---

## 🐛 Troubleshooting

### Container won't start

**Check logs:**
```bash
docker-compose logs mysql
```

### Database connection errors

**Verify MySQL is healthy:**
```bash
docker-compose ps
# Check mysql service shows "healthy"
```

**Test connection from inside container:**
```bash
docker-compose exec mysql mysql -u rateio_user -p rateio_top_mvp
```

**Test connection from your local machine:**
```bash
# Using MySQL client
mysql -h 127.0.0.1 -P 3306 -u root -p
# Enter password: rootpassword

# Or using application user
mysql -h 127.0.0.1 -P 3306 -u rateio_user -p rateio_top_mvp
# Enter password: rateio_password
```

**Verify connection string in local `.env`:**
```env
DATABASE_URL=mysql://rateio_user:rateio_password@localhost:3306/rateio_top_mvp
```

**If you get "Access denied" from local machine:**
- Make sure the container was restarted after adding the init script
- The init script creates users that can connect from any host (`%`)
- Restart: `docker-compose down && docker-compose up -d`

### Port already in use

**Change MySQL port in docker-compose.yml:**
```yaml
ports:
  - "3307:3306"  # Use 3307 on host
```

Then update your local `.env`:
```env
DATABASE_URL=mysql://rateio_user:rateio_password@localhost:3307/rateio_top_mvp
```

### Volume permissions

**Reset volumes:**
```bash
docker-compose down -v
docker-compose up -d
```

### Database migrations fail

**Run migrations locally (not in container):**
```bash
pnpm db:push
```

**Check database exists:**
```bash
docker-compose exec mysql mysql -u root -p -e "SHOW DATABASES;"
```

---

## 🔐 Security Best Practices

1. **Change default passwords** in docker-compose.yml or `.env`
2. **Don't expose MySQL port** in production (remove port mapping)
3. **Use secrets management** for production (Docker secrets, AWS Secrets Manager, etc.)
4. **Enable SSL** for MySQL connections in production
5. **Use strong passwords** for MySQL root and user accounts

---

## 📊 Monitoring

### Health Checks

MySQL service includes health check:

```bash
# Check service health
docker-compose ps

# Should show mysql service as "healthy"
```

### Resource Usage

```bash
# View resource usage
docker stats rateio-mysql
```

---

## 🚢 Production Deployment

### 1. Use Production Environment

Ensure docker-compose.yml has:
- Strong passwords
- Remove MySQL port exposure (security)

### 2. Update docker-compose.yml

Remove MySQL port mapping for security:
```yaml
mysql:
  # ports:
  #   - "3306:3306"  # Remove this in production
```

**Note:** In production, your application should connect to MySQL via Docker network, not exposed ports.

### 3. Use Docker Secrets (recommended)

```yaml
services:
  mysql:
    secrets:
      - mysql_root_password
      - mysql_password
secrets:
  mysql_root_password:
    file: ./secrets/mysql_root_password.txt
  mysql_password:
    file: ./secrets/mysql_password.txt
```

---

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [MySQL Docker Image](https://hub.docker.com/_/mysql)

---

## 🆘 Getting Help

If you encounter issues:

1. Check logs: `docker-compose logs -f`
2. Verify environment variables: `docker-compose config`
3. Check service status: `docker-compose ps`
4. Review this guide's troubleshooting section

