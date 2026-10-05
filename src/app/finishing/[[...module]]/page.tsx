import { ProductionDepartmentModulePage } from "@/features/department-routing/components/ProductionDepartmentModulePage";

export default async function FinishingModulePage({
  params,
}: {
  params: Promise<{ module?: string[] }>;
}) {
  const { module } = await params;
  return <ProductionDepartmentModulePage module={module} />;
}
