ALTER TABLE profile_change_requests
ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'profile_change';

UPDATE profile_change_requests
SET request_type = 'profile_change'
WHERE request_type IS NULL OR request_type = '';

CREATE INDEX IF NOT EXISTS idx_profile_change_requests_request_type
ON profile_change_requests(request_type);
