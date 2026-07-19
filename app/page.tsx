"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { EventProgramItem, EventSpeaker } from "../lib/event";
import { DEFAULT_PROGRAM, EVENT_START, programTimeLabel } from "../lib/event";

const guatemalaDepartments = [
  "Alta Verapaz", "Baja Verapaz", "Chimaltenango", "Chiquimula", "El Progreso", "Escuintla", "Guatemala", "Huehuetenango", "Izabal", "Jalapa", "Jutiapa", "Petén", "Quetzaltenango", "Quiché", "Retalhuleu", "Sacatepéquez", "San Marcos", "Santa Rosa", "Sololá", "Suchitepéquez", "Totonicapán", "Zacapa",
];

export default function Home() {
  const [registration, setRegistration] = useState<"presencial" | "virtual" | null>(null);
  const [professional, setProfessional] = useState(false);
  const [professionalType, setProfessionalType] = useState("");
  const [student, setStudent] = useState(false);
  const [sent, setSent] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [available, setAvailable] = useState(250);
  const [full, setFull] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [phoneLookup, setPhoneLookup] = useState<{ status: "idle" | "checking" | "found" | "not-found"; maskedEmail?: string; modality?: string; error?: string }>({ status: "idle" });
  const [registrationPhone, setRegistrationPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("Guatemala");
  const [otherCountry, setOtherCountry] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportProblem, setSupportProblem] = useState("");
  const [supportSent, setSupportSent] = useState(false);
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [program, setProgram] = useState<EventProgramItem[]>(DEFAULT_PROGRAM);
  const [selectedSpeaker, setSelectedSpeaker] = useState<EventSpeaker | null>(null);
  const [selectedProgramItem, setSelectedProgramItem] = useState<EventProgramItem | null>(null);
  const [siteContent, setSiteContent] = useState({ title: "Cuando el Duelo se Detiene", date: "15 DE AGOSTO 2026", place: "CHIMALTENANGO", description: "Jornada Clínica sobre Duelo Prolongado. Seis miradas para comprender su diagnóstico, impacto corporal y abordaje terapéutico, familiar, psiquiátrico y comunitario.", live: false });
  const [daysRemaining, setDaysRemaining] = useState(0);
  const visibleAgenda = program;

  useEffect(() => {
    fetch("/api/registrations").then(response => response.json()).then(data => { setAvailable(data.available); setFull(data.full); }).catch(() => undefined);
    fetch("/api/speakers").then(response => response.json()).then(data => setSpeakers(data.speakers ?? [])).catch(() => undefined);
    fetch("/api/program").then(response => response.json()).then(data => setProgram((data.program?.length ? data.program : DEFAULT_PROGRAM) as EventProgramItem[])).catch(() => undefined);
    fetch("/api/content").then(response => response.json()).then(data => setSiteContent(current => ({ ...current, ...data, live: Boolean(data.live) }))).catch(() => undefined);
    const updateDays = () => setDaysRemaining(Math.max(0, Math.ceil((new Date(EVENT_START).getTime() - Date.now()) / 86400000)));
    const timeout = window.setTimeout(updateDays, 0);
    const interval = window.setInterval(updateDays, 60 * 60 * 1000);
    return () => { window.clearTimeout(timeout); window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!selectedSpeaker && !selectedProgramItem) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedSpeaker(null);
        setSelectedProgramItem(null);
      }
    };
    document.addEventListener("keydown", close); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", close); document.body.style.overflow = ""; };
  }, [selectedSpeaker, selectedProgramItem]);

  function openRegistration(modality: "presencial" | "virtual") {
    setSent(false);
    setAlreadyRegistered(false);
    setWaitlisted(false);
    setRegistrationError("");
    setPhoneLookup({ status: "idle" });
    setProfessionalType("");
    setRegistrationPhone("");
    setSelectedCountry("Guatemala");
    setOtherCountry("");
    setLoginEmail("");
    setSupportOpen(false);
    setSupportProblem("");
    setSupportSent(false);
    setRegistration(modality);
  }

  function digitsOnly(value: string) {
    return value.replace(/\D/g, "");
  }

  function keepOnlyDigits(event: FormEvent<HTMLInputElement>) {
    event.currentTarget.value = digitsOnly(event.currentTarget.value);
    if (event.currentTarget.name === "phone") setRegistrationPhone(event.currentTarget.value);
  }

  async function checkPhone(phone: string) {
    const normalizedPhone = digitsOnly(phone);
    if (normalizedPhone.length < 8) { setPhoneLookup({ status: "idle" }); return; }
    setPhoneLookup({ status: "checking" });
    const response = await fetch("/api/registrations/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: normalizedPhone }) });
    if (!response.ok) { setPhoneLookup({ status: "idle", error: "No se pudo verificar el teléfono." }); return; }
    const result = await response.json() as { found?: boolean; maskedEmail?: string; modality?: string };
    setPhoneLookup(result.found ? { status: "found", maskedEmail: result.maskedEmail, modality: result.modality } : { status: "not-found" });
  }

  async function loginFromPhone() {
    setLoginLoading(true);
    setRegistrationError("");
    const response = await fetch("/api/auth/phone-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: registrationPhone, email: loginEmail }) });
    const result = await response.json();
    setLoginLoading(false);
    if (!response.ok) { setRegistrationError(result.error ?? "No fue posible iniciar sesión."); return; }
    window.location.href = result.destination ?? "/mi-cuenta";
  }

  async function sendSupportProblem() {
    const response = await fetch("/api/support-problems", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: registrationPhone, problem: supportProblem }) });
    if (!response.ok) { setRegistrationError("No fue posible enviar el problema. Intenta de nuevo."); return; }
    setSupportSent(true);
    setSupportOpen(false);
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setRegistrationError(""); setAlreadyRegistered(false);
    const form = new FormData(event.currentTarget);
    const accountResponse = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), phone: form.get("phone") }) });
    const accountResult = await accountResponse.json();
    if (!accountResponse.ok) { setRegistrationError(accountResult.error ?? "No se pudo crear tu cuenta."); setSubmitting(false); return; }
    const country = selectedCountry === "Otro" ? otherCountry.trim() : selectedCountry;
    const response = await fetch("/api/registrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modality: registration, waitlist: registration === "presencial" && full, name: form.get("name"), email: form.get("email"), phone: form.get("phone"), attendeeType: student ? "student" : professional ? "professional" : "general", profession: form.get("profession"), license: form.get("license"), institution: form.get("university"), country, department: selectedCountry === "Guatemala" ? form.get("department") : null, gender: form.get("gender"), professionalNetworkOptIn: form.get("professionalNetworkOptIn") === "on" }) });
    const result = await response.json();
    if (!response.ok) { if (response.status === 409) { setAvailable(0); setFull(true); } setRegistrationError(result.error ?? "No se pudo completar la inscripción."); setSubmitting(false); return; }
    setAvailable(result.available ?? available);
    setFull((result.available ?? available) === 0);
    setWaitlisted(Boolean(result.waitlisted));
    setAlreadyRegistered(Boolean(result.alreadyRegistered));
    setSent(true);
    setSubmitting(false);
  }

  function speakerForProgramItem(item: EventProgramItem) {
    return speakers.find(speaker => speaker.program_item_id === item.id) ?? null;
  }

  function openProgramDetail(item: EventProgramItem) {
    const linkedSpeaker = speakerForProgramItem(item);
    if (linkedSpeaker) setSelectedSpeaker(linkedSpeaker);
    else setSelectedProgramItem(item);
  }

  function speakerProgramItem(speaker: EventSpeaker) {
    return program.find(item => item.id === speaker.program_item_id) ?? null;
  }

  return (
    <main>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Inicio Encuentro Clínico">
          <img className="brand-logo" src="/logo-duelo-arbol-morado.png" alt="" /><span>ENCUENTRO<br /><b>CLÍNICO</b></span>
        </a>
        <nav aria-label="Navegación principal">
          <a href="#encuentro">La jornada</a><a href="#agenda">Agenda</a><a href="#ponentes">Ponentes</a><a href="#constancias">Constancias</a>
        </nav>
        <div className="nav-actions">
          <a className={`live ${siteContent.live ? "" : "locked"}`} href="#transmision" aria-label={siteContent.live ? "Ir a la transmisión" : "Transmisión aún no disponible"}><i /> {siteContent.live ? "En vivo · Entrar" : "En vivo · Próximamente"}</a>
          <Link className="login-link" href="/acceso">Iniciar sesión</Link>
          <button className="primary small" onClick={() => openRegistration("presencial")}>Inscribirme</button>
          <Link className="admin-link" href="/admin" aria-label="Administración">⚙</Link>
        </div>
      </header>

      <section id="inicio" className="hero">
        <div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
        <div className="hero-content" id="contenido">
          <p className="eyebrow"><span /> {siteContent.date.toUpperCase()} · {siteContent.place.toUpperCase()}</p>
          <h1>{siteContent.title.includes(" se ") ? <>{siteContent.title.split(" se ")[0]}<br /><em>se {siteContent.title.split(" se ").slice(1).join(" se ").toLowerCase()}.</em></> : siteContent.title}</h1>
          <p className="hero-copy">{siteContent.description}</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => openRegistration("presencial")}>Vivirlo presencial <span>↗</span></button>
            <button className="secondary" onClick={() => openRegistration("virtual")}>Participar en línea <span>→</span></button>
          </div>
          <button className={`seat-availability ${full ? "is-full" : ""}`} onClick={() => openRegistration("presencial")}><b>{full ? "Cupo completo" : available}</b><span>{full ? "Reserva tu espacio si se libera" : `espacio${available === 1 ? "" : "s"} disponible${available === 1 ? "" : "s"} de 250`}</span></button>
          <div className="hero-meta"><span><b>01</b> jornada</span><span><b>06</b> ponentes</span><span><b>3.5</b> horas</span></div>
          <div className="countdown"><span>Faltan</span><b>{daysRemaining}</b><span>días para la jornada</span></div>
        </div>
        <div className="hero-stage keynote-arch" role="img" aria-label="Ponente en escenario durante una conferencia clínica"><div className="arch-date"><b>15</b><span>AGOSTO 2026<strong>Modalidad híbrida · alcance nacional</strong></span></div></div>
        <a className="scroll-hint" href="#encuentro">Descubrir <span>↓</span></a>
      </section>

      <section id="encuentro" className="manifesto section-pad">
        <div><p className="section-kicker">POR QUÉ EL DUELO PROLONGADO</p><h2>Cuando el tiempo pasa,<br /><em>pero el dolor no cambia.</em></h2></div>
        <div className="manifesto-copy"><p>Una categoría diagnóstica reconocida por DSM-5-TR y CIE-11, todavía poco abordada en espacios formales e interdisciplinarios de Guatemala.</p><a href="#agenda">Explorar la jornada <span>→</span></a></div>
        <div className="value-grid">
          <article><span>01</span><div className="line-icon">◌</div><h3>Clínicamente relevante</h3><p>El duelo prolongado no es solo una etapa emocional: requiere detección y abordaje especializado.</p></article>
          <article><span>02</span><div className="line-icon">✦</div><h3>Necesario en Guatemala</h3><p>Un espacio formal, interdisciplinario y con respaldo institucional dedicado al tema.</p></article>
          <article><span>03</span><div className="line-icon">∞</div><h3>Alcance interinstitucional</h3><p>Universidades, Colegio de Psicólogos y otras ramas de la salud reunidas en una sola agenda.</p></article>
        </div>
      </section>

      <section id="agenda" className="agenda-section section-pad">
        <div className="section-head"><div><p className="section-kicker">CRONOGRAMA · 8:30 A.M.–12:00 P.M.</p><h2>Tres horas y media,<br /><em>minuto a minuto.</em></h2></div><div className="event-date-card"><b>15</b><span>AGOSTO<br />2026</span></div></div>
        <div className="agenda-list">{visibleAgenda.map((item, i) => <article key={item.id}><time>{programTimeLabel(item)}</time><span className={`tag tag-${i % 3}`}>{item.type}</span><div><h3>{item.title}</h3><p>{item.description}</p></div><button aria-label={`Ver detalles de ${item.title}`} onClick={() => openProgramDetail(item)}>+</button></article>)}</div>
        <a className="text-link" href="#recursos">Descargar agenda completa <span>↓</span></a>
      </section>

      <section id="ponentes" className="speakers-section section-pad">
        <div className="section-head"><div><p className="section-kicker light">VOCES DEL ENCUENTRO</p><h2>Conoce a<br /><em>los ponentes.</em></h2></div><p className="side-copy">Selecciona una ficha para conocer su trayectoria, ponencia y contenido audiovisual.</p></div>
        {speakers.length === 0 ? <div className="public-empty dark"><span>PRÓXIMAMENTE</span><h3>Ponentes por anunciar.</h3><p>Estamos preparando las fichas profesionales de quienes formarán parte de la jornada.</p></div> : <div className="speaker-grid">{speakers.map((speaker, index) => {
          const item = speakerProgramItem(speaker);
          return <button className="speaker-profile-card speaker-arch-card" key={speaker.id} onClick={() => setSelectedSpeaker(speaker)} aria-label={`Conocer a ${speaker.name}`}>
            <div className="speaker-arch-portrait">{speaker.photo_url ? <img src={speaker.photo_url} alt={`Fotografía de ${speaker.name}`} /> : <div className="speaker-placeholder">{speaker.name.slice(0, 1)}</div>}<span>{String(index + 1).padStart(2, "0")}</span></div>
            <div className="speaker-profile-info"><span>{item ? programTimeLabel(item) : speaker.talk_time || `PONENCIA ${String(index + 1).padStart(2, "0")}`}</span><h3>{speaker.name}</h3><p>{speaker.professional_title}</p><small>{speaker.talk_title || item?.title || "Tema por anunciar"}</small><b>Ver perfil →</b></div>
          </button>;
        })}</div>}
        <a className="secondary light-btn" href="#agenda">Ver cronograma completo <span>→</span></a>
      </section>

      <section id="inscripciones" className="formats section-pad">
        <div className="center-head"><p className="section-kicker">ELIGE CÓMO VIVIRLO</p><h2>Una experiencia.<br /><em>Dos formas de estar.</em></h2></div>
        <div className="format-grid">
          <article className="format-card featured"><span className="format-label">PRESENCIAL</span><div className="format-symbol">◉</div><h3>Vívelo en Chimaltenango.</h3><p>Participa en la jornada, el panel de preguntas y el encuentro interdisciplinario.</p><div className={`format-capacity ${full ? "is-full" : ""}`}><b>{full ? "Cupo completo" : available}</b><span>{full ? "Lista de espera disponible" : `espacio${available === 1 ? "" : "s"} disponible${available === 1 ? "" : "s"} de 250`}</span></div><ul><li>Seis charlas clínicas breves</li><li>Panel con los seis ponentes</li><li>Coffee break incluido</li><li>Souvenir de la actividad</li><li>Constancia según perfil</li></ul><button className="primary" onClick={() => openRegistration("presencial")}>{full ? "Reservar si se libera" : "Inscripción presencial"} <span>→</span></button></article>
          <article className="format-card"><span className="format-label">VIRTUAL</span><div className="format-symbol">◎</div><h3>Conéctate desde donde estés.</h3><p>Sigue la jornada en directo con el mismo contenido científico.</p><ul><li>Transmisión en vivo</li><li>Acceso a las seis charlas</li><li>Biblioteca digital</li><li>Constancia según perfil</li></ul><button className="secondary" onClick={() => openRegistration("virtual")}>Inscripción virtual <span>→</span></button></article>
        </div>
      </section>

      <section id="constancias" className="certificates section-pad">
        <div className="center-head"><p className="section-kicker">BENEFICIOS PARA PARTICIPANTES</p><h2>Constancias diferenciadas<br /><em>por perfil.</em></h2></div>
        <div className="certificate-grid">
          <article className="professional-certificate"><span>CONSTANCIA</span><h3>Profesionales colegiados</h3><em>Colegio de Psicólogos de Guatemala (CPG)</em><ul><li>Constancia con aval y numeración del CPG</li><li>Reconocimiento formal de horas de actualización profesional</li><li>Firma conjunta CPG</li></ul></article>
          <article><span>DIPLOMA</span><h3>Estudiantes y otras ramas de la salud</h3><em>Medicina, enfermería, trabajo social y otras carreras</em><ul><li>Diploma de participación institucional</li><li>Válido como constancia de asistencia académica</li><li>Mismo contenido científico, sin aval gremial del CPG</li></ul></article>
        </div>
      </section>

      <section id="transmision" className="live-banner section-pad"><div className="live-visual"><div className="play-lock">▶</div><span>TRANSMISIÓN PRIVADA</span></div><div><p className="section-kicker light">ENCUENTRO EN VIVO</p><h2>La sala se abrirá<br /><em>cuando sea el momento.</em></h2><p>El acceso aparecerá aquí cuando el equipo organizador active la transmisión.</p><button disabled={!siteContent.live} className="secondary light-btn">{siteContent.live ? "Entrar a la transmisión →" : "Aún no disponible · 🔒"}</button></div></section>

      <section id="recursos" className="resources section-pad">
        <div className="section-head"><div><p className="section-kicker">BIBLIOTECA DEL ENCUENTRO</p><h2>Para seguir<br /><em>profundizando.</em></h2></div><p className="side-copy dark-copy">Materiales seleccionados por el comité académico. Algunos recursos se habilitarán durante el evento.</p></div>
        <div className="public-empty"><span>BIBLIOTECA EN PREPARACIÓN</span><h3>Aún no hay recursos publicados.</h3><p>Los materiales aparecerán aquí cuando el equipo académico los cargue.</p></div>
      </section>

      <section className="partners section-pad"><p className="section-kicker">HACEN POSIBLE ESTE ENCUENTRO</p><h2>Aliados por la salud mental.</h2><div className="public-empty"><span>CONVOCATORIA ABIERTA</span><h3>Patrocinadores por anunciar.</h3><p>Las organizaciones confirmadas aparecerán aquí.</p></div><a href="mailto:lic.juanreyesr@gmail.com">Quiero ser patrocinador <span>→</span></a></section>

      <footer><div className="footer-brand"><img className="footer-art" src="/og.png" alt="Cuando el Duelo se Detiene — Jornada Clínica sobre Duelo Prolongado" /></div><div><b>Explora</b><a href="#encuentro">La jornada</a><a href="#agenda">Agenda</a><a href="#ponentes">Ponentes</a><a href="#constancias">Constancias</a></div><div><b>Participa</b><button onClick={() => openRegistration("presencial")}>Inscripción presencial</button><button onClick={() => openRegistration("virtual")}>Inscripción virtual</button><Link href="/preguntas">Preguntas a conferencistas</Link><a href="mailto:lic.juanreyesr@gmail.com">Patrocinios</a><Link href="/admin">Administración</Link></div><div><b>Mantente cerca</b><p>Recibe novedades, recursos y anuncios importantes.</p><form><input type="email" aria-label="Correo electrónico" placeholder="tu@email.com" /><button aria-label="Suscribirme">→</button></form></div><small>© 2026 Encuentro Clínico de Psicología · Chimaltenango · Privacidad · Términos</small></footer>

      {selectedSpeaker && <div className="modal-backdrop speaker-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedSpeaker(null); }}><section className="speaker-modal" role="dialog" aria-modal="true" aria-labelledby="speaker-modal-name"><button className="modal-close" aria-label="Cerrar perfil" onClick={() => setSelectedSpeaker(null)}>×</button><div className="speaker-modal-media">{selectedSpeaker.photo_url ? <img src={selectedSpeaker.photo_url} alt={`Fotografía de ${selectedSpeaker.name}`} /> : <div className="speaker-placeholder">{selectedSpeaker.name.slice(0, 1)}</div>}</div><div className="speaker-modal-copy"><p className="section-kicker">{speakerProgramItem(selectedSpeaker) ? programTimeLabel(speakerProgramItem(selectedSpeaker)!) : selectedSpeaker.talk_time || "PONENTE"}</p><h2 id="speaker-modal-name">{selectedSpeaker.name}</h2><strong>{selectedSpeaker.professional_title}</strong>{(selectedSpeaker.talk_title || speakerProgramItem(selectedSpeaker)?.title) && <h3>{selectedSpeaker.talk_title || speakerProgramItem(selectedSpeaker)?.title}</h3>}<p>{selectedSpeaker.bio || "La semblanza profesional estará disponible próximamente."}</p>{(selectedSpeaker.contact_email || selectedSpeaker.contact_phone || selectedSpeaker.contact_website) && <div className="speaker-contact"><b>Contacto</b>{selectedSpeaker.contact_email && <a href={`mailto:${selectedSpeaker.contact_email}`}>{selectedSpeaker.contact_email}</a>}{selectedSpeaker.contact_phone && <a href={`tel:${selectedSpeaker.contact_phone}`}>{selectedSpeaker.contact_phone}</a>}{selectedSpeaker.contact_website && <a href={selectedSpeaker.contact_website.startsWith("http") ? selectedSpeaker.contact_website : `https://${selectedSpeaker.contact_website}`} target="_blank" rel="noreferrer">Sitio web ↗</a>}</div>}{selectedSpeaker.video_url && <video src={selectedSpeaker.video_url} controls preload="metadata" />}</div></section></div>}

      {selectedProgramItem && <div className="modal-backdrop speaker-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedProgramItem(null); }}><section className="program-modal" role="dialog" aria-modal="true" aria-labelledby="program-modal-title"><button className="modal-close" aria-label="Cerrar detalle" onClick={() => setSelectedProgramItem(null)}>×</button><p className="section-kicker">{selectedProgramItem.type} · {programTimeLabel(selectedProgramItem)}</p><h2 id="program-modal-title">{selectedProgramItem.title}</h2><strong>{selectedProgramItem.description}</strong><p>{selectedProgramItem.details || "Los detalles de este espacio se actualizarán desde el administrador."}</p></section></div>}

      {registration && <div className="modal-backdrop" role="presentation" onMouseDown={() => setRegistration(null)}>
        <div className="registration-modal" role="dialog" aria-modal="true" aria-labelledby="reg-title" onMouseDown={event => event.stopPropagation()}>
          <button className="modal-close" onClick={() => setRegistration(null)} aria-label="Cerrar">×</button>
          {sent ? <div className="success"><span>✓</span><h2>{alreadyRegistered ? "Ya tenías inscripción." : waitlisted ? "Quedaste en lista de espera." : "Inscripción confirmada."}</h2><p>{alreadyRegistered ? "Tu acceso del encuentro está listo. Ingresa con tu correo y tu teléfono para consultar materiales y descargar tu constancia cuando esté disponible." : waitlisted ? "Registramos tu solicitud. Si se libera un espacio presencial, el equipo organizador podrá contactarte." : "Tu cuenta también quedó creada. Ingresa con tu correo y utiliza tu número de teléfono como contraseña inicial para consultar materiales y descargar tu constancia cuando esté disponible."}</p><Link className="primary" href="/mi-cuenta">Ir a mi cuenta</Link></div> : <>
            <p className="section-kicker">INSCRIPCIÓN</p>
            <h2 id="reg-title">Reserva tu lugar.</h2>
            <p>Primero verificaremos tu teléfono. Si ya estás inscrito, podrás iniciar sesión desde aquí usando el correo registrado.</p>
            <form onSubmit={submitRegistration} className="registration-form">
              <label className="wide-field">Teléfono / WhatsApp *<input required minLength={8} inputMode="numeric" pattern="[0-9]*" type="text" name="phone" autoComplete="tel" onInput={keepOnlyDigits} onBlur={event => checkPhone(event.currentTarget.value)} /></label>

              {phoneLookup.status === "checking" && <div className="registration-notice">Verificando teléfono...</div>}
              {phoneLookup.status === "found" && <div className="existing-registration">
                <b>Ya estás inscrito.</b>
                <p>El correo registrado comienza y termina así: <strong>{phoneLookup.maskedEmail}</strong>. ¿Quieres iniciar sesión?</p>
                <div className="inline-login">
                  <label>Correo registrado<input type="email" name="loginEmail" value={loginEmail} onChange={event => setLoginEmail(event.target.value)} autoComplete="email" /></label>
                  <button className="secondary" type="button" disabled={loginLoading || !loginEmail} onClick={loginFromPhone}>{loginLoading ? "Validando..." : "Iniciar sesión"}</button>
                </div>
                <button className="problem-toggle" type="button" onClick={() => setSupportOpen(value => !value)}>Tengo problemas para iniciar sesión</button>
                {supportOpen && <div className="support-form">
                  <label>Cuéntanos el problema<textarea name="problem" rows={3} value={supportProblem} onChange={event => setSupportProblem(event.target.value)} placeholder="Ej. No recuerdo qué correo usé o el correo mostrado no coincide." /></label>
                  <button className="secondary" type="button" disabled={supportProblem.trim().length < 4} onClick={sendSupportProblem}>Enviar problema</button>
                </div>}
                {supportSent && <p className="support-sent">Problema enviado. El equipo organizador podrá verlo en el administrador.</p>}
              </div>}

              <fieldset className="modality-picker"><legend>Selecciona tu asistencia *</legend><label className={registration === "presencial" ? "selected" : ""}><input type="radio" name="modalityChoice" checked={registration === "presencial"} onChange={() => setRegistration("presencial")} /><span><b>Presencial</b><small>{full ? "Cupo lleno · reserva si se libera" : `${available} espacios disponibles de 250`} · incluye coffee break y souvenir de la actividad</small></span></label><label className={registration === "virtual" ? "selected" : ""}><input type="radio" name="modalityChoice" checked={registration === "virtual"} onChange={() => setRegistration("virtual")} /><span><b>Virtual</b><small>Acceso en línea a la jornada y materiales digitales</small></span></label></fieldset>
              <label>Nombre completo *<input required name="name" autoComplete="name" /></label>
              <label>Correo electrónico *<input required type="email" name="email" autoComplete="email" /></label>
              <label>Género *<select required name="gender" defaultValue=""><option value="" disabled>Selecciona una opción</option><option>Hombre</option><option>Mujer</option></select></label>
              <div className="check-row"><label><input type="checkbox" checked={student} onChange={event => { setStudent(event.target.checked); if (event.target.checked) setProfessional(false); }} /> Soy estudiante</label><label><input type="checkbox" checked={professional} onChange={event => { setProfessional(event.target.checked); if (event.target.checked) setStudent(false); }} /> Soy profesional</label></div>
              {student && <label>Universidad / centro de estudios *<input required name="university" /></label>}
              {professional && <><label>Profesión *<select required name="profession" value={professionalType} onChange={event => setProfessionalType(event.target.value)}><option value="" disabled>Selecciona una profesión</option><option>Psicólogo</option><option>Psiquiatra</option><option>Médico</option><option>Enfermería</option><option>Trabajo social</option><option>Orientación</option><option>Otras áreas de apoyo</option><option>Otra profesión</option></select></label><label>Número de colegiado {professionalType === "Psicólogo" ? "*" : "(opcional)"}<input required={professionalType === "Psicólogo"} inputMode="numeric" pattern="[0-9]*" name="license" onInput={keepOnlyDigits} /><small>{professionalType === "Psicólogo" ? "Requerido para validar el perfil profesional." : "Puedes dejarlo vacío si tu profesión no utiliza colegiado."}</small></label></>}
              <label>País *<select required name="countryChoice" value={selectedCountry} onChange={event => setSelectedCountry(event.target.value)}><option>Guatemala</option><option>El Salvador</option><option>Honduras</option><option>Costa Rica</option><option>México</option><option>Otro</option></select></label>
              {selectedCountry === "Otro" ? <label>Escribe tu país *<input required name="otherCountry" value={otherCountry} onChange={event => setOtherCountry(event.target.value)} autoComplete="country-name" /></label> : <label>Departamento {selectedCountry === "Guatemala" ? "*" : "(solo Guatemala)"}<select required={selectedCountry === "Guatemala"} disabled={selectedCountry !== "Guatemala"} name="department" defaultValue=""><option value="" disabled>{selectedCountry === "Guatemala" ? "Selecciona departamento" : "No aplica fuera de Guatemala"}</option>{guatemalaDepartments.map(department => <option key={department}>{department}</option>)}</select><small>{selectedCountry === "Guatemala" ? "Selecciona tu departamento." : "El departamento se habilita únicamente para Guatemala."}</small></label>}
              <label className="consent professional-network-consent"><input type="checkbox" name="professionalNetworkOptIn" /> Quiero ser parte de una red profesional.</label>
              <label className="consent"><input required type="checkbox" /> Acepto el tratamiento de mis datos y la creación de mi cuenta de participante.</label>
              {registrationError && <p className="form-error">{registrationError}</p>}
              <button className="primary submit" type="submit" disabled={submitting}>{submitting ? "Creando cuenta e inscripción..." : full && registration === "presencial" ? "Crear cuenta y reservar si se libera" : "Crear cuenta e inscribirme"} <span>→</span></button>
            </form>
          </>}
        </div>
      </div>}
    </main>
  );
}
