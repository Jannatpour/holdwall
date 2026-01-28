/**
 * Case Intake Form with i18n Support
 * 
 * Wrapper component that provides i18n context to CaseIntakeForm
 */

"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CaseIntakeForm } from "./case-intake-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supportedLocales, type Locale } from "@/lib/i18n/config";
import { Globe } from "@/components/demo-icons";

export function CaseIntakeFormI18n() {
  const searchParams = useSearchParams();
  const browserDefaultLocale = useMemo<Locale>(() => {
    const browserLang = navigator.language.substring(0, 2) as Locale;
    return supportedLocales.includes(browserLang) ? browserLang : "en";
  }, []);

  const urlLocale = useMemo<Locale | null>(() => {
    const value = searchParams.get("locale") as Locale | null;
    return value && supportedLocales.includes(value) ? value : null;
  }, [searchParams]);

  const [userLocale, setUserLocale] = useState<Locale | null>(null);
  const locale = userLocale ?? urlLocale ?? browserDefaultLocale;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Select value={locale} onValueChange={(value) => setUserLocale(value as Locale)}>
          <SelectTrigger className="w-[180px]">
            <Globe className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Español</SelectItem>
            <SelectItem value="fr">Français</SelectItem>
            <SelectItem value="de">Deutsch</SelectItem>
            <SelectItem value="ja">日本語</SelectItem>
            <SelectItem value="zh">中文</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <CaseIntakeForm locale={locale} />
    </div>
  );
}
