# Report queue operations

Paid orders are enqueued by a database trigger in the same transaction as payment verification. No browser return or open tab is required. Existing purchases are not bulk regenerated. Opening an unfinished current-version purchase can enqueue it; historical editions remain protected.

The independent Supabase Cron runs once per minute and dispatches at most two concurrent reports through pg_net to the fixed production host. Each dispatch has a random, single-use credential. Only the server role can read or update jobs; customer roles cannot read queue credentials or pg_net request bodies. Do not paste tokens or request bodies into logs or tickets.

A dispatched/running job has a seven-minute lease, longer than the 300-second Vercel function and six-minute generation lock. Expired dispatches return to the queue. Failed requests back off from one to fifteen minutes; six consecutive errors/timeouts or sixty dispatches stop the job. Customers can explicitly retry a stopped job up to three times. Accepted sections are preserved. PDF rendering starts in a fresh invocation after body generation; completed PDFs are reused.

## Deployment order

1. Apply durable_report_jobs and secure_report_scheduler migrations. The scheduler must still be inactive. The latter recreates only the newly provisioned pg_net extension before any live requests exist; do not rerun it after activation.
2. Deploy the application and verify `/api/report/generate` returns `mode: durable-database-queue-v1`.
3. Apply activate_report_scheduler. Verify cron run status and a dispatch acknowledged by the application.

## Monitor without exposing credentials

```sql
select status, count(*), min(next_attempt_at) as oldest_due
from public.report_jobs group by status;
select order_id, status, failure_count, dispatch_count, last_error, updated_at
from public.report_jobs where status='failed' order by updated_at desc;
select status, return_message, start_time, end_time
from cron.job_run_details
where jobid=(select jobid from cron.job where jobname='report-jobs-every-minute')
order by start_time desc limit 10;
select q.order_id, q.status, r.status_code, r.timed_out, r.error_msg
from public.report_jobs q left join net._http_response r on r.id=q.last_request_id;
```

Cron history, queue failure state and Vercel error logs are available for operator monitoring. No external email/Slack alerts are configured. If failures accumulate, investigate the recorded cause and resolve it before resetting a job. Do not mark orders paid or replace report content to test recovery.

Emergency pause: `select cron.unschedule('report-jobs-every-minute');`. Existing data and payments remain intact; in-flight work may finish. Re-enable with the activation SQL after resolving the issue. Do not roll the application back to recursive generation while this scheduler remains active.

## Remaining acceptance testing

Real mobile payment-app return/cancellation and first real child/new-year purchase through PDF delivery require the buyer's payment flow. Automated checks cannot certify those external flows. The existing test coupon expires September 25, 2026 at 23:59:59 KST; keep it private during final acceptance testing.
