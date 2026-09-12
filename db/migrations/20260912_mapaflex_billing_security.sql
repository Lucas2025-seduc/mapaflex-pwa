-- MapaFlex billing security migration
-- Neon PostgreSQL 17 / Neon Auth / Stripe webhook processing

create extension if not exists pgcrypto;

create schema if not exists mapaflex_private;
revoke all on schema mapaflex_private from public;
revoke all on schema mapaflex_private from anonymous;
revoke all on schema mapaflex_private from authenticated;

create table if not exists mapaflex_private.secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
revoke all on mapaflex_private.secrets from public;
revoke all on mapaflex_private.secrets from anonymous;
revoke all on mapaflex_private.secrets from authenticated;

alter table mapaflex.plans enable row level security;
alter table mapaflex.billing_customers enable row level security;
alter table mapaflex.subscriptions enable row level security;
alter table mapaflex.licenses enable row level security;
alter table mapaflex.device_activations enable row level security;
alter table mapaflex.entitlements enable row level security;
alter table mapaflex.webhook_events enable row level security;
alter table mapaflex.license_events enable row level security;

drop policy if exists licenses_read_own on mapaflex.licenses;
create policy licenses_read_own on mapaflex.licenses
  for select to authenticated
  using ((select auth.user_id()) = auth_user_id);

drop policy if exists entitlements_read_own on mapaflex.entitlements;
create policy entitlements_read_own on mapaflex.entitlements
  for select to authenticated
  using (exists (
    select 1
    from mapaflex.licenses l
    where l.id = entitlements.license_id
      and l.auth_user_id = (select auth.user_id())
  ));

create or replace view mapaflex.my_access
with (security_invoker = true)
as
select
  l.id as license_id,
  l.auth_user_id,
  l.plan_code,
  l.status as license_status,
  l.max_devices,
  l.valid_until,
  l.grace_until,
  e.feature_key,
  e.enabled,
  e.limit_value,
  e.metadata
from mapaflex.licenses l
left join mapaflex.entitlements e on e.license_id = l.id
where l.auth_user_id = (select auth.user_id());

revoke all on schema mapaflex from public;
grant usage on schema mapaflex to authenticated;
grant usage on schema mapaflex to anonymous;
revoke all on all tables in schema mapaflex from anonymous;
revoke all on all tables in schema mapaflex from authenticated;
grant select on mapaflex.licenses to authenticated;
grant select on mapaflex.entitlements to authenticated;
grant select on mapaflex.my_access to authenticated;

