import Link from "next/link";

const footerLinks: Array<{
  title: string;
  links: Array<{ label: string; href: string }>;
}> = [
  {
    title: "Product",
    links: [
      { label: "Overview", href: "/product" },
      { label: "Pipeline", href: "/product/pipeline" },
      { label: "Claims & Clustering", href: "/product/claims" },
      { label: "Belief Graph", href: "/product/graph" },
      { label: "Forecasting", href: "/product/forecasting" },
      { label: "AAAL Studio", href: "/product/aaal" },
      { label: "Governance", href: "/product/governance" },
      { label: "Agents", href: "/product/agents" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Overview", href: "/solutions" },
      { label: "Comms & PR (SKU A)", href: "/solutions/comms" },
      { label: "Security & Trust (SKU B)", href: "/solutions/security" },
      { label: "Procurement (SKU C)", href: "/solutions/procurement" },
      { label: "Support & Ops", href: "/solutions/support" },
      { label: "Financial Services", href: "/solutions/financial-services" },
    ],
  },
  {
    title: "Trust",
    links: [
      { label: "Security", href: "/security" },
      { label: "Ethics", href: "/ethics" },
      { label: "Compliance", href: "/compliance" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Library", href: "/resources" },
      { label: "Documentation", href: "/resources/docs" },
      { label: "Interactive Demo", href: "/demo" },
      { label: "Playbooks", href: "/resources/playbooks" },
      { label: "AAAL Templates", href: "/resources/templates" },
      { label: "Case Studies", href: "/resources/cases" },
      { label: "Changelog", href: "/resources/changelog" },
      { label: "Blog", href: "/resources/blog" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:px-8 md:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <div className="text-lg font-semibold tracking-tight">Holdwall POS</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Perception Operating System: Turn narrative risk into a measurable, forecastable domain. 
            Make negative narratives structurally non-decisive through evidence, provenance, and AI-answer authority.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Holdwall. All rights reserved.
          </p>
        </div>

        {footerLinks.map((group) => (
          <div key={group.title} className="space-y-3">
            <div className="text-sm font-medium">{group.title}</div>
            <ul className="space-y-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}

