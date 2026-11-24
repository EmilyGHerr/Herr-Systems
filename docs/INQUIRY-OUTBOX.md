# Durable inquiry receipt and queued email

## Rollout order (do not reverse)

1. Emily creates D1 `herr-inquiries` (ID `47d4945b-0235-4e6a-ab17-558deffba796`), and queues `herr-inquiry-delivery` and `herr-inquiry-dead-letter`. All have default/no jurisdiction. No tokens are needed by Jules.
2. Before merging/deploying this code, open D1 -> herr-inquiries -> Console and run the complete additive SQL in `workers/inquiry-mailer/migrations/0001_inquiry_outbox.sql`. It creates only the inquiry table and indexes, and can be rerun safely. Do not paste it into a different database.
3. Verify `SELECT name FROM sqlite_master WHERE type='table' AND name='inquiry_outbox';` returns `inquiry_outbox`. Direct console SQL does not update Wrangler's migration ledger; a later migrations apply is safe because every statement is IF NOT EXISTS.
4. Merge/deploy through the existing Git-connected Worker build, using `npx wrangler deploy --config workers/inquiry-mailer/wrangler.jsonc`. It provisions native bindings/config from Git. Do not hand-create Text variables instead of bindings or expose workers.dev. Existing INQUIRY_TO secret and email restrictions must remain intact. If Workers Builds reports a D1/Queues permissions error, inspect its deployment token permissions privately in Cloudflare; do not share the token or grant unrelated account access.
5. Verify Worker production deployment succeeded, not just Pages. Binding names: INQUIRY_DB (D1), INQUIRY_QUEUE (producer), SEND_EMAIL (Email Service), INQUIRY_RATE_LIMITER (native limiter). Variables: INQUIRY_FROM=forms@herrsystems.com, INQUIRY_DELIVERY_MODE=outbox. INQUIRY_TO stays a secret. Queue delivery consumer is herr-inquiry-mailer, max retries 8, DLQ herr-inquiry-dead-letter. Recovery trigger runs every five minutes. No consumer on DLQ.
6. The Pages INQUIRY_MAILER binding and Turnstile settings do not change. Verify Pages production deployment separately. Old Pages accepts the compatible submitted response; old browsers without submissionId get a server-generated receipt, but cannot deduplicate retries across requests.
7. Submit ONE labelled test through the real production widget. Check receipt, D1 status, and actual inbox arrival. Do not bypass verification. A 202 and D1 record establish durable receipt, `submitted` means provider acceptance, and inbox arrival separately establishes delivery.

## Architecture and privacy

Browser -> Pages validation/Turnstile -> private mailer ingress/limiter -> D1 -> queue ID -> Worker queue handler -> Email Service.

The browser keeps a random UUID per unchanged payload in memory only. Reload/reset loses the ID. IDs are bound to a canonical server-normalized payload digest; conflicting reuse returns 409. Every retry still passes a fresh Turnstile verification and the same rate limiter, including duplicate receipt requests. No public lookup endpoint is added.

The successful D1 write/read-back is the receipt boundary. Email configuration/provider availability does not determine receipt. Queue publication runs under waitUntil AFTER saving, and a five-minute recovery sweep republishes pending due rows if publication fails or messages expire. No waitUntil email call is used as the durable receipt boundary. Queue messages contain only an ID; DB payloads have no challenge token, IP, recipient secret, or provider ID. SQL uses bound values.

D1 stores visitor names, reply addresses and inquiry content. Only account members with appropriate D1 permissions and the private Worker should access it; do not expose tables through Decap/public APIs. Queries and D1 Console can display personal data: do not paste their results into public issues or logs. This implementation deletes ALL inquiry records older than 90 days on its scheduled sweep, including failed/ambiguous inquiries. Review important inquiries before expiry; exported copies require their own access/deletion policy. Retention limits/billing still apply to D1 and Queues. Catch-all and existing DNS/routing are unchanged.

## Processing, retries and failures

- `pending`: saved, awaiting dispatch or a safe retry.
- `sending`: atomically claimed with a unique token, two-minute claim window.
- `submitted`: provider returned a nonempty string messageId (treated as opaque), NOT proof of inbox placement.
- `failed`: permanent configuration/authorization rejection or exhausted send attempts. Saved for operator review; not automatically resent.
- `ambiguous`: unknown exception/timeout, malformed provider acknowledgement, or interrupted send. May already have sent; reconcile against Email Service Activity/inbox before manually requeueing.

Known transient provider rejections retry with bounded exponential delay, at most eight provider calls per row. The provider wait is bounded at 25 seconds. Unknown exceptions are not assumed to be definite rejections. Each queue message is acknowledged or retried individually. Atomic D1 claims suppress overlapping sends; an expired claim is NOT taken over for resend. A crash after acceptance but before updating D1 becomes ambiguous. There is no exactly-once email guarantee without provider idempotency.

Infrastructure exceptions and poison messages use queue retries and eventually the configured DLQ. Permanent or ambiguous notification outcomes are stored in D1 and acknowledged rather than placed into the DLQ, so D1 is the authoritative attention list. The DLQ also expires; it is not an archive.

## Operations

Worker logs emit fixed `inquiry_outbox` stages and allowlisted codes with random receipt IDs only. They never include visitor fields, raw exceptions, tokens or provider IDs. Logs alone do NOT configure a proactive alert. In Cloudflare, review queue backlog/DLQ and set available monitoring/notifications for failed invocations/backlog as supported by the account. At minimum inspect the attention query regularly; no external alert channel is installed by this change.

D1 Console queries (no personal data):

```sql
SELECT status, COUNT(*) AS count FROM inquiry_outbox GROUP BY status;
SELECT id, status, attempts, last_error, datetime(updated_at,'unixepoch') AS updated_utc
FROM inquiry_outbox WHERE status IN ('failed','ambiguous') ORDER BY updated_at DESC LIMIT 50;
```

To inspect a specific inquiry, use its receipt in the PRIVATE D1 Console. Before recovering a failed or ambiguous record, verify the underlying cause and whether email already arrived. An intentional retry after reconciliation can be requested with a bound/admin-checked receipt; there is no public retry route. In Console, after substituting the known UUID safely:

```sql
UPDATE inquiry_outbox
SET status='pending', attempts=0, next_attempt_at=unixepoch(), enqueue_after=unixepoch(),
    lease_token=NULL, lease_expires_at=NULL, last_error=NULL, updated_at=unixepoch()
WHERE id='REPLACE-WITH-RECEIPT-UUID' AND status IN ('failed','ambiguous');
```

This can send a duplicate if the earlier ambiguous attempt was accepted. Recovery should dispatch within the next scheduled sweep. Do not purge a queue until records are accounted for in D1.

## Rollback

Keep this additive schema; do not drop D1 data. To stop queued sending, pause the delivery consumer in Cloudflare and set INQUIRY_DELIVERY_MODE to `legacy` in the Git-managed Wrangler config before deploying. Legacy requests then use the previous synchronous path; saved pending records are not drained by that path. Reverting to old code alone may leave queue/cron configuration behind, so remove/pause those explicitly and verify bindings after rollback. Missing/unknown mode configuration should be investigated; outbox mode never falls back to direct sending because D1 is unavailable.

## Verification

`npm run test:outbox` includes real SQLite-backed state/fault tests, actual frontend browser tests, and real local Workerd/D1/Queues tests with MOCKED email only. `npm test`, `npm run build:functions`, and `npm run build:mailer-dashboard` cover the broader site and both bundles. No local test establishes production inbox delivery.
