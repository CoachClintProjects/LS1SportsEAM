import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowUpRight,
  Building2,
  Cable,
  Check,
  ClipboardCheck,
  Database,
  Fingerprint,
  Gauge,
  GitBranch,
  Landmark,
  PanelsTopLeft,
  ScrollText,
  Shield,
  ShieldCheck,
  Timer,
  Unlock,
  UserCheck,
  Users,
  Workflow,
} from 'lucide-react';

import type {
  MarketingItem,
  MarketingPricingPlan,
  MarketingSection,
  MarketingSiteData,
} from '@/lib/server/marketingSite';

interface CorporateWebsiteProps {
  data: MarketingSiteData;
}

type ThemeStyle = CSSProperties & Record<`--site-${string}`, string>;

const iconRegistry: Record<string, LucideIcon> = {
  Activity,
  Building2,
  Cable,
  Check,
  ClipboardCheck,
  Database,
  Fingerprint,
  Gauge,
  GitBranch,
  Landmark,
  PanelsTopLeft,
  ScrollText,
  Shield,
  ShieldCheck,
  Timer,
  Unlock,
  UserCheck,
  Users,
  Workflow,
};

function ItemIcon({ item }: { item: MarketingItem }) {
  const Icon = item.icon_key ? iconRegistry[item.icon_key] : undefined;
  if (!Icon) return <span className="block h-2 w-2 rounded-full bg-[var(--site-accent)]" />;
  return <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.7} />;
}

function SectionHeading({ section, maxWidth = 'max-w-3xl' }: { section: MarketingSection; maxWidth?: string }) {
  return (
    <div className={maxWidth}>
      {section.eyebrow ? (
        <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--site-accent)]">
          {section.eyebrow}
        </p>
      ) : null}
      {section.headline ? (
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.035em] text-[var(--site-text)] sm:text-4xl lg:text-5xl">
          {section.headline}
        </h2>
      ) : null}
      {section.body ? (
        <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--site-muted)] sm:text-lg sm:leading-8">
          {section.body}
        </p>
      ) : null}
    </div>
  );
}

