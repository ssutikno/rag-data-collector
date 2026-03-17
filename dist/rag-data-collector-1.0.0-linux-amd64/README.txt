RAG Data Collector v1.0.0 â€” LINUX AMD64
=====================================================================

Quick Start
-----------
1. Copy .env.example to .env
2. Set a strong JWT_SECRET (min 32 random characters)
3. Adjust other settings (port, upload dir, etc.) if needed
4. Run the binary:
   chmod +x rag-data-collector start.sh && ./start.sh

The app will be available at http://localhost:8080

Default Admin Credentials (first run only)
-------------------------------------------
  Email   : admin@example.com
  Password: Admin@123

Change the admin password immediately after first login.

Configuration (.env)
--------------------
  DB_PATH          Path to SQLite database file   (default: ./app.db)
  JWT_SECRET       Secret key for JWT signing      (!!! CHANGE THIS !!!)
  JWT_EXPIRY_HOURS Token lifetime in hours         (default: 8)
  UPLOAD_DIR       Directory for uploaded files    (default: ./uploads)
  MAX_FILE_SIZE_MB Max upload size in MB           (default: 100)
  SERVER_PORT      HTTP listen port                (default: 8080)
