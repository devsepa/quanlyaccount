# Stylesheets

Load in this order: core.css, workspace.css, controls.css, filter-queue.css, dashboard.css, analytics.css, layout-refinement.css.

- core.css: original theme, common elements and feature styles.
- workspace.css: working layout, tables, typography and analytics layout.
- controls.css: floating controls, account cards, storage navigation, responsive safeguards and backup preview.

The original cascade order is preserved. Six exact duplicate rules were removed only where selector, declarations and media/supports context matched. Keep changes in the relevant existing rule rather than appending successive overrides. Avoid reordering media queries without comparing desktop and mobile rendering.

- filter-queue.css: filter queue, account tools, BAN and unban tracking.
- dashboard.css: final Minimal Dark theme, sidebar, overview and mobile layout. Keep this last; it intentionally replaces legacy shell styling without changing account logic.

- analytics.css: report modal presentation, responsive KPIs, report tabs, charts and scrollable tables. Scoped to #analytics-modal; keep report calculations in analytics-report.js unchanged.

- layout-refinement.css: reference dashboard composition; phone header, docked navigation, warehouse cards, search/filter controls and list status placement. Load last. Reuses the original DOM controls and their handlers.
