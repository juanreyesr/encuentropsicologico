/**
 * Vista previa de un módulo todavía cerrado. El equipo organizador lo ve para
 * saber de antemano lo que tendrá en su cuenta, sin poder usarlo hasta que la
 * organización lo habilite desde el panel.
 */
export default function LockedModule({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return <details className="account-resources locked-module">
    <summary><span>{kicker}</span><h2>{title}<b aria-hidden="true">+</b></h2></summary>
    <div className="account-resources-body">
      <p className="locked-note"><b>Aún no disponible.</b> Se habilitará cuando la organización lo abra.</p>
      {children}
    </div>
  </details>;
}
