# Authentication Testing Playbook
1. Login with the credentials in `/app/memory/test_credentials.md` at `/api/auth/login`.
2. Verify the response sets an `access_token` cookie and `/api/auth/me` returns the staff profile.
3. Verify `/api/dashboard`, `/api/students`, `/api/attendance`, and `/api/fees` reject requests without authentication.
4. Verify logout clears the session and protected endpoints return 401.