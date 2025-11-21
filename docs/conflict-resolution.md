# Resolving merge conflicts for color picker work

If you pull remote changes and Git reports merge conflicts, use these steps to get back to a clean working tree:

1. **Inspect conflicts**
   - Run `git status` to list conflicted files.
   - Open the files and search for `<<<<<<<` to locate conflict markers.
2. **Decide which side wins for palette helpers**
   - For changes in `src/canvas/core.js`, keep the shared palette map and the `normalizeHex` helper introduced in the "Normalize color selection handling" commit.
   - Preserve the logic that maps recent custom colors back to palette keys before applying updates.
3. **Re-apply any local adjustments**
   - If your branch adds new palette colors, merge them into the shared `PALETTE_HEX_BY_KEY` map instead of duplicating hex strings in pickers.
   - For UI tweaks, keep the dropdown-triggered pickers and recent-color suggestion list intact, then reapply layout adjustments around those components.
4. **Clean up conflict markers**
   - Remove all `<<<<<<<`, `=======`, and `>>>>>>>` lines after you choose the correct code.
5. **Verify behavior**
   - Run `npm run build` to ensure the pickers still compile and the palette utilities remain lint-clean.
   - Open the editors and confirm recent colors show up under the dropdown picker and update badges correctly.
6. **Commit the resolution**
   - After verifying, run `git commit` with a message like `Resolve merge conflicts`.

These steps prioritize keeping the normalized palette utilities and dropdown color pickers consistent across single-card and bulk editors while you reconcile incoming changes.
