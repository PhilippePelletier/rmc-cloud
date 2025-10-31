// web/app/profile/page.tsx
import ThemeSection from "./theme-section";

export const metadata = {
  title: "Profile Settings",
  description: "Manage your profile and preferences",
};

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Profile Settings</h1>

      <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-300">Theme</h2>
        {/* Client component rendered inside a server page */}
        <ThemeSection />
      </section>
    </div>
  );
}
