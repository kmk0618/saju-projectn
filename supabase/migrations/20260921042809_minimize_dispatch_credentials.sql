-- Send only a short-lived, single-use dispatch credential; never the report access token.
create or replace function report_private.dispatch_reports() returns integer
language plpgsql security invoker set search_path = '' as $$
declare j record; request_id bigint; slots integer; dispatched integer := 0;
begin
  -- Avoid overlapping scheduler runs; row locks also protect each selected job.
  if not pg_try_advisory_xact_lock(735210419) then return 0; end if;
  update public.report_jobs q set status='failed', last_error='ORDER_NOT_PAID',updated_at=now()
    from public.orders o where q.order_id=o.id and o.status <> 'paid' and q.status in ('queued','dispatched','running');
  update public.report_jobs set status='queued', failure_count=failure_count+1,
    last_error='WORKER_LEASE_EXPIRED',updated_at=now()
    where status in ('dispatched','running') and next_attempt_at <= now();
  update public.report_jobs set status='failed',last_error=coalesce(last_error,'GENERATION_RETRY_LIMIT'),updated_at=now()
    where status='queued' and (failure_count>=6 or dispatch_count>=60);
  update public.reports r set error_message='자동 복구 횟수를 초과했습니다. 기존 내용은 보존되어 있습니다. 고객센터로 문의해 주세요.'
    from public.report_jobs q where r.order_id=q.order_id and q.status='failed'
      and r.status <> 'completed' and r.error_message is null;
  select greatest(0,2-count(*)::integer) into slots from public.report_jobs where status in ('dispatched','running');
  for j in
    select q.order_id,o.guest_access_token from public.report_jobs q join public.orders o on o.id=q.order_id
      where q.status='queued' and q.next_attempt_at<=now() and o.status='paid' and o.guest_access_token is not null
      order by q.next_attempt_at,q.created_at limit slots for update of q skip locked
  loop
    update public.report_jobs set status='dispatched', dispatch_id=gen_random_uuid(),dispatch_count=dispatch_count+1,
      next_attempt_at=now()+interval '7 minutes',updated_at=now() where order_id=j.order_id;
    select net.http_post(
      url:='https://saju.projectn.xyz/api/report/generate',
      body:=jsonb_build_object('order_id',j.order_id,'dispatch_id',(select dispatch_id from public.report_jobs where order_id=j.order_id)),
      headers:='{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds:=15000
    ) into request_id;
    update public.report_jobs set last_request_id=request_id where order_id=j.order_id;
    dispatched:=dispatched+1;
  end loop;
  return dispatched;
end;
$$;
revoke all on function report_private.dispatch_reports() from public, anon, authenticated;
