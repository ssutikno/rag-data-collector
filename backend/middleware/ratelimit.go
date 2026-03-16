package middleware

import (
	"sync"
	"time"

	"rag-backend/utils"

	"github.com/gin-gonic/gin"
)

const (
	loginMaxAttempts = 5
	loginWindowMins  = 15
)

type ipState struct {
	count       int
	windowEnds  time.Time
	lockedUntil time.Time
}

var (
	mu       sync.Mutex
	attempts = make(map[string]*ipState)
)

// LoginRateLimit rejects requests from IPs that have exceeded the failed-login
// threshold before the handler is called.
func LoginRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()

		mu.Lock()
		state, ok := attempts[ip]
		if !ok {
			state = &ipState{windowEnds: time.Now().Add(loginWindowMins * time.Minute)}
			attempts[ip] = state
		}

		// Slide the window if it has expired.
		if time.Now().After(state.windowEnds) {
			state.count = 0
			state.windowEnds = time.Now().Add(loginWindowMins * time.Minute)
			state.lockedUntil = time.Time{}
		}

		locked := !state.lockedUntil.IsZero() && time.Now().Before(state.lockedUntil)
		mu.Unlock()

		if locked {
			utils.TooManyRequests(c, "too many failed login attempts — try again in 15 minutes")
			c.Abort()
			return
		}

		c.Next()
	}
}

// RecordFailedLogin increments the failure counter for an IP and locks it if
// the threshold is reached.
func RecordFailedLogin(ip string) {
	mu.Lock()
	defer mu.Unlock()

	state, ok := attempts[ip]
	if !ok {
		state = &ipState{windowEnds: time.Now().Add(loginWindowMins * time.Minute)}
		attempts[ip] = state
	}
	state.count++
	if state.count >= loginMaxAttempts {
		state.lockedUntil = time.Now().Add(loginWindowMins * time.Minute)
	}
}

// ResetLoginAttempts clears the failure record for an IP after a successful login.
func ResetLoginAttempts(ip string) {
	mu.Lock()
	defer mu.Unlock()
	delete(attempts, ip)
}
