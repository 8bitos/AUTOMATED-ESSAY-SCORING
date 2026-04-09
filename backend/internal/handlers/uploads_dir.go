package handlers

import "os"

func ensureUploadsDir() error {
	return os.MkdirAll("uploads", 0o755)
}
