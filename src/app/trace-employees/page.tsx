import { RequirePermission } from "@/features/auth/components/RequirePermission";
import { TraceEmployeesWorkspace } from "@/features/dummy-employees/components/TraceEmployeesWorkspace";

export default function TraceEmployeesPage() {
  return <RequirePermission pageKey="reports"><TraceEmployeesWorkspace /></RequirePermission>;
}
