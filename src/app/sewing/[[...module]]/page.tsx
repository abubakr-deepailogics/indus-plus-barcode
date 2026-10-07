import { ProductionDepartmentModulePage } from "@/features/department-routing/components/ProductionDepartmentModulePage";

export default async function SewingModulePage({
  params,
}: {
  params: Promise<{ module?: string[] }>;
}) {
  const { module } = await params;
  return <ProductionDepartmentModulePage module={module} />;
}
