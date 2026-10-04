# Promo v2: live line example

Approved outcome: teach developers by changing a chart, reading its actual source,
and running that example outside the monorepo. Deliver one complete line example
first; histogram and scatter follow separately.

Keep the Astro promo shell and introduce a FoldKit island at `/examples/line/`.
The island owns interpolation (smooth/linear/step), five values (0–100), and
Y-axis domain maximum (100–200). Reset restores the initial settings. Its model
is the only source of truth; browser effects are Commands.

Display actual maintained chart/application/CSS files and a settings module
that tracks the live controls. Provide copy with success/failure feedback,
project ZIP download and Open in StackBlitz. Both exports capture the current
settings and use the same maintained files as the preview. Include compiled
Foldkit Viz modules from this checkout because published versions lag behind.
Use a small Vite project with FoldKit for standalone execution; Astro remains
the promo host. No code editor or arbitrary code runner is added in this slice.

All actions and controls are keyboard accessible; preserve light/dark themes,
mobile fit, illustrative data labels and a static no-JavaScript explanation.
Do not publish or deploy. Preserve the existing uncommitted v1 work.

Verify state/geometry contracts and execute exported project code from a temporary
directory. Build the standalone project without workspace imports. Inspect both
themes, mobile, source synchronisation, reset, copy/download and playground launch
in the browser. Run root check/typecheck/workspace tests/build sequentially where
shared build outputs are involved.
