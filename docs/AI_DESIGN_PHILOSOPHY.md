# AI Design Philosophy for Spatial View

## The Problem: Tool Overload Makes AI Dumb

### What We Had Before
The AI assistant had 30+ specialized tools:
- `arrangeCardsInGrid`
- `arrangeCardsTimeline`
- `arrangeCardsKanban`
- `arrangeCardsMindMap`
- `arrangeCardsCluster`
- `arrangeAllTagsInGrids`
- `arrangeCardsByDay`
- `applySchoolColorScheme`
- `colorCardsByPattern`
- `groupCardsByCategory`
- ... and many more

### The Failure Mode

When a user asked "arrangera i 3 kategorier" (arrange in 3 categories), the AI would:
1. See the word "kategorier" → pattern match to "categories"
2. Look for a tool called "arrangeByCategories" or similar
3. Find `arrangeAllTagsInGrids` which mentions "kategorier"
4. Call it blindly without understanding what it does
5. Result: ALL 60 tags get their own grid, not 3 categories

**The AI was not thinking - it was pattern matching.**

## The Core Insight: Craftsman vs. Beginner

> "En duktig hantverkare kommer längre med en hammare och en såg, än en nybörjare kommer med senaste cirkelsågen."
>
> *"A skilled craftsman with a hammer and saw gets further than a beginner with the latest circular saw."*

### Why This Matters

**With 30+ specialized tools:**
- AI becomes a "tool selector" not a "problem solver"
- Rigid: can only do what predefined tools allow
- Brittle: fails when request doesn't match any tool exactly
- Dumb: doesn't understand WHY or HOW, just WHICH tool

**With minimal tools + deep understanding:**
- AI becomes a true problem solver
- Flexible: can compose any arrangement from basic operations
- Robust: adapts to any request by reasoning about it
- Smart: understands spatial principles and designs solutions

## The New Approach: Minimal Tools + Deep Understanding

### The Minimal Toolbox

**Information:**
- `getAllCards()` - read all cards with full data
- `searchCards(query)` - Boolean search
- `listAllTags()` - see all tags with counts
- Filter functions (by tag, date, image, mentioned date)

**Manipulation:**
- `updateCards(updates)` - batch update positions, colors, tags
- `selectCards(cardIds)` - visually highlight cards
- `addTagsToCards / removeTagsFromCards` - tag management

**Context:**
- `getCanvasInfo()` - canvas size, card dimensions, spacing principles

### The Deep Understanding

Instead of tool descriptions, the AI now has:

**1. Spatial Geometry Knowledge**
- Cards are exactly 200×150px
- 13-20px spacing = same group/category
- 200-300px spacing = different groups/categories
- Canvas is infinite 2D coordinate system

**2. Visual Pattern Knowledge**
- Grid layout: regular structure, equal importance
- Clusters: related items close, different clusters far apart
- Timeline: shows progression or chronology
- Hierarchy: central → peripheral, or top → bottom

**3. Arrangement Algorithms**
```
Categorization (N themes):
  For each category i:
    x = 100 + i * 450  // 200px card + 250px spacing
    For each card j in category:
      y = 100 + j * 165  // 150px card + 15px spacing

Timeline (chronological):
  Sort cards by date
  Horizontal: x = 100 + i * 215, y groups by category
  Vertical: y = 100 + i * 165, x groups by category

Clusters (by similarity):
  1. Group cards by content similarity
  2. For each cluster: arrange in grid (15px spacing)
  3. Place clusters 250-300px apart
```

**4. Composition Skill**
The AI can now:
1. **Understand** the request ("3 categories")
2. **Analyze** the data (which cards, what themes?)
3. **Design** the layout (3 columns, how to space them)
4. **Calculate** exact positions (x=100, x=450, x=800)
5. **Execute** with `updateCards([{id, x, y}, ...])`
6. **Explain** the reasoning to the user

## Meta-Tags: A Critical Requirement

### What Are Meta-Tags?

Meta-tags are system-generated tags starting with `#` that indicate the SOURCE or PROCESS of a card:
- `#zotero` - imported from Zotero (research literature)
- `#gemini` - created/edited by Gemini AI
- `#calendar` - imported from Google Calendar
- `#ocr` - text extracted via OCR from image
- `#drive` - synced from Google Drive

### The Absolute Rule

**Meta-tags MUST ALWAYS be included in all analysis and grouping operations.**

❌ **Wrong:** "Organize my cards" → skip cards with #zotero, #gemini
✅ **Correct:** "Organize my cards" → include ALL cards, meta-tags and regular tags

### Why This Matters

