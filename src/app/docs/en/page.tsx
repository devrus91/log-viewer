import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, Braces, Gauge, Sigma } from "lucide-react";
import { WotLabBrand } from "@/components/WotLabBrand";

export const metadata: Metadata = {
  title: "Documentation — WOT Lab",
  description: "WOT Lab guide to calculated channels, diagnostic rules, and window functions.",
};

const WINDOW_FUNCTIONS = [
  { name: "lag(expr, N)", result: "The value of expr N samples earlier.", edge: "The first N results are NaN." },
  { name: "delta(expr, N)", result: "The current value minus the value N samples earlier.", edge: "The first N results are NaN." },
  { name: "moving_avg(expr, N)", result: "Average of the latest N samples, including the current sample.", edge: "Requires a complete window without NaN." },
  { name: "moving_min(expr, N)", result: "Minimum value across the latest N samples.", edge: "Requires a complete window without NaN." },
  { name: "moving_max(expr, N)", result: "Maximum value across the latest N samples.", edge: "Requires a complete window without NaN." },
  { name: "moving_sum(expr, N)", result: "Sum of the latest N samples.", edge: "Requires a complete window without NaN." },
];

const SCALAR_FUNCTIONS = [
  ["abs(x)", "absolute value"], ["min(a, b, …)", "minimum"], ["max(a, b, …)", "maximum"],
  ["avg(a, b, …)", "argument average"], ["sqrt(x)", "square root"], ["pow(x, y)", "x raised to y"],
  ["clamp(x, min, max)", "range limit"], ["round(x)", "round to nearest"], ["floor(x)", "round down"],
  ["ceil(x)", "round up"], ["if(condition, yes, no)", "conditional choice"],
];

function CodeExample({ children }: { children: string }) {
  return <pre className="docs-code"><code>{children}</code></pre>;
}