create or replace function mapaflex.ingest_stripe_webhook(p_raw_body text, p_signature text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, mapaflex, mapaflex_private, public
as $body$
declare
  v_secret text;
  v_ts text;
  v_expected text;
  v_event jsonb;
  v_obj jsonb;
  v_event_id text;
  v_type text;
  v_row_id bigint;
  v_part text;
  v_sig_ok boolean := false;
  v_user_id text;
  v_email text;
  v_customer text;
  v_sub_id text;
  v_price_id text;
  v_plan text;
  v_status text;
  v_sub_row bigint;
  v_license bigint;
  v_period_end timestamptz;
begin
  select value into v_secret
  from mapaflex_private.secrets
  where key = 'stripe_webhook_secret';
  if v_secret is null then
    raise exception 'stripe webhook secret not configured';
  end if;

  v_ts := (regexp_match(coalesce(p_signature,''), '(?:^|,)t=([0-9]+)'))[1];
  if v_ts is null then raise exception 'invalid stripe signature'; end if;
  if abs(extract(epoch from now())::bigint - v_ts::bigint) > 300 then
    raise exception 'stripe timestamp outside tolerance';
  end if;

  v_expected := encode(
    hmac(
      convert_to(v_ts || '.' || p_raw_body, 'UTF8'),
      convert_to(v_secret, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  foreach v_part in array string_to_array(coalesce(p_signature,''), ',') loop
    if btrim(v_part) = ('v1=' || v_expected) then
      v_sig_ok := true;
      exit;
    end if;
  end loop;
  if not v_sig_ok then raise exception 'invalid stripe signature'; end if;

  v_event := p_raw_body::jsonb;
  v_event_id := v_event->>'id';
  v_type := v_event->>'type';
  v_obj := v_event#>'{data,object}';
  if v_event_id is null or v_type is null or v_obj is null then
    raise exception 'invalid stripe payload';
  end if;

  insert into mapaflex.webhook_events(
    provider, provider_event_id, event_type, livemode, payload_sha256
  ) values (
    'stripe', v_event_id, v_type,
    coalesce((v_event->>'livemode')::boolean,false),
    encode(digest(p_raw_body,'sha256'),'hex')
  )
  on conflict(provider_event_id) do nothing
  returning id into v_row_id;

  if v_row_id is null then
    return jsonb_build_object('ok',true,'duplicate',true,'event_id',v_event_id);
  end if;

  if v_type='checkout.session.completed'
     and coalesce(v_obj->>'mode','')='subscription' then
    v_user_id := nullif(v_obj->>'client_reference_id','');
    v_email := coalesce(
      nullif(v_obj#>>'{customer_details,email}',''),
      nullif(v_obj->>'customer_email','')
    );
    v_customer := nullif(v_obj->>'customer','');
    v_sub_id := nullif(v_obj->>'subscription','');
    v_plan := coalesce(nullif(v_obj#>>'{metadata,plan_code}',''),'pro');

    if v_user_id is null or v_customer is null or v_sub_id is null then
      raise exception 'checkout missing reconciliation fields';
    end if;
    if not exists(
      select 1
      from neon_auth."user" u
      where u.id=v_user_id
        and (v_email is null or lower(u.email)=lower(v_email))
    ) then
      raise exception 'checkout user mismatch';
    end if;

    insert into mapaflex.billing_customers(auth_user_id,email,stripe_customer_id)
    values(v_user_id,v_email,v_customer)
    on conflict(auth_user_id) do update set
      email=excluded.email,
      stripe_customer_id=excluded.stripe_customer_id,
      updated_at=now();

    insert into mapaflex.subscriptions(
      auth_user_id,plan_code,stripe_customer_id,stripe_subscription_id,status
    ) values(v_user_id,v_plan,v_customer,v_sub_id,'active')
    on conflict(stripe_subscription_id) do update set
      auth_user_id=excluded.auth_user_id,
      plan_code=excluded.plan_code,
      stripe_customer_id=excluded.stripe_customer_id,
      status='active',
      updated_at=now()
    returning id into v_sub_row;

    select id into v_license
    from mapaflex.licenses
    where subscription_id=v_sub_row
    order by id desc limit 1;

    if v_license is null then
      insert into mapaflex.licenses(
        auth_user_id,subscription_id,plan_code,status,max_devices
      ) values(v_user_id,v_sub_row,v_plan,'active',2)
      returning id into v_license;
    else
      update mapaflex.licenses
      set status='active',plan_code=v_plan,updated_at=now()
      where id=v_license;
    end if;

    insert into mapaflex.entitlements(license_id,feature_key,enabled)
    select
      v_license,
      f.key,
      case when jsonb_typeof(f.value)='boolean'
           then (f.value#>>'{}')::boolean else true end
    from mapaflex.plans p
    cross join lateral jsonb_each(p.features) f
    where p.code=v_plan
    on conflict(license_id,feature_key) do update set
      enabled=excluded.enabled,
      updated_at=now();

    insert into mapaflex.license_events(
      license_id,auth_user_id,event_type,source,metadata
    ) values(
      v_license,v_user_id,'activated','stripe.checkout.session.completed',
      jsonb_build_object('stripe_event_id',v_event_id)
    );

  elsif v_type in (
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted'
  ) then
    v_sub_id := nullif(v_obj->>'id','');
    v_customer := nullif(v_obj->>'customer','');
    v_price_id := nullif(v_obj#>>'{items,data,0,price,id}','');
    v_plan := coalesce(
      nullif(v_obj#>>'{metadata,plan_code}',''),
      (select code from mapaflex.plans
       where stripe_price_monthly_id=v_price_id
          or stripe_price_yearly_id=v_price_id limit 1),
      'pro'
    );
    v_status := case
      when v_type='customer.subscription.deleted' then 'canceled'
      else coalesce(nullif(v_obj->>'status',''),'active')
    end;

    select auth_user_id into v_user_id
    from mapaflex.subscriptions
    where stripe_subscription_id=v_sub_id;
    if v_user_id is null then
      select auth_user_id into v_user_id
      from mapaflex.billing_customers
      where stripe_customer_id=v_customer;
    end if;

    if v_user_id is not null and v_sub_id is not null then
      v_period_end := case
        when coalesce(
          v_obj->>'current_period_end',
          v_obj#>>'{items,data,0,current_period_end}'
        ) ~ '^[0-9]+$'
        then to_timestamp(coalesce(
          v_obj->>'current_period_end',
          v_obj#>>'{items,data,0,current_period_end}'
        )::double precision)
        else null
      end;

      insert into mapaflex.subscriptions(
        auth_user_id,plan_code,stripe_customer_id,stripe_subscription_id,
        stripe_price_id,status,current_period_end,cancel_at_period_end,canceled_at
      ) values(
        v_user_id,v_plan,v_customer,v_sub_id,v_price_id,v_status,v_period_end,
        coalesce((v_obj->>'cancel_at_period_end')::boolean,false),
        case when v_status='canceled' then now() else null end
      )
      on conflict(stripe_subscription_id) do update set
        plan_code=excluded.plan_code,
        stripe_customer_id=coalesce(
          excluded.stripe_customer_id,mapaflex.subscriptions.stripe_customer_id
        ),
        stripe_price_id=coalesce(
          excluded.stripe_price_id,mapaflex.subscriptions.stripe_price_id
        ),
        status=excluded.status,
        current_period_end=coalesce(
          excluded.current_period_end,mapaflex.subscriptions.current_period_end
        ),
        cancel_at_period_end=excluded.cancel_at_period_end,
        canceled_at=excluded.canceled_at,
        updated_at=now()
      returning id into v_sub_row;

      select id into v_license
      from mapaflex.licenses
      where subscription_id=v_sub_row
      order by id desc limit 1;

      if v_license is not null then
        update mapaflex.licenses set
          status=case
            when v_status in ('active','trialing') then 'active'
            when v_status='past_due' then 'grace'
            when v_status='canceled' then 'expired'
            else 'suspended'
          end,
          valid_until=coalesce(v_period_end,valid_until),
          grace_until=case
            when v_status='past_due' then now()+interval '3 days'
            else null
          end,
          updated_at=now()
        where id=v_license;
      end if;
    end if;

  elsif v_type='invoice.payment_failed' then
    v_sub_id := coalesce(
      nullif(v_obj->>'subscription',''),
      nullif(v_obj#>>'{parent,subscription_details,subscription}','')
    );
    if v_sub_id is not null then
      update mapaflex.subscriptions
      set status='past_due',updated_at=now()
      where stripe_subscription_id=v_sub_id
      returning id,auth_user_id into v_sub_row,v_user_id;
      if v_sub_row is not null then
        update mapaflex.licenses
        set status='grace',grace_until=now()+interval '3 days',updated_at=now()
        where subscription_id=v_sub_row;
      end if;
    end if;

  elsif v_type in ('invoice.paid','invoice.payment_succeeded') then
    v_sub_id := coalesce(
      nullif(v_obj->>'subscription',''),
      nullif(v_obj#>>'{parent,subscription_details,subscription}','')
    );
    if v_sub_id is not null then
      update mapaflex.subscriptions
      set status='active',updated_at=now()
      where stripe_subscription_id=v_sub_id
      returning id,auth_user_id into v_sub_row,v_user_id;
      if v_sub_row is not null then
        update mapaflex.licenses
        set status='active',grace_until=null,updated_at=now()
        where subscription_id=v_sub_row;
      end if;
    end if;
  end if;

  update mapaflex.webhook_events
  set processed=true,processed_at=now(),processing_error=null
  where id=v_row_id;

  return jsonb_build_object('ok',true,'event_id',v_event_id,'type',v_type);
exception when others then
  if v_row_id is not null then
    update mapaflex.webhook_events
    set processing_error=sqlerrm
    where id=v_row_id;
  end if;
  raise;
end;
$body$;

revoke all on function mapaflex.ingest_stripe_webhook(text,text) from public;
revoke all on function mapaflex.ingest_stripe_webhook(text,text) from authenticated;
grant execute on function mapaflex.ingest_stripe_webhook(text,text) to anonymous;
