DROP INDEX IF EXISTS idx_profile_change_requests_request_type;

ALTER TABLE profile_change_requests
DROP COLUMN IF EXISTS request_type;
