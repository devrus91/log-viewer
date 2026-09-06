export interface DocumentedDiagnosticRule {
  name: string;
  severity: "info" | "warning" | "critical";
  severityLabel: string;
  description: string;
}

export interface DocumentedRuleGroup {
  category: string;
  rules: DocumentedDiagnosticRule[];
}

export function DiagnosticRuleCatalog({ groups }: { groups: DocumentedRuleGroup[] }) {
  return <div className="docs-rule-categories">{groups.map((group) => <section key={group.category}><header><h3>{group.category}</h3><span>{group.rules.length}</span></header><div>{group.rules.map((rule) => <article className="docs-rule-card" data-testid="documented-rule" key={rule.name}><div><h4>{rule.name}</h4><span className={rule.severity}>{rule.severityLabel}</span></div><p>{rule.description}</p></article>)}</div></section>)}</div>;
}
