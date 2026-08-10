# 🎨 Wardrobe Tracker — Design Review

> **Date:** 2026-08-11
> **Reviewer:** tryclaw (design + accessibility audit)
> **Scope:** Full UI/UX review of all components and pages

---

## 🔴 CRITICAL ISSUES

### 1. Blank Page on GitHub Pages — DEPLOYMENT FAILURE
**Severity:** 🔴 Critical

**Problem:** BrowserRouter doesn't work with GitHub Pages (static file server). When user navigates to `/closet`, GitHub Pages tries to serve a file that doesn't exist. React never mounts.

**Fix:** Switch to `HashRouter` — uses `/#/closet` URLs which work on static hosts.

**Status:** ✅ Fixed in `App.tsx` (changed BrowserRouter → HashRouter)

---

## 🟡 VISUAL DESIGN ISSUES

### 2. Inconsistent Border Radii
**Severity:** 🟡 Medium

| Element | Current Radius | Recommended |
|---------|---------------|-------------|
| Cards | `rounded-xl` (18px) | Good |
| Buttons | `rounded-lg` (10px) | Good |
| Chips/Tags | `rounded-full` | Good |
| Input fields | `rounded-lg` (10px) | ✅ Consistent |
| Modals | `rounded-2xl` | Good, creates hierarchy |
| Color picker in filters | `rounded-lg` | **Inconsistent** — should be `rounded-full` |

**Fix:** Standardize to `rounded-lg` for all interactive elements, `rounded-xl` for cards/containers.

### 3. Color Contrast Issues
**Severity:** 🟡 Medium (Accessibility)

