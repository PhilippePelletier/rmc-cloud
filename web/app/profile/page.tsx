"use client";

import { useTheme } from "@/components/ThemeProvider";
import ThemeSwitcher from "@/components/ThemeSwitcher";

export const metadata = {
  title: "Profile Settings",
  description: "Manage your profile and preferences",
};

export default function ProfilePage() {
  const { theme } = useTheme();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Profile Settings</h1>
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Theme</h2>
        <p className="text-sm text-gray-400">Choose your accent colour</p>
        <ThemeSwitcher />
        <p className="text-xs text-gray-500">Current theme: {theme}</p>
      </section>
    </div>
  );
}
