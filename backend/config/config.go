package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all runtime configuration values read from environment variables.
type Config struct {
	DBPath         string
	JWTSecret      string
	JWTExpiry      time.Duration
	UploadDir      string
	MaxFileSize    int64 // bytes
	ServerPort     string
	AllowedOrigins []string
}

// Load reads configuration from environment variables, applying defaults where missing.
func Load() *Config {
	jwtHours, _ := strconv.Atoi(getEnv("JWT_EXPIRY_HOURS", "8"))
	maxFileMB, _ := strconv.ParseInt(getEnv("MAX_FILE_SIZE_MB", "100"), 10, 64)

	return &Config{
		DBPath:         getEnv("DB_PATH", "./app.db"),
		JWTSecret:      getEnv("JWT_SECRET", "change-this-to-a-long-random-secret"),
		JWTExpiry:      time.Duration(jwtHours) * time.Hour,
		UploadDir:      getEnv("UPLOAD_DIR", "./uploads"),
		MaxFileSize:    maxFileMB * 1024 * 1024,
		ServerPort:     getEnv("SERVER_PORT", "8080"),
		AllowedOrigins: []string{getEnv("FRONTEND_URL", "http://localhost:3000")},
	}
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
