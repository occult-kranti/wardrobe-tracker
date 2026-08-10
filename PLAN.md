# 🎯 Wardrobe Tracker — Master Plan

> **Current Status:** Website MVP is built and live at https://occult-kranti.github.io/wardrobe-tracker/
> **Goal:** Iterate on the website until satisfied, then build a mobile application.

---

## Phase 1: Foundation (✅ COMPLETE)

### Market Research (DONE)
- [x] Analyzed 10+ wardrobe apps (Stylebook, Cladwell, Whering, Acloset, Fits, PutTogether, Wardrowbe, Alta, Indyx, Vesta)
- [x] Key insights documented:
  - 74% of apps use subscription models
  - Setup time is #1 pain point (2-3 hours for manual entry)
  - Users report 40-60% reduction in impulse purchases
  - Morning routine drops from 20min to 5min
  - Source: MDPI study on wardrobe management apps

### Design System (DONE)
- [x] Color psychology research and palette defined:
  - Primary: Terracotta `#C4705A` — warmth, earthy, unique in market
  - Success: Sage `#7A9E7E` — calm, sustainable
  - Background: Cream `#FAF8F5` — soft, lets clothing images shine
- [x] Typography: General Sans (headings) + Outfit (body)
- [x] Touch targets: 44px minimum
- [x] ADHD/neurodiversity considerations
- [x] Card-based layout with generous whitespace

### Tech Stack (DONE)
- [x] React 18 + TypeScript + Vite
- [x] Tailwind CSS v4
- [x] React Router DOM
- [x] Lucide React icons
- [x] LocalStorage persistence (offline-first)
- [x] Framer Motion for animations

### Core Features Built (MVP)
- [x] Dashboard — stats, suggestions, category breakdown
- [x] My Closet — upload photos, categorize, search, filter
- [x] Outfit Builder — visual builder, random generator
- [x] Statistics — utilization, cost-per-wear, monthly activity
- [x] Settings — export/import, reset
- [x] Add Item modal — photo upload, color picker, tags

---

## Phase 2: Website Enhancement (🔄 IN PROGRESS)

### 2.1 Critical Fixes
- [ ] **Fix deployment** — GitHub Pages is active but need to verify live site works
- [ ] **Add proper .gitignore** — `node_modules` was accidentally committed to gh-pages branch
- [ ] **Verify all routes work** — React Router may need `HashRouter` for GitHub Pages

### 2.2 UX Improvements
- [ ] **Item Detail Modal** — Tap any clothing item to see full details, wear history, cost-per-wear
- [ ] **Calendar/Planner Page** — Weekly outfit calendar, schedule outfits in advance
- [ ] **Better empty states** — Friendly illustrations when closet is empty
- [ ] **Onboarding flow** — First-time user tutorial
- [ ] **Toast notifications** — Success/error feedback (item added, outfit saved, etc.)

### 2.3 Data Features
- [ ] **Cost tracking** — Better cost-per-wear analytics, total wardrobe value
- [ ] **Wear logging** — Tap "worn today" on any item or outfit
- [ ] **Laundry tracker** — Mark items as "in wash"
- [ ] **Wishlist** — Save items you want to buy

### 2.4 Visual Polish
- [ ] **PWA support** — Manifest.json, service worker, install prompt
- [ ] **Loading skeletons** — Better perceived performance
- [ ] **Image optimization** — Lazy loading, compression
- [ ] **Dark mode** — Toggle for dark theme

### 2.5 Quality Assurance
- [ ] **Responsive testing** — iPhone SE to desktop
- [ ] **Accessibility audit** — ARIA labels, keyboard nav, screen reader
- [ ] **Performance audit** — Lighthouse score 90+
- [ ] **Cross-browser testing** — Chrome, Safari, Firefox

---

## Phase 3: Advanced Website Features (📋 PLANNED)

### 3.1 Smart Features
- [ ] **Weather integration** — Suggest outfits based on weather
- [ ] **Color coordination** — Suggest items that match selected piece
- [ ] **Outfit rating** — Rate outfits, learn preferences over time
- [ ] **Seasonal rotation** — Suggest storing away out-of-season items

### 3.2 Social/Sharing
- [ ] **Export outfit images** — Shareable PNG of outfit combinations
- [ ] **Packing list generator** — Generate packing list for trips
- [ ] **Wardrobe capsule** — Create minimalist capsule wardrobes

### 3.3 Data Insights
- [ ] **Spending analysis** — Track wardrobe investment over time
- [ ] **Sustainability score** — Cost-per-wear, outfit variety
- [ ] **Style evolution** — See how style changes over months

---

## Phase 4: Mobile Application (📱 FUTURE)

### When to Start Mobile App
> **Criteria:** Website must meet ALL of these before moving to mobile:
> 1. All Phase 2 features complete
> 2. Lighthouse score 90+ on all metrics
> 3. User testing confirms UX is smooth
> 4. PWA works well as "app-like" experience

### Mobile App Options
| Approach | Pros | Cons |
|---|---|---|
| **React Native** | Shared codebase, native feel | More complex setup |
| **Capacitor (PWA wrap)** | Fast, web code reuse | Less native feel |
| **Flutter** | Fast, beautiful UI | Dart language, separate codebase |

### Mobile-First Features
- [ ] **Camera integration** — Take photos directly in app
- [ ] **Background removal** — Auto-remove photo backgrounds
- [ ] **Push notifications** — Daily outfit suggestions
- [ ] **Widget support** — iOS/Android home screen widgets
- [ ] **Offline sync** — Work offline, sync when connected
- [ ] **Biometric lock** — Face ID / fingerprint for privacy

---

## Phase 5: Launch & Growth (🚀 LATER)

- [ ] **App Store submission** — iOS App Store, Google Play
- [ ] **Marketing website** — Landing page with features, testimonials
- [ ] **Blog/SEO** — Content marketing for organic growth
- [ ] **User feedback loop** — In-app surveys, analytics
- [ ] **Monetization strategy** — Freemium model, premium features

---

## Immediate Next Steps (This Session)

1. **Verify live site** — Check if https://occult-kranti.github.io/wardrobe-tracker/ loads correctly
2. **Add Calendar page** — I already wrote the component, need to wire it up
3. **Add Item Detail modal** — I already wrote the component, need to integrate
4. **Fix Router for GitHub Pages** — May need HashRouter instead of BrowserRouter
5. **Clean up gh-pages branch** — Remove node_modules, only deploy dist/
6. **Push updates** — Commit and redeploy

---

## Design Principles (Always Follow)

1. **Warm Minimalism** — Clean but not cold
2. **Clothing-First** — UI should never compete with clothing photos
3. **Friction Reduction** — Every tap should feel effortless
4. **Offline-First** — No server dependency, ever
5. **Privacy-First** — All data stays on device

---

## Skills/Agents to Create

| Skill Name | Purpose |
|---|---|
| `wardrobe-design` | UI component design, color theory, layout |
| `wardrobe-analytics` | Statistics, charts, data visualization |
| `wardrobe-ux` | User flow, accessibility, interaction design |
| `wardrobe-mobile` | React Native / Capacitor mobile development |

---

## Resources

- **GitHub Repo:** https://github.com/occult-kranti/wardrobe-tracker
- **Live Site:** https://occult-kranti.github.io/wardrobe-tracker/
- **Market Research:** `docs/01-market-research.md`
- **Design System:** `docs/02-design-psychology.md`
- **Feature Spec:** `docs/03-feature-spec.md`

---

*Plan created: 2026-08-11*
*Next review: After Phase 2 completion*
