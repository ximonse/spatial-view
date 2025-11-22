# Technical Debt

This document tracks known technical debt items that should be addressed when time permits.

## Code Cleanup

### Orphaned Sepia Theme
**Status:** Deprecated
**Date Identified:** 2025-11-22

**Description:**
Sepia theme CSS exists in `src/assets/cards-colors.css` (18 references) but is not activatable:
- Not in `THEMES` array in `src/ui/theme.js`
- No UI button or keyboard shortcut
- Never tested or used

**Action:**
Remove all `.sepia-theme` CSS rules from:
- `src/assets/cards-colors.css` (18 occurrences)
- Any other CSS files with sepia references

**Reason for Delay:**
Low priority - doesn't affect functionality, just clutters CSS files.

---

## Architecture Debt

### Core.js Monolith
**Status:** Known Issue
**Date Identified:** 2025-11-22

**Description:**
`src/canvas/core.js` is 8023 lines, violating the 300-line rule documented in ARCHITECTURE.md. Most "modules" in `src/canvas/` are thin wrappers that re-export from core.js.

**Impact:**
- Harder to navigate codebase
- Longer file load times in editors
- Violates Single Responsibility Principle

**Action:**
See ARCHITECTURE.md "Framtida migration" section for detailed refactoring plan.

**Reason for Delay:**
- Tight coupling between functions and global state
- Risk of introducing bugs during refactoring
- Current section-based organization is adequate for now
- Prioritizing features over perfect architecture

---

**Last Updated:** 2025-11-22
