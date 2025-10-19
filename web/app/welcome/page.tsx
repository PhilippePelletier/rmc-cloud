// app/welcome/page.tsx
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function WelcomePage() {
  return (
    <main className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-b from-slate-50 to-white">
        <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 -left-48 h-96 w-96 rounded-full bg-sky-200/50 blur-3xl" />

        <div className="relative px-6 py-16 sm:px-10 sm:py-20">
          <div className="mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1 text-xs text-slate-600 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Finance-grade retail analytics — now in public beta
            </div>

            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Turn messy retail data into <span className="text-emerald-600">margin expansion</span>.
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-slate-600">
              RMC Cloud ingests sales, products, stores, and promos, then delivers a weekly brief:
              revenue, GM%, units, anomaly flags, and executive narrative — so you can make decisions
              that move EBITDA, not just dashboards.
            </p>

            <div className="mt-8 flex items-center justify-center gap-3">
              <Link href="/sign-up" className="btn">
                Get started — it’s free
              </Link>
              <Link
                href="/sign-in"
                className="btn border-gray-300 bg-white hover:bg-gray-50"
              >
                Sign in
              </Link>
            </div>

            <div className="mx-auto mt-10 grid max-w-3xl grid-cols-3 gap-3 text-left text-sm">
              {[
                { k: 'Gross Margin Δ', v: '+120 bps', t: 'category mix & promo discipline' },
                { k: 'SKU Velocity', v: '+9.8%', t: 'localized assortment' },
                { k: 'Cash Cycle', v: '-6 days', t: 'inventory productivity' },
              ].map((x) => (
                <div
                  key={x.k}
                  className="rounded-xl border bg-white px-4 py-3 shadow-sm"
                >
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
          Finance teams at multi-location retailers use RMC Cloud to align ops, merch, and growth on the same facts.
        </div>
      </section>

      {/* VALUE PILLARS */}
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          {
            title: 'Finance-first KPIs',
            desc:
              'Revenue, GM$, GM%, units, ASP, attach rate — normalized and comparable across stores, categories, and weeks.',
            badge: 'Single source of truth',
          },
          {
            title: 'Narrative that drives action',
            desc:
              'Variance analysis, mix shift, promo lift, and “so what?” guidance tied to next-week execution.',
            badge: 'Board-ready weekly brief',
          },
          {
            title: 'Anomalies without noise',
            desc:
              '2σ outlier detection on recent history to catch GM% dips, price leakage, or supply shocks early.',
            badge: 'Signal > noise',
          },
        ].map((f) => (
          <div
            key={f.title}
            className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[11px] text-slate-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {f.badge}
            </div>
            <h3 className="mt-3 text-base font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* HOW IT WORKS */}
      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">How it works</h2>
          <ol className="mt-4 space-y-4">
            {[
              {
                t: 'Upload your CSVs',
                d: 'Sales, product master, stores, promos. Reusable mapping presets speed repeat imports.',
              },
              {
                t: 'Auto-compute KPIs',
                d: 'We aggregate, normalize, and compute GM$, GM%, units, and more per day/store/category.',
              },
              {
                t: 'Ship your weekly brief',
                d: 'We generate a concise executive narrative, flag anomalies, and recommend actions.',
              },
            ].map((s, i) => (
              <li key={s.t} className="flex gap-3">
                <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-emerald-600 text-center text-[11px] font-semibold leading-6 text-white">
                  {i + 1}
                </div>
                <div>
                  <div className="font-medium text-slate-900">{s.t}</div>
                  <div className="text-sm text-slate-600">{s.d}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex items-center gap-3">
            <Link href="/sign-up" className="btn">
              Create account
            </Link>
            <Link href="/uploads" className="btn border-gray-300 bg-white hover:bg-gray-50">
              Try an upload
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border bg-gradient-to-br from-slate-50 to-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">What you’ll see</h2>
          <div className="mt-3 aspect-[16/10] w-full overflow-hidden rounded-xl border bg-white/80 p-4 shadow-sm">
            {/* Placeholder for a real screenshot */}
            <div className="grid h-full w-full place-items-center text-slate-400">
              <div className="text-center">
                <div className="text-sm">Brief preview</div>
                <div className="mt-1 text-xs">KPI table · GM% trend · Category mix · Anomaly flags</div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            PDF briefs are saved to Storage and accessible from Jobs/Briefs.
          </p>
        </div>
      </section>

      {/* SECURITY / GOVERNANCE */}
      <section className="mt-10 rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Security & governance</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: 'Data control', v: 'Your Storage · Your DB · Your keys' },
            { k: 'Access', v: 'RLS + JWT · Principle of least privilege' },
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

      {/* TESTIMONIALS */}
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          {
            quote:
              'The weekly brief replaced three standing meetings. Cleaner margins in a month.',
            author: 'CFO — Specialty Retail',
          },
          {
            quote:
              'Promo ROI went up once we saw the mix shift in GM% every Monday. No guesswork.',
            author: 'VP Merchandising — DTC',
          },
          {
            quote:
              'Store ops loves the clarity. One page, five actions. Execution finally compounds.',
            author: 'COO — Multilocation',
          },
        ].map((t, i) => (
          <figure key={i} className="rounded-2xl border bg-white p-5">
            <blockquote className="text-sm text-slate-700">&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption className="mt-3 text-xs text-slate-500">{t.author}</figcaption>
          </figure>
        ))}
      </section>

      {/* FINAL CTA */}
      <section className="mt-10 rounded-2xl border bg-gradient-to-br from-emerald-50 to-white p-6 text-center">
        <h3 className="text-xl font-semibold text-slate-900">Ready to expand margin?</h3>
        <p className="mt-1 text-sm text-slate-600">
          Upload your first CSV and get an executive brief this week.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link href="/sign-up" className="btn">
            Create account
          </Link>
          <Link
            href="/sign-in"
            className="btn border-gray-300 bg-white hover:bg-gray-50"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* FOOTNOTE */}
      <section className="mt-6 text-center text-xs text-slate-500">
        Built on Supabase · Designed for finance & operators · RMC Cloud © {new Date().getFullYear()}
      </section>
    </main>
  );
}
