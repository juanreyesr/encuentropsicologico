import { requireAdmin } from "../../lib/auth";
import AdminDashboard from "./AdminDashboard";
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdmin();
  return <AdminDashboard userName={user.email} />;
}
