import { MarketPredictPanel } from "@/components/MarketPredictPanel";

export default function Home() {
  return (
    <div className="pageShell">
      <header>
        <h1 className="pageTitle">Predikt</h1>
        <p className="pageSubtitle">
          Mercados activos en Polymarket y envío al servicio de inferencia (configura{" "}
          <code className="pageCode">INFERENCE_API_URL</code>).
        </p>
      </header>
      <MarketPredictPanel />
    </div>
  );
}
