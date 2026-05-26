"use client";

import { HeroTerrain } from "./HeroTerrain";
import styles from "./LandingPage.module.css";

type LandingPageProps = {
  onEnter: () => void;
};

type FeatureIconType = "chart" | "ai" | "bolt" | "shield" | "search" | "code";

const STEPS = [
  {
    step: "01",
    title: "Explore markets",
    description:
      "Browse hundreds of active Polymarket markets with instant search by title or slug.",
  },
  {
    step: "02",
    title: "Select and analyze",
    description:
      "Review volume, CLOB tokens, and market metadata before sending to your model.",
  },
  {
    step: "03",
    title: "Predict with ML",
    description:
      "Send the market to your inference service and get probabilities in seconds.",
  },
];

const FAQS = [
  {
    q: "What is Predikt?",
    a: "Predikt is a dashboard to explore active Polymarket markets and send selected markets to your own machine learning inference service for probability estimates.",
  },
  {
    q: "Do I need to configure anything?",
    a: "Yes. Set the INFERENCE_API_URL environment variable to the URL of your prediction API. Without it, the panel can still browse markets but cannot run predictions.",
  },
  {
    q: "Does Predikt manage my wallet?",
    a: "No. Predikt only reads public market data from Polymarket and forwards your selection to your API. It never holds funds, signs transactions, or accesses private keys.",
  },
  {
    q: "Do I need a Polymarket account?",
    a: "No account is required to browse markets or run predictions in Predikt. Trading on Polymarket itself is separate and handled on polymarket.com.",
  },
  {
    q: "What data is sent to my inference API?",
    a: "When you click predict, Predikt sends a JSON payload with the market question, slug, volume, and CLOB token IDs—the same fields exposed by the public Gamma API.",
  },
  {
    q: "What should my inference API return?",
    a: "Your service should respond with JSON your model defines—typically outcome probabilities or a structured prediction. Predikt displays the raw response in the panel so you can validate outputs quickly.",
  },
  {
    q: "Can I use my own ML or deep learning model?",
    a: "Yes. Predikt is model-agnostic: any HTTP endpoint that accepts the market payload and returns JSON can power predictions, from scikit-learn to PyTorch or custom ensembles.",
  },
  {
    q: "How often is market data updated?",
    a: "Markets are loaded from the Polymarket Gamma API when you open the dashboard. Refresh the page or re-enter the panel to pull the latest active market list.",
  },
  {
    q: "Is Predikt free to use?",
    a: "The Predikt frontend is free to run locally or deploy yourself. You may incur costs from hosting your inference API, Polymarket rate limits, or any cloud resources you attach.",
  },
  {
    q: "Can I search markets by keyword?",
    a: "Yes. The dashboard search filters the loaded market list by title or slug as you type, so you can find specific events without scrolling the full catalog.",
  },
];

function ArrowUpRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M4 12L12 4M12 4H6M12 4V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  titleItalic,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  titleItalic?: string;
}) {
  return (
    <header className={styles.sectionHeader}>
      <span className={styles.sectionEyebrow}>{eyebrow}</span>
      <h2 className={styles.sectionTitle}>
        {title}
        {titleItalic ? (
          <>
            {" "}
            <em className={styles.sectionTitleEm}>{titleItalic}</em>
          </>
        ) : null}
      </h2>
      <p className={styles.sectionSubtitle}>{subtitle}</p>
    </header>
  );
}

function PreviewRow({ active }: { active?: boolean }) {
  return (
    <div className={`${styles.previewRow} ${active ? styles.previewRowActive : ""}`}>
      <div className={styles.previewRowTitle} />
      <div className={styles.previewRowSlug} />
    </div>
  );
}

function PreviewRows() {
  return (
    <>
      <PreviewRow active />
      <PreviewRow />
      <PreviewRow />
      <PreviewRow />
    </>
  );
}

