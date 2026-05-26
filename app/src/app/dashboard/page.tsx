"use client";

import { useRouter } from "next/navigation";
import { DashboardView } from "@/components/DashboardView";

export default function DashboardPage() {
  const router = useRouter();

  return <DashboardView onBack={() => router.push("/home")} />;
}
