import Link from "next/link";
import { programTimeLabel, type EventProgramItem } from "../../lib/event";

export type SpeakerAssignment = {
  item: Pick<EventProgramItem, "id" | "start_time" | "end_time" | "type" | "title" | "description" | "details">;
  talkTitle: string;
  eventDate: string;
  eventPlace: string;
};

export default function SpeakerAssignmentCard({ assignment }: { assignment: SpeakerAssignment | null }) {
  const item = assignment?.item;
  const topic = assignment?.talkTitle || item?.title || "";
  return <details className="account-resources speaker-account-link" open>
    <summary><span>ESPACIO DE PONENTE</span><h2>{assignment ? "Tu ponencia asignada" : "Tu espacio como ponente"} <b aria-hidden="true">+</b></h2></summary>
    <div className="account-resources-body">
      {assignment && item ? <section className="speaker-assignment" aria-labelledby="speaker-assignment-topic">
        <div className="speaker-assignment-topic">
          <span>TEMA ASIGNADO</span>
          <h3 id="speaker-assignment-topic">{topic}</h3>
          {assignment.talkTitle && assignment.talkTitle !== item.title && <p className="speaker-assignment-block">Bloque del programa: {item.title}</p>}
          {item.description && <p>{item.description}</p>}
        </div>
        <dl className="speaker-assignment-facts">
          <div><dt>Hora de inicio</dt><dd>{item.start_time || "Por confirmar"}</dd></div>
          <div><dt>Horario completo</dt><dd>{programTimeLabel(item)}</dd></div>
          <div><dt>Fecha</dt><dd>{assignment.eventDate}</dd></div>
          {(item.type || assignment.eventPlace) && <div><dt>{item.type ? "Bloque" : "Lugar"}</dt><dd>{item.type || assignment.eventPlace}</dd></div>}
        </dl>
        {item.details && <div className="speaker-assignment-detail"><h4>Detalle de la ponencia</h4><p className="preserve-newlines">{item.details}</p></div>}
      </section> : <p className="speaker-assignment-pending">La organización todavía no ha asignado tu conferencia. En cuanto quede asignada, aquí verás el tema, la hora de inicio y el detalle de tu ponencia.</p>}
      <div className="speaker-assignment-questions">
        <p>Cuando la organización active las preguntas en vivo, aquí tendrás acceso a tu bandeja para marcar las que responderás durante el panel.</p>
        <Link className="primary" href="/preguntas">Abrir preguntas recibidas</Link>
      </div>
    </div>
  </details>;
}
