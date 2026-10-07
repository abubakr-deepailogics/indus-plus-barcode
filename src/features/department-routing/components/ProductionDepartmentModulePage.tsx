import { notFound } from "next/navigation";
import CutReportPage from "@/app/industrial-engineering/cut-report/page";
import StyleBulletinPage from "@/app/industrial-engineering/style-bulletin/page";
import CouponGenerationPage from "@/app/industrial-engineering/coupon-generation/page";
import CouponScanningPage from "@/app/industrial-engineering/coupon-scanning/page";
import CouponTracingPage from "@/app/industrial-engineering/coupon-tracing/page";
import ReworkCouponPage from "@/app/industrial-engineering/rework-coupon/page";
import ReportsPage from "@/app/industrial-engineering/reports/page";
import WagesPage from "@/app/industrial-engineering/reports/wages/page";
import OrderWiseReportPage from "@/app/industrial-engineering/reports/order-wise/page";
import OperatorWiseReportPage from "@/app/industrial-engineering/reports/operator-wise/page";

// Washing and Finishing have their own URLs but share these proven page
// implementations. DepartmentContext derives ownership from the URL, so all
// API calls stay department-scoped without copying feature code per module.
const PRODUCTION_MODULE_PAGES: Record<string, React.ComponentType> = {
  "cut-report": CutReportPage,
  "style-bulletin": StyleBulletinPage,
  "coupon-generation": CouponGenerationPage,
  "coupon-scanning": CouponScanningPage,
  "coupon-tracing": CouponTracingPage,
  "rework-coupon": ReworkCouponPage,
  reports: ReportsPage,
  "reports/wages": WagesPage,
  "reports/order-wise": OrderWiseReportPage,
  "reports/operator-wise": OperatorWiseReportPage,
};

export function ProductionDepartmentModulePage({
  module,
}: {
  module?: string[];
}) {
  const path = module?.join("/") || "style-bulletin";
  const Page = PRODUCTION_MODULE_PAGES[path];
  if (!Page) notFound();
  return <Page />;
}
