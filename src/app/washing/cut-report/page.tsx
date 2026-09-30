import { WashingCutReportView } from "@/features/washing/components/WashingCutReportView";
import { RequirePermission } from "@/features/auth/components/RequirePermission";

export default function WashingCutReportPage() {
  return (
    <RequirePermission pageKey="washing-cut-report">
      <WashingCutReportView />
    </RequirePermission>
  );
}
