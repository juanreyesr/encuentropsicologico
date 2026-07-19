import { requireUser } from "../../lib/auth";
import QuestionsHub from "./QuestionsHub";

export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  await requireUser("/preguntas");
  return <QuestionsHub />;
}
