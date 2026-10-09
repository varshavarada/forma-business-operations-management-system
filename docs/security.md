# Security model and boundaries

Passwords are Argon2 hashes. Session identifiers are 256-bit random values; the database stores SHA-256 hashes of those identifiers. Cookies are HTTP-only, SameSite Strict, path `/`, eight-hour lifetime, and Secure in production. Expiry is checked on every request independently of MongoDB TTL cleanup. Logout revokes the current session; password changes and account-access changes revoke relevant sessions. No token is stored in localStorage.

Authentication middleware reads the live active user for every protected API. Roles are enforced before mutation handlers. All business records belong to one shared business; no tenant boundary is claimed. Field allowlists prevent clients from assigning roles, totals, stock, or historical prices through unrelated APIs.

The configured origin is required for login and protected writes. Protected writes additionally require the session's CSRF token. Same-origin static delivery uses no permissive CORS middleware. A separate frontend origin requires deliberate configuration rather than enabling wildcard CORS.

Zod strictly validates body fields and IDs. MongoDB operators are never copied from request input into queries. Search metacharacters are escaped. Browser markup interpolation escapes text and attribute characters; user content is not executed. CSV cells are quoted and formula-leading values are prefixed before export. Helmet supplies standard headers including CSP; the current UI uses same-origin module scripts and permits inline styles for data charts. No inline script execution is required.

Login is limited to 20 attempts per 15 minutes per IP, password changes to 6 requests per minute, and APIs to 300 requests per minute. Limits are per application process, not a distributed abuse defense. The application does not trust arbitrary forwarded IP headers. Production proxy configuration must be specific to the deployment and tested; do not blindly set `trust proxy=true`.

Errors expose generic unexpected-failure messages and request identifiers, not stack traces. Optional structured request logs record method, route template, status and duration, not request bodies, cookies, credentials, or query strings. Unexpected-error logs record type/code/field only. `LOG_REQUESTS=true` enables completion logs.

Critical mutations include their audit event inside the same transaction. There is no API to edit/delete audits, movements, or payment records. This is application-level traceability, not tamper-proof evidence against a privileged database administrator. Login attempts are protected by rate limits but are not retained as business audit records.

Submission fingerprints use HMAC-SHA256 with a private configured key. This avoids retaining a plain fast hash of password-bearing request bodies. The setup helper generates this key without displaying it. Keep it stable across application restarts; plan any key rotation and idempotency-record migration together.

## Verification versus operational work

Automated tests verify role gates, CSRF/origin rejection, missing authentication, input allowlists, expired/revoked sessions, password change, stored-HTML escaping, overpayment conflicts, and transactional rollback/races. Dependency audit reported no advisories at installation time. These checks are not a penetration test or formal security certification.

External MongoDB credentials, TLS/proxy behavior, Atlas network permissions, backups/restoration, secret rotation, monitoring, production index migrations, high-load abuse, and real-user access reviews have not been validated. There is no email password recovery or MFA. No actual financial processing occurs.

For a persistent deployment, store secrets outside version control, use least-privileged database credentials for the application, use a separate migration identity where appropriate, enable HTTPS, configure backups and recovery, and define audit/idempotency retention. These steps remain operational requirements; they have not been validated in a deployed environment.
