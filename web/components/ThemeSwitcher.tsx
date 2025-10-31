"use client";

import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

/**
 * ThemeSwitcher renders a list of colour options the user can click to
 * switch the accent palette.  The selected theme is highlighted with a
 * ring.  Themes correspond to CSS variables defined in globals.css.
 */
const themes = [
  { id: "default", color: "bg-blue-600" },
  { id: "violet", color: "bg-violet-600" },
  { id: "green", color: "bg-green-600" },
] as const;

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-2">
      {themes.map(({ id, color }) => (
        <button
          key={id}
          onClick={() => setTheme(id as any)}
          className={cn(
            "h-5 w-5 rounded-full border-2 transition-all",
            color,
            theme === id ? "ring-2 ring-offset-2 ring-offset-gray-900" : "border-gray-500"
          )}
        />
      ))}
    </div>
  );
}