function FeatureIcon({ type }: { type: FeatureIconType }) {
  if (type === "chart") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19V5M4 19h16M8 17V9M12 17V7M16 17v-4" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "ai") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "bolt") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "shield") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "search") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3-3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 9l-4 4 4 4M16 9l4 4-4 4M14 5l-4 14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: FeatureIconType;
  title: string;
  description: string;
}) {
  return (
    <div className={styles.featureCard}>
      <span className={styles.featureIcon} aria-hidden="true">
        <FeatureIcon type={icon} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <div className={styles.landing}>
      <div className={styles.landingBackdrop} aria-hidden="true">
        <span className={styles.backdropBase} />
        <span className={styles.backdropGlow} />
        <span className={styles.backdropGrid} />
        <span className={styles.backdropNoise} />
      </div>

      <header className={styles.heroZone}>
        <nav className={styles.nav} aria-label="Main">
          <NavBrand />
          <NavLinks />
          <button type="button" className={styles.navCta} onClick={onEnter}>
            Sign In
          </button>
        </nav>

        <div className={styles.heroLayout}>
          <main className={styles.heroContent}>
            <h1 className={styles.headline}>
              <span className={styles.headlineBold}>From raw data to</span>{" "}
              <em className={styles.headlineEm}>market direction</em>
            </h1>

            <p className={styles.subheadline}>
              Gain valuable insights and predictions on up and downs for Polymarket
              from Machine and Deep Learning Models.
            </p>

            <button type="button" className={styles.heroCtaPrimary} onClick={onEnter}>
              Get Started FREE
            </button>
          </main>
        </div>

        <HeroTerrain />
      </header>

      <div className={styles.sectionRule} aria-hidden="true" />

      <section id="features" className={styles.section}>
        <SectionHeader
          eyebrow="Features"
          title="Everything you need"
          titleItalic="to predict"
          subtitle="A complete flow from market exploration to your model's response."
        />
        <div className={styles.features}>
          <FeatureCard icon="chart" title="Live markets" description="Updated list of active markets with search by title or slug." />
          <FeatureCard icon="ai" title="ML inference" description="Send any selected market to your configured prediction API." />
          <FeatureCard icon="bolt" title="Instant response" description="View your model's JSON response directly in the panel." />
          <FeatureCard icon="shield" title="Non-custodial" description="Read-only public data. Your wallet and funds never go through Predikt." />
          <FeatureCard icon="search" title="Fast search" description="Filter hundreds of markets in milliseconds as you type." />
          <FeatureCard icon="code" title="API ready" description="Connect INFERENCE_API_URL and get predictions with one click." />
        </div>
      </section>

      <div className={styles.sectionRule} aria-hidden="true" />

      <section id="how" className={styles.section}>
        <SectionHeader
          eyebrow="How it works"
          title="From market to prediction"
          titleItalic="in three steps"
          subtitle="A simple, transparent pipeline for your machine learning workflow."
        />
        <StepsSection />
      </section>

      <div className={styles.sectionRule} aria-hidden="true" />

      <section className={styles.section}>
        <SectionHeader
          eyebrow="Preview"
          title="This is what"
          titleItalic="your panel looks like"
          subtitle="A modern horizontal interface with real-time data."
        />
        <div className={styles.preview}>
          <div className={styles.previewSidebar}>
            <div className={styles.previewBar} />
            <PreviewRows />
          </div>
          <div className={styles.previewDetail}>
            <div className={styles.previewDetailHeader} />
            <div className={styles.previewGrid}>
              <div className={styles.previewCell} />
              <div className={styles.previewCell} />
              <div className={`${styles.previewCell} ${styles.previewCellWide}`} />
            </div>
            <button type="button" className={styles.previewBtn} onClick={onEnter}>
              Open live panel
            </button>
          </div>
        </div>
      </section>

      <div className={styles.sectionRule} aria-hidden="true" />

      <section className={styles.section}>
        <div className={styles.integrations}>
          <div className={styles.integrationsText}>
            <span className={styles.sectionEyebrow}>Integrations</span>
            <h2 className={styles.sectionTitle}>
              Connected to <em className={styles.sectionTitleEm}>your stack</em>
            </h2>
            <p className={styles.sectionSubtitle}>
              Predikt uses the public Polymarket API and forwards selected
              markets to your inference endpoint via POST.
            </p>
            <ul className={styles.integrationList}>
              <li>
                <strong>Polymarket Gamma API</strong> — active markets
              </li>
              <li>
                <strong>INFERENCE_API_URL</strong> — your ML model
              </li>
              <li>
                <strong>Next.js</strong> - frontend y API routes
              </li>
            </ul>
          </div>
          <div className={styles.codeBlock}>
            <span className={styles.codeLabel}>POST /api/predict</span>
            <pre className={styles.codePre}>{`{
  "market": {
    "question": "Will X happen?",
    "slug": "will-x-happen",
    "volume": 1250000,
    "clobTokenIds": ["0x...", "0x..."]
  }
}`}</pre>
          </div>
        </div>
      </section>

      <div className={styles.sectionRule} aria-hidden="true" />

      <section id="faq" className={styles.section}>
        <SectionHeader
          eyebrow="FAQ"
          title="Frequently asked"
          titleItalic="questions"
          subtitle="Quick answers on how to use Predikt in your project."
        />
        <div className={styles.faqList}>
          {FAQS.map((item) => (
            <details key={item.q} className={styles.faqItem}>
              <summary className={styles.faqQuestion}>{item.q}</summary>
              <p className={styles.faqAnswer}>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionCta}`}>
        <div className={styles.ctaBand}>
          <h2 className={styles.ctaBandTitle}>
            Ready to explore <em className={styles.sectionTitleEm}>markets</em>?
          </h2>
          <p className={styles.ctaBandText}>
            Open the panel, pick a market, and send your first prediction.
          </p>
          <button type="button" className={styles.ctaBandBtn} onClick={onEnter}>
            Get started
            <ArrowUpRight className={styles.heroCtaIcon} />
          </button>
        </div>
      </section>

      <footer className={styles.footer}>
        <span className={styles.footerBrand}>Predikt</span>
        <span className={styles.footerCopy}>
          Prediction markets + Machine Learning
        </span>
      </footer>
    </div>
  );
}

function NavLinks() {
  return (
    <div className={styles.navLinks}>
      <a href="#features" className={styles.navLink}>
        Features
      </a>
      <a href="#faq" className={styles.navLink}>
        FAQs
      </a>
    </div>
  );
}

function StepsSection() {
  return (
    <div className={styles.steps}>
      {STEPS.map((item) => (
        <article key={item.step} className={styles.stepCard}>
          <span className={styles.stepNumber}>{item.step}</span>
          <h3 className={styles.stepTitle}>{item.title}</h3>
          <p className={styles.stepDesc}>{item.description}</p>
        </article>
      ))}
    </div>
  );
}

function NavBrand() {
  return (
    <div className={styles.navBrand}>
      {/* Native img avoids Next/Image + CSS module className hydration mismatch on SSR */}
      <img
        src="/Predikt.png"
        alt="Predikt"
        width={320}
        height={86}
        className={styles.navLogo}
        decoding="async"
      />
    </div>
  );
}
