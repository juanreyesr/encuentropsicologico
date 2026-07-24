-- A full presencial room can still accept a voluntary waitlist registration.
create or replace function public.encuentro_psicologico_register(
  p_modality text, p_name text, p_email text, p_phone text,
  p_attendee_type text default 'general', p_profession text default null,
  p_license text default null, p_institution text default null,
  p_country text default 'Guatemala', p_waitlist boolean default false,
  p_user_id uuid default null, p_department text default null,
  p_professional_network_opt_in boolean default false
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_confirmed integer; v_status text; v_existing record;
begin
  if p_modality not in ('presencial','virtual') then raise exception 'Modalidad inválida'; end if;
  perform pg_advisory_xact_lock(hashtext('encuentro_psicologico_capacity'));
  select count(*) into v_confirmed from public.encuentro_psicologico_registrations where modality='presencial' and status='confirmed';
  select * into v_existing from public.encuentro_psicologico_registrations
    where (p_user_id is not null and user_id=p_user_id) or lower(email)=lower(trim(p_email))
    order by created_at desc, id desc limit 1;
  if p_modality='presencial' and not p_waitlist and (v_existing.id is null or v_existing.modality <> 'presencial' or v_existing.status <> 'confirmed') and v_confirmed >= 250 then
    return jsonb_build_object('status','full','available',0);
  end if;
  v_status := case when p_modality='presencial' and p_waitlist then 'waitlist' else 'confirmed' end;
  if v_existing.id is not null then
    update public.encuentro_psicologico_registrations set
      modality=p_modality,status=v_status,name=p_name,email=lower(trim(p_email)),phone=regexp_replace(p_phone,'[^0-9]','','g'),
      attendee_type=p_attendee_type,profession=p_profession,license=regexp_replace(coalesce(p_license,''),'[^0-9]','','g'),
      institution=p_institution,country=p_country,department=p_department,user_id=coalesce(p_user_id,user_id),
      professional_network_opt_in=coalesce(p_professional_network_opt_in,false),attendance_verified_at=null,
      attendance_verification_method=null,attendance_verified_by=null
    where id=v_existing.id;
  else
    insert into public.encuentro_psicologico_registrations
      (modality,name,email,phone,attendee_type,profession,license,institution,country,department,status,user_id,professional_network_opt_in)
    values (p_modality,p_name,lower(trim(p_email)),regexp_replace(p_phone,'[^0-9]','','g'),p_attendee_type,p_profession,regexp_replace(coalesce(p_license,''),'[^0-9]','','g'),p_institution,p_country,p_department,v_status,p_user_id,coalesce(p_professional_network_opt_in,false));
  end if;
  if p_user_id is not null then
    insert into public.encuentro_psicologico_profiles (user_id,full_name,phone,attendee_type,profession,license,institution,country,department,professional_network_opt_in)
    values (p_user_id,p_name,regexp_replace(p_phone,'[^0-9]','','g'),p_attendee_type,p_profession,regexp_replace(coalesce(p_license,''),'[^0-9]','','g'),p_institution,coalesce(nullif(p_country,''),'Guatemala'),p_department,coalesce(p_professional_network_opt_in,false))
    on conflict (user_id) do update set full_name=excluded.full_name,phone=excluded.phone,attendee_type=excluded.attendee_type,profession=excluded.profession,license=excluded.license,institution=excluded.institution,country=excluded.country,department=excluded.department,professional_network_opt_in=excluded.professional_network_opt_in,updated_at=now();
    insert into public.encuentro_psicologico_certificates (user_id) values (p_user_id) on conflict (user_id) do nothing;
  end if;
  select count(*) into v_confirmed from public.encuentro_psicologico_registrations where modality='presencial' and status='confirmed';
  return jsonb_build_object('status',v_status,'available',greatest(0,250-v_confirmed),'changed_existing',v_existing.id is not null);
end; $$;
revoke all on function public.encuentro_psicologico_register(text,text,text,text,text,text,text,text,text,boolean,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.encuentro_psicologico_register(text,text,text,text,text,text,text,text,text,boolean,uuid,text,boolean) to service_role;
