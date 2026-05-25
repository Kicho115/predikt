"use client";

import { useState } from "react";

import { DashboardView } from "@/components/DashboardView";
import { LandingPage } from "@/components/LandingPage";

export function HomeClient() {
  const [showDashboard, setShowDashboard] = useState(false);

  if (showDashboard) {
    return <DashboardView onBack={() => setShowDashboard(false)} />;
  }

  return <LandingPage onEnter={() => setShowDashboard(true)} />;
}
