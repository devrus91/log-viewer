import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, Braces, Gauge, Sigma } from "lucide-react";
import { WotLabBrand } from "@/components/WotLabBrand";

export const metadata: Metadata = {
  title: "Документация — WOT Lab",
  description: "Руководство по виртуальным каналам, диагностическим правилам и оконным функциям WOT Lab.",
};

const WINDOW_FUNCTIONS = [
  { name: "lag(expr, N)", result: "Значение expr N отсчётов назад.", edge: "Первые N результатов — NaN." },
  { name: "delta(expr, N)", result: "Текущее значение минус значение N отсчётов назад.", edge: "Первые N результатов — NaN." },
  { name: "moving_avg(expr, N)", result: "Среднее по последним N отсчётам, включая текущий.", edge: "Нужно полное окно без NaN." },
  { name: "moving_min(expr, N)", result: "Минимум по последним N отсчётам.", edge: "Нужно полное окно без NaN." },
  { name: "moving_max(expr, N)", result: "Максимум по последним N отсчётам.", edge: "Нужно полное окно без NaN." },
  { name: "moving_sum(expr, N)", result: "Сумма последних N отсчётов.", edge: "Нужно полное окно без NaN." },
];

const SCALAR_FUNCTIONS = [
  ["abs(x)", "модуль"], ["min(a, b, …)", "минимум"], ["max(a, b, …)", "максимум"],
  ["avg(a, b, …)", "среднее аргументов"], ["sqrt(x)", "квадратный корень"], ["pow(x, y)", "x в степени y"],
  ["clamp(x, min, max)", "ограничение диапазона"], ["round(x)", "округление"], ["floor(x)", "округление вниз"],
  ["ceil(x)", "округление вверх"], ["if(condition, yes, no)", "условный выбор"],
];

function CodeExample({ children }: { children: string }) {
  return <pre className="docs-code"><code>{children}</code></pre>;
}

