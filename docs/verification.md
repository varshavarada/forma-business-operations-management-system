# Forma verification results

This committed summary records local test runs completed on 9 October 2026 and an earlier performance baseline. It describes observed results and their limits. Raw test console output is not archived here, and generated JSON, screenshots, traces, and browser reports are ignored and absent from a fresh clone.

Run `npm test` and `npm run test:browser` from the project directory to check your environment. Run `npm run benchmark` to generate a local performance report. The documentation review did not rerun these commands.

## Recorded environment

- Release source: commit `9860770`, dated 9 October 2026, with the earlier backend commit `a36585f` preserved.
- Windows `10.0.26200`, Node `v24.20.0`, npm `11.19.0`.
- Intel i3-1115G4, 4 logical processors, 7,886 MiB system memory reported to Node.
- Real MongoDB `7.0.14` processes managed as isolated local replica sets; a separate standalone fixture verifies topology rejection.
- Google Chrome `154.0.8037.98` at the installed standard system path; Playwright `1.64.0`; mongodb-memory-server `10.4.3`.
- Locked runtime versions: Express `5.2.1`, Mongoose `8.24.5`, Argon2 `0.44.0`, Helmet `8.3.0`, express-rate-limit `8.7.1`, Zod `4.6.5`.

The earlier attempted Playwright Chromium download failed after network/certificate errors. Closeout used the existing installed Chrome and cached local MongoDB binary; no installation, dependency audit or benchmark was rerun. Environment/version details above were retained from the earlier recorded evidence. No TLS certificate checking was disabled.

## Release closeout results

| Check | Passed | Failed | Skipped | Observed duration |
|---|---:|---:|---:|---:|
| Backend integration tests, `npm test` | 18 | 0 | 0 | 24.429 seconds |
| Chrome browser cases, `npm run test:browser` | 15 | 0 | 0 | 38.2 seconds |

Each full suite completed once for closeout. Initial sandbox launches failed with `spawn EPERM` before test execution; the same commands completed after process-launch approval. These were environment failures, not failed application assertions. No application fixes or affected-test reruns were necessary. Atlas and real data were not accessed.

Backend tests include:

1. Authentication, CSRF/origin, role gates, protected routes and field allowlists.
2. Customer/catalog uniqueness, literal search, bounded pagination, service rules and archival.
3. Integrated order, inventory, historical-price, payment, reporting and audit workflow.
4. Concurrent duplicate creation/confirmation and competing orders for remaining stock; duplicate persistence count is also checked.
5. Multi-item rollback preserving stock, draft state and movement consistency.
6. Payment reversal and cancellation restoring balance/stock once.
7. Expiration, deactivation, password change and logout revoking sessions.
8. Exact dashboard deltas, report date limits, services and inventory pagination.
9. Competing payments that would otherwise exceed a balance.
10. Archived-item confirmation rejection, duplicate lines and invalid stock/type changes.
11. Two separate application processes preserving orders, sessions and idempotent replay across restart.
12. Account creation without credential exposure and refusal of self access changes.
13. Standalone MongoDB startup rejection.
14. Sanitized malformed/oversized requests and JSON login-rate-limit responses.
15. Configuration secret generation and overwrite refusal; additive indexes; first-admin bootstrap and repeat refusal in another isolated database.
16. Refusal of unsafe aggregate arithmetic rather than displaying rounded money.
17. Concurrent customer edits reject stale versions, preserve the winner and record exactly one successful edit audit.
18. Customer version validation, authorization, missing-record behavior and idempotent replay.

Browser cases include the full sale workflow and CSV export; order search; validation recovery and stored HTML rendered as text; payment correction/cancellation and stock restoration; and mobile/tablet/desktop navigation, role visibility, dialog keyboard behavior and contained horizontal table scrolling.

The nine additional browser cases cover customer conflict reload retaining local edits; immutable catalog type; accessible empty-order rejection; mobile drawer focus, dismissal and scrolling at 320 by 568; narrow order search at 320 and 390 px; stale sales and inventory report responses; server-revoked session recovery; and a simulated expired-session 401 during reporting. Actual database expiry is covered by the backend suite.

Workflow viewports are 390 by 844, 820 by 1180 and 1440 by 900. Generated screenshots are synthetic but excluded from release source, along with traces, Playwright reports and benchmark JSON under `docs/evidence/`.

Initial order-schema and transaction-retry failures were fixed before these final passing runs. There are no outstanding failed or skipped cases in the executed suites. The later aggregate guard was covered by the final backend run; it does not change ordinary safe-valued browser output.

## Earlier performance baseline (not rerun at closeout)

The figures below summarize the earlier local `docs/evidence/performance.json`. That generated file is ignored and is not included in the repository. Running `npm run benchmark` creates a new report with environment details, a query plan, resource observations, and asset measurements; timings will vary by machine. Fixture: 1,000 customers, 200 products and 2,000 orders. Records are synthetic read fixtures, not a complete stock-accounting history.

Method: 5 warmups, then 40 sequential loopback HTTP requests per endpoint, concurrency 1. Timing includes cookie authentication, server work and client JSON parsing. The benchmark's client and server share a Node process. No network TLS or WAN was involved.

| Endpoint | p50 ms | p95 ms | Max ms | JSON body bytes | DB commands/request |
|---|---:|---:|---:|---:|---:|
| Customers, 20 rows | 28.41 | 33.14 | 38.66 | 4,564 | 4 |
| Products, 20 rows | 29.21 | 54.60 | 69.38 | 5,233 | 4 |
| Orders, 20 rows | 30.90 | 36.91 | 199.29 | 8,716 | 4 |
| Dashboard | 49.28 | 67.44 | 82.29 | 4,123 | 8 |

Command counts include session and live-user authorization reads. The customer query used `archived_1_createdAt_-1__id_-1`, examining 20 keys and 20 documents for 20 returned rows. This proves that representative query's plan, not every search/filter/report plan.

Test-fixture startup was 2,243.36 ms; it includes MongoDB startup, index initialization and synthetic account setup, not just production HTTP-server startup. Node RSS after measurements was 211.79 MiB and heap used 60.72 MiB. CPU observations over a 6,446.02 ms interval were 4,047 ms user and 437 ms system time. These include the benchmark harness and retained fixture objects; MongoDB child-process memory/CPU and peak process usage were not measured.

Earlier recorded frontend assets: HTML 461 bytes, CSS 8,423 bytes, JavaScript 34,620 bytes. Offline gzip sizes: 297, 2,532 and 10,184 bytes respectively. The current Express static server does not enable gzip; computed gzip sizes are potential transfer sizes, not observed compressed responses. These recorded measurements were not refreshed during release closeout and should not be treated as current asset measurements.

No frontend frame-time profile, high-concurrency throughput test, sustained write benchmark, real Atlas query explain, production TLS measurement, or production capacity claim was performed. Search, deep offsets, all-time aggregates and retention growth remain scaling considerations.

## Unexecuted and external checks

Real Atlas connectivity/data/index migration, HTTPS cookies through a real proxy, production deployment, backup recovery, monitoring, distributed rate limiting, formal penetration/accessibility audits, Firefox/Safari, and real-user usability validation are unexecuted. Production startup index checks are implemented but were not exercised through a deployed production environment.

No external application database was reset, dropped, seeded, or used for tests. Every fixture database URI is generated by the local test harness rather than read from application configuration.