Meta-tags represent SIGNIFICANT portions of the user's data:
- Research notes (#zotero) might be 50% of all cards
- AI-generated insights (#gemini) are valuable content
- Calendar events (#calendar) are time-critical information

Ignoring meta-tags = ignoring half the user's knowledge base.

## Architecture: Where Tools Live

### For the AI
**Location:** `src/canvas/core.js` lines 5139-5363 (function declarations)

The AI sees these tools in its tool declarations:
- Basic information tools
- `updateCards` and `getCanvasInfo`
- Tag manipulation
- Calendar tools (for integrations)

**The AI does NOT see:**
- Specialized arrange-* tools
- Pre-made layout functions
- Fixed pattern tools

### For the User
**Location:** `src/canvas/core.js` lines 5367-6524 (toolRegistry implementations)

All the old arrange functions STILL EXIST in the codebase:
- `arrangeCardsInGrid`
- `arrangeCardsTimeline`
- `arrangeCardsKanban`
- etc.

These are available through:
- Keyboard shortcuts
- Toolbar buttons
- Command palette
- Direct function calls

**The user keeps all their tools!** We only changed what the AI can access.

## Benefits of This Approach

### 1. Intelligent Responses
**Before:** "arrange in 3 categories" → calls wrong tool → 60 grids
**After:** "arrange in 3 categories" → analyzes data → identifies 3 meaningful themes → calculates 3-column layout → executes

### 2. Flexibility
**Before:** Can only do pre-programmed arrangements
**After:** Can create ANY layout: grids, timelines, clusters, hierarchies, custom patterns

### 3. Adaptability
**Before:** "sort by importance" → no tool for that → fails
**After:** "sort by importance" → identifies importance from tags/dates/content → designs appropriate visual hierarchy

### 4. Transparency
**Before:** "I used arrangeAllTagsInGrids" (user doesn't know what that means)
**After:** "I identified 3 themes: Research (28 cards including #zotero), Planning (30 cards including #calendar), Creative (5 cards). I arranged them in 3 columns with 250px separation."

### 5. Scalability
**Before:** Need to code a new tool for each new arrangement pattern
**After:** AI can compose any new pattern from basic operations

## Implementation Details

### Changes Made

1. **Removed from AI's toolbox** (lines 5230-5417 in core.js):
   - arrangeCardsInGrid
   - groupCardsByCategory
   - arrangeAllTagsInGrids
   - arrangeCardsByDay
   - applySchoolColorScheme
   - colorCardsByPattern
   - arrangeCardsTimeline
   - arrangeCardsKanban
   - arrangeCardsMindMap
   - arrangeCardsCluster

2. **Added to AI's toolbox** (lines 5326-5362 in core.js):
   - `updateCards(updates)` - batch update cards
   - `getCanvasInfo()` - get dimensions and spacing info

3. **Completely rewrote system prompt** (lines 332-586 in gemini.js):
   - Removed tool descriptions
   - Added spatial reasoning knowledge
   - Added arrangement algorithms
   - Emphasized meta-tags importance
   - Added composition examples

### Implementation Notes

**Function implementations remain unchanged** - all arrange-* functions still exist in toolRegistry (lines 5767+). They're just not exposed to the AI.

**User shortcuts unchanged** - all keyboard shortcuts, buttons, and commands still work exactly as before.

**Only AI behavior changed** - the AI now reasons about layouts instead of selecting pre-made tools.

## Testing the New System

### Test Cases

1. **"Arrangera i 3 kategorier"**
   - Expected: AI analyzes all cards, identifies 3 meaningful themes, creates 3-column layout
   - Should NOT: Call arrangeAllTagsInGrids and create 60 grids

2. **"Gruppera forskningskort"**
   - Expected: AI finds all cards with #zotero and research-related tags, clusters them together
   - Should: Include meta-tagged cards (#zotero, #gemini)

3. **"Visa min vecka som en tidslinje"**
   - Expected: AI filters cards from this week, sorts by date, arranges horizontally with proper spacing
   - Should: Use updateCards with calculated positions

4. **"Samla duplicerade kort"**
   - Expected: AI identifies duplicate content, creates clusters for each set
   - Should: Use spatial reasoning to layout clusters with appropriate separation

### Success Criteria

✅ AI explains its reasoning before acting
✅ AI includes meta-tagged cards in all operations
✅ AI uses updateCards for all spatial arrangements
✅ Arrangements respect spacing principles (15px within, 250px between)
✅ User shortcuts and buttons still work as before

## Future Considerations

### Potential Enhancements

1. **More sophisticated similarity detection** - use embeddings for semantic clustering
2. **Learning from user corrections** - adapt arrangement preferences based on feedback
3. **Context-aware layouts** - different default patterns for different types of content
4. **Animated transitions** - smooth visual movement when rearranging

### Not Planned

❌ Adding more specialized tools back
❌ Creating AI-specific shortcuts that bypass reasoning
❌ Pattern-matching based tool selection

## Philosophy: Trust the AI's Intelligence

The fundamental shift is from **"AI as tool executor"** to **"AI as intelligent problem solver"**.

We're not limiting the AI - we're empowering it to think.

---

*For implementation details, see `src/canvas/core.js` (tools) and `src/lib/gemini.js` (system prompt).*
*For architecture overview, see `ARCHITECTURE.md`.*
