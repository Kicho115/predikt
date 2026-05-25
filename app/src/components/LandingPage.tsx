"use client";

import styles from "./LandingPage.module.css";

type LandingPageProps = {
  onEnter: () => void;
};

type FeatureIconType = "chart" | "ai" | "bolt" | "shield" | "search" | "code";

const STATS = [
  { value: "200+", label: "Active markets" },
  { value: "ML", label: "Real-time inference" },
  { value: "API", label: "Flexible integration" },
  { value: "JSON", label: "Structured responses" },
];

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
    a: "A panel to explore Polymarket markets and send predictions to your own machine learning service.",
  },
  {
    q: "Do I need to configure anything?",
    a: "Yes. Set the INFERENCE_API_URL variable pointing to your inference API to receive predictions.",
  },
  {
    q: "Does Predikt manage my wallet?",
    a: "No. It only reads public market data and sends it to your API. It never touches funds or private keys.",
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

function HeroVisual() {
  return (
    <div className={styles.heroVisual} aria-hidden="true">
      <div className={styles.heroCardStack}>
        <div className={styles.heroCardMain}>
          <div className={styles.heroCardGrain} />
          <div className={styles.heroCardGlow} />
          <div className={styles.heroCardContent}>
            <span className={styles.heroCardStat}>200+</span>
            <p className={styles.heroCardCaption}>
              Glass gradients and patterns for your prediction insights.
            </p>
            <span className={styles.heroCardArrow}>
              <ArrowUpRight />
            </span>
          </div>
          <div className={styles.heroCardGrid}>
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={styles.heroCardBar} style={{ height: `${35 + (i % 3) * 22}%` }} />
            ))}
          </div>
        </div>
        <div className={styles.heroCardSide}>
          <div className={styles.heroCardSideGradient} />
          <span className={styles.heroCardSideLabel}>ML</span>
        </div>
      </div>
    </div>
  );
}

export function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <div className={styles.landing}>
      <header className={styles.heroZone}>
        <nav className={styles.nav}>
          <NavBrand />
          <NavLinks />
          <button type="button" className={styles.navCta} onClick={onEnter}>
            Get started
          </button>
        </nav>

        <div className={styles.heroLayout}>
          <main className={styles.heroContent}>
            <h1 className={styles.headline}>
              From raw data to{" "}
              <em className={styles.headlineEm}>market direction</em>
            </h1>

            <p className={styles.subheadline}>
              Gain valuable insights and predictions on ups and downs for
              prediction markets like{" "}
              <em className={styles.subheadlineEm}>Polymarket</em> or{" "}
              <em className={styles.subheadlineEm}>Kalshi</em> from Machine and
              Deep Learning Models.
            </p>

            <div className={styles.heroActions}>
              <button type="button" className={styles.heroCtaOutline} onClick={onEnter}>
                Get started
                <ArrowUpRight className={styles.heroCtaIcon} />
              </button>
            </div>
          </main>

          <HeroVisual />
        </div>
      </header>

      <section aria-label="Metrics" className={styles.section}>
        <div className={styles.stats}>
          {STATS.map((stat) => (
            <div key={stat.label} className={styles.statItem}>
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

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

      <section id="how" className={styles.section}>
        <SectionHeader
          eyebrow="How it works"
          title="From market to prediction"
          titleItalic="in three steps"
          subtitle="A simple, transparent pipeline for your machine learning workflow."
        />
        <StepsSection />
      </section>

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

      <section className={styles.section}>
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
      <a href="#features" className={styles.navLinkAccent}>
        Features
      </a>
      <a href="#how" className={styles.navLink}>
        How it works
      </a>
      <a href="#faq" className={styles.navLink}>
        FAQ
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
      <span className={styles.navLogoBadge} aria-hidden="true">
        <CrystalBallIcon />
      </span>
      <span className={styles.navTitle}>Predikt</span>
    </div>
  );
}
