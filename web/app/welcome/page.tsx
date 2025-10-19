// app/welcome/page.tsx
import Link from "next/link";

export const metadata = {
  title: "RMC Cloud – Retail Margin Copilot",
  description: "Turn retail data into margin wins. Upload, map, brief—automatically.",
};

export default function LandingPage() {
  return (
    <div className="container mx-auto px-4">
      {/* Hero */}
      <section className="mx-auto max-w-5xl py-16 sm:py-24">
        <div className="grid items-center gap-8 sm:grid-cols-2">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Turn raw retail data into <span className="text-blue-600">weekly margin wins</span>.
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              Upload CSVs, map fields once, and get clean KPIs, anomaly detection, and AI-generated briefs—
              ready for your leadership team.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/sign-up" className="btn">Get Started</Link>
              <Link href="/sign-in" className="btn-outline">Sign In</Link>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              No credit card needed. Start with your sales CSV.
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="rounded-lg border bg-gray-50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span className="text-sm font-medium">Weekly Brief</span>
                </div>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Auto</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Metric label="Revenue" value="$1.2M" />
                <Metric label="GM $" value="$410k" />
                <Metric label="GM %" value="34.2%" />
                <Metric label="Units" value="58,921" />
              </div>
              <div className="mt-4 rounded-lg border bg-white p-3">
                <p className="text-sm text-gray-700">
                  “Revenue held steady week-over-week while GM% improved 0.8pp driven by Accessories.
                  Watch Beverage in Region West (−23% vs trend).”
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl py-10">
        <h2 className="h2 mb-6">Why teams use RMC Cloud</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Feature
            title="Upload & Map"
            desc="One-time mapping by CSV type. Save presets per vendor and reuse with a click."
          />
          <Feature
            title="Clean KPIs"
            desc="Revenue, GM$, GM%, Units—plus top categories and trends. No spreadsheets required."
          />
          <Feature
            title="AI Briefs"
            desc="Auto-generate exec-ready weekly briefs with anomalies and next actions."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl py-16 text-center">
        <h3 className="text-2xl font-semibold">Ready to turn data into decisions?</h3>
        <p className="mt-2 text-gray-600">Create an account and upload your first CSV.</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/sign-up" className="btn">Create account</Link>
          <Link href="/sign-in" className="btn-outline">I already have one</Link>
        </div>
      </section>

      <footer className="mt-12 border-t py-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} RMC Cloud — Retail Margin Copilot
      </footer>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-base font-semibold">{title}</div>
      <p className="mt-2 text-sm text-gray-600">{desc}</p>
    </div>
  );
}
