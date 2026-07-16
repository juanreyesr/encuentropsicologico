alter table public.encuentro_psicologico_registrations
  add column if not exists professional_network_opt_in boolean not null default false;

alter table public.encuentro_psicologico_profiles
  add column if not exists professional_network_opt_in boolean not null default false;

create table if not exists public.encuentro_psicologico_professional_directory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  share_enabled boolean not null default false,
  profession text,
  specialty text,
  address text,
  email text,
  whatsapp text,
  website text,
  instagram text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.encuentro_psicologico_professional_directory enable row level security;
revoke all on public.encuentro_psicologico_professional_directory from anon, authenticated;
grant all on public.encuentro_psicologico_professional_directory to service_role;

create index if not exists encuentro_psicologico_professional_directory_share_idx
  on public.encuentro_psicologico_professional_directory (share_enabled, updated_at desc);

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
  p_user_id uuid default null,
  p_department text default null,
  p_professional_network_opt_in boolean default false
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
    if p_user_id is not null then
      update public.encuentro_psicologico_profiles
      set professional_network_opt_in = coalesce(p_professional_network_opt_in, false),
          updated_at = now()
      where user_id = p_user_id;

      update public.encuentro_psicologico_registrations
      set professional_network_opt_in = coalesce(p_professional_network_opt_in, false)
      where user_id = p_user_id
        and lower(email) = lower(trim(p_email))
        and status in ('confirmed', 'waitlist');
    end if;

    select count(*) into v_confirmed
    from public.encuentro_psicologico_registrations
    where modality = 'presencial' and status = 'confirmed';

    return jsonb_build_object('status', 'already_registered', 'registration_status', v_existing_status, 'available', greatest(0, 250 - v_confirmed));
  end if;

  perform pg_advisory_xact_lock(hashtext('encuentro_psicologico_capacity'));
  select count(*) into v_confirmed
  from public.encuentro_psicologico_registrations
  where modality = 'presencial' and status = 'confirmed';

  if p_modality = 'presencial' and v_confirmed >= 250 and not p_waitlist then
    return jsonb_build_object('status', 'full', 'available', 0);
  end if;

  v_status := case when p_modality = 'presencial' and (p_waitlist or v_confirmed >= 250) then 'waitlist' else 'confirmed' end;

  insert into public.encuentro_psicologico_registrations
    (modality, name, email, phone, attendee_type, profession, license, institution, country, department, status, user_id, professional_network_opt_in)
  values
    (p_modality, p_name, lower(trim(p_email)), regexp_replace(p_phone, '[^0-9]', '', 'g'), p_attendee_type, p_profession, regexp_replace(coalesce(p_license, ''), '[^0-9]', '', 'g'), p_institution, p_country, p_department, v_status, p_user_id, coalesce(p_professional_network_opt_in, false));

  if p_user_id is not null then
    insert into public.encuentro_psicologico_profiles
      (user_id, full_name, phone, attendee_type, profession, license, institution, country, department, professional_network_opt_in)
    values
      (p_user_id, p_name, regexp_replace(p_phone, '[^0-9]', '', 'g'), p_attendee_type, p_profession, regexp_replace(coalesce(p_license, ''), '[^0-9]', '', 'g'), p_institution, coalesce(nullif(p_country, ''), 'Guatemala'), p_department, coalesce(p_professional_network_opt_in, false))
    on conflict (user_id) do update set
      full_name = excluded.full_name,
      phone = excluded.phone,
      attendee_type = excluded.attendee_type,
      profession = excluded.profession,
      license = excluded.license,
      institution = excluded.institution,
      country = excluded.country,
      department = excluded.department,
      professional_network_opt_in = excluded.professional_network_opt_in,
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

revoke all on function public.encuentro_psicologico_register(text,text,text,text,text,text,text,text,text,boolean,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.encuentro_psicologico_register(text,text,text,text,text,text,text,text,text,boolean,uuid,text,boolean) to service_role;
