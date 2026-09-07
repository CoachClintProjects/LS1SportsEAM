import Link from 'next/link';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import type { CorporateSite } from '@/lib/server/corporateSite';

function ActionLink({ action, primary = false }: { action: { label: string; href: string }; primary?: boolean }) {
  return (
    <Link
      href={action.href}
      className={primary
        ? 'inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:bg-neutral-200'
        : 'inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white transition hover:border-white/30 hover:bg-white/[0.04]'}
    >
      {action.label}
      <ArrowRight className="h-4 w-4" strokeWidth={2} />
    </Link>
  );
}

function Price({ amount, currency, period, label }: { amount: number | null; currency: string | null; period: string | null; label: string | null }) {
  if (amount === null) return label ? <div className="text-3xl font-black tracking-[-0.03em] text-white">{label}</div> : null;
  const formatted = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency ?? 'CAD',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
  return (
    <div className="flex items-end gap-2">
      <div className="text-4xl font-black tracking-[-0.04em] text-white">{formatted}</div>
      {period ? <div className="pb-1 text-sm text-neutral-500">/{period}</div> : null}
    </div>
  );
}

export function CorporateSitePage({ site }: { site: CorporateSite }) {
  const { brand, navigation, primaryCta, loginCta, footerStatement, page, pricingPlans } = site;

  return (
    <div className="min-h-screen bg-[#050706] text-white">
      <div className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.07] bg-[#050706]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-3" aria-label={brand.name}>
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-[11px] font-black tracking-[-0.04em]" style={{ color: brand.accent }}>
              {brand.mark}
            </div>
            <div>
              <div className="text-sm font-black tracking-[-0.02em]">{brand.name}</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-500">{brand.descriptor}</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Corporate navigation">
            {navigation.map((item) => (
              <Link key={item.code} href={item.href} className="text-xs font-semibold text-neutral-400 transition hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href={loginCta.href} className="hidden rounded-full px-4 py-2 text-xs font-bold text-neutral-300 transition hover:bg-white/[0.05] hover:text-white sm:inline-flex">
              {loginCta.label}
            </Link>
            <Link href={primaryCta.href} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-black transition hover:bg-neutral-200">
              {primaryCta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <main>
        <section className="relative overflow-hidden border-b border-white/[0.07] pt-[72px]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(250,70,22,0.10),transparent_32%),radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.04),transparent_30%)]" />
          <div className="relative mx-auto grid min-h-[650px] max-w-7xl items-center gap-16 px-5 py-24 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:px-10 lg:py-28">
            <div className="max-w-3xl">
              {page.eyebrow ? <div className="mb-6 text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: brand.accent }}>{page.eyebrow}</div> : null}
              <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.055em] sm:text-6xl lg:text-7xl">{page.title}</h1>
              {page.summary ? <p className="mt-7 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg sm:leading-8">{page.summary}</p> : null}
              <div className="mt-9 flex flex-wrap gap-3">
                <ActionLink action={primaryCta} primary />
                {page.slug !== 'platform' ? <ActionLink action={{ label: navigation.find((item) => item.code === 'PLATFORM')?.label ?? brand.descriptor, href: navigation.find((item) => item.code === 'PLATFORM')?.href ?? '/' }} /> : null}
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="absolute -inset-8 rounded-[36px] border border-white/[0.05]" />
              <div className="rounded-[28px] border border-white/10 bg-[#090b0a] p-5 shadow-2xl shadow-black/40">
                <div className="mb-5 flex items-center justify-between border-b border-white/[0.07] pb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: brand.accent }} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{brand.name}</span>
                  </div>
                  <ShieldCheck className="h-4 w-4 text-neutral-600" />
                </div>
                <div className="space-y-3">
                  {page.sections.slice(0, 3).map((section, index) => (
                    <div key={section.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                      <div className="flex items-start justify-between gap-6">
                        <div>
                          <div className="text-[9px] font-black uppercase tracking-[0.22em] text-neutral-600">0{index + 1}</div>
                          <div className="mt-2 text-sm font-bold text-white">{section.title}</div>
                        </div>
                        <div className="mt-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brand.accent }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <div className="grid gap-px overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.08] lg:grid-cols-3">
            {page.sections.map((section) => (
              <article key={section.id} className="bg-[#070908] p-7 sm:p-9">
                {section.eyebrow ? <div className="text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: brand.accent }}>{section.eyebrow}</div> : null}
                {section.title ? <h2 className="mt-4 text-2xl font-black tracking-[-0.035em] text-white">{section.title}</h2> : null}
                {section.body ? <p className="mt-4 text-sm leading-6 text-neutral-400">{section.body}</p> : null}
                {section.items.length ? (
                  <div className="mt-7 space-y-3 border-t border-white/[0.07] pt-6">
                    {section.items.map((item) => (
                      <div key={item} className="flex gap-3 text-xs leading-5 text-neutral-300">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: brand.accent }} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {(section.primary_action || section.secondary_action) ? (
                  <div className="mt-7 flex flex-wrap gap-2">
                    {section.primary_action ? <ActionLink action={section.primary_action} /> : null}
                    {section.secondary_action ? <ActionLink action={section.secondary_action} /> : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {page.slug === 'pricing' ? (
          <section className="border-y border-white/[0.07] bg-[#070908]">
            <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
              <div className="grid gap-6 lg:grid-cols-2">
                {pricingPlans.map((plan) => (
                  <article key={plan.id} className="rounded-[28px] border border-white/10 bg-[#0a0c0b] p-8 sm:p-10">
                    <div className="flex items-start justify-between gap-6">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: brand.accent }}>{plan.name}</div>
                        <div className="mt-5"><Price amount={plan.price_amount} currency={plan.currency} period={plan.billing_period} label={plan.price_label} /></div>
                      </div>
                      {plan.all_features_enabled ? <ShieldCheck className="h-6 w-6 text-neutral-600" /> : null}
                    </div>
                    {plan.description ? <p className="mt-6 max-w-xl text-sm leading-6 text-neutral-400">{plan.description}</p> : null}
                    <div className="mt-8 space-y-3 border-t border-white/[0.07] pt-7">
                      {plan.statements.map((statement) => (
                        <div key={statement} className="flex gap-3 text-sm text-neutral-300">
                          <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: brand.accent }} />
                          <span>{statement}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-9"><ActionLink action={{ label: plan.cta_label, href: plan.cta_href }} primary /></div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
          <div className="flex flex-col items-start justify-between gap-8 rounded-[28px] border border-white/10 bg-white/[0.025] p-8 sm:p-10 lg:flex-row lg:items-center">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: brand.accent }}>{brand.name}</div>
              <div className="mt-3 max-w-2xl text-2xl font-black tracking-[-0.035em] sm:text-3xl">{footerStatement}</div>
            </div>
            <ActionLink action={primaryCta} primary />
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-[11px] text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div className="font-bold text-neutral-500">{brand.name}</div>
          <div className="flex flex-wrap gap-5">
            {navigation.map((item) => <Link key={item.code} href={item.href} className="transition hover:text-neutral-300">{item.label}</Link>)}
          </div>
        </div>
      </footer>
    </div>
  );
}
