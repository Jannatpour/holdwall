/**
 * Newsletter Manager
 * 
 * Automated newsletter creation and distribution for
 * building authority and maintaining engagement.
 */

export interface Newsletter {
  id: string;
  title: string;
  content: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
  publishedAt?: string;
  sentCount?: number;
  openRate?: number;
}

export interface NewsletterOptions {
  title: string;
  sections: Array<{ title: string; content: string }>;
  includeUnsubscribe?: boolean;
}

export class NewsletterManager {
  private newsletters: Map<string, Newsletter> = new Map();

  /**
   * Create newsletter
   */
  create(options: NewsletterOptions): Newsletter {
    const newsletter: Newsletter = {
      id: crypto.randomUUID(),
      title: options.title,
      content: this.combineSections(options.sections),
      sections: options.sections,
    };

    this.newsletters.set(newsletter.id, newsletter);
    return newsletter;
  }

  /**
   * Combine sections into full content
   */
  private combineSections(sections: Array<{ title: string; content: string }>): string {
    return sections
      .map(section => `## ${section.title}\n\n${section.content}`)
      .join("\n\n");
  }

  /**
   * Format newsletter for email
   */
  formatForEmail(newsletter: Newsletter): string {
    let html = `<html><body>`;
    html += `<h1>${newsletter.title}</h1>`;

    for (const section of newsletter.sections) {
      html += `<h2>${section.title}</h2>`;
      html += `<div>${section.content.replace(/\n/g, "<br/>")}</div>`;
    }

    html += `</body></html>`;
    return html;
  }

  /**
   * Get newsletter
   */
  getNewsletter(id: string): Newsletter | null {
    return this.newsletters.get(id) || null;
  }

  /**
   * List newsletters
   */
  listNewsletters(): Newsletter[] {
    return Array.from(this.newsletters.values())
      .sort((a, b) => {
        const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return bTime - aTime;
      });
  }
}
