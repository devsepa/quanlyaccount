# Stylesheets

Load in this order: core.css, workspace.css, controls.css.

- core.css: original theme, common elements and feature styles.
- workspace.css: working layout, tables, typography and analytics layout.
- controls.css: floating controls, account cards, storage navigation, responsive safeguards and backup preview.

The original cascade order is preserved. Six exact duplicate rules were removed only where selector, declarations and media/supports context matched. Keep changes in the relevant existing rule rather than appending successive overrides. Avoid reordering media queries without comparing desktop and mobile rendering.
