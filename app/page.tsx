"use client";

import { FormEvent, useMemo, useState } from "react";

const agenda = [
  { time: "08:00", type: "Apertura", title: "Registro, café y encuentro", speaker: "Vestíbulo principal" },
  { time: "09:00", type: "Magistral", title: "La mente que sana: presencia, vínculo y cambio", speaker: "Dra. Elena Valdés · Psicología clínica" },
  { time: "10:30", type: "Panel", title: "Trauma, cuerpo y memoria: una mirada integradora", speaker: "Panel interdisciplinario" },
  { time: "12:00", type: "Pausa", title: "Almuerzo y conexión profesional", speaker: "Zona de experiencias" },
  { time: "14:00", type: "Taller", title: "Herramientas para conversaciones clínicas difíciles", speaker: "Lic. Samuel Méndez" },
  { time: "16:00", type: "Magistral", title: "Psicología en una era de inteligencia artificial", speaker: "Dra. Mariana Solís · Neuropsicología" },
  { time: "17:30", type: "Cierre", title: "Lo que nos llevamos a la práctica", speaker: "Comité académico" },
];

const speakers = [
  { initials: "EV", name: "Dra. Elena Valdés", role: "Psicóloga clínica y autora", topic: "Presencia terapéutica y cambio profundo", color: "violet" },
  { initials: "SM", name: "Lic. Samuel Méndez", role: "Especialista en trauma complejo", topic: "El cuerpo como territorio de recuperación", color: "gold" },
  { initials: "MS", name: "Dra. Mariana Solís", role: "Neuropsicóloga e investigadora", topic: "La clínica frente a la inteligencia artificial", color: "coral" },
];

