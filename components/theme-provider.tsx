"use client";

import * as React from "react";

type Theme = "obsidian" | "regulator-light";

interface ThemeProviderContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeProviderContext = React.createContext<
  ThemeProviderContextValue | undefined
>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = "obsidian",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setTheme] = React.useState<Theme>(defaultTheme);

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === "obsidian") {
      root.classList.add("dark");
      root.removeAttribute("data-theme");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "regulator-light");
    }
  }, [theme]);

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
