"use client";

import { MarketPredictPanel } from "@/components/MarketPredictPanel";
import styles from "./DashboardView.module.css";

type DashboardViewProps = {
  onBack: () => void;
};

function CrystalBallIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="10" r="5.5" />
      <path d="M8 18h8M9.5 18c.5-1.2 1.6-2 2.5-2s2 .8 2.5 2" strokeLinecap="round" />
      <path d="M9 8l1 1M15 8l-1 1M12 6v1" strokeLinecap="round" />
      <path d="M7 5l.8.8M17 5l-.8.8" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function DashboardView({ onBack }: DashboardViewProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.brand}>
            <span className={styles.logoBadge} aria-hidden="true">
              <CrystalBallIcon />
            </span>
            <div>
              <h1 className={styles.title}>Predikt</h1>
              <p className={styles.subtitle}>
                Active Polymarket markets and inference delivery. Set{" "}
                <code className={styles.code}>INFERENCE_API_URL</code> in your env.
              </p>
            </div>
          </div>
          <button type="button" className={styles.backBtn} onClick={onBack}>
            Back to home
          </button>
        </div>
      </header>
      <MarketPredictPanel />
    </div>
  );
}
