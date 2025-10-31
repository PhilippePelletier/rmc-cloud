"use client";

import React, { createContext, useState, useEffect, useContext } from "react";
import { createSupabaseBrowser } from "@/app/lib/supabase-browser";

/**
 * ThemeContext stores the current theme and an updater.  Themes correspond to
 * values defined in globals.css.  When the theme changes we update the
 * document's data-theme attribute, persist to localStorage, and optionally
 * write to Supabase (user_preferences table).
 */
type Theme = "default" | "violet" | "green";
interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
}
const ThemeContext = createContext<ThemeCtx | undefined>(undefined);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const sb = createSupabaseBrowser();
  const [theme, setThemeState] = useState<Theme>("default");

  // On mount, hydrate theme from localStorage or database
  useEffect(() => {
    async function loadTheme() {
      // Try localStorage first
      const stored = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
      if (stored === "default" || stored === "violet" || stored === "green") {
        setThemeState(stored);
        document.documentElement.setAttribute("data-theme", stored);
      } else {
        // Fallback: fetch from Supabase user_preferences table
        const {
          data: { session },
        } = await sb.auth.getSession();
        const user = session?.user;
        if (user) {
          const { data, error } = await sb
            .from("user_preferences")
            .select("theme")
            .eq("user_id", user.id)
            .single();
          if (!error && data?.theme) {
            const t = data.theme as Theme;
            setThemeState(t);
            document.documentElement.setAttribute("data-theme", t);
            localStorage.setItem("theme", t);
          }
        }
      }
    }
    loadTheme();
  }, [sb]);

  // When theme changes, update attribute, persist to localStorage and DB
  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", t);
    }
    document.documentElement.setAttribute("data-theme", t);
    // Persist to Supabase
    (async () => {
      const {
        data: { session },
      } = await sb.auth.getSession();
      const user = session?.user;
      if (user) {
        await sb.from("user_preferences").upsert({ user_id: user.id, theme: t }, { onConflict: "user_id" });
      }
    })();
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