| Element | Foreground | Background | Ratio | WCAG AA? |
|---------|-----------|-----------|-------|---------|
| `text-text-muted` (#A8A39E) on `bg-surface` (#F5F0EB) | #A8A39E | #F5F0EB | 2.1:1 | ❌ Fail |
| `text-text-secondary` (#6B6560) on `bg-cream` (#FFFDF9) | #6B6560 | #FFFDF9 | 3.8:1 | ⚠️ Marginal |
| `text-text-muted` on `bg-cream` (#FFFDF9) | #A8A39E | #FFFDF9 | 2.0:1 | ❌ Fail |
| Accent text (#C4705A) on white | #C4705A | #FFF | 3.5:1 | ⚠️ Marginal |

**Fix:** 
- Darken `text-muted` from `#A8A39E` → `#8A8580` (ratio improves to ~3.2:1)
- Or add `font-medium` to all muted text to compensate with weight
- Consider a slightly darker `text-secondary` for better readability

### 4. Shadow Usage — Missing Depth Cues
**Severity:** 🟡 Medium

**Problem:** Cards use `border` but rarely `shadow`. On the cream background, bordered cards can feel flat. The only shadow is `hover:shadow-md` on closet items.

**Fix:** 
- Add subtle default shadow to elevated cards: `shadow-sm`
- Use `shadow-md` for modals (already done, good)
- Use `shadow-lg` for the mobile nav dropdown

### 5. Image Aspect Ratios Inconsistent
**Severity:** 🟡 Medium

**Problem:** 
- Closet grid: `aspect-[3/4]`
- Outfit builder: `aspect-[3/4]`
- Most worn: no explicit aspect ratio
- Statistics items: no explicit aspect ratio

This causes layout shifts when images load at different sizes.

**Fix:** 
- Standardize ALL clothing images to `aspect-[3/4]`
- Add `bg-surface` as placeholder background
- Add `loading="lazy"` to all images (already done in Closet, missing elsewhere)

### 6. Mobile Header — Action Buttons Too Small
**Severity:** 🟡 Medium

**Problem:** Mobile header has two buttons at `w-9 h-9` (36px). WCAG recommends 44×44px minimum for touch targets.

**Fix:** Increase to `w-11 h-11` (44px) on mobile.

### 7. Empty States — Generic & Bland
**Severity:** 🟡 Medium

**Problem:** All empty states use the same pattern: gray circle + icon + text. No personality, no illustration, no clear CTA hierarchy.

**Current:**
```
[ Gray circle with icon ]
"Your closet is empty"
"Start building..."
```

**Recommended:**
- Add a friendly illustration or larger icon
- Make the CTA button prominent, not just text
- Use warmer language
- Add a "Get Started" primary button

---

## 🟢 ACCESSIBILITY ISSUES

### 8. Missing `aria-label` on Icon Buttons
**Severity:** 🟢 Should Fix

**Problem:** Many icon-only buttons lack accessible labels:
- Mobile menu toggle (Menu/X)
- Add item button (Plus)
- Favorite buttons (Heart)
- Delete buttons (Trash2)
- Close buttons (X)

**Fix:** Add `aria-label` to all icon-only buttons:
```tsx
<button aria-label="Toggle navigation menu">
  <Menu size={18} />
</button>
```

### 9. Form Inputs — Missing `label` associations
**Severity:** 🟢 Should Fix

**Problem:** AddItemModal uses `<label>` visually but not programmatically linked:
```tsx
<label className="...">Item Name</label>
<input ... />  {/* No htmlFor + id */}
```

**Fix:** 
```tsx
<label htmlFor="item-name" className="...">Item Name</label>
<input id="item-name" ... />
```

### 10. Color Swatches — Missing Selected State (Non-Visual)
**Severity:** 🟢 Should Fix

**Problem:** Color picker buttons show selection via border + scale, but screen readers can't tell which is selected.

**Fix:** Add `aria-pressed={color === c}` to color buttons.

### 11. Modal Focus Trap — Missing
**Severity:** 🟢 Should Fix

**Problem:** When AddItemModal opens, focus isn't trapped inside. Tab key can escape to background elements.

**Fix:** Use `useEffect` to focus first input on open, and intercept Tab key at modal boundaries.

### 12. Focus Rings — Inconsistent
**Severity:** 🟢 Polish

**Problem:** Some elements have `focus:ring-2 focus:ring-accent/30`, others don't. The ring color is inconsistent (`accent/30` vs `accent`).

**Fix:** Standardize to `focus:ring-2 focus:ring-accent/40 focus:ring-offset-1` for all interactive elements.

---

## 🔵 UX / INTERACTION ISSUES

### 13. No Loading States
**Severity:** 🔵 Low

**Problem:** Images load without placeholders. On slow connections, users see broken layouts.

**Fix:** 
- Add skeleton placeholders for images
- Use `object-cover` with a background color (`bg-surface`)
- Consider a blur-up loading effect for uploaded images

### 14. No Toast/Feedback System
**Severity:** 🔵 Low

**Problem:** When user adds an item, deletes something, or logs a wear — there's no confirmation. User might think the action failed.

**Fix:** Add a toast notification system:
- "Item added to closet ✅"
- "Outfit saved ✅"
- "Wear logged for today ✅"
- "Item deleted"

### 15. Delete Confirmations — Too Aggressive
**Severity:** 🔵 Low

**Problem:** `confirm('Delete this item?')` uses the browser's native dialog — jarring, ugly, and inconsistent with the warm design.

**Fix:** Use inline confirmation (like the Settings page does for Reset) for all delete actions.

### 16. Search Input — No Clear Button
**Severity:** 🔵 Low

**Problem:** Once user types in the search field, there's no quick way to clear it.

**Fix:** Add an X button inside the search input when text is present.

### 17. Filter Panel — No Animation
**Severity:** 🔵 Polish

**Problem:** Filter panel appears/disappears instantly. Feels abrupt.

**Fix:** Add a smooth height animation using `framer-motion` or CSS transitions.

### 18. Category Chips — No "Active" Visual Distinction on Mobile
**Severity:** 🔵 Low

**Problem:** The active chip (All/Tops/etc.) uses `bg-accent text-white`, which is good. But on small screens with horizontal scroll, users might lose track of which is selected.

**Fix:** Add a subtle left border or underline to the active chip for additional affordance.

---

## 🟣 TYPOGRAPHY & SPACING

### 19. Font Size Hierarchy — Could Be Stronger
**Severity:** 🟣 Polish

**Current:**
- Page titles: `text-2xl` (24px)
- Card titles: `text-base` (16px)
- Body: `text-sm` (14px)
- Captions: `text-xs` (12px) + `text-[10px]`

**Issue:** The jump from `text-base` to `text-2xl` is too large. Missing an intermediate size for section headers.

**Fix:** 
- Use `text-xl` (20px) for section headers inside cards
- Reserve `text-2xl` for page titles only
- Standardize on `text-xs` for all metadata/captions — remove `text-[10px]`

### 20. Line Height — Too Tight in Some Places
**Severity:** 🟣 Polish

**Problem:** Dense cards with `space-y-2` can feel cramped, especially on mobile.

**Fix:** 
- Increase card padding from `p-4` to `p-5` on mobile
- Add `leading-relaxed` to description text

---

## 📋 COMPONENT-SPECIFIC FEEDBACK

### Dashboard
- ✅ Good greeting with time-aware message
- ✅ Quick stats cards are well-organized
- ⚠️ "What are you wearing today?" — good prompt, but needs a direct action button
- ❌ "Today's Suggestions" section only shows saved outfits, not actual AI suggestions
- ❌ Category breakdown progress bars have no animation

### Closet
- ✅ Grid layout is responsive
- ✅ Hover effects on items are nice
- ⚠️ Favorite/Delete buttons only appear on hover — inaccessible on touch devices
- ❌ Items are not clickable (no detail view opens on tap)
- ❌ Missing "quick add" or "log wear" from closet view

### Outfits
- ✅ Random outfit generator is fun
- ✅ Builder UI is intuitive
- ⚠️ No way to edit an existing outfit (only delete and recreate)
- ❌ "Wear Today" button on outfits — what if it's not today?

### Statistics
- ✅ Donut chart for utilization is effective
- ✅ Monthly activity bar chart is clear
- ⚠️ Bar chart lacks hover tooltips
- ❌ No comparison metrics (e.g., "+12% from last month")
- ❌ "Needs More Love" section shows items with 0-2 wears, but doesn't suggest how to style them

### Settings
- ✅ Clean, minimal design
- ✅ Good confirmation flow for reset
- ⚠️ Import/Export buttons are small
- ❌ No "About" section with version, credits, privacy policy

### AddItemModal
- ✅ Clean form layout
- ✅ Drag & drop for images
- ✅ Color picker with presets
- ⚠️ Form is long — consider stepper/wizard for mobile
- ❌ No image compression — large images will bloat localStorage
- ❌ No validation feedback (e.g., "Name is required" doesn't show visually)

---

## 🎯 PRIORITY MATRIX

| Priority | Issue | Effort |
|----------|-------|--------|
| **P0** | Fix deployment (HashRouter) | 5 min ✅ |
| **P1** | Add aria-labels to icon buttons | 15 min |
| **P1** | Fix color contrast (text-muted) | 5 min |
| **P1** | Make touch targets 44px minimum | 10 min |
| **P2** | Add toast notification system | 30 min |
| **P2** | Improve empty states | 20 min |
| **P2** | Standardize image aspect ratios | 15 min |
| **P3** | Add search clear button | 5 min |
| **P3** | Replace native confirm() dialogs | 20 min |
| **P3** | Add loading skeletons | 30 min |
| **P4** | Add focus trap to modals | 20 min |
| **P4** | Typography hierarchy refinement | 15 min |

---

## 💡 DESIGN WINS (What's Working)

1. **Color palette** — Terracotta + cream is warm, unique, and clothing-appropriate
2. **Card-based layout** — Clean, scannable, modern
3. **Mobile-first sidebar** — Good responsive pattern
4. **Lucide icons** — Consistent, lightweight, recognizable
5. **LocalStorage persistence** — Offline-first is the right call
6. **Category chips** — Quick filtering is intuitive
7. **AddItemModal** — Well-organized form with clear sections

---

*Review completed. Ready to implement fixes.*
