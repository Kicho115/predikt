"use client";

import { MarketPredictPanel } from "@/components/MarketPredictPanel";
import styles from "./DashboardView.module.css";

type DashboardViewProps = {
  onBack: () => void;
};

export function DashboardView({ onBack }: DashboardViewProps) {
  return (
    <div className={styles.shell}>
      <MarketPredictPanel onBack={onBack} />
    </div>
  );
}
