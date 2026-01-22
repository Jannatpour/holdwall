/**
 * Schema Generator
 * 
 * Generates JSON-LD structured data for all published content
 * to improve AI discovery and citation.
 */

import { generateStructuredData } from "./metadata";

export interface SchemaOptions {
  type: "Organization" | "Product" | "Article" | "FAQPage" | "HowTo" | "SoftwareApplication";
  title: string;
  content: string;
  url: string;
  [key: string]: unknown;
}

export class SchemaGenerator {
  /**
   * Generate schema for Organization
   */
  generateOrganization(data: {
    name: string;
    description: string;
    url: string;
    logo?: string;
    contactPoint?: {
      email?: string;
      phone?: string;
    };
    sameAs?: string[]; // Social media profiles
  }): object {
    return generateStructuredData({
      type: "Organization",
      name: data.name,
      description: data.description,
      url: data.url,
      logo: data.logo,
      contactPoint: data.contactPoint,
      sameAs: data.sameAs,
    });
  }

  /**
   * Generate schema for Product
   */
  generateProduct(data: {
    name: string;
    description: string;
    url: string;
    brand?: string;
    category?: string;
    offers?: {
      price?: string;
      priceCurrency?: string;
    };
  }): object {
    return generateStructuredData({
      type: "Product",
      name: data.name,
      description: data.description,
      url: data.url,
      brand: data.brand,
      category: data.category,
      offers: data.offers,
    });
  }

  /**
   * Generate schema for Article
   */
  generateArticle(data: {
    headline: string;
    description: string;
    url: string;
    author?: {
      name: string;
      url?: string;
    };
    datePublished?: string;
    dateModified?: string;
    image?: string;
  }): object {
    return generateStructuredData({
      type: "Article",
      name: data.headline,
      description: data.description,
      url: data.url,
      headline: data.headline,
      author: data.author,
      datePublished: data.datePublished,
      dateModified: data.dateModified,
      image: data.image,
    });
  }

  /**
   * Generate schema for FAQPage
   */
  generateFAQPage(data: {
    name: string;
    description: string;
    url: string;
    questions: Array<{
      question: string;
      answer: string;
    }>;
  }): object {
    return generateStructuredData({
      type: "FAQPage",
      name: data.name,
      description: data.description,
      url: data.url,
      mainEntity: data.questions.map(q => ({
        "@type": "Question",
        name: q.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: q.answer,
        },
      })),
    });
  }

  /**
   * Generate schema for HowTo
   */
  generateHowTo(data: {
    name: string;
    description: string;
    url: string;
    steps: Array<{
      name: string;
      text: string;
      image?: string;
    }>;
  }): object {
    return generateStructuredData({
      type: "HowTo",
      name: data.name,
      description: data.description,
      url: data.url,
      step: data.steps.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.name,
        text: step.text,
        image: step.image,
      })),
    });
  }

  /**
   * Generate schema for SoftwareApplication
   */
  generateSoftwareApplication(data: {
    name: string;
    description: string;
    url: string;
    applicationCategory?: string;
    operatingSystem?: string;
    offers?: {
      price?: string;
      priceCurrency?: string;
    };
    aggregateRating?: {
      ratingValue: number;
      reviewCount: number;
    };
  }): object {
    return generateStructuredData({
      type: "SoftwareApplication",
      name: data.name,
      description: data.description,
      url: data.url,
      applicationCategory: data.applicationCategory,
      operatingSystem: data.operatingSystem,
      offers: data.offers,
      aggregateRating: data.aggregateRating,
    });
  }

  /**
   * Generate schema based on type
   */
  generate(options: SchemaOptions): object {
    const { type, title, content, url, ...rest } = options;

    switch (type) {
      case "Organization":
        return this.generateOrganization({
          name: title,
          description: content,
          url,
          ...rest,
        } as any);

      case "Product":
        return this.generateProduct({
          name: title,
          description: content,
          url,
          ...rest,
        } as any);

      case "Article":
        return this.generateArticle({
          headline: title,
          description: content.substring(0, 200),
          url,
          ...rest,
        } as any);

      case "FAQPage":
        return this.generateFAQPage({
          name: title,
          description: content,
          url,
          questions: rest.questions as any || [],
        });

      case "HowTo":
        return this.generateHowTo({
          name: title,
          description: content,
          url,
          steps: rest.steps as any || [],
        });

      case "SoftwareApplication":
        return this.generateSoftwareApplication({
          name: title,
          description: content,
          url,
          ...rest,
        } as any);

      default:
        return generateStructuredData({
          type: "Article",
          name: title,
          description: content,
          url,
          ...rest,
        });
    }
  }

  /**
   * Generate multiple schemas for a page
   */
  generateMultiple(schemas: SchemaOptions[]): object[] {
    return schemas.map(schema => this.generate(schema));
  }

  /**
   * Generate BreadcrumbList schema
   */
  generateBreadcrumbs(items: Array<{ name: string; url: string }>): object {
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    };
  }
}
