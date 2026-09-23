import { WagesPage } from "@/features/wages/components/WagesPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wages",
  description: "Search, create, and manage employee wage batches by title or tenure",
};

export default function WagesRoute() {
  return <WagesPage />;
}