export default function DocumentationPage() {
  return <main className="docs-page" lang="ru">
    <header className="docs-topbar"><Link href="/" aria-label="На главную WOT Lab"><WotLabBrand compact /></Link><div className="docs-topbar-actions"><span>LOG VIEWER MANUAL</span><nav className="docs-language-switcher" aria-label="Язык документации"><Link className="active" href="/docs" lang="ru" aria-current="page">RU</Link><Link href="/docs/en" lang="en">EN</Link></nav><Link className="docs-back-link" href="/"><ArrowLeft size={15} /> Вернуться в приложение</Link></div></header>
    <div className="docs-shell">
      <aside className="docs-nav"><div><BookOpen size={17} /><span><b>Документация</b><small>Формулы и диагностика</small></span></div><nav aria-label="Разделы документации">
        <a href="#quick-start">Быстрый старт</a>
        <a href="#calculated-channels">Виртуальные каналы</a>
        <a href="#formula-language">Язык формул</a>
        <a href="#window-functions">Оконные функции</a>
        <a href="#diagnostic-rules">Правила анализа</a>
        <a href="#channel-mapping">Маппинг каналов</a>
        <a href="#recipes">Готовые примеры</a>
      </nav><p>Вычисления выполняются локально в браузере. Логи и пользовательские настройки не отправляются на сервер.</p></aside>

      <article className="docs-content">
        <section className="docs-hero"><span className="eyebrow">WOT LAB · USER GUIDE</span><h1>Формулы и правила,<br /><em>которым можно доверять.</em></h1><p>Практическое руководство по созданию вычисляемых сигналов и диагностике автомобильных CSV-логов.</p><div className="docs-hero-cards"><a href="#calculated-channels"><Sigma size={18} /><span><b>Виртуальные каналы</b><small>Производные сигналы</small></span></a><a href="#diagnostic-rules"><Gauge size={18} /><span><b>Правила анализа</b><small>События только в WOT</small></span></a><a href="#window-functions"><Braces size={18} /><span><b>Оконные функции</b><small>История и сглаживание</small></span></a></div></section>

        <section id="quick-start" className="docs-section"><div className="docs-heading"><span>01</span><div><h2>Быстрый старт</h2><p>Два независимых инструмента используют один безопасный язык выражений.</p></div></div><div className="docs-steps"><article><b>Виртуальный канал</b><ol><li>Откройте CSV-лог.</li><li>Нажмите <strong>Formula</strong> или <kbd>Ctrl/⌘+F</kbd>.</li><li>Задайте имя, единицу и выражение.</li><li>Нажмите <strong>Create channel</strong>.</li></ol></article><article><b>Правило диагностики</b><ol><li>Откройте <strong>Settings → Diagnostics</strong>.</li><li>Выберите <strong>Configure diagnostic rules</strong>.</li><li>Нажмите <strong>New rule</strong>.</li><li>Настройте условия и выполните <strong>Re-run diagnostics</strong>.</li></ol></article></div></section>

        <section id="calculated-channels" className="docs-section"><div className="docs-heading"><span>02</span><div><h2>Виртуальные (calculated) каналы</h2><p>Новый канал рассчитывается для каждого отсчёта исходного лога.</p></div></div>
          <div className="docs-callout"><Sigma size={18} /><div><b>Главное правило синтаксиса</b><p>Имя канала из CSV указывается точно, с пробелами и единицами, внутри квадратных скобок: <code>[Boost Pressure Actual (bar)]</code>. Проще нажать канал в правой колонке Formula Builder — ссылка вставится автоматически.</p></div></div>
          <h3>Поля Formula Builder</h3><div className="docs-definition-grid"><div><code>Channel name</code><p>Уникальное отображаемое имя. Его можно использовать в других виртуальных каналах.</p></div><div><code>Unit</code><p>Подпись единицы измерения. Приложение не выполняет автоматическую конвертацию единиц.</p></div><div><code>Expression</code><p>Формула, вычисляемая для каждого отсчёта. Доступны каналы, параметры, операторы и функции.</p></div><div><code>Reusable parameters</code><p>Именованные числовые константы. Например, <code>BAR_TO_PSI = 14.5038</code>.</p></div></div>
          <h3>Простой пример</h3><CodeExample>{`Имя: Boost Error\nЕдиница: bar\nФормула: [Boost Pressure Target (bar)] - [Boost Pressure Actual (bar)]`}</CodeExample>
          <p>Определения сохраняются в <code>localStorage</code> текущего браузера и восстанавливаются для следующих логов. Если необходимого исходного канала нет или его имя отличается, такой вычисляемый канал не сможет материализоваться. При переименовании канала зависимые сохранённые формулы обновляются; циклические зависимости блокируются.</p>
          <div className="docs-note"><b>Редактирование</b><span>Выберите calculated-канал на графике и нажмите <strong>Edit selected</strong> либо значок карандаша рядом с ним в списке каналов. После сохранения пересчитываются и зависящие от него виртуальные каналы.</span></div>
        </section>

        <section id="formula-language" className="docs-section"><div className="docs-heading"><span>03</span><div><h2>Язык формул</h2><p>Выражения разбираются собственным парсером — произвольный JavaScript не выполняется.</p></div></div>
          <div className="docs-syntax-table"><div><b>Канал</b><code>[Engine Speed (rpm)]</code><span>Точное имя исходного или calculated-канала</span></div><div><b>Параметр</b><code>MIN_RPM</code><span>Идентификатор: буквы, цифры и _, не начиная с цифры</span></div><div><b>Число</b><code>0.5 · .5 · 1e-3</code><span>Десятичные и экспоненциальные значения</span></div><div><b>Арифметика</b><code>+ − * / % ^</code><span>Стандартный приоритет; скобки меняют порядок</span></div><div><b>Сравнение</b><code>&gt; &gt;= &lt; &lt;= == !=</code><span>Результат 1 для true и 0 для false</span></div><div><b>Логика</b><code>AND · OR · NOT</code><span>Комбинация числовых условий</span></div></div>
          <h3>Скалярные функции</h3><div className="docs-function-grid">{SCALAR_FUNCTIONS.map(([signature, description]) => <div key={signature}><code>{signature}</code><span>{description}</span></div>)}</div>
          <p className="docs-muted">Деление или остаток от деления на ноль дают <code>NaN</code>. Отсутствующий канал или параметр считается ошибкой формулы. Регистр имени канала и его написание должны совпадать.</p>
        </section>

        <section id="window-functions" className="docs-section"><div className="docs-heading"><span>04</span><div><h2>Оконные функции</h2><p>Позволяют обращаться к истории сигнала и подавлять кратковременный шум.</p></div></div>
          <div className="docs-warning"><b>N — количество отсчётов, а не время.</b><span>При частоте 50 Гц окно 10 отсчётов примерно равно 200 мс. Для нерегулярного лога фактическая длительность окна меняется. N должно быть целым числом от 1 до 10 000 и может быть задано параметром.</span></div>
          <div className="docs-window-table"><div className="head"><span>Функция</span><span>Результат</span><span>Границы</span></div>{WINDOW_FUNCTIONS.map((item) => <div key={item.name}><code>{item.name}</code><span>{item.result}</span><small>{item.edge}</small></div>)}</div>
          <h3>Примеры</h3><CodeExample>{`// Сглаженное отклонение наддува за последние 10 отсчётов\nmoving_avg([Boost Target] - [Boost Actual], 10)\n\n// Изменение оборотов относительно 5 отсчётов назад\ndelta([Engine Speed (rpm)], 5)\n\n// Максимальная температура в полном окне из 100 отсчётов\nmoving_max([Intake Air Temperature (°C)], WINDOW)`}</CodeExample>
          <p>Для <code>lag</code> и <code>delta</code> первые N строк не имеют достаточной истории. Для moving-функций результат появляется с строки N−1. Если в полном moving-окне есть нечисловое значение, результат этого окна — <code>NaN</code>.</p>
        </section>

        <section id="diagnostic-rules" className="docs-section"><div className="docs-heading"><span>05</span><div><h2>Правила анализа лога</h2><p>Пользовательские правила находят непрерывные интервалы, в которых выполняются заданные условия.</p></div></div>
          <div className="docs-callout"><Gauge size={18} /><div><b>Пользовательское правило — temporal</b><p>Созданные через интерфейс правила используют универсальный temporal-детектор. Специализированные встроенные детекторы — WOT pull, dropout, wheel mismatch и другие — можно настраивать и дублировать, но их алгоритм задаётся приложением.</p></div></div>
          <h3>Как вычисляется правило</h3><ol className="docs-process"><li><span>1</span><div><b>Каналы сопоставляются</b><p>Канонические ссылки вроде <code>[engine.rpm]</code> связываются с реальными колонками CSV.</p></div></li><li><span>2</span><div><b>Условия проверяются построчно</b><p>В режиме <strong>All conditions</strong> должны выполняться все условия, в <strong>Any condition</strong> — хотя бы одно.</p></div></li><li><span>3</span><div><b>Строятся интервалы</b><p>Короткие интервалы отбрасываются по Duration, соседние объединяются по Cooldown.</p></div></li><li><span>4</span><div><b>Применяется WOT-фильтр</b><p>Если включено <strong>WOT area only</strong>, остаются только части событий, пересекающиеся с найденными WOT-пуллами.</p></div></li><li><span>5</span><div><b>События коррелируются</b><p>Correlation window связывает близкие по времени проблемы для совместного анализа.</p></div></li></ol>
          <h3>Поля правила</h3><div className="docs-definition-grid"><div><code>Severity</code><p>Базовый уровень события: info, warning или critical.</p></div><div><code>WOT area only</code><p>Ограничивает результат автоматически определёнными участками полного газа.</p></div><div><code>Duration, ms</code><p>Минимальное непрерывное время выполнения условий.</p></div><div><code>Cooldown, ms</code><p>Максимальный разрыв, при котором эпизоды объединяются.</p></div><div><code>Correlation window, ms</code><p>Интервал для связывания событий разных правил.</p></div><div><code>Parameters</code><p>Пороговые значения для выражений; имя редактируется двойным кликом.</p></div><div><code>Recommended channels</code><p>Канонические каналы, которые предлагаются для просмотра вместе с событием.</p></div><div><code>Message / Possible causes</code><p>Текст результата и список гипотез для диагностической панели.</p></div></div>
          <h3>Пример WOT-правила</h3><CodeExample>{`Название: Boost under target\nWOT area only: включено\n\nУсловие 1:\n  [boost.target] - [boost.actual]  >  MAX_ERROR\nУсловие 2:\n  [engine.rpm]  >  MIN_RPM\n\nПараметры:\n  MAX_ERROR = 0.25\n  MIN_RPM = 2500\nDuration = 200 ms\nCooldown = 300 ms`}</CodeExample>
          <p>Оконные функции разрешены в обеих частях условия. Например, чтобы игнорировать одиночные пики: <code>moving_avg([boost.target] - [boost.actual], 10) &gt; MAX_ERROR</code>. Если нужный канонический канал не найден, условие недоступно и правило не создаёт событий.</p>
          <div className="docs-warning"><b>WOT зависит от найденных пуллов.</b><span>Если WOT Pull не определён из доступных каналов и порогов профиля, правила с включённым WOT area only не выдадут событий. После изменения правил или маппинга нажмите <strong>Re-run diagnostics</strong>.</span></div>
        </section>

        <section id="channel-mapping" className="docs-section"><div className="docs-heading"><span>06</span><div><h2>Почему имена каналов в правилах отличаются</h2><p>Правила независимы от конкретного логгера благодаря каноническому слою.</p></div></div>
          <div className="docs-mapping-flow"><code>Boost Pressure Actual (bar)</code><span>автоматический или ручной маппинг</span><code>[boost.actual]</code></div>
          <p>Виртуальная формула работает с точным именем колонки текущего файла. Диагностическое правило работает с устойчивым каноническим именем. Resolver собирает все совпадения и выбирает наиболее специфичный шаблон с максимальной уверенностью, поэтому порядок колонок CSV не определяет результат.</p>
          <p>Если автоматический выбор неверен или логгер использует новое название, откройте <strong>Settings → Diagnostics → Map channels</strong> либо кнопку <strong>Map channels</strong> в редакторе правил. Ручной маппинг имеет приоритет и сохраняется для будущих логов с таким именем колонки.</p>
          <div className="docs-note"><b>Маппинг не конвертирует единицы</b><span>Порог правила должен соответствовать единицам реального канала. Например, правило с порогом в bar нельзя без изменения порога применять к значению в kPa.</span></div>
        </section>

        <section id="recipes" className="docs-section"><div className="docs-heading"><span>07</span><div><h2>Готовые рецепты</h2><p>Стартовые формулы, которые можно адаптировать под названия каналов своего лога.</p></div></div>
          <div className="docs-recipes"><article><span>BOOST</span><h3>Ошибка наддува</h3><CodeExample>{`[Boost Target] - [Boost Actual]`}</CodeExample></article><article><span>FUEL</span><h3>Ошибка лямбды</h3><CodeExample>{`[Lambda Actual] - [Lambda Target]`}</CodeExample></article><article><span>SMOOTHING</span><h3>Сглаженный сигнал</h3><CodeExample>{`moving_avg([Fuel Pressure Actual], 20)`}</CodeExample></article><article><span>RATE</span><h3>Изменение за окно</h3><CodeExample>{`delta([Engine Speed (rpm)], 5)`}</CodeExample></article><article><span>LIMIT</span><h3>Ограничение диапазона</h3><CodeExample>{`clamp([Throttle Position], 0, 100)`}</CodeExample></article><article><span>CONDITION</span><h3>Условный сигнал</h3><CodeExample>{`if([Engine Speed] > MIN_RPM, [Boost Actual], 0)`}</CodeExample></article></div>
        </section>

        <footer className="docs-footer"><WotLabBrand compact /><span>Документация соответствует текущему безопасному движку формул и диагностике WOT Lab.</span><Link href="/"><ArrowLeft size={14} /> К просмотру логов</Link></footer>
      </article>
    </div>
  </main>;
}
