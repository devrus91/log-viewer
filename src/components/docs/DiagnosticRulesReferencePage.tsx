import Link from "next/link";
import { ArrowLeft, BookOpen, Gauge } from "lucide-react";
import { WotLabBrand } from "@/components/WotLabBrand";
import { DiagnosticRuleCatalog, type DocumentedRuleGroup } from "./DiagnosticRuleCatalog";

interface ReferenceCopy {
  locale: "ru" | "en";
  topLabel: string;
  languageLabel: string;
  backToApp: string;
  backToDocs: string;
  title: string;
  introduction: string;
  countLabel: string;
  scopeTitle: string;
  scopeText: string;
  caveatsTitle: string;
  caveats: Array<{ title: string; text: string }>;
}

export function DiagnosticRulesReferencePage({ copy, groups }: { copy: ReferenceCopy; groups: DocumentedRuleGroup[] }) {
  const english = copy.locale === "en";
  const docsHref = english ? "/docs/en" : "/docs";
  const alternateHref = english ? "/docs/rules" : "/docs/en/rules";
  return <main className="docs-page docs-rules-reference" lang={copy.locale}>
    <header className="docs-topbar"><Link href="/" aria-label="WOT Lab home"><WotLabBrand compact /></Link><div className="docs-topbar-actions"><span>{copy.topLabel}</span><nav className="docs-language-switcher" aria-label={copy.languageLabel}><Link className={english ? "" : "active"} href={english ? alternateHref : "/docs/rules"} lang="ru" aria-current={english ? undefined : "page"}>RU</Link><Link className={english ? "active" : ""} href={english ? "/docs/en/rules" : alternateHref} lang="en" aria-current={english ? "page" : undefined}>EN</Link></nav><Link className="docs-back-link" href="/"><ArrowLeft size={15} /> {copy.backToApp}</Link></div></header>
    <article className="docs-reference-content"><Link className="docs-reference-back" href={docsHref}><ArrowLeft size={14} /> {copy.backToDocs}</Link><header className="docs-reference-hero"><span className="eyebrow"><Gauge size={13} /> BUILT-IN DIAGNOSTICS</span><h1>{copy.title}</h1><p>{copy.introduction}</p><div><b>26</b><span>{copy.countLabel}</span></div></header>
      <div className="docs-warning"><b>{copy.scopeTitle}</b><span>{copy.scopeText}</span></div>
      <DiagnosticRuleCatalog groups={groups} />
      <section className="docs-reference-caveats"><div className="docs-heading"><span>!</span><div><h2>{copy.caveatsTitle}</h2></div></div><div className="docs-definition-grid">{copy.caveats.map((item) => <div key={item.title}><code>{item.title}</code><p>{item.text}</p></div>)}</div></section>
      <footer className="docs-footer"><WotLabBrand compact /><span>{copy.title}</span><Link href={docsHref}><BookOpen size={14} /> {copy.backToDocs}</Link></footer>
    </article>
  </main>;
}
