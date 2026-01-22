/**
 * Internationalization (i18n) Configuration
 * Multi-language support with locale detection and translation
 */

export type Locale = "en" | "es" | "fr" | "de" | "ja" | "zh";

export const defaultLocale: Locale = "en";
export const supportedLocales: Locale[] = ["en", "es", "fr", "de", "ja", "zh"];

export interface Translations {
  [key: string]: string | Translations;
}

export const translations: Record<Locale, Translations> = {
  en: {
    common: {
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      create: "Create",
      search: "Search",
      loading: "Loading...",
      error: "Error",
      success: "Success",
    },
    nav: {
      overview: "Overview",
      signals: "Signals",
      claims: "Claims",
      graph: "Belief Graph",
      forecasts: "Forecasts",
      studio: "AAAL Studio",
      governance: "Governance",
    },
    claims: {
      title: "Claims",
      create: "Create Claim",
      decisiveness: "Decisiveness",
      evidence: "Evidence",
      cluster: "Cluster",
    },
    evidence: {
      title: "Evidence",
      type: "Type",
      source: "Source",
      content: "Content",
    },
  },
  es: {
    common: {
      save: "Guardar",
      cancel: "Cancelar",
      delete: "Eliminar",
      edit: "Editar",
      create: "Crear",
      search: "Buscar",
      loading: "Cargando...",
      error: "Error",
      success: "Éxito",
    },
    nav: {
      overview: "Resumen",
      signals: "Señales",
      claims: "Afirmaciones",
      graph: "Gráfico de Creencias",
      forecasts: "Pronósticos",
      studio: "Estudio AAAL",
      governance: "Gobernanza",
    },
    claims: {
      title: "Afirmaciones",
      create: "Crear Afirmación",
      decisiveness: "Decisividad",
      evidence: "Evidencia",
      cluster: "Agrupación",
    },
    evidence: {
      title: "Evidencia",
      type: "Tipo",
      source: "Fuente",
      content: "Contenido",
    },
  },
  fr: {
    common: {
      save: "Enregistrer",
      cancel: "Annuler",
      delete: "Supprimer",
      edit: "Modifier",
      create: "Créer",
      search: "Rechercher",
      loading: "Chargement...",
      error: "Erreur",
      success: "Succès",
    },
    nav: {
      overview: "Vue d'ensemble",
      signals: "Signaux",
      claims: "Revendications",
      graph: "Graphe de Croyances",
      forecasts: "Prévisions",
      studio: "Studio AAAL",
      governance: "Gouvernance",
    },
    claims: {
      title: "Revendications",
      create: "Créer une Revendication",
      decisiveness: "Détermination",
      evidence: "Preuve",
      cluster: "Groupe",
    },
    evidence: {
      title: "Preuve",
      type: "Type",
      source: "Source",
      content: "Contenu",
    },
  },
  de: {
    common: {
      save: "Speichern",
      cancel: "Abbrechen",
      delete: "Löschen",
      edit: "Bearbeiten",
      create: "Erstellen",
      search: "Suchen",
      loading: "Laden...",
      error: "Fehler",
      success: "Erfolg",
    },
    nav: {
      overview: "Übersicht",
      signals: "Signale",
      claims: "Behauptungen",
      graph: "Glaubensgraph",
      forecasts: "Prognosen",
      studio: "AAAL Studio",
      governance: "Governance",
    },
    claims: {
      title: "Behauptungen",
      create: "Behauptung Erstellen",
      decisiveness: "Entschlossenheit",
      evidence: "Beweis",
      cluster: "Cluster",
    },
    evidence: {
      title: "Beweis",
      type: "Typ",
      source: "Quelle",
      content: "Inhalt",
    },
  },
  ja: {
    common: {
      save: "保存",
      cancel: "キャンセル",
      delete: "削除",
      edit: "編集",
      create: "作成",
      search: "検索",
      loading: "読み込み中...",
      error: "エラー",
      success: "成功",
    },
    nav: {
      overview: "概要",
      signals: "シグナル",
      claims: "主張",
      graph: "信念グラフ",
      forecasts: "予測",
      studio: "AAALスタジオ",
      governance: "ガバナンス",
    },
    claims: {
      title: "主張",
      create: "主張を作成",
      decisiveness: "決断力",
      evidence: "証拠",
      cluster: "クラスター",
    },
    evidence: {
      title: "証拠",
      type: "タイプ",
      source: "ソース",
      content: "コンテンツ",
    },
  },
  zh: {
    common: {
      save: "保存",
      cancel: "取消",
      delete: "删除",
      edit: "编辑",
      create: "创建",
      search: "搜索",
      loading: "加载中...",
      error: "错误",
      success: "成功",
    },
    nav: {
      overview: "概览",
      signals: "信号",
      claims: "声明",
      graph: "信念图",
      forecasts: "预测",
      studio: "AAAL工作室",
      governance: "治理",
    },
    claims: {
      title: "声明",
      create: "创建声明",
      decisiveness: "决断力",
      evidence: "证据",
      cluster: "集群",
    },
    evidence: {
      title: "证据",
      type: "类型",
      source: "来源",
      content: "内容",
    },
  },
};

/**
 * Get translation for key
 */
export function t(key: string, locale: Locale = defaultLocale): string {
  const keys = key.split(".");
  let value: any = translations[locale];

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      // Fallback to English
      value = translations[defaultLocale];
      for (const k2 of keys) {
        if (value && typeof value === "object" && k2 in value) {
          value = value[k2];
        } else {
          return key; // Return key if translation not found
        }
      }
      break;
    }
  }

  return typeof value === "string" ? value : key;
}

/**
 * Detect locale from request
 */
export function detectLocale(request: Request): Locale {
  // Check Accept-Language header
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const languages = acceptLanguage
      .split(",")
      .map((lang) => lang.split(";")[0].trim().toLowerCase().substring(0, 2));
    for (const lang of languages) {
      if (supportedLocales.includes(lang as Locale)) {
        return lang as Locale;
      }
    }
  }

  // Check URL path
  const url = new URL(request.url);
  const pathLocale = url.pathname.split("/")[1];
  if (supportedLocales.includes(pathLocale as Locale)) {
    return pathLocale as Locale;
  }

  return defaultLocale;
}
