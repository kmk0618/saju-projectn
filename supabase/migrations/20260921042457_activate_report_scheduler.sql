-- Apply only after /api/report/generate reports durable-database-queue-v1.
select cron.schedule('report-jobs-every-minute','* * * * *','select report_private.dispatch_reports();');
