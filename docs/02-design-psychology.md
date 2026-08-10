# Design Psychology & Color System

## User Psychology Insights

### Decision Fatigue & The Paradox of Choice
- Users with full closets still struggle with "nothing to wear"
- Average person makes 35,000 decisions/day - wardrobe should reduce, not add
- **Design implication:** Limit choices presented, use smart defaults

### Identity & Self-Expression
- Clothing is identity expression - the app must feel personal
- Users develop "style confidence" after 6 months of tracking
- **Design implication:** Allow customization, celebrate user's unique style

### The "Cher Horowitz" Effect
- The 1995 Clueless closet scene created lasting expectation
- Users want the "scroll through closet" experience
- **Design implication:** Visual-first, browseable interface

### Sustainability Without Preachiness
- Users want to be sustainable but don't want guilt
- Cost-per-wear changes perspective naturally
- **Design implication:** Show positive impact, not negative consequences

### ADHD/Neurodiversity Considerations
- 45 neurodiverse users found structure helpful
- Visual organization reduces cognitive load
- **Design implication:** Clear categories, visual cues, minimal steps

---

## Color Psychology for Fashion Apps

### Primary Palette: Warm Neutrals with Accents

**Why neutrals?**
- Fashion apps should not compete with the clothes
- Neutral backgrounds let clothing colors pop
- Calming, non-anxiety-inducing
- Premium/luxury associations

### Base Colors

| Role | Color | Hex | Psychology |
|------|-------|-----|-----------|
| Background | Warm White | `#FAF8F5` | Clean, calming, premium |
| Surface | Soft Cream | `#F5F0EB` | Warmth, comfort, inviting |
| Primary Text | Charcoal | `#2D2A26` | Authority, readability |
| Secondary Text | Warm Gray | `#6B6560` | Subtle, sophisticated |
| Muted | Light Gray | `#A8A39E` | Placeholder, disabled |
| Border | Border Gray | `#E8E4E0` | Soft separation |

### Accent Colors

| Role | Color | Hex | Psychology |
|------|-------|-----|-----------|
| Primary Action | Terracotta | `#C4705A` | Warmth, action, earthy |
| Success | Sage Green | `#7A9E7E` | Growth, sustainability |
| Warning | Amber | `#D4A03D` | Attention, warmth |
| Error | Soft Red | `#C45B5A` | Gentle correction |
| Highlight | Dusty Rose | `#C48B9E` | Fashion, femininity (optional) |

### Why Terracotta as Primary?
- Earthy warmth without aggression (unlike bright red/orange)
- Associated with clay, craftsmanship, authenticity
- Complements all clothing colors
- Unique in app landscape (most use blue/purple)

### Why Sage Green for Success?
- Sustainability association without being preachy
- Calming, natural
- Fashion-industry friendly ("sage" is a trending color)

---

## Typography System

### Font: General Sans + Outfit

**General Sans** (Primary)
- Weights: 300, 400, 500, 600, 700
- Use: Headlines, navigation, buttons
- Character: Modern, geometric, friendly

**Outfit** (Secondary)
- Weights: 300, 400, 500, 600, 700
- Use: Body text, descriptions, metadata
- Character: Humanist, readable, warm

### Type Scale

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Display | 48px | 700 | Hero headlines |
| H1 | 32px | 600 | Page titles |
| H2 | 24px | 600 | Section headers |
| H3 | 20px | 500 | Card titles |
| Body | 16px | 400 | Main text |
| Small | 14px | 400 | Descriptions |
| Caption | 12px | 500 | Labels, metadata |
| Overline | 11px | 600 | Uppercase labels |

---

## Interaction Design Principles

### Touch Targets
- Minimum 44px x 44px for all interactive elements
- 8px spacing between adjacent targets

### Visual Feedback
- 150ms transitions for state changes
- Subtle scale (1.02) on card hover
- Opacity change (0.7) on disabled states

### The "One-Tap" Rule
- Any common action should be achievable in one tap
- Bulk actions available but not required
- Smart defaults pre-selected

### Progressive Disclosure
- Show essential info first
- Expand for details
- Never overwhelm with all options at once

### Gestures (Mobile Web)
- Swipe to favorite/like
- Long-press for quick actions
- Pull to refresh
- Pinch to zoom on clothing images

---

## Layout Principles

### Grid System
- 12-column grid
- 24px gutters
- 16px mobile margins
- 24px tablet+ margins

### Card-Based Design
- Clothing items as cards
- Consistent aspect ratio (3:4 for clothing)
- Rounded corners (12px) - more comfortable than sharp
- Subtle shadow for elevation

### Whitespace
- Generous padding (24-32px)
- Let clothing images breathe
- Dense = overwhelming for fashion

---

## Animation Principles

### Purposeful Motion
- Guide attention, not distract
- 200-300ms duration
- Ease-out for enter, ease-in for exit

### Common Patterns
- **Staggered load:** Cards appear 50ms apart
- **Hero transition:** Smooth image expansion
- **Pull-to-refresh:** Rotation indicator
- **Modal:** Fade + scale from origin

### Performance
- Use `transform` and `opacity` only
- `will-change` on animated elements
- Respect `prefers-reduced-motion`

---

## Accessibility

### Contrast Ratios
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- Interactive elements: 3:1 minimum

### Focus States
- Visible 2px outline on keyboard focus
- Offset 2px from element

### Screen Readers
- Semantic HTML structure
- ARIA labels on icon buttons
- Alt text on all clothing images

---

## Mood & Atmosphere

### Keywords
- Minimal, Classy, Trustworthy, Poised, Calm, Composed
- Warm, Inviting, Premium, Thoughtful

### Reference Points
- Aesop skincare (warm minimalism)
- Everlane (transparency, simplicity)
- Kinfolk magazine (lifestyle, calm)
- The Row (quiet luxury)

### What to Avoid
- Blue-purple gradients (AI slop aesthetic)
- Overly bright/saturated colors
- Cluttered interfaces
- Aggive upselling
- Guilt-based messaging

