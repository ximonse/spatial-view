# Documentation Audit - 2025-11-22

## Executive Summary

This audit compared 10 documentation files to identify inconsistencies, outdated information, and gaps. The core finding is **architectural debt**: documentation describes an ideal modular structure (300-line files, 13 modules) but reality shows most code remains in `src/canvas/core.js` (9272 lines) with thin wrapper modules that just re-export.

## Files Audited

1. `ARCHITECTURE.md`
2. `BUILD.md`
3. `FEATURES.md`
4. `README.md`
5. `docs/ADR-001-why-konva.md`
6. `docs/ADR-002-indexeddb-storage.md`
7. `docs/ADR-003-incremental-sync.md`
8. `docs/ai-chooser-review.md`
9. `docs/card-creation-rules.md`
10. `docs/keyboard-shortcuts.md`

## Critical Issues (Fix Immediately)

### 1. ARCHITECTURE.md Claims 300-Line Limit But Reality Doesn't Match

**Problem**:
- ARCHITECTURE.md states: "INGEN fil över 300 rader - dela upp INNAN du lägger till funktionalitet"
- Reality: `src/canvas/core.js` is **9272 lines**
- The "modular structure" described exists as thin wrappers that re-export from core.js

**Files Affected**: `ARCHITECTURE.md`

**Impact**: HIGH - Misleads developers about actual codebase structure

**Recommendation**: Update ARCHITECTURE.md to acknowledge current state and explain migration plan

---

### 2. Sepia Theme Exists in Code But Not Documented or Activatable

**Problem**:
- `src/ui/theme.js` has complete sepia theme implementation
- No UI button or keyboard shortcut to activate it
- Not mentioned in any documentation
- Dead code taking up space

**Files Affected**: `FEATURES.md`, `README.md`, UI code

**Impact**: MEDIUM - Confusing orphaned code, potential for user confusion

**Recommendation**: Either remove sepia theme entirely OR add UI to activate it and document

---

### 3. ADR-003 Describes Google Drive as "Future" But It's Implemented

**Problem**:
- ADR-003 status: "Planned" (dated 2024-11-05)
- Reality: Google Drive sync is fully implemented and working
- Misleading status suggests feature doesn't exist yet

**Files Affected**: `docs/ADR-003-incremental-sync.md`

**Impact**: MEDIUM - Confuses project status and feature availability

**Recommendation**: Update status to "Implemented" with implementation date

---

## Important Issues (Fix Within Week)

### 4. Missing Module Reference Documentation

**Problem**: No central document listing all source files and their purposes

**Recommendation**: Create `docs/module-reference.md` with complete file listing

---

### 5. card-creation-rules.md Doesn't Clarify Module Structure

**Problem**: Document lists files but doesn't explain that most are thin wrappers around core.js

**Recommendation**: Add note explaining actual vs. documented architecture

---

### 6. Overlapping Documentation Between README and FEATURES

**Problem**:
- README.md and FEATURES.md both describe features
- Information is duplicated and sometimes inconsistent
- No clear "source of truth"

**Recommendation**: Make FEATURES.md the detailed reference, README.md the overview

---

### 7. Keyboard Shortcuts Documentation Fragile

**Problem**:
- `docs/keyboard-shortcuts.md` manually maintained
- Easy to get out of sync with `src/command-registry.js`
- Already has inconsistencies (F3 conflict, missing Escape)

**Recommendation**: Auto-generate from command-registry.js or add validation

---

## Medium Priority Issues (Fix Within 2 Weeks)

### 8. AI System Poorly Documented

**Problem**:
- Two AI agents (Gemini and ChatGPT) with different tools
- No overview of AI integration architecture
- Tool capabilities scattered across code

**Recommendation**: Create `docs/ai-integration.md` with complete AI documentation

---

### 9. Color System Scattered Across Documentation

**Problem**:
- Zotero colors in card-creation-rules.md
- School subject colors only in code comments
- Calendar auto-coloring not documented
- No central color reference

**Recommendation**: Create `docs/color-system.md` consolidating all color schemes

---

### 10. View System Under-Documented

**Problem**:
- Board view and Column view exist
- View switching logic not explained
- `src/views/` directory mentioned but files not documented

**Recommendation**: Create `docs/views.md` explaining view system

---

### 11. Missing Changelog

**Problem**: No systematic record of changes, features, and fixes over time

**Recommendation**: Create `CHANGELOG.md` following Keep a Changelog format

---

## Optional Improvements (When Time Permits)

### 12. No Architecture Diagram

**Recommendation**: Add Mermaid.js diagram showing module relationships

---

### 13. Terminology Inconsistency (Swedish/English Mix)

**Problem**:
- Code uses English (card, board, column)
- UI and some docs use Swedish (kort, brädvy, kolumnvy)
- No glossary mapping terms

**Recommendation**: Create glossary section in README or separate file

---

### 14. Missing Inline Documentation (JSDoc)

**Recommendation**: Add JSDoc comments to key modules for better IDE support

---

### 15. BUILD.md Could Be More Comprehensive

**Recommendation**: Add troubleshooting section, deployment instructions, environment setup

---

### 16. No Contribution Guidelines

**Recommendation**: Create `CONTRIBUTING.md` with code standards and PR process

---

## Summary Statistics

- **Total Issues Identified**: 16
- **Critical**: 3
- **Important**: 4
- **Medium**: 4
- **Optional**: 5

## Action Plan

### Phase 1 (Immediate - Today)
1. Fix ARCHITECTURE.md to reflect reality
2. Decide on sepia theme (remove or activate)
3. Update ADR-003 status to "Implemented"

### Phase 2 (This Week)
4. Create module-reference.md
5. Update card-creation-rules.md with architecture note
6. Consolidate README vs FEATURES
7. Fix keyboard-shortcuts.md

### Phase 3 (Next Two Weeks)
8. Create ai-integration.md
9. Create color-system.md
10. Create views.md
11. Create CHANGELOG.md

### Phase 4 (Future)
12-16. Optional improvements as time permits

---

**Audit Performed**: 2025-11-22
**Auditor**: Claude Code
**Next Review**: After Phase 1 completion
