"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";

export default function AccessPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    const result = await response.json(); setLoading(false);
    if (!response.ok) return setError(result.error ?? "No fue posible ingresar.");
    const requested = new URLSearchParams(window.location.search).get("next");
    window.location.href = requested?.startsWith("/") ? requested : result.destination;
  }
  return <main className="access-page"><section className="access-card"><Link href="/" className="access-brand"><img src="/duelo-simbolo.png" alt="" /> Encuentro Clínico</Link><p className="section-kicker">ACCESO PRIVADO</p><h1>Tu espacio del encuentro.</h1><p>Ingresa para consultar tu inscripción, materiales y constancia. Si te registraste, tu usuario es tu correo y tu contraseña inicial es tu número de teléfono.</p><form onSubmit={submit}><label>Correo electrónico<input name="email" type="email" required autoComplete="email" /></label><label>Contraseña<input name="password" type="password" required autoComplete="current-password" /></label>{error && <p className="form-error">{error}</p>}<button className="primary" disabled={loading}>{loading ? "Ingresando…" : "Ingresar"}</button></form><Link href="/#inscripciones">¿Aún no tienes cuenta? Inscríbete aquí →</Link></section></main>;
}
