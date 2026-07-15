"use client";

import { FormEvent, useState } from "react";

export default function AccountNameEditor({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: draft }) });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { setError(result.error ?? "No se pudo actualizar el nombre."); return; }
    setName(result.name);
    setDraft(result.name);
    setEditing(false);
  }

  if (!editing) return <div className="account-name-row"><h1>Hola, {name}.</h1><button type="button" aria-label="Editar mi nombre" onClick={() => setEditing(true)}>✎</button></div>;

  return <form className="account-name-editor" onSubmit={submit}>
    <label>Corrige tu nombre<input value={draft} onChange={event => setDraft(event.target.value)} autoFocus /></label>
    {error && <p className="form-error">{error}</p>}
    <div><button className="primary" disabled={saving || draft.trim().length < 3}>{saving ? "Guardando…" : "Guardar"}</button><button className="secondary" type="button" onClick={() => { setDraft(name); setEditing(false); }}>Cancelar</button></div>
  </form>;
}
