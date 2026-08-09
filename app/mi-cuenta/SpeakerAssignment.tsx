import Link from "next/link";
import { programTimeLabel, type EventProgramItem } from "../../lib/event";

type AssignedProgramItem = Pick<EventProgramItem, "id" | "start_time" | "end_time" | "title" | "description">;

export type SpeakerAssignment = {
  item: AssignedProgramItem;
  talkTitle: string;
  panel: AssignedProgramItem | null;
};

export default function SpeakerAssignmentCard({ assignment }: { assignment: SpeakerAssignment | null }) {
  const item = assignment?.item;
  return <details className="account-resources speaker-account-link" open>
    <summary><span>ESPACIO DE PONENTE</span><h2>{assignment ? "Tu ponencia asignada" : "Tu espacio como ponente"} <b aria-hidden="true">+</b></h2></summary>
    <div className="account-resources-body">
      {assignment && item ? <div className="speaker-agenda">
        <article>
          <time>{programTimeLabel(item)}</time>
          <div><h3 className="preserve-newlines">{assignment.talkTitle || item.title}</h3>{item.description && <p className="preserve-newlines">{item.description}</p>}</div>
        </article>
        {assignment.panel && <article className="speaker-agenda-panel">
          <time>{programTimeLabel(assignment.panel)}</time>
          <div><h3 className="preserve-newlines">{assignment.panel.title}</h3>{assignment.panel.description && <p className="preserve-newlines">{assignment.panel.description}</p>}</div>
        </article>}
      </div> : <p className="speaker-assignment-pending">La organización todavía no ha asignado tu conferencia. En cuanto quede asignada, aquí verás el tema y el horario de tu ponencia.</p>}
      <p className="speaker-assignment-note">Al cierre de la jornada, todos los ponentes tienen un espacio para responder las preguntas de los participantes. <Link href="/preguntas">Ver las preguntas de tu conferencia →</Link></p>
    </div>
  </details>;
}
