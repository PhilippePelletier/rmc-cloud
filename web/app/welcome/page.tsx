// app/welcome/page.tsx
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'RMC Cloud — Finance-grade Retail Analytics',
  description:
    'Turn messy retail data into clean, compounding margin. Weekly executive briefs that move EBITDA.',
};

export default function WelcomePage() {
  return (
    <main className="relative">
      {/* Brand bar (local to /welcome only) */}
      <div className="mb-6 flex items-center justify-between rounded-2xl border bg-white/70 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <LogoMark className="h-6 w-6" />
          <span className="font-semibold tracking-tight text-slate-900">RMC Cloud</span>
          <span className="hidden text-xs text-slate-500 sm:inline">Finance-grade retail analytics</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
            Sign in
          </Link>
          <Link href="/sign-up" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
            Get started
          </Link>
        </div>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-b from-slate-50 to-white">
        {/* soft glows */}
        <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 -left-48 h-96 w-96 rounded-full bg-sky-200/50 blur-3xl" />
        <div className="relative px-6 py-16 sm:px-10 sm:py-20">
          <div className="mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1 text-xs text-slate-600 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Now in public beta — enterprise-clean, operator-fast
            </div>

            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Turn messy retail data into{' '}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-emerald-600 to-sky-600 bg-clip-text text-transparent">
                  compounding margin
                </span>
                <span className="absolute bottom-0 left-0 h-[6px] w-full translate-y-1 rounded-full bg-emerald-200/60 blur-[2px]" />
              </span>
              .
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-slate-600">
              Weekly executive briefs that quantify what moved gross margin, where leakage hides, and the 3 actions that will move EBITDA next.
            </p>

            <div className="mt-8 flex items-center justify-center gap-3">
              <Link href="/sign-up" className="btn">
                Create your account
              </Link>
              <Link href="/uploads" className="btn border-gray-300 bg-white hover:bg-gray-50">
                Try an upload
              </Link>
            </div>

            {/* KPI cards */}
            <div className="mx-auto mt-10 grid max-w-3xl grid-cols-3 gap-3 text-left text-sm">
              {[
                { k: 'Gross Margin Δ', v: '+120 bps', t: 'mix discipline & promo ROI' },
                { k: 'SKU Velocity', v: '+9.8%', t: 'localized assortment' },
                { k: 'Cash Cycle', v: '-6 days', t: 'inventory productivity' },
              ].map((x) => (
                <div key={x.k} className="rounded-xl border bg-white/90 px-4 py-3 shadow-sm transition hover:shadow-md">
                  <div className="text-slate-500">{x.k}</div>
                  <div className="text-lg font-semibold text-slate-900">{x.v}</div>
                  <div className="text-xs text-slate-500">{x.t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="mt-8">
        <div className="rounded-2xl border bg-white/70 p-4 text-center text-xs text-slate-500">
          Trusted by finance teams at multi-location retailers to align ops, merch & growth on the same facts.
        </div>
      </section>

      {/* VALUE PILLARS (results > mechanics) */}
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          {
            title: 'Board-ready clarity',
            desc: 'One page. The signal behind GM%, mix, and promo lift. What changed and why it matters—every Monday.',
            badge: 'Executive brief',
          },
          {
            title: 'Margin that compounds',
            desc: 'Spot leakage early, redeploy discounts with intent, and focus stores on the few moves that stack.',
            badge: 'EBITDA focus',
          },
          {
            title: 'A single truth',
            desc: 'Consistent KPIs across stores and categories—no spreadsheet drift, no debate over the math.',
            badge: 'Finance-grade',
          },
        ].map((f) => (
          <div key={f.title} className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[11px] text-slate-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {f.badge}
            </div>
            <h3 className="mt-3 text-base font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* PREVIEW / SOCIAL PROOF */}
      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-gradient-to-br from-slate-50 to-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">What leaders say</h2>
          <div className="mt-4 grid gap-4">
            {[
              {
                quote: 'The weekly brief replaced three standing meetings. Cleaner margins in a month.',
                who: 'CFO — Specialty Retail',
              },
              {
                quote: 'Promo ROI went up once mix shifts were obvious. We finally turned noise into action.',
                who: 'VP Merchandising — DTC',
              },
              {
                quote: 'Ops has a crisp Monday plan. One page, five actions. Execution finally compounds.',
                who: 'COO — Multilocation',
              },
            ].map((t, i) => (
              <figure key={i} className="rounded-xl border bg-white p-4 shadow-sm">
                <blockquote className="text-sm text-slate-700">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="mt-2 text-xs text-slate-500">{t.who}</figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">A brief that moves EBITDA</h2>
          <div className="mt-3 aspect-[16/10] w-full overflow-hidden rounded-xl border bg-slate-50 p-4 shadow-sm">
            {/* Replace with a real screenshot later */}
            <div className="grid h-full w-full place-items-center text-slate-400">
              <div className="text-center">
                <div className="text-sm">Executive Brief Preview</div>
                <div className="mt-1 text-xs">GM% trend · Category mix · Profit deltas · Action items</div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">PDF briefs are archived alongside jobs for auditability.</p>
        </div>
      </section>

      {/* SECURITY / GOVERNANCE */}
      <section className="mt-10 rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Built for finance & controls</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: 'Data control', v: 'Your Storage · Your DB · Your keys' },
            { k: 'Access', v: 'RLS + JWT · Least privilege' },
            { k: 'Privacy', v: 'Permanent deletes on request' },
            { k: 'Compliance', v: 'SOC2 (in progress)' },
          ].map((x) => (
            <div key={x.k} className="rounded-xl border bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-600">{x.k}</div>
              <div className="text-sm font-medium text-slate-900">{x.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mt-10 rounded-2xl border bg-gradient-to-br from-emerald-50 to-white p-6 text-center">
        <h3 className="text-xl font-semibold text-slate-900">Ready to expand margin?</h3>
        <p className="mt-1 text-sm text-slate-600">Create your account and get your first brief this week.</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link href="/sign-up" className="btn">
            Get started
          </Link>
          <Link href="/sign-in" className="btn border-gray-300 bg-white hover:bg-gray-50">
            Sign in
          </Link>
        </div>
      </section>

      {/* FOOTNOTE */}
      <section className="mt-6 text-center text-xs text-slate-500">
        RMC Cloud © {new Date().getFullYear()} · Finance-grade analytics for retail operators
      </section>
    </main>
  );
}

/** Minimal inline logomark—keeps /welcome independent from the app header */
function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="6" fill="url(#g)" opacity="0.15" />
      <path
        d="M7 20.5l5.5-6 4 3.5 7-8.5M7 24.5h18"
        stroke="url(#g)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
