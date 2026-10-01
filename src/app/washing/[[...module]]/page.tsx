import { notFound } from "next/navigation";
import StyleBulletinPage from "@/app/industrial-engineering/style-bulletin/page";
import CouponGenerationPage from "@/app/industrial-engineering/coupon-generation/page";
import CouponScanningPage from "@/app/industrial-engineering/coupon-scanning/page";
import CouponTracingPage from "@/app/industrial-engineering/coupon-tracing/page";
import ReworkCouponPage from "@/app/industrial-engineering/rework-coupon/page";
import ReportsPage from "@/app/industrial-engineering/reports/page";
import WagesPage from "@/app/industrial-engineering/reports/wages/page";
import OrderWiseReportPage from "@/app/industrial-engineering/reports/order-wise/page";
import OperatorWiseReportPage from "@/app/industrial-engineering/reports/operator-wise/page";

// One route file owns every Washing URL. The page implementations stay in
// their existing feature routes; AppShell's department context makes their
// API calls use Washing data.
const WASHING_PAGES: Record<string, React.ComponentType> = {
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

export default async function WashingModulePage({
  params,
}: {
  params: Promise<{ module?: string[] }>;
}) {
  const { module } = await params;
  const path = module?.join("/") || "style-bulletin";
  const Page = WASHING_PAGES[path];

  if (!Page) notFound();
  return <Page />;
}