export default function Home() {
  const [day, setDay] = useState("Día 1");
  const [registration, setRegistration] = useState<"presencial" | "virtual" | null>(null);
  const [professional, setProfessional] = useState(false);
  const [student, setStudent] = useState(false);
  const [sent, setSent] = useState(false);
  const visibleAgenda = useMemo(() => day === "Día 1" ? agenda : agenda.slice(1, 6).map((item, i) => ({ ...item, time: `${9 + i * 2}:00` })), [day]);

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await fetch("/api/registrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modality: registration, name: form.get("name"), email: form.get("email"), phone: form.get("phone"), attendeeType: student ? "student" : professional ? "professional" : "general", profession: form.get("profession"), license: form.get("license"), institution: form.get("university"), country: form.get("country") || "Guatemala" }) });
    setSent(true);
  }

  return (
    <main>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Inicio Encuentro Clínico">
          <span className="brand-mark">EC</span><span>ENCUENTRO<br /><b>CLÍNICO</b></span>
        </a>
        <nav aria-label="Navegación principal">
          <a href="#encuentro">El encuentro</a><a href="#agenda">Agenda</a><a href="#ponentes">Ponentes</a><a href="#recursos">Recursos</a>
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
          <p className="eyebrow"><span /> 16–17 OCTUBRE 2026 · CIUDAD DE GUATEMALA</p>
          <h1>La ciencia de<br /><em>encontrarnos.</em></h1>
          <p className="hero-copy">Dos días para volver al corazón de la práctica clínica: escuchar mejor, comprender más profundo y acompañar con humanidad.</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => setRegistration("presencial")}>Vivirlo presencial <span>↗</span></button>
            <button className="secondary" onClick={() => setRegistration("virtual")}>Participar en línea <span>→</span></button>
          </div>
          <div className="hero-meta"><span><b>02</b> días</span><span><b>18</b> voces</span><span><b>12</b> experiencias</span></div>
        </div>
        <div className="hero-stage" aria-label="Conferencia magistral ante una audiencia">
          <div className="arch arch-1" /><div className="arch arch-2" /><div className="stage-light" />
          <div className="speaker-figure"><span className="head" /><span className="body" /></div>
          <div className="audience"><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <div className="stage-caption"><span>01</span><p>PONENCIA MAGISTRAL<br /><b>Ideas que transforman la práctica</b></p></div>
        </div>
        <a className="scroll-hint" href="#encuentro">Descubrir <span>↓</span></a>
      </section>

      <section id="encuentro" className="manifesto section-pad">
        <div><p className="section-kicker">UNA EXPERIENCIA CLÍNICA VIVA</p><h2>No venimos solo a escuchar.<br /><em>Venimos a conectar.</em></h2></div>
        <div className="manifesto-copy"><p>Un espacio de aprendizaje riguroso y profundamente humano para estudiantes, profesionales y equipos de salud mental.</p><a href="#agenda">Explorar el programa <span>→</span></a></div>
        <div className="value-grid">
          <article><span>01</span><div className="line-icon">◌</div><h3>Perspectivas actuales</h3><p>Conocimiento clínico conectado con los desafíos de hoy.</p></article>
          <article><span>02</span><div className="line-icon">✦</div><h3>Herramientas aplicables</h3><p>Recursos para llevar del encuentro a la consulta.</p></article>
          <article><span>03</span><div className="line-icon">∞</div><h3>Comunidad profesional</h3><p>Conversaciones que continúan mucho después del evento.</p></article>
        </div>
      </section>

      <section id="agenda" className="agenda-section section-pad">
        <div className="section-head"><div><p className="section-kicker">PROGRAMA ACADÉMICO</p><h2>Tu ruta de<br /><em>aprendizaje.</em></h2></div><div className="day-tabs" role="tablist">{["Día 1", "Día 2"].map(d => <button key={d} role="tab" aria-selected={day === d} onClick={() => setDay(d)}>{d}<small>{d === "Día 1" ? "Viernes 16" : "Sábado 17"}</small></button>)}</div></div>
        <div className="agenda-list">{visibleAgenda.map((item, i) => <article key={item.time + item.title}><time>{item.time}</time><span className={`tag tag-${i % 3}`}>{item.type}</span><div><h3>{item.title}</h3><p>{item.speaker}</p></div><button aria-label={`Ver detalles de ${item.title}`}>+</button></article>)}</div>
        <a className="text-link" href="#recursos">Descargar agenda completa <span>↓</span></a>
      </section>

      <section id="ponentes" className="speakers-section section-pad">
        <div className="section-head"><div><p className="section-kicker light">VOCES QUE ABREN CAMINO</p><h2>Conoce a quienes<br /><em>nos harán pensar.</em></h2></div><p className="side-copy">Referentes, investigadores y profesionales que combinan evidencia, experiencia y sensibilidad humana.</p></div>
        <div className="speaker-grid">{speakers.map((speaker, i) => <article className={`speaker-card ${speaker.color}`} key={speaker.name}><div className="portrait"><div className="portrait-glow" /><span>{speaker.initials}</span><div className="portrait-number">0{i + 1}</div></div><div className="speaker-info"><p>{speaker.role}</p><h3>{speaker.name}</h3><div /><small>{speaker.topic}</small></div></article>)}</div>
        <button className="secondary light-btn">Ver todos los ponentes <span>→</span></button>
      </section>

      <section id="inscripciones" className="formats section-pad">
        <div className="center-head"><p className="section-kicker">ELIGE CÓMO VIVIRLO</p><h2>Una experiencia.<br /><em>Dos formas de estar.</em></h2></div>
        <div className="format-grid">
          <article className="format-card featured"><span className="format-label">PRESENCIAL</span><div className="format-symbol">◉</div><h3>Estar cambia todo.</h3><p>Vive las conferencias, talleres y encuentros en el mismo espacio.</p><ul><li>Acceso a todas las salas</li><li>Kit del participante</li><li>Café y espacios de conexión</li><li>Certificado de participación</li></ul><button className="primary" onClick={() => setRegistration("presencial")}>Inscripción presencial <span>→</span></button></article>
          <article className="format-card"><span className="format-label">VIRTUAL</span><div className="format-symbol">◎</div><h3>Conéctate desde donde estés.</h3><p>Transmisión de alta calidad y acceso posterior a las ponencias.</p><ul><li>Transmisión en vivo</li><li>Acceso por 30 días</li><li>Biblioteca digital</li><li>Certificado de participación</li></ul><button className="secondary" onClick={() => setRegistration("virtual")}>Inscripción virtual <span>→</span></button></article>
        </div>
      </section>

      <section id="transmision" className="live-banner section-pad"><div className="live-visual"><div className="play-lock">▶</div><span>TRANSMISIÓN PRIVADA</span></div><div><p className="section-kicker light">ENCUENTRO EN VIVO</p><h2>La sala se abrirá<br /><em>cuando sea el momento.</em></h2><p>El acceso aparecerá aquí cuando el equipo organizador active la transmisión.</p><button disabled className="secondary light-btn">Aún no disponible · 🔒</button></div></section>

      <section id="recursos" className="resources section-pad">
        <div className="section-head"><div><p className="section-kicker">BIBLIOTECA DEL ENCUENTRO</p><h2>Para seguir<br /><em>profundizando.</em></h2></div><p className="side-copy dark-copy">Materiales seleccionados por el comité académico. Algunos recursos se habilitarán durante el evento.</p></div>
        <div className="resource-grid"><article><span>GUÍA</span><h3>Cuaderno del participante</h3><p>Preguntas, notas y herramientas para acompañar tu experiencia.</p><button>Descargar PDF ↓</button></article><article><span>LECTURAS</span><h3>Selección previa</h3><p>Artículos y referencias recomendadas por los ponentes.</p><button>Explorar biblioteca →</button></article><article className="locked-resource"><span>DESPUÉS DEL EVENTO</span><h3>Grabaciones y presentaciones</h3><p>Disponible para participantes inscritos.</p><button disabled>Próximamente 🔒</button></article></div>
      </section>

      <section className="partners section-pad"><p className="section-kicker">HACEN POSIBLE ESTE ENCUENTRO</p><h2>Aliados por la salud mental.</h2><div className="logo-row"><span>MENTE ABIERTA</span><span>CLÍNICA SER</span><span>PSI·LAB</span><span>UNIVERSIDAD CENTRAL</span><span>FUNDACIÓN ESCUCHA</span></div><a href="mailto:alianzas@encuentroclinico.org">Quiero ser patrocinador <span>→</span></a></section>

      <footer><div className="footer-brand"><span className="brand-mark">EC</span><h2>Encuentro<br />Clínico de Psicología</h2></div><div><b>Explora</b><a href="#encuentro">El encuentro</a><a href="#agenda">Agenda</a><a href="#ponentes">Ponentes</a><a href="#recursos">Biblioteca</a></div><div><b>Participa</b><button onClick={() => setRegistration("presencial")}>Inscripción presencial</button><button onClick={() => setRegistration("virtual")}>Inscripción virtual</button><a href="mailto:alianzas@encuentroclinico.org">Patrocinios</a><a href="/admin">Administración</a></div><div><b>Mantente cerca</b><p>Recibe novedades, recursos y anuncios importantes.</p><form><input type="email" aria-label="Correo electrónico" placeholder="tu@email.com" /><button aria-label="Suscribirme">→</button></form></div><small>© 2026 Encuentro Clínico · Privacidad · Términos</small></footer>

      {registration && <div className="modal-backdrop" role="presentation" onMouseDown={() => setRegistration(null)}><div className="registration-modal" role="dialog" aria-modal="true" aria-labelledby="reg-title" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setRegistration(null)} aria-label="Cerrar">×</button>{sent ? <div className="success"><span>✓</span><h2>Tu lugar está en proceso.</h2><p>Recibimos tus datos para la modalidad {registration}. Pronto recibirás los siguientes pasos.</p><button className="primary" onClick={() => { setSent(false); setRegistration(null); }}>Listo</button></div> : <><p className="section-kicker">INSCRIPCIÓN {registration.toUpperCase()}</p><h2 id="reg-title">Reserva tu lugar.</h2><p>Completa tus datos. Los campos marcados son obligatorios.</p><form onSubmit={submitRegistration} className="registration-form"><label>Nombre completo *<input required name="name" autoComplete="name" /></label><label>Correo electrónico *<input required type="email" name="email" autoComplete="email" /></label><label>Teléfono / WhatsApp *<input required type="tel" name="phone" autoComplete="tel" /></label><div className="check-row"><label><input type="checkbox" checked={student} onChange={e => { setStudent(e.target.checked); if (e.target.checked) setProfessional(false); }} /> Soy estudiante</label><label><input type="checkbox" checked={professional} onChange={e => { setProfessional(e.target.checked); if (e.target.checked) setStudent(false); }} /> Soy profesional</label></div>{student && <label>Universidad / centro de estudios *<input required name="university" /></label>}{professional && <><label>Profesión *<select required defaultValue=""><option value="" disabled>Selecciona una profesión</option><option>Psicología clínica</option><option>Psicología educativa</option><option>Psicología industrial</option><option>Psiquiatría</option><option>Medicina</option><option>Trabajo social</option><option>Orientación</option><option>Otra profesión de salud</option></select></label><label>Número de colegiado *<input required name="license" /></label></>}<label>País *<select required defaultValue="Guatemala"><option>Guatemala</option><option>El Salvador</option><option>Honduras</option><option>Costa Rica</option><option>México</option><option>Otro</option></select></label><label className="consent"><input required type="checkbox" /> Acepto el tratamiento de mis datos para gestionar esta inscripción.</label><button className="primary submit" type="submit">Continuar con mi inscripción <span>→</span></button></form></>}</div></div>}
    </main>
  );
}