export default function EnglishDocumentationPage() {
  return <main className="docs-page" lang="en">
    <header className="docs-topbar"><Link href="/" aria-label="WOT Lab home"><WotLabBrand compact /></Link><div className="docs-topbar-actions"><span>LOG VIEWER MANUAL</span><nav className="docs-language-switcher" aria-label="Documentation language"><Link href="/docs" lang="ru">RU</Link><Link className="active" href="/docs/en" lang="en" aria-current="page">EN</Link></nav><Link className="docs-back-link" href="/"><ArrowLeft size={15} /> Back to the app</Link></div></header>
    <div className="docs-shell">
      <aside className="docs-nav"><div><BookOpen size={17} /><span><b>Documentation</b><small>Formulas and diagnostics</small></span></div><nav aria-label="Documentation sections">
        <a href="#quick-start">Quick start</a>
        <a href="#calculated-channels">Calculated channels</a>
        <a href="#formula-language">Formula language</a>
        <a href="#window-functions">Window functions</a>
        <a href="#diagnostic-rules">Analysis rules</a>
        <a href="#channel-mapping">Channel mapping</a>
        <a href="#recipes">Ready-to-use recipes</a>
      </nav><p>All calculations run locally in your browser. Logs and custom settings are not uploaded to a server.</p></aside>

      <article className="docs-content">
        <section className="docs-hero"><span className="eyebrow">WOT LAB · USER GUIDE</span><h1>Formulas and rules<br /><em>you can trust.</em></h1><p>A practical guide to building calculated signals and diagnosing automotive CSV logs.</p><div className="docs-hero-cards"><a href="#calculated-channels"><Sigma size={18} /><span><b>Calculated channels</b><small>Derived signals</small></span></a><a href="#diagnostic-rules"><Gauge size={18} /><span><b>Analysis rules</b><small>WOT-scoped events</small></span></a><a href="#window-functions"><Braces size={18} /><span><b>Window functions</b><small>History and smoothing</small></span></a></div></section>

        <section id="quick-start" className="docs-section"><div className="docs-heading"><span>01</span><div><h2>Quick start</h2><p>Two independent tools share the same safe expression language.</p></div></div><div className="docs-steps"><article><b>Calculated channel</b><ol><li>Open a CSV log.</li><li>Select <strong>Formula</strong> or press <kbd>Ctrl/⌘+F</kbd>.</li><li>Enter a name, unit, and expression.</li><li>Select <strong>Create channel</strong>.</li></ol></article><article><b>Diagnostic rule</b><ol><li>Open <strong>Settings → Diagnostics</strong>.</li><li>Select <strong>Configure diagnostic rules</strong>.</li><li>Select <strong>New rule</strong>.</li><li>Configure the conditions and run <strong>Re-run diagnostics</strong>.</li></ol></article></div></section>

        <section id="calculated-channels" className="docs-section"><div className="docs-heading"><span>02</span><div><h2>Calculated channels</h2><p>A calculated channel evaluates a new value for every sample in the source log.</p></div></div>
          <div className="docs-callout"><Sigma size={18} /><div><b>The primary syntax rule</b><p>Use the exact CSV channel name, including spaces and units, inside square brackets: <code>[Boost Pressure Actual (bar)]</code>. The safest option is to click a channel in the Formula Builder sidebar so the reference is inserted automatically.</p></div></div>
          <h3>Formula Builder fields</h3><div className="docs-definition-grid"><div><code>Channel name</code><p>A unique display name. Other calculated channels can reference this name.</p></div><div><code>Unit</code><p>The displayed unit label. WOT Lab does not convert units automatically.</p></div><div><code>Expression</code><p>The formula evaluated for each sample. It can contain channels, parameters, operators, and functions.</p></div><div><code>Reusable parameters</code><p>Named numeric constants, for example <code>BAR_TO_PSI = 14.5038</code>.</p></div></div>
          <h3>Basic example</h3><CodeExample>{`Name: Boost Error\nUnit: bar\nExpression: [Boost Pressure Target (bar)] - [Boost Pressure Actual (bar)]`}</CodeExample>
          <p>Definitions are stored in the current browser&apos;s <code>localStorage</code> and restored for future logs. If a required source channel is missing or its name differs, the calculated channel cannot be materialized. Renaming a calculated channel updates saved formulas that depend on it; dependency cycles are rejected.</p>
          <div className="docs-note"><b>Editing</b><span>Select a calculated channel on the chart and use <strong>Edit selected</strong>, or use the pencil icon next to it in the channel list. Saving also recalculates every calculated channel that depends on it.</span></div>
        </section>

        <section id="formula-language" className="docs-section"><div className="docs-heading"><span>03</span><div><h2>Formula language</h2><p>Expressions use a dedicated parser. Arbitrary JavaScript is never executed.</p></div></div>
          <div className="docs-syntax-table"><div><b>Channel</b><code>[Engine Speed (rpm)]</code><span>Exact name of a source or calculated channel</span></div><div><b>Parameter</b><code>MIN_RPM</code><span>An identifier made of letters, digits, and _, not starting with a digit</span></div><div><b>Number</b><code>0.5 · .5 · 1e-3</code><span>Decimal and exponential values</span></div><div><b>Arithmetic</b><code>+ − * / % ^</code><span>Standard precedence; parentheses change evaluation order</span></div><div><b>Comparison</b><code>&gt; &gt;= &lt; &lt;= == !=</code><span>Returns 1 for true and 0 for false</span></div><div><b>Logic</b><code>AND · OR · NOT</code><span>Combines numeric conditions</span></div></div>
          <h3>Scalar functions</h3><div className="docs-function-grid">{SCALAR_FUNCTIONS.map(([signature, description]) => <div key={signature}><code>{signature}</code><span>{description}</span></div>)}</div>
          <p className="docs-muted">Division or remainder by zero produces <code>NaN</code>. A missing channel or parameter is a formula error. Channel spelling and letter case must match.</p>
        </section>

        <section id="window-functions" className="docs-section"><div className="docs-heading"><span>04</span><div><h2>Window functions</h2><p>Read signal history, calculate changes, and reduce short-lived noise.</p></div></div>
          <div className="docs-warning"><b>N is a sample count, not a time value.</b><span>At 50 Hz, a 10-sample window is approximately 200 ms. In an irregularly sampled log, the actual window duration varies. N must be an integer from 1 through 10,000 and can be supplied through a parameter.</span></div>
          <div className="docs-window-table"><div className="head"><span>Function</span><span>Result</span><span>Boundary behavior</span></div>{WINDOW_FUNCTIONS.map((item) => <div key={item.name}><code>{item.name}</code><span>{item.result}</span><small>{item.edge}</small></div>)}</div>
          <h3>Examples</h3><CodeExample>{`// Smoothed boost error over the latest 10 samples\nmoving_avg([Boost Target] - [Boost Actual], 10)\n\n// RPM change relative to 5 samples earlier\ndelta([Engine Speed (rpm)], 5)\n\n// Maximum temperature in a complete 100-sample window\nmoving_max([Intake Air Temperature (°C)], WINDOW)`}</CodeExample>
          <p>For <code>lag</code> and <code>delta</code>, the first N rows do not have enough history. A moving function starts producing results at row N−1. If any value inside a complete moving window is not numeric, that window produces <code>NaN</code>.</p>
        </section>

        <section id="diagnostic-rules" className="docs-section"><div className="docs-heading"><span>05</span><div><h2>Log analysis rules</h2><p>Custom rules detect continuous intervals during which their configured conditions are true.</p></div></div>
          <div className="docs-callout"><Gauge size={18} /><div><b>Custom rules use the temporal detector</b><p>Rules created in the editor use the general-purpose temporal detector. Specialized built-in detectors—WOT pull, dropout, wheel mismatch, and others—can be configured or duplicated, but their underlying algorithms are provided by WOT Lab.</p></div></div>
          <h3>How a rule is evaluated</h3><ol className="docs-process"><li><span>1</span><div><b>Channels are resolved</b><p>Canonical references such as <code>[engine.rpm]</code> are connected to actual CSV columns.</p></div></li><li><span>2</span><div><b>Conditions are evaluated per sample</b><p><strong>All conditions</strong> requires every condition; <strong>Any condition</strong> requires at least one.</p></div></li><li><span>3</span><div><b>Intervals are built</b><p>Duration removes short intervals, while Cooldown merges neighboring episodes.</p></div></li><li><span>4</span><div><b>The WOT filter is applied</b><p>With <strong>WOT area only</strong> enabled, only event portions intersecting a detected WOT pull remain.</p></div></li><li><span>5</span><div><b>Events are correlated</b><p>The Correlation window connects issues that occur close together for joint analysis.</p></div></li></ol>
          <h3>Rule fields</h3><div className="docs-definition-grid"><div><code>Severity</code><p>The event&apos;s base level: info, warning, or critical.</p></div><div><code>WOT area only</code><p>Restricts results to automatically detected wide-open-throttle pulls.</p></div><div><code>Duration, ms</code><p>Minimum continuous time for which the conditions must remain true.</p></div><div><code>Cooldown, ms</code><p>Maximum gap across which adjacent episodes are merged.</p></div><div><code>Correlation window, ms</code><p>Time interval used to associate events from different rules.</p></div><div><code>Parameters</code><p>Threshold values used by expressions; double-click a name to edit it.</p></div><div><code>Recommended channels</code><p>Canonical channels suggested for inspection alongside the event.</p></div><div><code>Message / Possible causes</code><p>The result explanation and a list of diagnostic hypotheses.</p></div></div>
          <h3>Example WOT rule</h3><CodeExample>{`Name: Boost under target\nWOT area only: enabled\n\nCondition 1:\n  [boost.target] - [boost.actual]  >  MAX_ERROR\nCondition 2:\n  [engine.rpm]  >  MIN_RPM\n\nParameters:\n  MAX_ERROR = 0.25\n  MIN_RPM = 2500\nDuration = 200 ms\nCooldown = 300 ms`}</CodeExample>
          <p>Window functions are allowed on either side of a condition. For example, use <code>moving_avg([boost.target] - [boost.actual], 10) &gt; MAX_ERROR</code> to ignore single-sample spikes. If a required canonical channel is not mapped, the condition is unavailable and the rule produces no events.</p>
          <div className="docs-warning"><b>WOT rules depend on detected pulls.</b><span>If WOT Pull cannot be detected from the available channels and profile thresholds, rules with WOT area only enabled produce no events. After changing rules or mappings, select <strong>Re-run diagnostics</strong>.</span></div>
        </section>

        <section id="channel-mapping" className="docs-section"><div className="docs-heading"><span>06</span><div><h2>Why rule channel names are different</h2><p>A canonical layer makes rules independent of a particular logger.</p></div></div>
          <div className="docs-mapping-flow"><code>Boost Pressure Actual (bar)</code><span>automatic or manual mapping</span><code>[boost.actual]</code></div>
          <p>A calculated formula uses the exact column name from the current file. A diagnostic rule uses a stable canonical name. The resolver collects every match and selects the most specific pattern with the highest confidence, so CSV column order does not determine the result.</p>
          <p>If the automatic choice is wrong or a logger uses a new name, open <strong>Settings → Diagnostics → Map channels</strong> or use <strong>Map channels</strong> in the rule editor. A manual mapping takes priority and is retained for future logs containing that source column name.</p>
          <div className="docs-note"><b>Mapping does not convert units</b><span>A rule threshold must match the actual channel unit. For example, a threshold expressed in bar cannot be applied to a kPa signal without adjusting the threshold.</span></div>
        </section>

        <section id="recipes" className="docs-section"><div className="docs-heading"><span>07</span><div><h2>Ready-to-use recipes</h2><p>Starter formulas you can adapt to the channel names in your own log.</p></div></div>
          <div className="docs-recipes"><article><span>BOOST</span><h3>Boost error</h3><CodeExample>{`[Boost Target] - [Boost Actual]`}</CodeExample></article><article><span>FUEL</span><h3>Lambda error</h3><CodeExample>{`[Lambda Actual] - [Lambda Target]`}</CodeExample></article><article><span>SMOOTHING</span><h3>Smoothed signal</h3><CodeExample>{`moving_avg([Fuel Pressure Actual], 20)`}</CodeExample></article><article><span>RATE</span><h3>Windowed change</h3><CodeExample>{`delta([Engine Speed (rpm)], 5)`}</CodeExample></article><article><span>LIMIT</span><h3>Range limit</h3><CodeExample>{`clamp([Throttle Position], 0, 100)`}</CodeExample></article><article><span>CONDITION</span><h3>Conditional signal</h3><CodeExample>{`if([Engine Speed] > MIN_RPM, [Boost Actual], 0)`}</CodeExample></article></div>
        </section>

        <footer className="docs-footer"><WotLabBrand compact /><span>This guide describes the current WOT Lab safe formula engine and diagnostics implementation.</span><Link href="/"><ArrowLeft size={14} /> Open the log viewer</Link></footer>
      </article>
    </div>
  </main>;
}
