// web/app/profile/theme-section.tsx
"use client";

import ThemeSwitcher from "@/components/ThemeSwitcher";
import { useTheme } from "@/components/ThemeProvider";

export default function ThemeSection() {
  const { theme } = useTheme();
  return (
    <div>
      <ThemeSwitcher />
      <p className="mt-3 text-xs text-gray-400">
        Current theme: <span className="font-medium text-gray-200">{theme}</span>
      </p>
    </div>
  );
}
