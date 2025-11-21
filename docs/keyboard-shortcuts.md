# Keyboard shortcut workflow

Use the shared command registry to avoid diverging shortcuts between the canvas, command palette, and other views.

## Adding or updating a shortcut

1. **Declare the command** in [`src/lib/command-registry.js`](../src/lib/command-registry.js): set `id`, `name/description`, `keyBinding`, `category`, and `contexts`. Icons and `showInPalette` are optional, but key bindings plus contexts are required for conflict detection.
2. **Register the handler** where the behavior lives (for example in `registerCanvasCommands` inside `src/canvas/core.js` or `initSearchBar` in `src/ui/search-bar.js`). Call `registerCommand` with the command `id`, a `handler`, and any overrides such as `allowInInputs`.
3. **Check for conflicts**: the registry logs a warning if two commands share the same binding in an overlapping context. Resolve by adjusting the binding or contexts before shipping.
4. **Verify the palette/shortcuts**: open the app, trigger the binding, and confirm the command appears in the palette (only commands with handlers are shown) and executes in the right view.

## Notes

- Contexts derive from `setContextResolver` in `src/main.js` so board-only shortcuts disappear when the column view is active.
- Escape and search behaviors are registered via the registry, so avoid adding separate global listeners for those keys.
- Use `allowInInputs: true` only for commands that must run while a text field is focused.
