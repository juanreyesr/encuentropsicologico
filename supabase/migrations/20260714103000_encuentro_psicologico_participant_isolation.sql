create or replace function public.encuentro_psicologico_auth_user_id(p_email text)
returns uuid
language sql
security definer
set search_path = auth, public, pg_temp
as $$
  select id
  from auth.users
  where lower(email) = lower(trim(p_email))
  order by created_at asc
  limit 1
$$;

revoke all on function public.encuentro_psicologico_auth_user_id(text) from public, anon, authenticated;
grant execute on function public.encuentro_psicologico_auth_user_id(text) to service_role;

create unique index if not exists encuentro_psicologico_registration_email_modality_active_idx
  on public.encuentro_psicologico_registrations (lower(email), modality)
  where status in ('confirmed', 'waitlist');

create or replace function public.encuentro_psicologico_register(
  p_modality text,
  p_name text,
  p_email text,
  p_phone text,
  p_attendee_type text default 'general',
  p_profession text default null,
  p_license text default null,
  p_institution text default null,
  p_country text default 'Guatemala',
  p_waitlist boolean default false,
  p_user_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_confirmed integer;
  v_status text;
  v_existing_status text;
begin
  if p_modality not in ('presencial', 'virtual') then
    raise exception 'Modalidad invalida';
  end if;

  select status into v_existing_status
  from public.encuentro_psicologico_registrations
  where lower(email) = lower(trim(p_email))
    and modality = p_modality
    and status in ('confirmed', 'waitlist')
  order by created_at desc
  limit 1;

  if v_existing_status is not null then
    select count(*) into v_confirmed
    from public.encuentro_psicologico_registrations
    where modality = 'presencial' and status = 'confirmed';

    return jsonb_build_object(
      'status', 'already_registered',
      'registration_status', v_existing_status,
      'available', greatest(0, 250 - v_confirmed)
    );
  end if;

  perform pg_advisory_xact_lock(hashtext('encuentro_psicologico_capacity'));
  select count(*) into v_confirmed
  from public.encuentro_psicologico_registrations
  where modality = 'presencial' and status = 'confirmed';

  if p_modality = 'presencial' and v_confirmed >= 250 and not p_waitlist then
    return jsonb_build_object('status', 'full', 'available', 0);
  end if;

  v_status := case
    when p_modality = 'presencial' and (p_waitlist or v_confirmed >= 250) then 'waitlist'
    else 'confirmed'
  end;

  insert into public.encuentro_psicologico_registrations
    (modality, name, email, phone, attendee_type, profession, license, institution, country, status, user_id)
  values
    (p_modality, p_name, lower(trim(p_email)), p_phone, p_attendee_type, p_profession, p_license, p_institution, p_country, v_status, p_user_id);

  if p_user_id is not null then
    insert into public.encuentro_psicologico_profiles
      (user_id, full_name, phone, attendee_type, profession, license, institution, country)
    values
      (p_user_id, p_name, p_phone, p_attendee_type, p_profession, p_license, p_institution, coalesce(nullif(p_country, ''), 'Guatemala'))
    on conflict (user_id) do update set
      full_name = excluded.full_name,
      phone = excluded.phone,
      attendee_type = excluded.attendee_type,
      profession = excluded.profession,
      license = excluded.license,
      institution = excluded.institution,
      country = excluded.country,
      updated_at = now();

    insert into public.encuentro_psicologico_certificates (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;
  end if;

  if p_modality = 'presencial' and v_status = 'confirmed' then
    v_confirmed := v_confirmed + 1;
  end if;

  return jsonb_build_object('status', v_status, 'available', greatest(0, 250 - v_confirmed));
end;
$$;

revoke all on function public.encuentro_psicologico_register(text,text,text,text,text,text,text,text,text,boolean,uuid) from public, anon, authenticated;
grant execute on function public.encuentro_psicologico_register(text,text,text,text,text,text,text,text,text,boolean,uuid) to service_role;
