# Navigation composition qualification

The standard and compact layouts use the same package navigation primitives. In
compact mode, the app owns the order, labels, and style of the buttons, the
padded minimap frame, the node marks, and the viewport outline. The package owns
camera input and the mapping from the SVG to world coordinates.

- [Standard navigation](navigation-standard.png)
- [Compact navigation](navigation-compact.png)
- [Compact navigation with a collapsed Onion Architecture group](navigation-groups.png)

The local Chromium run checked zoom in and out, Arrow and Shift+Arrow pan, Home
fit, Enter centering, and pointer navigation within the SVG coordinate plane.
It compared the exported graph before and after navigation, then verified one
Undo removed the prior graph edit. Minimal mode hid the minimap while leaving
zoom available. The collapsed group hid its descendants in the overview. No
browser runtime errors were observed.

To reproduce from the repository root:

```sh
bun run --filter @opsydyn/flow-sample build
cd apps/web
node --input-type=module < ../flow-sample/evidence/navigation-browser.mjs
```

The script serves the built sample on a loopback port and writes screenshots to
`/tmp/foldkit-flow-navigation-{standard,compact,groups}.png`.
