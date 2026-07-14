"use client";

import { FormEvent, useEffect, useState } from "react";

const agenda = [
  { time: "8:30–9:00", type: "Registro", title: "Registro e inscripciones", speaker: "Recepción de participantes" },
  { time: "9:00–9:10", type: "Apertura", title: "Apertura institucional", speaker: "Bienvenida a la jornada" },
  { time: "9:10–9:30", type: "Charla 1", title: "Diagnóstico", speaker: "Duelo normal vs. trastorno de duelo prolongado · DSM-5-TR / CIE-11" },
  { time: "9:30–9:50", type: "Charla 2", title: "Impacto corporal", speaker: "Somatización del duelo no resuelto" },
  { time: "9:50–10:10", type: "Charla 3", title: "Manejo terapéutico", speaker: "Intervención clínica individual" },
  { time: "10:10–10:25", type: "Receso", title: "Pausa y encuentro", speaker: "15 minutos" },
  { time: "10:25–10:45", type: "Charla 4", title: "Manejo familiar", speaker: "El sistema familiar frente al duelo detenido" },
  { time: "10:45–11:05", type: "Charla 5", title: "Psiquiatría", speaker: "Cuándo se requiere manejo farmacológico" },
  { time: "11:05–11:25", type: "Charla 6", title: "Cierre comunitario", speaker: "Resiliencia y rol del psicólogo local" },
  { time: "11:25–12:00", type: "Cierre", title: "Panel de preguntas y entrega de constancias", speaker: "Conversación con los 6 ponentes · cierre institucional" },
];

const speakers = [
  { initials: "01", name: "Diagnóstico", role: "Eje clínico", topic: "Duelo normal vs. trastorno de duelo prolongado", color: "violet" },
  { initials: "02", name: "Impacto corporal", role: "Eje clínico", topic: "Somatización del duelo no resuelto", color: "gold" },
  { initials: "03", name: "Manejo terapéutico", role: "Eje clínico", topic: "Intervención clínica individual", color: "coral" },
  { initials: "04", name: "Manejo familiar", role: "Eje sistémico", topic: "El sistema familiar frente al duelo detenido", color: "gold" },
  { initials: "05", name: "Psiquiatría", role: "Eje interdisciplinario", topic: "Cuándo se requiere manejo farmacológico", color: "violet" },
  { initials: "06", name: "Cierre comunitario", role: "Eje comunitario", topic: "Resiliencia y rol del psicólogo local", color: "coral" },
];

