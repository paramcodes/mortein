# Security notes

This release is intended for local development and trusted single-user use.

- There is no user authentication or authorization layer yet. Do not expose the web app or API to an untrusted network.
- Each workspace has separate workflow and credential records. The worker checks the credential's workspace before decrypting it.
- SMTP and Google credentials are encrypted with AES-256-GCM using `CREDENTIALS_ENCRYPTION_KEY`. Store that key outside source control and back it up separately from the database; losing it makes stored credentials unreadable.
- Webhook URLs contain the workflow ID and act as bearer URLs. Keep them private. A dedicated revocable random webhook secret and rate limiting are planned hardening work.
- Execution is at least once, not exactly once. A timeout after an external API accepted a request can lead to a retry and duplicate side effects.
- The Compose PostgreSQL port binds to `127.0.0.1`. Preserve that boundary in local use.

Before deploying on a public host, add user authentication, CSRF/origin protections appropriate to that deployment, authenticated/revocable webhook secrets, rate limits, encrypted backups, and a TLS-enabled reverse proxy.