function HeroSection({ section }: { section: MarketingSection }) {
  const primaryLabel = typeof section.settings.primary_cta_label === 'string' ? section.settings.primary_cta_label : null;
  const primaryHref = typeof section.settings.primary_cta_href === 'string' ? section.settings.primary_cta_href : null;
  const secondaryLabel = typeof section.settings.secondary_cta_label === 'string' ? section.settings.secondary_cta_label : null;
  const secondaryHref = typeof section.settings.secondary_cta_href === 'string' ? section.settings.secondary_cta_href : null;

  return (
    <section id={section.section_key} className="relative overflow-hidden border-b border-[var(--site-line)]">
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true">
        <div className="absolute right-[-18rem] top-[-18rem] h-[38rem] w-[38rem] rounded-full border border-[var(--site-line)]" />
        <div className="absolute right-[-9rem] top-[-9rem] h-[24rem] w-[24rem] rounded-full border border-[var(--site-line)]" />
      </div>
      <div className="relative mx-auto grid min-h-[760px] max-w-[var(--site-max)] items-center gap-16 px-6 pb-20 pt-32 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:pb-28 lg:pt-36">
        <div>
          {section.eyebrow ? (
            <p className="mb-7 text-[11px] font-bold uppercase tracking-[0.26em] text-[var(--site-accent)]">
              {section.eyebrow}
            </p>
          ) : null}
          <h1 className="max-w-5xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-[var(--site-text)] sm:text-6xl lg:text-7xl xl:text-[5.35rem]">
            {section.headline}
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-[var(--site-muted)] sm:text-xl">
            {section.body}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            {primaryLabel && primaryHref ? (
              <a
                href={primaryHref}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--site-accent)] px-6 py-3.5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                {primaryLabel}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : null}
            {secondaryLabel && secondaryHref ? (
              <a
                href={secondaryHref}
                className="inline-flex items-center rounded-full border border-[var(--site-line)] bg-[var(--site-surface)] px-6 py-3.5 text-sm font-semibold text-[var(--site-text)] transition hover:border-[var(--site-muted)]"
              >
                {secondaryLabel}
              </a>
            ) : null}
          </div>
        </div>

        <div className="relative lg:justify-self-end">
          <div className="w-full max-w-md border border-[var(--site-line)] bg-[var(--site-surface)] p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-[var(--site-line)] pb-5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--site-muted)]">Operating model</span>
              <span className="h-2 w-2 rounded-full bg-[var(--site-accent)]" />
            </div>
            <div className="space-y-0 py-2">
              {section.items.map((item, index) => (
                <div key={item.id} className="grid grid-cols-[42px_1fr] gap-4 border-b border-[var(--site-line)] py-5 last:border-b-0">
                  <span className="pt-0.5 text-xs tabular-nums text-[var(--site-muted)]">0{index + 1}</span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--site-text)]">{item.title}</p>
                    {item.description ? <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">{item.description}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatementSection({ section }: { section: MarketingSection }) {
  return (
    <section id={section.section_key} className="border-b border-[var(--site-line)] bg-[var(--site-surface)]">
      <div className="mx-auto max-w-[var(--site-max)] px-6 py-24 lg:px-10 lg:py-32">
        <SectionHeading section={section} maxWidth="max-w-5xl" />
      </div>
    </section>
  );
}

function FeatureGridSection({ section }: { section: MarketingSection }) {
  return (
    <section id={section.section_key} className="border-b border-[var(--site-line)]">
      <div className="mx-auto max-w-[var(--site-max)] px-6 py-24 lg:px-10 lg:py-32">
        <SectionHeading section={section} />
        <div className="mt-16 grid border-l border-t border-[var(--site-line)] sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map((item) => (
            <article key={item.id} className="min-h-64 border-b border-r border-[var(--site-line)] p-7 sm:p-8">
              <div className="mb-12 flex h-10 w-10 items-center justify-center border border-[var(--site-line)] text-[var(--site-accent)]">
                <ItemIcon item={item} />
              </div>
              {item.kicker ? <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--site-muted)]">{item.kicker}</p> : null}
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-[var(--site-text)]">{item.title}</h3>
              {item.description ? <p className="mt-4 text-sm leading-6 text-[var(--site-muted)]">{item.description}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RoleGridSection({ section }: { section: MarketingSection }) {
  return (
    <section id={section.section_key} className="border-b border-[var(--site-line)] bg-[var(--site-surface-alt)]">
      <div className="mx-auto max-w-[var(--site-max)] px-6 py-24 lg:px-10 lg:py-32">
        <SectionHeading section={section} />
        <div className="mt-16 grid gap-px overflow-hidden border border-[var(--site-line)] bg-[var(--site-line)] sm:grid-cols-2 lg:grid-cols-4">
          {section.items.map((item) => (
            <article key={item.id} className="bg-[var(--site-bg)] p-6 sm:p-7">
              <div className="mb-8 h-px w-8 bg-[var(--site-accent)]" />
              <h3 className="text-base font-semibold text-[var(--site-text)]">{item.title}</h3>
              {item.description ? <p className="mt-3 text-sm leading-6 text-[var(--site-muted)]">{item.description}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArchitectureSection({ section }: { section: MarketingSection }) {
  return (
    <section id={section.section_key} className="border-b border-[var(--site-line)]">
      <div className="mx-auto grid max-w-[var(--site-max)] gap-16 px-6 py-24 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-32">
        <SectionHeading section={section} />
        <div className="grid gap-px border border-[var(--site-line)] bg-[var(--site-line)] sm:grid-cols-2">
          {section.items.map((item) => (
            <article key={item.id} className="bg-[var(--site-surface)] p-6">
              <div className="flex items-center gap-3 text-[var(--site-accent)]">
                <ItemIcon item={item} />
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--site-muted)]">{item.item_key}</span>
              </div>
              <h3 className="mt-8 text-lg font-semibold text-[var(--site-text)]">{item.title}</h3>
              {item.description ? <p className="mt-3 text-sm leading-6 text-[var(--site-muted)]">{item.description}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SplitSection({ section }: { section: MarketingSection }) {
  return (
    <section id={section.section_key} className="border-b border-[var(--site-line)] bg-[var(--site-surface)]">
      <div className="mx-auto grid max-w-[var(--site-max)] gap-16 px-6 py-24 lg:grid-cols-2 lg:px-10 lg:py-32">
        <SectionHeading section={section} />
        <div className="space-y-4 lg:pt-8">
          {section.items.map((item) => (
            <article key={item.id} className="border border-[var(--site-line)] bg-[var(--site-bg)] p-6">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 text-[var(--site-accent)]"><ItemIcon item={item} /></div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--site-text)]">{item.title}</h3>
                  {item.description ? <p className="mt-2 text-sm leading-6 text-[var(--site-muted)]">{item.description}</p> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingCard({ plan, features }: { plan: MarketingPricingPlan; features: MarketingItem[] }) {
  const amount = plan.price_amount == null
    ? null
    : new Intl.NumberFormat('en-CA', { style: 'currency', currency: plan.currency_code, maximumFractionDigits: 0 }).format(plan.price_amount);

  return (
    <div className="grid overflow-hidden border border-[var(--site-line)] bg-[var(--site-surface)] lg:grid-cols-[0.85fr_1.15fr]">
      <div className="border-b border-[var(--site-line)] p-8 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--site-muted)]">{plan.name}</p>
        <p className="mt-8 text-4xl font-semibold tracking-[-0.04em] text-[var(--site-text)] sm:text-5xl">{amount ?? plan.price_label}</p>
        {amount && plan.billing_period ? <p className="mt-2 text-sm text-[var(--site-muted)]">{plan.billing_period}</p> : null}
        <p className="mt-6 max-w-md text-sm leading-7 text-[var(--site-muted)]">{plan.description}</p>
        <a
          href={plan.cta_href}
          className="mt-9 inline-flex items-center gap-2 rounded-full bg-[var(--site-accent)] px-6 py-3.5 text-sm font-semibold text-white transition hover:brightness-110"
        >
          {plan.cta_label}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
      <div className="p-8 sm:p-10 lg:p-12">
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {features.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--site-accent)]" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-[var(--site-text)]">{item.title}</p>
                {item.description && item.description !== item.value ? <p className="mt-1 text-xs leading-5 text-[var(--site-muted)]">{item.description}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PricingSection({ section, pricing }: { section: MarketingSection; pricing: MarketingPricingPlan[] }) {
  return (
    <section id={section.section_key} className="border-b border-[var(--site-line)]">
      <div className="mx-auto max-w-[var(--site-max)] px-6 py-24 lg:px-10 lg:py-32">
        <SectionHeading section={section} maxWidth="max-w-4xl" />
        <div className="mt-14 space-y-6">
          {pricing.map((plan) => <PricingCard key={plan.id} plan={plan} features={section.items} />)}
        </div>
      </div>
    </section>
  );
}

function ClosingSection({ section }: { section: MarketingSection }) {
  const label = typeof section.settings.primary_cta_label === 'string' ? section.settings.primary_cta_label : null;
  const href = typeof section.settings.primary_cta_href === 'string' ? section.settings.primary_cta_href : null;

  return (
    <section id={section.section_key} className="bg-[var(--site-accent-soft)]">
      <div className="mx-auto max-w-[var(--site-max)] px-6 py-24 lg:px-10 lg:py-32">
        <div className="grid items-end gap-10 lg:grid-cols-[1fr_auto]">
          <SectionHeading section={section} maxWidth="max-w-4xl" />
          {label && href ? (
            <a href={href} className="inline-flex items-center gap-2 rounded-full bg-[var(--site-text)] px-6 py-3.5 text-sm font-semibold text-[var(--site-bg)] transition hover:opacity-90">
              {label}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function renderSection(section: MarketingSection, pricing: MarketingPricingPlan[]) {
  switch (section.section_type) {
    case 'hero':
      return <HeroSection key={section.id} section={section} />;
    case 'statement':
      return <StatementSection key={section.id} section={section} />;
    case 'feature_grid':
      return <FeatureGridSection key={section.id} section={section} />;
    case 'role_grid':
      return <RoleGridSection key={section.id} section={section} />;
    case 'architecture':
      return <ArchitectureSection key={section.id} section={section} />;
    case 'split':
      return <SplitSection key={section.id} section={section} />;
    case 'pricing':
      return <PricingSection key={section.id} section={section} pricing={pricing} />;
    case 'cta':
      return <ClosingSection key={section.id} section={section} />;
    default:
      return <StatementSection key={section.id} section={section} />;
  }
}

export function CorporateWebsite({ data }: CorporateWebsiteProps) {
  const { site, navigation, sections, pricing } = data;
  const theme = site.theme;
  const style: ThemeStyle = {
    '--site-bg': theme.background ?? '#070A09',
    '--site-surface': theme.surface ?? '#0E1210',
    '--site-surface-alt': theme.surface_alt ?? '#121714',
    '--site-line': theme.line ?? '#242B26',
    '--site-text': theme.text ?? '#F5F5F0',
    '--site-muted': theme.muted ?? '#9CA49E',
    '--site-accent': theme.accent ?? '#FA4616',
    '--site-accent-soft': theme.accent_soft ?? '#2B140C',
    '--site-max': theme.max_width ?? '1180px',
    backgroundColor: 'var(--site-bg)',
    color: 'var(--site-text)',
  };

  const navLinks = navigation.filter((item) => item.item_type === 'link');
  const navCtas = navigation.filter((item) => item.item_type === 'cta');

  return (
    <div style={style} className="min-h-screen w-full bg-[var(--site-bg)] text-[var(--site-text)]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--site-line)] bg-[var(--site-bg)] backdrop-blur">
        <div className="mx-auto flex h-20 max-w-[var(--site-max)] items-center justify-between gap-6 px-6 lg:px-10">
          <a href="#hero" className="flex items-center gap-3" aria-label={`${site.brand_name} home`}>
            <span className="h-2.5 w-2.5 bg-[var(--site-accent)]" aria-hidden="true" />
            <span className="text-sm font-black tracking-[0.08em] text-[var(--site-text)]">{site.wordmark}</span>
          </a>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Corporate navigation">
            {navLinks.map((item) => (
              <a key={item.id} href={item.href} className="text-sm font-medium text-[var(--site-muted)] transition hover:text-[var(--site-text)]">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {navCtas.map((item) => (
              <a key={item.id} href={item.href} className="inline-flex items-center gap-2 rounded-full border border-[var(--site-line)] px-4 py-2.5 text-xs font-semibold text-[var(--site-text)] transition hover:border-[var(--site-muted)] sm:px-5 sm:text-sm">
                {item.label}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </header>

      <main>{sections.map((section) => renderSection(section, pricing))}</main>

      <footer className="border-t border-[var(--site-line)] bg-[var(--site-bg)]">
        <div className="mx-auto flex max-w-[var(--site-max)] flex-col gap-8 px-6 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 bg-[var(--site-accent)]" aria-hidden="true" />
            <span className="text-xs font-black tracking-[0.08em] text-[var(--site-text)]">{site.wordmark}</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {navLinks.map((item) => (
              <a key={item.id} href={item.href} className="text-xs text-[var(--site-muted)] transition hover:text-[var(--site-text)]">
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
