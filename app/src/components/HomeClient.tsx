"use client";

import { useRouter } from "next/navigation";

import { LandingPage } from "@/components/LandingPage";

export function HomeClient() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100dvh", background: "#050505" }}>
      <LandingPage onEnter={() => router.push("/dashboard")} />
    </div>
  );
}