export default function Home() {
  const [registration, setRegistration] = useState<"presencial" | "virtual" | null>(null);
  const [professional, setProfessional] = useState(false);
  const [student, setStudent] = useState(false);
  const [sent, setSent] = useState(false);
  const [available, setAvailable] = useState(250);
  const [full, setFull] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const visibleAgenda = agenda;
  const daysRemaining = Math.max(0, Math.ceil((new Date("2026-08-15T08:30:00-06:00").getTime() - Date.now()) / 86400000));

  useEffect(() => {
    fetch("/api/registrations").then(response => response.json()).then(data => { setAvailable(data.available); setFull(data.full); }).catch(() => undefined);
  }, []);

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setRegistrationError("");
    const form = new FormData(event.currentTarget);
    const accountResponse = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), phone: form.get("phone") }) });
    const accountResult = await accountResponse.json();
    if (!accountResponse.ok) { setRegistrationError(accountResult.error ?? "No se pudo crear tu cuenta."); setSubmitting(false); return; }
    const response = await fetch("/api/registrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modality: registration, waitlist: registration === "presencial" && full, name: form.get("name"), email: form.get("email"), phone: form.get("phone"), attendeeType: student ? "student" : professional ? "professional" : "general", profession: form.get("profession"), license: form.get("license"), institution: form.get("university"), country: form.get("country") || "Guatemala" }) });
    const result = await response.json();
    if (!response.ok) { if (response.status === 409) { setAvailable(0); setFull(true); } setRegistrationError(result.error ?? "No se pudo completar la inscripción."); setSubmitting(false); return; }
    setAvailable(result.available ?? available);
    setFull((result.available ?? available) === 0);
    setWaitlisted(Boolean(result.waitlisted));
    setSent(true);
    setSubmitting(false);
  }

  return (
    <main>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Inicio Encuentro Clínico">
          <img className="brand-logo" src="/duelo-simbolo.png" alt="" /><span>ENCUENTRO<br /><b>CLÍNICO</b></span>
        </a>
        <nav aria-label="Navegación principal">
          <a href="#encuentro">La jornada</a><a href="#agenda">Agenda</a><a href="#ponentes">Ejes clínicos</a><a href="#constancias">Constancias</a>
        </nav>
        <div className="nav-actions">
          <a className="live locked" href="#transmision" aria-label="Transmisión aún no disponible"><i /> En vivo · Próximamente</a>
          <button className="primary small" onClick={() => setRegistration("presencial")}>Inscribirme</button>
          <a className="admin-link" href="/admin" aria-label="Administración">⚙</a>
        </div>
      </header>

      <section id="inicio" className="hero">
        <div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
        <div className="hero-content" id="contenido">
          <p className="eyebrow"><span /> 15 DE AGOSTO 2026 · CHIMALTENANGO</p>
          <h1>Cuando el duelo<br /><em>se detiene.</em></h1>
          <p className="hero-copy"><b>Jornada Clínica sobre Duelo Prolongado.</b> Seis miradas para comprender su diagnóstico, impacto corporal y abordaje terapéutico, familiar, psiquiátrico y comunitario.</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => setRegistration("presencial")}>Vivirlo presencial <span>↗</span></button>
            <button className="secondary" onClick={() => setRegistration("virtual")}>Participar en línea <span>→</span></button>
          </div>
          <button className={`seat-availability ${full ? "is-full" : ""}`} onClick={() => setRegistration("presencial")}><b>{full ? "Cupo completo" : available}</b><span>{full ? "Reserva tu espacio si se libera" : `espacio${available === 1 ? "" : "s"} disponible${available === 1 ? "" : "s"} de 250`}</span></button>
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
        <div className="agenda-list">{visibleAgenda.map((item, i) => <article key={item.time + item.title}><time>{item.time}</time><span className={`tag tag-${i % 3}`}>{item.type}</span><div><h3>{item.title}</h3><p>{item.speaker}</p></div><button aria-label={`Ver detalles de ${item.title}`}>+</button></article>)}</div>
        <a className="text-link" href="#recursos">Descargar agenda completa <span>↓</span></a>
      </section>

      <section id="ponentes" className="speakers-section section-pad">
        <div className="section-head"><div><p className="section-kicker light">SEIS EJES · UNA SECUENCIA CLÍNICA</p><h2>Un tema.<br /><em>Seis miradas.</em></h2></div><p className="side-copy">Charlas breves de 15–18 minutos, transición inmediata y cierre integrador con los seis ponentes.</p></div>
        <div className="speaker-grid">{speakers.map((speaker, i) => <article className={`speaker-card ${speaker.color}`} key={speaker.name}><div className="portrait"><div className="portrait-glow" /><span>{speaker.initials}</span><div className="portrait-number">0{i + 1}</div></div><div className="speaker-info"><p>{speaker.role}</p><h3>{speaker.name}</h3><div /><small>{speaker.topic}</small></div></article>)}</div>
        <a className="secondary light-btn" href="#agenda">Ver cronograma completo <span>→</span></a>
      </section>

      <section id="inscripciones" className="formats section-pad">
        <div className="center-head"><p className="section-kicker">ELIGE CÓMO VIVIRLO</p><h2>Una experiencia.<br /><em>Dos formas de estar.</em></h2></div>
        <div className="format-grid">
          <article className="format-card featured"><span className="format-label">PRESENCIAL</span><div className="format-symbol">◉</div><h3>Vívelo en Chimaltenango.</h3><p>Participa en la jornada, el panel de preguntas y el encuentro interdisciplinario.</p><div className={`format-capacity ${full ? "is-full" : ""}`}><b>{full ? "Cupo completo" : available}</b><span>{full ? "Lista de espera disponible" : `espacio${available === 1 ? "" : "s"} disponible${available === 1 ? "" : "s"} de 250`}</span></div><ul><li>Seis charlas clínicas breves</li><li>Panel con los seis ponentes</li><li>Espacio de conexión profesional</li><li>Constancia según perfil</li></ul><button className="primary" onClick={() => setRegistration("presencial")}>{full ? "Reservar si se libera" : "Inscripción presencial"} <span>→</span></button></article>
          <article className="format-card"><span className="format-label">VIRTUAL</span><div className="format-symbol">◎</div><h3>Conéctate desde donde estés.</h3><p>Sigue la jornada en directo con el mismo contenido científico.</p><ul><li>Transmisión en vivo</li><li>Acceso a las seis charlas</li><li>Biblioteca digital</li><li>Constancia según perfil</li></ul><button className="secondary" onClick={() => setRegistration("virtual")}>Inscripción virtual <span>→</span></button></article>
        </div>
      </section>

      <section id="constancias" className="certificates section-pad">
        <div className="center-head"><p className="section-kicker">BENEFICIOS PARA PARTICIPANTES</p><h2>Constancias diferenciadas<br /><em>por perfil.</em></h2></div>
        <div className="certificate-grid">
          <article className="professional-certificate"><span>CONSTANCIA</span><h3>Profesionales colegiados</h3><em>Colegio de Psicólogos de Guatemala (CPG)</em><ul><li>Constancia con aval y numeración del CPG</li><li>Reconocimiento formal de horas de actualización profesional</li><li>Firma conjunta CPG</li></ul></article>
          <article><span>DIPLOMA</span><h3>Estudiantes y otras ramas de la salud</h3><em>Medicina, enfermería, trabajo social y otras carreras</em><ul><li>Diploma de participación institucional</li><li>Válido como constancia de asistencia académica</li><li>Mismo contenido científico, sin aval gremial del CPG</li></ul></article>
        </div>
      </section>

      <section id="transmision" className="live-banner section-pad"><div className="live-visual"><div className="play-lock">▶</div><span>TRANSMISIÓN PRIVADA</span></div><div><p className="section-kicker light">ENCUENTRO EN VIVO</p><h2>La sala se abrirá<br /><em>cuando sea el momento.</em></h2><p>El acceso aparecerá aquí cuando el equipo organizador active la transmisión.</p><button disabled className="secondary light-btn">Aún no disponible · 🔒</button></div></section>

      <section id="recursos" className="resources section-pad">
        <div className="section-head"><div><p className="section-kicker">BIBLIOTECA DEL ENCUENTRO</p><h2>Para seguir<br /><em>profundizando.</em></h2></div><p className="side-copy dark-copy">Materiales seleccionados por el comité académico. Algunos recursos se habilitarán durante el evento.</p></div>
        <div className="resource-grid"><article><span>GUÍA</span><h3>Cuaderno del participante</h3><p>Preguntas, notas y herramientas para acompañar tu experiencia.</p><button>Descargar PDF ↓</button></article><article><span>LECTURAS</span><h3>Selección previa</h3><p>Artículos y referencias recomendadas por los ponentes.</p><button>Explorar biblioteca →</button></article><article className="locked-resource"><span>DESPUÉS DEL EVENTO</span><h3>Grabaciones y presentaciones</h3><p>Disponible para participantes inscritos.</p><button disabled>Próximamente 🔒</button></article></div>
      </section>

      <section className="partners section-pad"><p className="section-kicker">HACEN POSIBLE ESTE ENCUENTRO</p><h2>Aliados por la salud mental.</h2><div className="logo-row"><span>MENTE ABIERTA</span><span>CLÍNICA SER</span><span>PSI·LAB</span><span>UNIVERSIDAD CENTRAL</span><span>FUNDACIÓN ESCUCHA</span></div><a href="mailto:alianzas@encuentroclinico.org">Quiero ser patrocinador <span>→</span></a></section>

      <footer><div className="footer-brand"><img className="footer-art" src="/og.png" alt="Cuando el Duelo se Detiene — Jornada Clínica sobre Duelo Prolongado" /></div><div><b>Explora</b><a href="#encuentro">La jornada</a><a href="#agenda">Agenda</a><a href="#ponentes">Ejes clínicos</a><a href="#constancias">Constancias</a></div><div><b>Participa</b><button onClick={() => setRegistration("presencial")}>Inscripción presencial</button><button onClick={() => setRegistration("virtual")}>Inscripción virtual</button><a href="mailto:alianzas@encuentroclinico.org">Patrocinios</a><a href="/admin">Administración</a></div><div><b>Mantente cerca</b><p>Recibe novedades, recursos y anuncios importantes.</p><form><input type="email" aria-label="Correo electrónico" placeholder="tu@email.com" /><button aria-label="Suscribirme">→</button></form></div><small>© 2026 Encuentro Clínico de Psicología · Chimaltenango · Privacidad · Términos</small></footer>

      {registration && <div className="modal-backdrop" role="presentation" onMouseDown={() => setRegistration(null)}><div className="registration-modal" role="dialog" aria-modal="true" aria-labelledby="reg-title" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setRegistration(null)} aria-label="Cerrar">×</button>{sent ? <div className="success"><span>✓</span><h2>Inscripción confirmada.</h2><p>Tu cuenta también quedó creada. Ingresa con tu correo y utiliza tu número de teléfono como contraseña inicial para consultar materiales y descargar tu constancia cuando esté disponible.</p><a className="primary" href="/mi-cuenta">Ir a mi cuenta</a></div> : <><p className="section-kicker">INSCRIPCIÓN {registration.toUpperCase()}</p><h2 id="reg-title">Reserva tu lugar.</h2><p>Al inscribirte crearemos tu cuenta personal. Tu usuario será tu correo electrónico y tu contraseña inicial será tu número de teléfono. La necesitarás para acceder a materiales y descargar tu constancia.</p><form onSubmit={submitRegistration} className="registration-form"><label>Nombre completo *<input required name="name" autoComplete="name" /></label><label>Correo electrónico *<input required type="email" name="email" autoComplete="email" /></label><label>Teléfono / WhatsApp *<input required minLength={8} type="tel" name="phone" autoComplete="tel" /></label><div className="check-row"><label><input type="checkbox" checked={student} onChange={e => { setStudent(e.target.checked); if (e.target.checked) setProfessional(false); }} /> Soy estudiante</label><label><input type="checkbox" checked={professional} onChange={e => { setProfessional(e.target.checked); if (e.target.checked) setStudent(false); }} /> Soy profesional</label></div>{student && <label>Universidad / centro de estudios *<input required name="university" /></label>}{professional && <><label>Profesión *<select required name="profession" defaultValue=""><option value="" disabled>Selecciona una profesión</option><option>Psicología clínica</option><option>Psicología educativa</option><option>Psicología industrial</option><option>Psiquiatría</option><option>Medicina</option><option>Trabajo social</option><option>Orientación</option><option>Otra profesión de salud</option></select></label><label>Número de colegiado *<input required name="license" /></label></>}<label>País *<select required name="country" defaultValue="Guatemala"><option>Guatemala</option><option>El Salvador</option><option>Honduras</option><option>Costa Rica</option><option>México</option><option>Otro</option></select></label><label className="consent"><input required type="checkbox" /> Acepto el tratamiento de mis datos y la creación de mi cuenta de participante.</label>{registrationError && <p className="form-error">{registrationError}</p>}<button className="primary submit" type="submit" disabled={submitting}>{submitting ? "Creando cuenta e inscripción…" : "Crear cuenta e inscribirme"} <span>→</span></button></form></>}</div></div>}
    </main>
  );
}
