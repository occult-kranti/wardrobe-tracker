# The company — Almari's launch plan

*Drafted 13 August 2026, against seven commissioned research reports (India
incorporation, IP, regulation, market, costs, funding, mobile stack) and the
repository's own competitive benchmark (docs/24). Sourced inline where
sources exist; the load-bearing judgment calls — unit volumes, the
India/global mix, the price point — are flagged as judgment where they
appear. Conversions throughout at ₹95.5 = US$1, the August 2026 spot rate. A
four-lens adversarial review (legal, arithmetic, logic, constraints; 45
findings) was applied in full before commit, with the findings preserved in
the repository history; the surviving uncertainties are stated where they
live and collected in Section 5.*

The app exists, is complete, and is free. The company exists to do the three
things a repository cannot: sign contracts, sell a one-time-purchase native
app in two stores, and own the mark. Everything in this plan is sized to that
modesty — and to the design contract, which binds the company as it binds the
code: local-first forever, no accounts, no telemetry, no commerce, no ads, no
gamification, lossless export permanently.

## 0. The decisions, in one place

| Decision | Choice | Where argued |
|---|---|---|
| Entity | Private Limited (India), SPICe+, authorised capital ₹10L, two directors | §2.1 |
| Recognition | DPIIT immediately — chiefly for the 50% trademark rebate and SISFS eligibility | §2.2 |
| Business model | Web app free-everything forever; native apps one-time purchase, ₹299 / $4.99; no subscription, ever | §1.4 |
| Brand | "Almari" — pending attorney clearance; live collisions found; explicit rename gate before launch spend | §2.4 |
| Mobile | Capacitor 8 wrap of the existing app; storage to SQLite/Preferences through the existing migration layer | §3.2 |
| AI | Build-time: Claude Code (as the app was built). Runtime: bring-your-own-key only; no Almari-operated inference, ever | §3.4 |
| Money | Bootstrap (Scenario A, ≈₹1.6–4L/month) is the plan; grants (SISFS/Elevate/GENESIS) are the raise; VC is a named fork, off by default | §4.1–4.2 |
| Growth | Organic-first as a structural constraint: ASO, nano/micro collabs, PR on four angles, published research | §4.3 |
| Testing | Continue the focus-group tradition; TestFlight + Play org account; moderated sessions and diary studies in place of the telemetry the app will never have | §4.4 |
| Timeline | Calendar-anchored, month 1 = September 2026; store launch month 10 (June 2027); the external gates are trademark clearance/opposition and App Review | §4.5 |

The two numbers that discipline everything else: **the conservative revenue
scenario is ~₹13.4 lakh/year post-GST** (≈₹1.1L/month; 5,000 paid units net
of store cut and GST, §1.4), and **the bootstrap burn is ₹1.6–4L/month**
(§4.1). Conservative revenue does not carry Scenario A, even at Scenario A's
low end. What it roughly carries is the post-launch **maintenance burn** —
Scenario A minus the front-loaded contractor line and the marketing
experiments, ≈ ₹1.0–1.1L/month (§4.1). Said plainly, and repeated wherever
these numbers appear (§1.4, §5.1): post-GST conservative revenue roughly
carries maintenance mode only; the moderate scenario (~₹66.9L/yr) carries
Scenario A. That is the whole financial argument, and it is why every "hire
someone" instinct in this plan is answered with a contractor line instead.

---

## 1. The market, the position, and the honest business model

### 1.1 The category as of 2026

**Market size: the honest version.** Every published "wardrobe app market" figure comes from low-credibility research mills, and they disagree with each other by roughly 2x: $1.93B (2025) growing to $5.32B by 2033 ([Verified Market Research](https://www.verifiedmarketresearch.com/product/outfit-planner-app-market/)); $3.5B (2026) to $9.2B by 2033 ([Verified Market Reports](https://www.verifiedmarketreports.com/product/wardrobe-app-market/)); $2.7B (2026) to $9.8B by 2033 ([openPR](https://www.openpr.com/news/4557248/outfit-planner-app-market-research-report-2026-closet)). No tier-1 firm publishes a dedicated category size. We treat these numbers as junk and do not build on them. The credible adjacent anchors are real: global fashion e-commerce at roughly $886B–$1,058B in 2025 ([CoherentMI](https://www.coherentmi.com/industry-reports/global-fashion-ecommerce-market); [Market.us](https://market.us/report/fashion-e-commerce-market/)), global secondhand apparel heading to $367B by 2029 ([ThredUp IR](https://ir.thredup.com/news-releases/news-release-details/thredups-13th-resale-report-shows-online-resale-saw-accelerated)), and total app consumer spend near $156B in 2025 even as downloads declined ([TechCrunch](https://techcrunch.com/2026/01/14/app-downloads-declined-again-in-2025-but-consumer-spending-soared-to-nearly-156b/)). The category is real, adjacent to enormous flows of money, and unconsolidated.

**The competitors, and what they charge for.**

| Player | Money in | Model | Status |
|---|---|---|---|
| Whering | $7M seed Jul 2026 led by eBay Ventures + Google AI Futures Fund; ~$14M total ([TheIndustry.fashion](https://www.theindustry.fashion/whering-secures-7m-to-expand-ai-powered-wardrobe-app/); [WWD](https://wwd.com/business-news/technology/whering-styling-app-investment-ebay-google-ai-futures-1239053470/)) | Free app; affiliate/marketplace commissions + B2B arm ([Startups Magazine](https://startupsmagazine.co.uk/article-whering-full-range-your-wardrobe)) | 10M+ users, mostly Gen Z ([TheIndustry.fashion](https://www.theindustry.fashion/whering-secures-7m-to-expand-ai-powered-wardrobe-app/)) |
| Alta | $11M seed Jun 2025 led by Menlo Ventures ([TechCrunch](https://techcrunch.com/2025/06/16/alta-raises-11m-to-bring-clueless-fashion-tech-to-life-with-all-star-investors/)) | Free consumer app; "agentic shopping" commerce, brand partnerships (CFDA, Poshmark, Public School embed deal — [TechCrunch](https://techcrunch.com/2026/02/14/clueless-inspired-app-alta-partners-with-brand-public-school-to-start-integrating-styling-tools-into-websites/); the 4,000+ brand-partnership count is from our competitive log, not independently sourced in the market research) | Pivoting toward B2B embeds |
| Acloset (Looko, Seoul) | ~$2.42M, weakly sourced ([CB Insights](https://www.cbinsights.com/company/a-close t/)) | Freemium with paid AI; the 100-item free cap and $3.99–24.99/mo tiers are app-listing facts from our competitive log, not in the market research file | Claims 7M users ([acloset.app](https://www.acloset.app/)) |
| Indyx | Seed from Alante Capital, amount undisclosed ([Crunchbase](https://www.crunchbase.com/organization/indyx-inc)) | Free cataloging; analytics behind Insider at $7.99/mo ([Indyx](https://www.myindyx.com/how-it-works)) — $74.99/yr annual in our competitive log — plus human services from $150 | Operating |
| Cladwell | Subscription, then retreat to free core with optional sub ([Style Within Grace](https://stylewithingrace.com/closet-organiser-app-cladwell-review/)) | Free core + optional sub | Operating; user counts unsourced |
| Stylebook | Bootstrapped | $4.99 one-time purchase (competitive-log fact; no link in the market research) | Effectively dormant — no meaningful updates — yet still selling |

**Retention reality.** Cross-vertical D30 retention runs 5–7% ([Adjust-derived benchmarks](https://www.core-mba.pro/tool-hub/mobile-app-retention)); shopping apps sit at D30 ≈ 5.6% ([Sendbird](https://sendbird.com/blog/app-retention-benchmarks-broken-down-by-industry)). A "~28% D90 median for fashion apps" figure circulates in vendor content, and similar 20–25% D90 claims appear at [Pushwoosh](https://www.pushwoosh.com/blog/increase-user-retention-rate/) and [Geckoboard](https://www.geckoboard.com/resources/kpi-examples/retention-rate/) — but these contradict the D30 data and appear to mix rolling and classic retention definitions. Our research treats D90 as effectively unsourced. Planning assumption: most installs churn within a month, in this category as in every other. A one-time-purchase model is the only one in the list above for which churn cannot claw back revenue post-sale — but churn still gates volume pre-sale: with a complete free web app standing in front of the purchase, the try-first path suppresses conversion rather than retention. What actually triggers the purchase is stated in §1.4.

**Category events.** From our competitive log (these three are not in the market-research file and carry no independent links there): Google Photos shipped a "Wardrobe" feature in June 2026, commoditizing free cloud photo-cataloging of clothes; Google killed its Doppl try-on app in April 2026; and Save Your Wardrobe completed its pivot out of consumer into B2B aftercare SaaS — the pivot itself is corroborated ([Dealroom](https://app.dealroom.co/companies/save_your_wardrobe)). The pattern: platform giants absorb the free cloud-cataloging layer, and funded consumer players flee to B2B. Nobody is fighting for the layer Almari occupies.

### 1.2 The structural insight

Every funded competitor monetizes one of two things: your *future purchases* (Whering's affiliate marketplace, Alta's agentic shopping, Style DNA's retail commissions) or your *own data about your own clothes* (Indyx's analytics paywall, Acloset's item cap, GetWardrobe's $9.99/mo tier — [GetWardrobe pricing](https://getwardrobe.com/pricing/)). The market research's summary line is blunt: no one has proven consumer subscription at scale in this category, and the largest player, Whering at 10M users, is free ([research §6 cross-cutting facts](https://www.theindustry.fashion/whering-secures-7m-to-expand-ai-powered-wardrobe-app/)).

Almari's differentiators are precisely the things those business models cannot copy, because copying them would destroy the business model: local-first storage with no accounts, wear-analytics free forever, zero commerce surfaces, the drawn-flat plate so a garment never needs a photo, photo-free entry, and lossless export. Whering cannot go local-first — its investors bought a resale funnel. Indyx cannot free its analytics — that is its revenue. An affiliate app cannot remove shop links. This is a moat made of incentives, not features.

One honesty note the research insists on: there is **no evidence yet that local-first drives adoption in fashion specifically** — the niche exists only among tiny indie apps ([Google Play — My Wardrobe](https://play.google.com/store/apps/details?id=finecoder.apps.smartcloset&hl=en_IN); [App Store — iCloShot](https://apps.apple.com/us/app/icloshot-ai-closet-style/id6793092539)). And user research found people respond to *ownership*, not privacy. So the positioning line is not "private" but **"your closet outlives the app"** — ownership, portability, permanence. The lossless export is the proof, not a bullet point.

### 1.3 India

India has 806M internet users (55.3% penetration) with 97.4% smartphone ownership among them ([DataReportal Digital 2025](https://datareportal.com/reports/digital-2025-india)); Counterpoint counts 740M+ active smartphones ([Adda247/Counterpoint](https://currentaffairs.adda247.com/india-becomes-worlds-no-2-smartphone-giant-with-this-whooping-numbers-of-users/)). Fashion leads Indian e-commerce with a 31.67% share ([Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/india-ecommerce-market)); the India fashion e-commerce market is ~$21.6B in 2025 growing at 24.2% CAGR ([CoherentMI](https://www.coherentmi.com/industry-reports/india-fashion-ecommerce-market)). Myntra alone approaches 200M annual active users, half Gen Z ([The Tribune](https://www.tribuneindia.com/news/business/myntra-set-to-hit-200-million-annual-active-users-in-2025-50-of-the-active-customer-base-is-gen-z/)). Tens of millions of Indians already photograph, browse, and think about clothes on their phones daily. All of this is **context, not addressable demand**: these statistics evidence shopping and browsing — behaviors the design contract forbids the product to monetize or even surface — not wear-logging. The evidence that actually bears on the behavior Almari needs is the Indyx wardrobe dataset and the #30Wears/underconsumption engagement in §1.5; §5.2 logs this adjacency risk by name.

Willingness to pay is the constraint that shapes the model. India is a structurally low-ARPU market ([Cancelmates](https://cancelmates.com/guides/indian-subscription-spending-report-2025)), and RevenueCat flags the Indian subcontinent as an extreme outlier on cost-per-paying-subscriber ([RevenueCat](https://www.revenuecat.com/state-of-subscription-apps)). But one-time payment behavior is mature: UPI carries over 84% of digital payment volume at 20B+ transactions a month ([Cleverbridge](https://grow.cleverbridge.com/blog/upi-india-saas-digital-goods)). The research's interpretation — and ours — is that a small one-time price fits Indian behavior in a way an $8/month Western subscription never will. Hence the shape of the company: **India-first distribution** (the founder's market, festival-and-ceremony wardrobe features no Western competitor has, Myntra/Ajio-adjacent culture) with a **global-English product** — nothing in the app is India-locked, and the same binary sells at $4.99 in markets where Stylebook proved that price two decades running.

### 1.4 The business model, without flinching

The web app stays free-everything forever. Revenue comes from one-time-purchase native apps — same features, no subscription, no tiers. This is the Stylebook model, the only model in the category our own research does not condemn: it aligns with churn instead of fighting it, requires no servers, and cannot be pressured into commerce.

**Price point: ₹299 in India, $4.99 in USD markets.** Justification: $4.99 is Stylebook's proven price class (competitive-log fact, unsourced in the market file); ₹299 sits comfortably inside single-transaction UPI habits ([Cleverbridge](https://grow.cleverbridge.com/blog/upi-india-saas-digital-goods)) and below the psychological threshold where India's low-ARPU reality bites ([RevenueCat](https://www.revenuecat.com/state-of-subscription-apps)). There is no direct price-satisfaction study for wardrobe apps; this is judgment anchored on the one durable precedent.

**The ceiling arithmetic.** Assumptions visible: 70/30 India/global unit mix (judgment); ₹95.5/USD (Aug 2026 spot — [exchangerates.org.uk](https://www.exchangerates.org.uk/USD-INR-spot-exchange-rates-history-2026.html), the rate used throughout this plan); 15% store cut (Apple Small Business Program and Google Play's reduced rate both apply under $1M — published store policy, no link in the research file); 18% GST on the India leg (₹45.6/unit embedded in the ₹299 price at 18/118; exports are zero-rated under LUT — §2.5); unit volumes are judgment, anchored on the fact that the category's largest player took ~$14M of funding to reach 10M *free* users ([WWD](https://wwd.com/business-news/technology/whering-styling-app-investment-ebay-google-ai-futures-1239053470/)) — paid units are 100–1000x harder.

| Scenario | Paid units/yr | Blended gross/unit | Net after 15% cut + GST | Annual revenue |
|---|---|---|---|---|
| Low | 5,000 | $3.69 / ₹352 | $2.80 / ₹267.5 | ~$14,000 / ~₹13.4 lakh |
| Mid | 25,000 | $3.69 / ₹352 | $2.80 / ₹267.5 | ~$70,000 / ~₹66.9 lakh |
| High | 100,000 | $3.69 / ₹352 | $2.80 / ₹267.5 | ~$280,000 / ~₹2.67 crore |

Blended gross = 0.7 × ₹299 + 0.3 × $4.99, at ₹95.5/USD. Net: the India leg
nets ₹299 − ₹44.85 (store) − ₹45.61 (GST) ≈ ₹208.5/unit; the export leg nets
$4.99 × 0.85 ≈ ₹405, zero-rated (§2.5); blended ≈ ₹267.5/unit. Mix
sensitivity: at 50/50 the blended net is ≈ ₹307/unit (Low ≈ ₹15.3L); at
30/70 ≈ ₹346/unit (Low ≈ ₹17.3L). Note the direction: the net *rises* as the
mix tilts global — the Low case leans hardest on the market our own sources
say converts to paying worst, and if the paying units turn out to be mostly
global at $4.99, the India-first distribution argument and the revenue
argument must stop borrowing each other's evidence. The rows are labelled
Low/Mid/High because they are illustrative points, not probability-weighted
scenarios: 5,000 units ≈ ~100K organic installs at ~5% install→paid, or ~33K
web-habituated users at ~15% web→native conversion — the same conversion
assumptions §4.3 uses, now applied in both directions (§5.2).

**What triggers the purchase.** The free web app is complete, so the paid
native SKU must sell something real: native camera intake, eviction-safe
SQLite storage (WebView localStorage is transient — §3.2), Face ID app lock,
a guaranteed offline install, store presence with store-managed updates, and
the optional BYOK convenience (§3.4). The buyer is someone the free app
already convinced; the purchase is the durable native home for a habit that
exists.

One sentence this section must not soften: **no company we can find sustains
a business on this exact model** — Stylebook persists dormant, and Obsidian's
sustainability comes from subscription services this plan forbids (§5.2).
The model is an experiment. Donations ("pay once more if it lasted") are the
only §5.4-compatible second stream, and they live in exactly two places: a
second one-time IAP SKU through store billing inside the native apps, or a
page on the website that the native binaries never link to — no third
mechanism, because an external donate link inside a binary trips
anti-steering rules in India, the primary market.

**What this does not support:** paid user acquisition (CAC for shopping-adjacent apps would exceed the entire purchase price), a team beyond the founder plus contractors, or any spending pattern that assumes recurring revenue. The post-GST Low case (~₹13.4L/yr ≈ ₹1.1L/month) is a modest solo income that roughly carries the maintenance burn only (§4.1); the Mid case (~₹66.9L/yr) carries Scenario A. The plan sizes the company to survive the Low case.

**What it uniquely enables:** zero marginal infrastructure cost per user — the Obsidian lesson, ~1.5M MAU on a tiny bootstrapped team because local-first storage costs the maker nothing ([Fueler](https://fueler.io/blog/obsidian-usage-revenue-valuation-growth-statistics)); total incentive alignment users can verify (no ads to serve, no data to monetize, no funnel to feed); and immunity to the platform squeeze — Google Photos "Wardrobe" attacks free cloud cataloging, not ownership and permanence, which a platform feature structurally cannot promise.

### 1.5 The cultural tailwind

The discourse Almari serves is a decade old and accelerating. #30Wears, launched by Livia Firth in 2015 ([Fabric of the World](https://www.fabricoftheworld.com/post/the-30wearschallenge-getting-maximum-mileage-from-our-clothes)), made cost-per-wear the moral unit of fashion ([SELVANE](https://www.selvane.co/blogs/knowledge/the-30-wear-rule-a-simple-mandate-for-a-sustainable-wardrobe)) — and cost-per-wear is Almari's native metric, computed free, on-device. "Underconsumption core" carries ~45M TikTok posts ([Wikipedia](https://en.wikipedia.org/wiki/Underconsumption_core); [The Conversation](https://theconversation.com/understanding-underconsumption-core-how-a-new-trend-is-challenging-consumer-culture-235417)). Over half of Deloitte's 2024 respondents avoid or intend to avoid fast fashion ([The Conversation](https://theconversation.com/understanding-underconsumption-core-how-a-new-trend-is-challenging-consumer-culture-235417)). The villain is well documented: the average garment is worn ~7 times ([Project Cece](https://www.projectcece.com/blog/506/how-many-times-do-we-wear-our-clothes/)), and Indyx's own April 2025 dataset — the best-provenance numbers in the category — shows 166-item wardrobes, 25% unworn in a year, and luxury worn no more than fast fashion at 6 wears ([Indyx Substack](https://indyxapp.substack.com/p/the-state-of-our-wardrobes-isconcerning)). That re-wear framing now attracts strategic capital (eBay into Whering — [TheIndustry.fashion](https://www.theindustry.fashion/whering-secures-7m-to-expand-ai-powered-wardrobe-app/)) confirms the current is real.

The pay-for-values analogies are encouraging but must be read honestly. Signal grew from ~20M to 70–100M MAU by April 2025 on a pure trust position ([Backlinko](https://backlinko.com/signal-stats)) — proof the position can drive mass adoption, though as a nonprofit burning ~$50M/yr it is no revenue model ([SQ Magazine](https://sqmagazine.co.uk/signal-statistics/)). Obsidian is the closer analogy: local-first, bootstrapped, sustainable on a tiny team, users paying out of loyalty and convenience ([Fueler](https://fueler.io/blog/obsidian-usage-revenue-valuation-growth-statistics); [OperatorBook](https://www.operatorbook.dev/stories/obsidian-revenue-estimates-2m-to-25m)). Almari's bet is narrower and cheaper than either: not that ownership will make it huge, but that ownership plus a fair one-time price will make it *permanent* — which is, after all, the product's whole promise.

---

## Section 2 — The company, the IP, and the law

### 2.1 Entity: a lean Private Limited, incorporated via SPICe+

Almari incorporates as a **Private Limited Company**, not an LLP or OPC — and given that Section 1's monetization decision caps revenue, this deserves a plain justification. The compliance delta over an LLP is real (roughly ₹15,000–40,000/year), and if the Stylebook model were the whole story an LLP would be cheaper. The reason is Section 4's funding fork: if the company ever raises, it needs to issue CCPS — the standard Indian VC instrument, available only to companies — and to grant ESOPs to hire design and app talent. LLPs cannot issue shares, so "investors usually say no" ([JustStart](https://juststart.co.in/blog/pvt-ltd-vs-llp-vs-opc/)); OPCs cannot raise outside equity at all ([JustStart](https://juststart.co.in/blog/pvt-ltd-vs-llp-vs-opc/)); ESOPs are only cleanly available in a Pvt Ltd ([Corpzo](https://www.corpzo.com/private-limited-vs-llp-vs-opc-which-business-structure-wins-in-2026)). Incorporating Pvt Ltd directly with a second nominal shareholder — a resident Indian, keeping the cap table FEMA-clean until any deliberate foreign raise (§4.2) — avoids a conversion step later ([PSR Compliance](https://www.psrcompliance.com/blog/private-limited-vs-llp-vs-opc-which-is-better-2026)). We buy the optionality now; it costs a compliance premium, not a strategic one.

Everything runs through the MCA's integrated SPICe+ form — name, incorporation, DIN, PAN, TAN in one filing ([Agile Regulatory](https://www.agileregulatory.com/blogs/private-limited-company-registration-fees-in-india-in-2026)). We set **authorised capital at ₹10 lakh** (well under the ₹15 lakh ceiling for the zero-MCA-fee slab — [Patron Accounting](https://www.patronaccounting.com/blog/private-limited-company-registration-cost-breakdown-government-fees)), two directors.

| Item | Cost (INR) |
|---|---|
| SPICe+ MCA fee (capital ≤ ₹15 lakh) | ₹0 ([Patron](https://www.patronaccounting.com/blog/private-limited-company-registration-cost-breakdown-government-fees)) |
| Name reservation (2 options) | ₹1,000 ([Patron](https://www.patronaccounting.com/blog/private-limited-company-registration-cost-breakdown-government-fees)) |
| DSCs, 2 directors | ₹3,000–5,000 ([Agile Regulatory](https://www.agileregulatory.com/blogs/private-limited-company-registration-fees-in-india-in-2026)) |
| Stamp duty (state-dependent) | ₹200–12,600 ([Patron](https://www.patronaccounting.com/blog/private-limited-company-registration-cost-breakdown-government-fees)) |
| Professional fees | ₹5,000–15,000 ([Patron](https://www.patronaccounting.com/blog/private-limited-company-registration-cost-breakdown-government-fees)) |
| **All-in** | **₹7,000–25,000** ([Patron](https://www.patronaccounting.com/blog/private-limited-company-registration-cost-breakdown-government-fees)); IndiaFilings says ₹6,000–30,000 ([IndiaFilings](https://www.indiafilings.com/learn/how-much-does-it-cost-to-register-a-company)). Note: the sourced bands are not the sum of the rows above, which run ₹9,200–33,600 — stamp duty and professional fees rarely hit their maxima together. We budget to the itemized high end, ~₹34,000 |

**Timeline:** 7–15 working days when documents are clean, 10–20 conservatively — DSCs days 1–2, name approval days 2–4, drafting and SPICe+ filing days 5–9, RoC review to Certificate of Incorporation days 10–20 ([The News Minute](https://www.thenewsminute.com/partner/costs-timelines-for-private-limited-company-registration-in-india-updated-for-2026), [IncorpX](https://www.incorpx.io/blog/company-registration-time-india)).

**First 90 days, calendared on day one:** open the bank account immediately (needed for capital deposit before INC-20A); file **ADT-1** appointing the first auditor within **30 days** ([IncorpX](https://www.incorpx.io/guide/how-to-file-inc-20a-commencement-of-business)); file **INC-20A** (commencement of business) within **180 days** — the late penalty is ₹50,000 on the company plus ₹1,000/day per officer ([TAXAJ](https://www.taxaj.com/inc-20a-commencement-of-business)); budget ₹5,000–10,000 for this post-incorporation cluster ([Agile Regulatory](https://www.agileregulatory.com/blogs/private-limited-company-registration-fees-in-india-in-2026)). Also in the first 90 days: **Shops & Establishments** registration and **Professional Tax** enrolment in the state of registration — mandatory for a commercial establishment, home office included, typically within 30 days of commencing business, at small state fees — and the free **Udyam/MSME registration** the same week as the DPIIT application, which independently qualifies the company for the reduced ₹4,500/class small-entity trademark fee: a costless hedge if DPIIT recognition is slow.

**Annual burden:** statutory audit is mandatory regardless of turnover, even at zero revenue ([Vakilsearch](https://vakilsearch.com/article/private-limited-company-audit/)). AGM by 30 September; AOC-4 within 30 days of AGM, MGT-7 within 60, DIR-3 KYC by 30 September ([ClearlyComply](https://clearlycomply.org/blog/roc-annual-filing-private-limited-company/)). Budget **₹30,000–60,000/year** for the statutory work, pre-GST-registration (audit ₹8,000–25,000, ROC filings ₹2,500–7,000, ITR ₹4,000–12,000 — [Kanakkupillai](https://www.kanakkupillai.com/learn/annual-compliance-cost-for-private-limited-company-in-india/) — components that sum to ₹14,500–44,000, with routine CA and secretarial work between filings making up the rest of the band; ₹25,000–55,000 per [IncorpX](https://www.incorpx.io/blog/annual-compliance-cost-startups-2026)), rising once monthly/quarterly GST returns begin at monetization (§2.5). The one rule with teeth: late ROC filings run **₹100/day/form, uncapped** ([ClearlyComply](https://clearlycomply.org/blog/roc-annual-filing-private-limited-company/)). This is the statutory floor of staying alive; §4.1 budgets the practical total — a full CA retainer covering GST/TCS and bookkeeping — at ₹1.5–2L/yr, and both figures are labelled where they appear.

### 2.2 DPIIT Startup India recognition — file immediately, mostly for the trademark rebate

Under the revised framework notified 6 February 2026 ([Treelife](https://treelife.in/startups/indias-revised-startup-recognition-framework-2026/)), a Pvt Ltd under 10 years old with turnover under ₹200 crore qualifies if working toward innovation ([startupindia.gov.in](https://www.startupindia.gov.in/content/sih/en/startupgov/startup_recognition_page.html)). Application is free via NSWS, typically 2–10 working days ([Patron](https://www.patronaccounting.com/blog/dpiit-startup-recognition-2026-guide)). What it actually buys us, honestly ranked:

1. **50% trademark fee rebate** — ₹4,500/class instead of ₹9,000 ([intepat.com](https://www.intepat.com/blog/trademark-registration-fees-india)), plus free SIPP facilitator services ([pib.gov.in](https://www.pib.gov.in/PressReleasePage.aspx?PRID=1880465)). Directly relevant to §2.4 — and the sequencing rule is: file TM at the earliest date after attorney clearance, and never delay a filing to wait for the rebate, though on this plan's calendar (recognition month 2, filing month 3 — §4.5) the rebate is captured anyway.
2. **Self-certification** under 9 labour/environmental laws, no inspections up to 5 years ([IncorpX](https://www.incorpx.io/blog/government-grants-subsidies-startups-india-2026)).
3. **Section 80-IAC** (3-year tax holiday within 10 years, incorporation window extended to 1 April 2030 — [Vakilsearch](https://vakilsearch.com/article/section-80-iac-startup-tax-holiday-india-2026-imb-certificate/)) requires separate IMB approval; only ~3,700 of 2.23 lakh recognized startups have it ([Taxscan](https://www.taxscan.in/dpiit-clears-187-startups-for-tax-relief-under-revised-section-80-iac-framework/518497/), [IBEF](https://www.ibef.org/news/government-recognizes-more-than-55-200-startups-during-2025-26-highest-ever-in-a-single-year-since-launch-of-startup-india-initiative)). Treat as a lottery ticket, not a plan — and with the Stylebook revenue cap, the sheltered profits would be small anyway.
4. **Angel tax is not a DPIIT benefit anymore** — Section 56(2)(viib) was abolished by the Finance (No. 2) Act 2024, ineffective from 1 April 2025, for all investor classes with no exemption filing needed ([India Briefing](https://www.india-briefing.com/news/abolishing-the-angel-tax-in-india-applicable-for-fy-2025-26-35289.html/)). Section 4's optionality carries no angel-tax sting.

### 2.3 IP housekeeping: assignment first, copyright cheap, patents no

**The codebase predates the company**, so the company owns none of it automatically — Section 17 of the Copyright Act vests employer ownership only for work in the course of employment, and a not-yet-existing company employed no one ([Bhavya Sharma & Associates](https://www.bhavyasharmaandassociates.com/ip-assignment-checklist-indian-startups-founders-employees-contractors-code-brand-domains-2026/)). In month 2, as soon as the company exists to receive it: a written **Deed of Assignment** from founder to company covering all pre-incorporation code, the drawn SVG plates, names, and domains, with an asset schedule; Section 19 requires it in writing, signed, identifying work, rights, territory, duration ([EquityList](https://www.equitylist.co/blog-post/founders-agreement-india)). The deed is executed **on stamp paper** per the state of execution — an unstamped or under-stamped instrument is inadmissible in evidence under Section 35 of the Stamp Act, which defeats the deed's entire purpose — with counsel splitting or characterising the copyright component (exempt from duty in most states) from the trademark/goodwill component (conveyance-rate duty, state-dependent), and with the CA fixing a defensible consideration — a nil-value transfer raises Section 56(2)(x) and capital-gains questions — and papering the board approval. A small line is budgeted for stamp duty and drafting, and the question is owned in §5.3. Unassigned founder IP is a diligence flag if Section 4's fork is ever taken.

**Copyright** arises automatically (Berne, no formalities — [Mondaq](https://www.mondaq.com/india/copyright/1192016/is-copyright-registration-mandatory)), but registration is cheap prima facie evidence: source code as a literary work, Form XIV, **₹500** with a first-10/last-10-pages deposit ([intepat.com](https://www.intepat.com/blog/cost-registering-copyright-india), [prosolllaw.com](https://prosolllaw.com/software-copyright-registration-in-india-guide-2026/)); the hand-drawn garment plates as artistic works at ₹500 (register the set as a compilation — lawyer call); the logo at **₹2,000 plus a TM-C NOC** since it functions as a mark ([intepat.com](https://www.intepat.com/blog/cost-registering-copyright-india)).

**AI-assisted code:** the contract layer is clear — Anthropic assigns its rights in outputs to the customer ([anthropic.com/legal/commercial-terms](https://www.anthropic.com/legal/commercial-terms)). The copyright-law layer is unsettled in India; the *RAGHAV* matter is still before the Delhi High Court ([K&S](https://ksandk.com/intellectual-property-rights/divergent-copyright-recognition-ai-generated-works-sahnis-case-us-vs-india/)). Practice: keep human review and modification visible in commit history, register naming a human/company author, and ensure everyone who prompts AI tools is inside the assignment chain ([Prime Legal](https://blog.primelegal.in/ai-copyright-law-india-guide/)).

**Patents, one line:** Section 3(k) excludes computer programs per se, business methods and algorithms, the CRI Guidelines 2025 confirm it ([intepat.com](https://www.intepat.com/blog/cri-guidelines-2025-patent-india-3k)), and a wardrobe ledger's CPW math is exactly that territory — we file nothing.

### 2.4 Trademark: "Almari" is this section's centerpiece risk

"Almari" is the common Hindi word for wardrobe. For a wardrobe app, that is a **semi-descriptive mark for the very subject matter of the goods** — and a quick clearance probe already surfaced four live Indian collisions:

| Collision | What it is | Why it matters |
|---|---|---|
| ALMARI (almari.co.in) | Premium garment-storage startup, founded 2019, YourStory coverage | Established prior user in the wardrobe space; oldest and best-resourced potential opponent |
| "Shop Almari" | Secondhand-clothing app, Apple App Store | **Closest collision: an app, in clothing** — same channel as our Class 9 filing |
| "My Almari" (myalmari.in) | Preloved luxury marketplace | Marketplace/Class 35 territory |
| "Almaari Fashion" | Saree brand | Class 25; phonetically identical |

Two doctrines collide here. Under **Section 9(1)(b)**, marks designating the kind or characteristics of the goods are refused ([intepat.com](https://www.intepat.com/blog/section-9-11-grounds-refusal-trademark-india)); a word meaning "wardrobe" applied to wardrobe software invites exactly that objection, even in Classes 9/42 where the word does not describe *software* as such. And the crowded field raises **Section 11 relative-grounds and opposition risk**: IP India has cited a 25–27% opposition rate ([ipindia.gov.in](https://ipindia.gov.in/trademark-opposition-systems-in-india-and-japan) — a loose official figure, but opposition is not rare), ~200,000 oppositions were pending as of 2020, and the five-year application-to-registration ratio is ~68% ([bizonym.com](https://bizonym.com/naming_resources/present-state-of-the-indian-trademark-registry-as-of-2024/)). A contested opposition can run **5–10 years** ([legalserviceindia.com](https://www.legalserviceindia.com/Legal-Articles/brief-overview-of-trademark-registration-in-india-and-current-timelines-2026/)). Opposition delays registration, not use — but a prior user or registrant can enjoin *use* at any time, independent of any opposition timeline, and Section 34 prior-user rights would defeat even a later-granted registration; ruling that out is exactly what the clearance search is for. The crowd cuts both ways: nobody can own a dictionary word for wardrobes outright, so coexistence is plausible and any protection we get will be narrow. But "plausible" is not a plan.

**The plan:**

1. **Attorney clearance search before one rupee of brand spend** — full registry wordmark + phonetic search ("ALMARI", "ALMAARI", "ALMIRAH") across classes 9, 42, 35, 25 at tmrsearch.ipindia.gov.in ([prosolllaw.com](https://prosolllaw.com/trademark-search-india-guide-2026/)), plus common-law search (app stores, MCA name search, handles). The attorney brief also covers: the registered/unregistered status of all four collisions in classes 9/42/35/25; passing-off exposure from the 2019 ALMARI specifically; and the TM-A use claim — "proposed to be used" versus a claimed user date — decided with counsel at filing. From day one, the company maintains a dated use-evidence file (first public use, screenshots, invoices, press): the Section 9 acquired-distinctiveness proviso and any future Section 34 defence both depend on it. The probe above is not clearance; the research's own registry search was run against the old name, not this one. **This plan does not certify clearance.**
2. **Device mark + house style.** File the composite device (the word in Almari's distinctive lettering plus logo) alongside the word mark. A device is registrable even where the bare word is weak, and consistent house style is how a semi-descriptive word accrues the acquired distinctiveness that Section 9's proviso rewards ([compliancecalendar.in](https://www.compliancecalendar.in/learn/an-analysis-on-the-proviso-of-section-9-1-b-of-the-trademark-act-1999)).
3. **Classes 9 + 42 only**, at the DPIIT rate: **₹9,000** government fees ([intepat.com](https://www.intepat.com/blog/trademark-registration-fees-india)), filed month 3 — after clearance (month 1) and recognition (month 2). Class 35 is where My Almari trades — and the design contract bars commerce surfaces forever, so we never compete with the marketplaces in their class. Shop Almari, as an app, likely overlaps our Class 9 — which is exactly what the attorney search must resolve; class separation is an argument for coexistence with the marketplaces, not with the app. Class 25 never (no merch, and the worst descriptiveness). File with expedited examination (₹20,000, report in ~5–30 days — [IndiaFilings](https://www.indiafilings.com/learn/trademark-fee-trademark-rules-2017)) so objections and publication land well before launch spend.
4. **Realistic timeline:** 12–18 months to registration on a clean application ([registerkaro.in](https://www.registerkaro.in/post/time-period-for-trademark-registration-in-india)); examination 3–6 months in 2026 after the examiner recruitment drive ([legalserviceindia.com](https://www.legalserviceindia.com/Legal-Articles/brief-overview-of-trademark-registration-in-india-and-current-timelines-2026/)); then a fixed 4-month opposition window from journal publication ([Vakilsearch](https://vakilsearch.com/article/trademark-opposition-section-21-india-2026-form-tm-o/)).
5. **The decision gate, explicitly:** the attorney search runs *before* mobile-launch brand spend. If clearance fails — a likely-successful opposition from the 2019 ALMARI or a registered mark blocking 9/42 — **renaming now costs roughly ₹25,000–75,000** (new search, forfeited non-refundable filing fees, design rework; attorney fees are unsourced in the research and vary). **Renaming after launch costs an order of magnitude more**: rebuilt store listings and forfeited ASO history, reprinted brand assets, press that points at the wrong name, plus defending an opposition that can drag 5–10 years ([legalserviceindia.com](https://www.legalserviceindia.com/Legal-Articles/brief-overview-of-trademark-registration-in-india-and-current-timelines-2026/)) — several lakh at minimum, and years of distraction. Cheap now, ruinous later: the search is not optional. And because even a passed search cannot prevent an opposition from the four named collisions, the search does not retire the risk by itself: the timeline carries a month-8 go/no-go (§4.5) — opposition-window status checked before store listings and PR spend, with the rename gate invoked then if a credible senior user has opposed.
6. **Madrid Protocol: defer.** The international registration depends on the Indian basic mark for 5 years — if the Indian application falls to opposition, the whole IR falls with it ("central attack" — [btlj.org](https://btlj.org/2019/04/madrids-central-attack-in-transnational-trademark-law-practice-procedures-and-strategic-considerations/)). With Almari's clearance shakier than average, filing Madrid before the Indian mark is past opposition would be building on sand. When foreign traction justifies it: ~**CHF 2,714** for US+EU+UK in two classes plus India's ₹5,000 handling fee ([wipo.int](https://www.wipo.int/en/web/madrid-system/fees/ind_taxes), [ssrana.in](https://ssrana.in/ufaqs/cost-filing-international-application-madrid-protocol/)).

### 2.5 Regulatory posture: the architecture is the compliance program

**DPDP Act 2023.** The Rules were notified 14 November 2025 with phased commencement; the substantive fiduciary obligations arrive in Phase 3, around **May 2027** ([Shardul Amarchand Mangaldas](https://www.amsshardul.com/insight/enforcement-of-the-dpdp-act-and-notification-of-the-dpdp-rules/)) — *before* this plan's month-10 store launch (June 2027, §4.5), so whatever the company does process, it processes under the full regime from launch day. More fundamentally: the Act exempts personal data processed by an individual for personal or domestic purposes ([FPF](https://fpf.org/blog/the-digital-personal-data-protection-act-of-india-explained/)), and in a genuinely no-server, no-account, no-telemetry app the user is the only processor of their own data — the company never receives wardrobe data, except research artifacts volunteered under the research protocol below, which it handles as a fiduciary; for wardrobe data at large it never determines purpose and means and is arguably not a Data Fiduciary at all. This reading is untested (the regime is too new for rulings) but well grounded. What *does* process personal data: the company website, store listings, any support email, the research artifacts below, and the ASO tool (§4.3 — AppTweak or the AppFollow free tier), a contracted processor of review-author personal data (names, profile text) with a retention rule for exported review data. Launch interest runs through **Play pre-registration and App Store pre-order**, which keeps the stores as the fiduciary; a company-held launch-notification list exists only if genuinely needed later, and then only as a DPDP-compliant signup — explicit consent notice, single purpose (launch notification), no under-18 collection, deletion at launch plus 90 days, never reused for marketing. Minimal obligations: a plain privacy policy (disclosing the optional BYOK flow, §3.4), no analytics on the website, short retention on support threads, and an architecture log proving nothing leaves the device. One boundary rule, stated here and in §5.4: the telemetry ban binds the shipped binary — no SDK, no network call the user did not initiate; platform-side aggregate console data, and read-only ASO tooling over it, are permitted, and nothing in the binary may ever be added to enrich them.

**The research-data protocol** (referenced from §4.4). A tester's lossless export is their complete wardrobe — photos that can include faces and home interiors, travel dates via events and packing, household members via the shared rail — so the moment one lands in a company inbox, the company is processing personal data as a fiduciary for it. The protocol: written consent per tester; testers 18 and over only (India's under-18 regime is stricter than COPPA's under-13); a fixed retention-and-deletion date per study; research artifacts stored segregated from company systems; and redacted exports preferred — the app ships a "research export" variant that strips photos and free text and carries schema plus counts only. The penalty schedule (up to ₹250 crore for security-safeguard failures, ₹200 crore for children's-data breaches — [dpdpa.com](https://www.dpdpa.com/theschedule.html)) is the standing argument for never adding an SDK: one crash-reporting library would make the company a fiduciary, with India's under-18 children's regime (stricter than COPPA's under-13) attaching from May 2027.

**Stores.** Play's Data safety form is mandatory even when collecting nothing; "collect" means transmitting off-device, so the build without BYOK truthfully declares **"No data collected"** ([Google](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)); Apple's equivalent is the **"Data Not Collected"** label ([Apple](https://developer.apple.com/app-store/app-privacy-details/)). The §3.4 BYOK flow changes the analysis: the app then transmits user photos off-device to the user's chosen AI provider, and whether that user-initiated transfer is compatible with the no-collection labels, or must be declared as an optional third-party flow, is an open question (§5.3) to resolve against the current Play Data-safety and Apple privacy-label definitions before the BYOK build ships — until resolved, v1 ships without BYOK or with amended declarations. A privacy policy is required on both stores regardless ([Google](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en), [TermsFeed](https://www.termsfeed.com/blog/ios-apps-privacy-policy/)). Both account-deletion rules apply only to apps offering account creation ([Google](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en), [Apple](https://developer.apple.com/forums/thread/693997)) — N/A with no accounts. Fees: Play US$25 one-time — register as an organization account (D-U-N-S) to skip the 12-tester/14-day gate ([iconikai](https://www.iconikai.com/blog/google-play-developer-account-fee-2026)); Apple US$99/year ([SplitMetrics](https://splitmetrics.com/blog/google-play-apple-app-store-fees/)). The one-time purchase runs through store billing at **15%**: Play's sub-US$1M tier ([Google](https://support.google.com/googleplay/android-developer/answer/112622?hl=en) — the new June 2026 fee architecture applies only to US/UK/EEA, not India) and Apple's Small Business Program at ≤US$1M prior-year proceeds ([Apple](https://developer.apple.com/app-store/small-business-program/)). Play's user-choice billing would shave 4% (15%→11%) but adds 24-hour transaction reporting ([Google](https://support.google.com/googleplay/android-developer/answer/13306652?hl=en)) — not worth it for one small SKU.

**GST.** Paid app sales to Indian users attract **18% GST** ([busy.in](https://busy.in/gst-rates/it-services/)); the registration threshold is ₹20 lakh for services ([IndiaFilings](https://www.indiafilings.com/learn/gst-on-freelancers)), but Google deducts GST TCS on Indian purchases by India-based developers ([Google](https://support.google.com/googleplay/android-developer/answer/138000?hl=en)), which practically pushes us to register at monetization and reconcile TCS against a GSTIN — a CA question to settle before the paid apps ship, including Apple's India-storefront treatment. Sales abroad are **zero-rated exports under an LUT** ([Tally](https://tallysolutions.com/gst/gst-software-saas-exports-international-clients/)); **OIDAR is the regime for foreign suppliers selling into India, not for us selling out** ([IndiaFilings](https://www.indiafilings.com/gst/cross-border-digital-services-oidar)) — destination-country VAT is generally handled by the stores as merchant of record.

### 2.6 The demo personas: the code already holds the right line

The five sample wardrobes are briefed from film and television costume design but deliberately never use character or actor names — `src/lib/personaCast.ts` documents this as a publicity-rights and trademark decision, and briefs the wardrobe instead ("a Kolkata newspaper sub-editor in 1974 who owns four shirts"). This is the legally sound form. Character IP protects the *delineated* character — the specific constellation of name, look and persona that travels together (*DC Comics v. Towle* — [Wikipedia](https://en.wikipedia.org/wiki/DC_Comics_v._Mark_Towle)); Indian courts protect the same and entertain character-merchandising and passing-off claims (*Raja Pocket Books*, *Arbaaz Khan* — [legalserviceindia.com](https://www.legalserviceindia.com/legal/article-13043-can-we-obtain-copyright-in-fictional-character.html), [ssrana.in](https://ssrana.in/articles/character-merchandising-and-copyright-an-analysis/)). What stays free is the archetype — stock material under *Nichols* and India's idea/expression doctrine ([Khurana & Khurana](https://www.khuranaandkhurana.com/2021/07/16/work-of-fiction-idea-or-expression/)). Rights holders enforce: the Addams estate research showed trademark filings extending into India and active takedowns ([uspto.report](https://uspto.report/TM/97727135), [Daily Dot](https://www.dailydot.com/upstream/adult-wednesday-addams-copyright-claim/)).

**The rule every future persona must follow:** brief the wardrobe, never name the source. No character names, no actor names, no "inspired by" or "as seen in" anywhere — UI, store listing, ASO keywords, or marketing; "inspired by X" in marketing copy is trademark use in commerce, and a disclaimer does not cure it. Original drawn plates only, never stills or costume reproductions. Test: if a user can name the character from the persona page alone, move further from the source; if they can only name a genre, it is stock-character territory and free to use. The press-FAQ rule extends this off the page: no one confirms, denies, or hints at a specific source work on the record — the can-you-name-the-character test applies to interviews and press kits, not just the persona page.

---

## Section 3 — Product and technology roadmap

### 3.1 Current state (shipped, live)

The web app is complete and is the permanent free tier. Stack: React 19 + TypeScript + Vite + Tailwind v4, HashRouter, localStorage as the single store. Feature set: closet, 2-tap wear log, outfits, calendar with honest plans, the centralized CPW ledger, before-you-buy, wishlist cooling-off, mending bench, retire-with-history, events/packing, households/shared rail, in-browser background cutout, photo intake via a bring-your-own vision model, PWA manifest with a partial service worker, 8 sample wardrobes (5 of them film/TV-briefed personas), a hand-coded SVG design system with a CI-enforced brand contract, and 100+ automated checks. Nothing in this section proposes rework of the web app; everything below is packaging, hardening, and distribution.

### 3.2 Mobile: Capacitor wrap, not a rewrite, not PWA-only

**Decision: Capacitor 8.x wrap of the existing DOM app.** Capacitor 8 shipped December 2025 and 8.5 shipped July 31, 2026, adopting the UIScene lifecycle needed for Xcode 27 builds ([capacitor-8](https://ionic.io/blog/announcing-capacitor-8), [8.5 release](https://ionic.io/blog/capacitor-8-5-released)); v7 left maintenance in June 2026, so we start on 8, not 7 ([support policy](https://capacitorjs.com/docs/main/reference/support-policy)). Every native capability Almari needs is a first-party plugin — `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/haptics`, `@capacitor/preferences` ([plugin list](https://capacitorjs.com/docs/apis)). A React Native rewrite would mean rebuilding the entire Tailwind/DOM UI and the SVG design system in RN primitives for no user-visible gain; 2026 decision guides consistently land on "existing web app → Capacitor" ([comparison](https://www.bacancytechnology.com/blog/capacitor-vs-react-native), [capgo](https://capgo.app/blog/comparing-react-native-vs-capacitor/)). No credible sourced rewrite-cost multiplier exists — the qualitative consensus is the evidence. One hard deadline to respect: since April 28, 2026 all App Store uploads must be built with the Xcode 26 / iOS 26 SDK ([Apple](https://www.developer.apple.com/news/upcoming-requirements/)); Capacitor 8.x satisfies this.

**Storage is the real port work.** Capacitor's own guidance says WebView localStorage/IndexedDB "must be considered transient" — the OS reclaims it under disk pressure, and iOS offers no persisted-storage opt-out ([Capacitor storage guide](https://capacitorjs.com/docs/guides/storage)). Two distinct iOS risks get conflated and shouldn't be: Safari's ITP 7-day purge is a *web/PWA* risk; inside a Capacitor WKWebView the ITP day-counter resets on every app launch, so the 7-day cap effectively never fires for an app that gets opened ([Thinktecture analysis](https://www.thinktecture.com/en/ios/wkwebview-itp-ios-14/) — 2020, still the canonical reference). The live risk in-app is low-disk eviction, with anecdotal loss reports on Apple's forums ([thread](https://developer.apple.com/forums/thread/742037)). The port therefore moves the source of truth: settings and small state to `@capacitor/preferences` (native key/value, eviction-safe), the wardrobe database to SQLite via `@capacitor-community/sqlite`, which supports iOS/Android with optional SQLCipher AES-256 encryption ([repo](https://github.com/capacitor-community/sqlite), [encryption](https://github.com/capacitor-community/sqlite/blob/master/docs/DatabaseEncryption.md)). The app already has a lossless migration layer for schema changes; the localStorage→SQLite move reuses it rather than writing a new one, and localStorage remains as a cache only. `@capacitor/filesystem` + `@capacitor/share` add user-controlled JSON export to a real file — which is both our lossless-export promise made native and, usefully, an App Review talking point.

**Guideline 4.2 risk and the armor.** Minimum Functionality is the top rejection vector for wrapped apps ([guideline](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)); vendor content claims a bare wrapper is near-certain rejection by 2026 ([publishd](https://publishd.app/blog/why-wrapping-a-web-app-doesnt-work) — marketing source, treat directionally; no official rejection-rate statistic exists). Known triggers: mirrors the mobile site, browser-style UI, browser error screens offline, no platform features ([MobiLoud guide, updated Dec 2025](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)); bolting on push alone is called out as insufficient ([code2native](https://code2native.com/blog/pass-app-store-guideline-42-review)). Almari's concrete mitigations, all compatible with the design contract: native camera capture of garments, share sheet for outfits and packing lists, haptics on the 2-tap wear log, Face ID app lock (a privacy feature, fitting for a no-account app), custom splash, no browser chrome — and genuine full offline operation, which local-first architecture gives us for free and most wrappers cannot claim. Android equivalents come from the same plugins; Capacitor 8's `SystemBars` plugin handles Android 15+ edge-to-edge ([8.0 update notes](https://capacitorjs.com/docs/updating/8-0)).

**Why not PWA-only, especially for India.** Technically a PWA now reaches most Indian devices: StatCounter puts India at Android 92.44% / iOS 7.5% (July 2026, [statcounter](https://gs.statcounter.com/os-market-share/mobile/india); a secondary aggregate says 95.21% — use StatCounter), Android PWAs are fully installable ([MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)), and iOS 26 even opens Home-Screen sites as web apps by default ([WebKit](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)). But iOS still has no install prompt, no background sync, and WebKit-only engines ([limitations](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)) — and the monetization model *is* the store: a one-time-purchase native app needs a store to sell through. The practical objection for India is distribution and trust, which are Play-Store-centric; a raw PWA has no store presence (qualitative — no sourced India PWA-adoption number exists beyond the market-share data). The shape we adopt: **the PWA stays the free web channel; Capacitor APK/AAB gets Play distribution (a TWA listing via [PWABuilder](https://blog.pwabuilder.com/docs/android-platform/) is the fallback); iOS PWA is a fallback, not a store presence.**

### 3.3 Release engineering for a Windows-based solo founder

No Mac is owned; iOS builds go to the cloud. Options, in preference order:

| Service | Cost | Notes |
|---|---|---|
| Capawesome Cloud | Browser-based CSR + `.p12` generator (no Keychain/Mac), ~2.5-min iOS builds, auto-publish to TestFlight ([guide](https://capawesome.io/blog/how-to-build-and-deploy-ios-apps-without-a-mac/)) | Capacitor-specialized; first choice |
| Codemagic | 500 free macOS M2 minutes/month, then $0.095/min (~₹9.1/min) ([pricing](https://codemagic.io/pricing/)) | General CI fallback |
| EAS Build | 30 free builds/month (≤15 iOS) ([Expo plans](https://docs.expo.dev/billing/plans/)) | RN-optimized; works but not a reason to be here |
| Cloud Mac rental (MacStadium/MacinCloud) | Third-party guides put typical cloud-build cost at $2–10/build ([code2native](https://code2native.com/blog/build-ios-app-without-mac-2026)) | For occasional Xcode debugging only |

Fastlane remains the automation standard but its iOS lanes require macOS and it is community-maintained since Google stopped sponsorship ([history](https://connortumbleson.com/2025/12/01/a-history-of-fastlane/)) — on Windows it's Android-lanes-only, so let Codemagic/Capawesome drive iOS signing rather than self-hosting fastlane.

Accounts and flow: Apple Developer Program $99/year (~₹9,450), Google Play $25 one-time (~₹2,400) ([fees](https://splitmetrics.com/blog/google-play-apple-app-store-fees/)). iOS: cloud build → TestFlight internal (100 testers, instant) → external (up to 10,000, needs Beta App Review) → App Store review ([TestFlight](https://developer.apple.com/testflight/)). Android: internal testing track → closed test → production. **Critical gotcha:** a personal Play developer account created after Nov 13, 2023 must run a closed test with 12 testers opted in for 14 continuous days before production access ([Google policy](https://support.google.com/googleplay/android-developer/answer/14151465), [explainer](https://ontest.app/blog/google-play-12-testers-14-days-requirement-explained)). The committed path: register the Play account as an **organization** (D-U-N-S number, obtainable only after incorporation completes), created in month 2 of the timeline, and **verify the 12-tester exemption at account creation** (§5.3). If the exemption fails, the 14-day clock runs inside the month-6–7 closed track — which the timeline treats as QA regardless (§4.5) — not on the critical path. Versioning discipline: single source of truth in `package.json`, semver `major.minor.patch` mapped to iOS `CFBundleShortVersionString`/build number and Android `versionName`/`versionCode` (monotonic integer), tags cut from CI only, and the existing 100+ checks plus the brand-contract CI gate must pass before any store build is produced.

### 3.4 AI, two lanes

**Lane 1 — build-time (how the app is made).** Almari is already built with Claude Code, and the port continues that way. The honest state of the 2026 toolchain: Claude Code CLI at v2.1.2xx with Claude Opus 5 as default model ([release feed](https://releasebot.io/updates/anthropic/claude-code)); subagents with their own context windows, hooks, and skills/plugins; the official `anthropics/claude-code-action@v1` for CI PR review and issue-to-PR work ([repo](https://github.com/anthropics/claude-code-action)) — noting Microsoft's disclosed prompt-injection vector in CI, mitigated in 2.1.128, which means the CI agent runs with sandboxed permissions ([Microsoft](https://www.microsoft.com/en-us/security/blog/2026/06/05/securing-ci-cd-in-agentic-world-claude-code-github-action-case/)); Claude Code on the web for parallel managed sessions ([Anthropic](https://www.anthropic.com/news/claude-code-on-the-web)); and the Claude Agent SDK for custom automation (the same harness as a library, used for our verification scripts). Desktop gained an iOS Simulator pane in July 2026, though simulation still needs a Mac/cloud Mac from Windows ([release feed](https://releasebot.io/updates/anthropic/claude-code)). Productivity claims stay honest: the only RCT-grade evidence, METR's July 2025 study, found experienced devs 19% *slower* with AI while believing they were faster ([arXiv](https://arxiv.org/abs/2507.09089)); METR's Feb 2026 follow-up declares its own newer numbers unreliable and says only that developers "likely experience speedups" they can't yet quantify ([METR update](https://metr.org/blog/2026-02-24-uplift-update/)). Vendor "10x" claims are unsourced. The practical read: agentic tooling is strongest on exactly this port — mechanical adapter work against a verifiable test harness — but human review time is budgeted, not assumed away. What stays human, permanently: the design contract and its vetoes, the focus-group verdicts, every monetization and scope decision, and final review of anything CI agents produce.

**Lane 2 — runtime (AI in the shipped app).** The rule is absolute and inherited from the design contract: **no server-side AI, ever** — the no-telemetry rule forbids Almari-operated inference because it would mean user photos transiting our servers. The existing web feature already respects this: photo intake hands a structured prompt to the *user's own* vision model and parses what comes back. The native apps may add one optional convenience: bring-your-own-API-key intake, where the user pastes their own key (stored on-device in Preferences/Keychain, never ours), and the app calls their account directly. At current Claude API prices — claude-opus-5 $5/M input, $25/M output; claude-sonnet-5 $3/$15 (introductory $2/$10 through 2026-08-31); claude-haiku-4-5 $1/$5 — and a full-resolution image at roughly 1,600–4,800 input tokens, a wardrobe catalogue run costs (assuming ~300 output tokens per garment record; INR at ₹95.5/US$, the plan's standard rate):

| Model (exact ID) | Per photo | Per 100 photos |
|---|---|---|
| `claude-sonnet-5` (standard $3/$15) | $0.009–$0.019 (₹0.9–1.8) | $0.93–$1.89 (₹89–181) |
| `claude-sonnet-5` (intro $2/$10, through 2026-08-31) | $0.006–$0.013 | $0.62–$1.26 (₹59–120) |
| `claude-haiku-4-5` ($1/$5) | $0.003–$0.006 (₹0.3–0.6) | $0.31–$0.63 (₹30–60) |

Footnote on the Haiku row: Haiku 4.5 caps image inputs at the ~1,600-token resolution tier, so its realistic cost is the low end (~₹30/100 photos); the 4,800-token upper bound applies to Sonnet-tier high-resolution input only.

Cataloguing an entire 100-piece wardrobe on the user's own Haiku-tier key costs less than a cup of chai; even Sonnet-tier is under ₹185. `claude-opus-5` is overkill for garment tagging and is not the default we suggest. This stays strictly optional — the manual intake path and the copy-prompt-to-your-own-model path remain first-class forever. Two rules travel with the feature: the get-a-key link carries no referral, affiliate, or partner code, ever — otherwise it becomes the commerce surface the contract bans — and every absolute "never leaves your device" claim in listings, PR, or the privacy page is qualified to say: nothing leaves your device unless you choose to connect your own AI key, and then photos go only to the provider you chose, under your own account; Almari never sees them (§2.5, §4.3).

### 3.5 Roadmap phases and estimates

**Estimating assumption:** one senior developer working with Claude Code, part-time-to-full-time. Given the METR evidence above, ranges are stated as unassisted-senior-dev effort; AI assistance is treated as risk reduction on the mechanical work, not a schedule multiplier. Calendar time ≠ effort where store gates apply.

| Phase | Scope (from the repo's next-steps ledger) | Engineer-weeks |
|---|---|---|
| **P0 — Hardening** | Photograph the five briefed wardrobes from open-license museum collections; closet masthead/empty-state fixes; room frame bug | 1–2 |
| **P1 — Tutorial** | docs/27 spec: welcome sheet, five coach marks, first-log toast | 1–2 |
| **P2 — True offline** | Complete the service worker, full offline guarantee, sync-you-own file sync (user-controlled file, no server) | 2–4 |
| **P3 — Capacitor port + store launch** | Storage migration to SQLite/Preferences first within the phase (reusing the lossless migration layer) so alpha testers run the shipping architecture, then native plugins, 4.2 armor, cloud-build pipeline, TestFlight + Play tracks | 4–8; the Play closed track doubles as QA, and the 12-tester/14-day clock matters only if the org-account exemption fails (§3.3) |
| **P4 — Post-launch** | Repair log folded into CPW, seasonal coverage, "The Annual Fitting" year-in-review export (a local, shareable file — no server, no telemetry), spec'd under an explicit no-shame/no-gamification review before work starts: descriptive wear statistics only; no scores, badges, streaks, ranks, or unworn-count callouts; it may celebrate most-worn pieces but never indict least-worn ones; the copy addresses the clothes | 3–5, spread across releases |

Total to store launch: roughly 8–16 engineer-weeks — 3 to 5 months at roughly two-thirds time, or up to ~7 months at half-time. Calendar order differs from phase numbering: the port (P3) runs months 3–6 so alpha testers exercise the shipping storage architecture, and true offline (P2) follows in months 6–7 (§4.5). The widest uncertainty sits in P3 (storage migration correctness and one budgeted App Review rejection cycle); the P0 photography work is effort-cheap but sourcing-dependent. Nothing on this roadmap requires a second hire, a server, or a subscription — which is the point.

---

## Section 4 — Money: budgets, funding, marketing, and testing

All conversions at **₹95.5 = $1**, the Aug 2026 spot rate ([exchangerates.org.uk](https://www.exchangerates.org.uk/USD-INR-spot-exchange-rates-history-2026.html)). Unit costs below are sourced; scenario totals are our arithmetic on those units, not independently sourced figures.

### 4.1 Two 18-month budgets

Almari's architecture makes the infra line honest and nearly zero: a local-first app needs static hosting only. Cloudflare Pages serves unlimited static bandwidth free ([danubedata.ro](https://danubedata.ro/blog/cloudflare-pages-vs-netlify-vs-vercel-static-hosting-2026)); TestFlight is included in Apple's $99/yr membership and Play testing in the $25 one-time Console fee ([developer.apple.com](https://developer.apple.com/programs/whats-included/), [choicely.com](https://www.choicely.com/tutorials/how-to-create-a-google-play-developer-account-for-your-organization)). The real recurring items are Apple **$99/yr** ([developer.apple.com](https://developer.apple.com/programs/enroll/)), Play **$25 once** plus a second **$25** Android developer-verification registration from Sept 2026 ([iconikai.com](https://www.iconikai.com/blog/google-play-developer-account-fee-2026), [scworld.com](https://www.scworld.com/brief/googles-android-developer-registration-plan-faces-opposition)), GitHub Actions (2,000 free min/mo, but hosted macOS runners for iOS builds bill at **$0.062/min** — budget real money for cloud Mac minutes: [cicdpipelinecost.com](https://cicdpipelinecost.com/github-actions-pricing)), Google Workspace at ~₹270/user/mo ([unicoconnect.com](https://unicoconnect.com/google-workspace-pricing-india)), and a domain (minor; unsourced).

**Scenario A — Bootstrap** (founder + contractors, remote, no office):

| Line | Monthly (₹) | Basis |
|---|---|---|
| Founder stipend | 50,000–1,00,000 | convention, **unsourced** |
| Senior contract dev, avg 3–5 days/mo (front-loaded into the native build) | 60,000–2,00,000 | ₹20,000–40,000/day, derived from ₹2,500–5,000/hr ([karboncard.com](https://www.karboncard.com/blog/freelance-hourly-rate)) |
| Design/illustration contract work | 8,000–20,000 | derived from freelance hourly bands ([xflowpay.com](https://www.xflowpay.com/blog/freelancer-charges)); flats-illustration rates specifically are unsourced |
| Infra + tooling (Workspace, CI incl. Mac minutes, domain) | 2,500–5,000 | Section above |
| Store fees, amortised year 1 | ~1,200 | $99 + $25 + $25 at ₹95.5 |
| CA retainer + filings + audit (practical total; the statutory floor alone is ₹30–60K/yr — §2.1) | 12,500–17,000 | ₹1.5–2L/yr low band ([batchwise.ai](https://batchwise.ai/guides/how-much-does-ca-charge-small-business-india/), [actaxindia.com](https://actaxindia.com/startups/annual-expenses-of-pvt-ltd-company-in-india/)) |
| Marketing experiments | 25,000–60,000 | nano collabs at ₹2,000–8,000/post ([upgrowth.in](https://upgrowth.in/influencer-marketing-pricing-india-2026/)) + one ASO tool at $65–83/mo ([apsteq.com](https://apsteq.com/blog/aso-tools-comparison/)) |
| **Total burn** | **≈ ₹1.6L–4.0L/mo** | the low-to-mid range sits inside the sourced solo/small-team band of ₹1–3L/mo ([bhavyasharmaandassociates.com](https://www.bhavyasharmaandassociates.com/startup-runway-calculator-2026-india-free-burn-rate-calculator/)); the ₹4L top end (max contractor usage) exceeds it |

**18-month total: ≈ ₹29L–73L (~$30K–76K).** Fixed-scope contractor sprints ($15K–30K, zero equity) are the sourced alternative to hiring for the native wrap ([rohitraj.tech](https://rohitraj.tech/en/notes/founding-engineer-equity-percentage-2026)).

**Maintenance burn**, defined here because §0, §1.4 and §5.1 lean on it: Scenario A minus the front-loaded contractor line and the marketing experiments — stipend, design touch-ups, infra, store fees, compliance — ≈ **₹1.0–1.1L/month** at midpoint assumptions. This is the burn the post-GST Low revenue case (~₹13.4L/yr ≈ ₹1.1L/month, §1.4) roughly carries; Scenario A proper needs the Mid case.

**Scenario B — Seed-funded** (founder + 3–4 hires, coworking):

| Line | Monthly (₹) | Basis |
|---|---|---|
| Founder salary | 1,00,000–1,50,000 | convention, **unsourced** |
| Senior React/TS dev | 1,85,000–2,50,000 | ₹22–30 LPA product-startup band ([tryjobrix.com](https://www.tryjobrix.com/learn/react-developer-salary-india-2026)) |
| Mobile dev (React Native/Capacitor) | 1,10,000–1,60,000 | Bangalore avg ₹16 LPA, max ~₹26 LPA ([cutshort.io](https://cutshort.io/salary/react-native-developer/bangalore)) |
| Mid-level product designer | 85,000–1,35,000 | ₹10–16 LPA ([uiuxjobsboard.com](https://uiuxjobsboard.com/salary/product-designer/bangalore)) |
| Coworking, 4–5 mid-tier seats | 24,000–54,000 | ₹6,000–10,800/seat ([capsule.works](https://blog.capsule.works/best-affordable-coworking-spaces-in-central-bangalore-for-startups), [myhq.in](https://myhq.in/blog/office-space/coworking-space-cost-in-bangalore/)) |
| SaaS/infra/CI, 5 seats | 3,000–6,000 | sourced unit prices, Section 3 of the cost research |
| Marketing (real line) | 1,00,000–2,50,000 | installs at ₹20–80 CPI ([vmobify.com](https://vmobify.com/blog/app-install-cost-india)) + micro collabs ([upgrowth.in](https://upgrowth.in/influencer-marketing-pricing-india-2026/)) |
| Compliance | 12,500–33,000 | ₹1.5–4L/yr ([batchwise.ai](https://batchwise.ai/guides/how-much-does-ca-charge-small-business-india/)) |
| Store fees, amortised | ~1,200 | as above |
| **Total burn** | **≈ ₹6.2L–10.4L/mo** | inside the sourced pre-seed band of ₹3–8L/mo at the low end ([bhavyasharmaandassociates.com](https://www.bhavyasharmaandassociates.com/startup-runway-calculator-2026-india-free-burn-rate-calculator/)) |

**18-month total: ≈ ₹1.12–1.87 crore (~$117K–196K)** — matching the research's own derived 5–6-person figure of ₹1.2–2.1 crore, i.e. top-of-pre-seed or a small seed (₹1–10 crore band, [myhq.in](https://myhq.in/guides/seed-funding-guide)). **ESOP note:** create a ~10% pool before any priced round ([cashfree.com](https://www.cashfree.com/blog/esop-full-form-meaning-how-esops-work-in-indian-startups/)); first engineers typically get 0.5–1% ([startupeditor.com](https://www.startupeditor.com/startup-compensation-guide/)), on the standard 4-year vest / 1-year cliff ([rohitraj.tech](https://rohitraj.tech/en/notes/founding-engineer-equity-percentage-2026)).

Given the Stylebook-model revenue cap, **Scenario A is the default plan**. Scenario B exists only if non-dilutive or angel money arrives on the milestones in 4.2.

### 4.2 Funding — honest fit first

Almari is a weak fit for classic consumer VC, and the numbers say so. Indian seed funding contracted ~30% to $1.1 Bn in 2025 ([techcrunch.com](https://techcrunch.com/2025/12/27/india-startup-funding-hits-11b-in-2025-as-investors-grow-more-selective/)); the H1 2026 recovery (+18% to $478 Mn, median ticket $1 Mn) is real but selective ([inc42.com](https://inc42.com/features/indian-startup-funding-slips-9-to-5-2-bn-in-h1-2026/)). Funded consumer themes are commerce velocity, revenue brands, and AI (+317% YoY); the research found **no Indian funding data for the category, and every funded global player monetizes commerce — absence of funding for the model we would pitch is itself a signal** ([inc42.com](https://inc42.com/features/indian-startup-funding-slips-9-to-5-2-bn-in-h1-2026/)). Our own competitive research (Section 2) shows the category's funded apps died or pivoted to commerce — the pivot our design contract forbids. Add no telemetry (no DAU dashboards to show) and a one-time price (capped LTV), and the pitch fails the standard consumer-VC screen by construction. The counterweight: India app spending hit a record $345 Mn in Q2 2026, +35% YoY ([techcrunch.com](https://techcrunch.com/2026/07/31/india-is-starting-to-pay-for-apps-not-just-download-them/)), and pay-once works precisely for "premium utilities with no recurring server cost" — under 5% of App Store revenue, but our profile ([nicheshunter.app](https://nicheshunter.app/blog/subscription-vs-one-time-purchase-which-model-for-your-app)).

**The real menu, in order of fit:**

1. **Non-dilutive government money.** SISFS: up to ₹20L grant for prototype + ₹50L via convertible instruments, routed through DPIIT-recognised incubators; requires DPIIT recognition and incorporation ≤2 years ([cashfree.com](https://www.cashfree.com/blog/startup-india-seed-fund-scheme-sisfs-eligibility-how-to-apply/), [ISTI portal](https://www.indiascienceandtechnology.gov.in/funding-opportunities/startups/startup-india-seed-fund-scheme-sisfs)). Karnataka **Elevate**: one-time grant up to ₹50L, 2025 window ran Aug 15–Sep 15 ([elevate.startupkarnataka.in](https://elevate.startupkarnataka.in/)). MeitY **GENESIS**: ₹10L early-stage no-match, ₹50L 1:1 matching ([msh.meity.gov.in](https://msh.meity.gov.in/assets/Brochure_GENESIS.pdf)); **SAMRIDH** ₹40L matching via accelerators ([msh.meity.gov.in](https://msh.meity.gov.in/schemes/samridh)); STPI **NGIS** ₹25L but restricted to 12 Tier-2 cities — unavailable if we register in Bengaluru ([stpi.in](https://stpi.in/en/about-ngis)). Stacked, the pure grants reach **~₹80L** (SISFS ₹20L + Elevate ₹50L + GENESIS ₹10L); more is reachable via convertible and matching instruments that are not strictly zero-dilution. And the stack is a ceiling, not a plan: the same properties that fail the VC screen — no telemetry dashboards, capped LTV, an explicit no-growth posture — weaken grant-committee pitches too, so the expected value is a probability-weighted fraction of the ceiling (§5.3 asks which incubators have funded apps like this one).
2. **Grant-style programs.** WTFund ₹20L, zero equity — founders 25 and under only, so applicability depends on the founder's age ([business-standard.com](https://www.business-standard.com/finance/personal-finance/wtfund-nikhil-kamath-launches-rs-20-lakh-grant-for-young-entrepreneurs-124041500338_1.html)); gradCapital $40K for 4%, students only ([business-standard.com](https://www.business-standard.com/finance/investment/vc-firm-gradcapital-launches-6-million-fund-for-students-startups-123090100253_1.html)).
3. **Angels.** IAN averages $400–600K ([gritt.io](https://www.gritt.io/blog/indian-angel-network)); Mumbai Angels ~$70–272K ([aletheiaai.in](https://www.aletheiaai.in/glossary/angel-network-india)); LetsVenture syndicates $100–500K ([aletheiaai.in](https://www.aletheiaai.in/glossary/angel-network-india)). Instruments: a bare US SAFE is a legal grey zone in India — use **iSAFE (CCPS/CCD wrapper)** or CCDs; convertible notes require DPIIT recognition, ₹25L minimum per investor ([mondaq.com](https://www.mondaq.com/india/shareholders/1703148/startup-fundraising-in-india-demystifying-ccds-ccps-and-safes), [incorpx.io](https://www.incorpx.io/blog/convertible-notes-startups-india-fema-rules)). Angel tax is abolished from FY 2025-26 ([cleartax.in](https://cleartax.in/s/angel-tax)).
4. **Micro-VC.** 100X.VC's fixed ₹1.25 Cr for 15% via iSAFE ([siliconindia.com](https://www.siliconindia.com/startup/startup-funding/100xvc-aims-to-invest-in-100-startups-via-isafe-nwid-18309.html)) — steep dilution for the cheque; Antler ₹4 Cr for 11% with a 3-week Bengaluru residency ([antler.co](https://www.antler.co/location/india)). Both listed by Tracxn among active fashion-startup backers ([tracxn.com](https://tracxn.com/d/explore/fashion-tech-startups-in-india/__GLGTTxPKTUvGA-jfIyn-IPXpNczOULLjwBknKcm54bM)).
5. **YC — the explicit fork.** $500K standard deal ([ycombinator.com](https://www.ycombinator.com/blog/ycs-500-000-standard-deal)), but it requires flipping the company to a US/Cayman/Singapore/Canada parent ([ycombinator.com](https://www.ycombinator.com/blog/adding-canada-back)) and a venture-scale story we do not have. Taking it would mean adding a cloud/sync product line or a B2B angle — both currently **off the table by design contract**. Named here only so the fork is a conscious decision, never a drift.

**Milestone-gated plan:** Months 1–3 (Sep–Nov 2026): incorporate, DPIIT recognition (unlocks SISFS, CNs, tax benefits — [mondaq.com](https://www.mondaq.com/india/shareholders/1703148/startup-fundraising-in-india-demystifying-ccds-ccps-and-safes)), no raise. Months 4–9 (Dec 2026–May 2027): apply SISFS + GENESIS against a working beta and store pre-registration numbers (§2.5). Month 12 (Aug 2027): the Elevate window (Aug 15–Sep 15 per the 2025 cycle) — post-launch, applied for with real sales. Month 10+: only if paid-app revenue shows a run rate, consider ₹50L–1.5 Cr from angels on CCPS/iSAFE to fund Scenario B. No metric, no raise — Scenario A continues regardless.

Two standing rules. **Before any non-resident money in any instrument** — foreign angel, NRI syndicate participant, foreign micro-VC — a CA/CS engagement for FEMA pricing/valuation, Form FC-GPR within 30 days of allotment, and the annual FLA return thereafter; late filings mean Late Submission Fees or compounding before RBI. The second nominal shareholder is a resident (§2.1), so the cap table stays FEMA-clean until a deliberate foreign raise. And grant or incubator progress reports use store-console aggregates, sales figures, and moderated-research results only — in-app instrumentation is never the answer to a reporting request.

### 4.3 Marketing without breaking the product

The app carries no ads, no growth hooks, no share-nags; all acquisition is external. **Organic-first is a constraint, not a virtue**: India lifestyle-adjacent CPI plausibly runs ₹20–80/install (interpolated band — [vmobify.com](https://vmobify.com/blog/app-install-cost-india)), and CPI ≠ CAC — at 5% install→paying conversion, CAC is 20× CPI ([insertaffiliate.com](https://insertaffiliate.com/blog/mobile-app-user-acquisition-cost-benchmarks/)), i.e. ₹400–1,600 to acquire one buyer of a one-time app priced in the low hundreds of rupees. Subscription apps can outbid us on every paid channel; no India-wide lifestyle-app CAC figure exists beyond these derivations (**flagged unsourced in the research**). Paid installs are therefore only small experiments to test store listings, never a channel.

What we actually do:

- **ASO:** AppFollow free tier or one $65–83/mo tool (AppTweak) — ₹0–8,000/mo ([appfollow.io](https://appfollow.io/blog/app-store-optimization-cost), [apsteq.com](https://apsteq.com/blog/aso-tools-comparison/)).
- **Nano/micro influencers:** nano ₹2,000–8,000/post at the best engagement ROI (6–12%); fashion micros at ~50K followers ₹25–60K; YouTube micro videos ₹10,000–50,000 ([upgrowth.in](https://upgrowth.in/influencer-marketing-pricing-india-2026/), [tring.co.in](https://www.tring.co.in/influencer-marketing/influencer-price-list-in-india)). Brief: honest wardrobe audits, not promo codes — there is nothing to code.
- **PR, no retainer:** boutique retainers start ₹25K–75K/mo with 6-month minimums ([bluebuzz.in](https://bluebuzz.in/pr-cost-in-india-2025-retainers-agency-rates/), [wingcomm.co](https://wingcomm.co/blogs/pr-agency-costs-in-india-2025/)) — skip; pitch directly on four angles: ownership — nothing leaves your device unless you choose to connect your own AI key, and then photos go only to the provider you chose, under your own account (the qualification travels with the claim everywhere it appears — §3.4); the 30-wears sustainability discourse; the hand-drawn flats design story; and the craft of the sample wardrobes — hand-drawn plates and costume-design-grade wardrobe briefs, with no film/TV provenance ever named (§2.6's press-FAQ rule applies).
- **Content:** the competitive benchmark document (Section 2) is genuinely good standalone content — published only after a verification pass: every competitor price, cap, and status re-verified against live store listings and sites, with dated screenshots archived; an "as of" date in the header; observable facts only (last update date, current listed price) in place of characterizations of competitor health or motive; the 28% D90 figure nowhere in the public version; and the piece reviewed by the TM attorney as marketing material before it goes up. Cost-per-wear explainers follow. Content performance is read from host-side aggregate request counts only (Cloudflare's edge statistics) — no cookies, no client-side analytics script (§2.5).
- **Communities:** fashion subreddits, India fashion YouTube/Instagram, privacy forums — participation, not spam.

**The copy law travels.** All owned external copy — store listings, ASO description text, screenshot captions, influencer briefs, PR boilerplate — obeys the product copy law: no exclamation points, no urgency or discount framing, and screenshots show real product copy that addresses the clothes; any contractor paid from the marketing line gets that in the brief. One content rule with the same force: waste and underuse statistics always describe the industry in aggregate, never the reader — "the average garment is worn seven times," never "how much of your closet is wasted."

Budget: the ₹25–60K/mo (A) or ₹1–2.5L/mo (B) lines above cover all of this.

### 4.4 Alpha and beta without telemetry

The app cannot phone home, so measurement is manual by design.

**Cohorts:** the original focus-group archetypes continue — LGBTQ+ fashion designers and shopaholic archetypes — plus two additions: India metro Gen-Z (the paying-for-apps demographic — [techcrunch.com](https://techcrunch.com/2026/07/31/india-is-starting-to-pay-for-apps-not-just-download-them/)) and a global privacy-conscious cohort recruited from privacy communities.

**Mechanics:** TestFlight internal testing (100 testers, included in the Apple membership — [developer.apple.com](https://developer.apple.com/programs/whats-included/)) → Play closed track (QA; the org account's exemption from the 12-tester/14-day gate is verified at account creation — §3.3) → Play open beta.

**What gets measured, without telemetry:** moderated in-person/video sessions (stopwatch the two-tap log promise), opt-in diary studies (testers keep a one-week log of when they logged wears and when they didn't), voluntary sharing of the lossless export by testers who choose to — handled under §2.5's research-data protocol (written consent, 18+ only, fixed retention, segregated storage, the redacted "research export" variant preferred) — store reviews, and support mail as the ongoing signal. **Success gates, pre-registered and absolute:** median assisted logging flow ≤ two taps in moderated sessions; ≥60% of diary-study participants complete week 1; ≥40% of the alpha cohort logs at least one wear in week 12. No gate compares against the circulating 28% D90 figure — §1.1 found it effectively unsourced, and it appears in no gate, pitch, or store copy (§5.2) — and no gate depends on data the app would have to collect silently.

### 4.5 Twelve-month master timeline

Month 1 = **September 2026**; every external date below is anchored to that calendar. Critical path: **trademark clearance/opposition and App Review** — the gates outside our control. Slack is built in; slipping a month costs ₹1.6–4L (Scenario A burn), not the plan.

| Month | Company & money | Product & testing |
|---|---|---|
| 1 (Sep 2026) | Incorporate Pvt Ltd (SPICe+); **attorney TM clearance search**; open bank/CA; S&E + PT registrations | P0 (photography + fixes) starts |
| 2 (Oct 2026) | DPIIT application; Udyam registration; **org store accounts** (Apple + Play organization, D-U-N-S; 12-tester exemption verified — §3.3); assignment deed executed on stamp paper | P0 completes; P1 tutorial starts; alpha cohort recruiting |
| 3 (Nov 2026) | DPIIT in hand; **file TM** — word + device, classes 9+42, DPIIT rate ₹9,000, expedited examination ₹20,000; SISFS incubator shortlist | P1 completes; P3 Capacitor port starts — storage migration to SQLite/Preferences first |
| 4 (Dec 2026) | SISFS application submitted | P3 continues: native plugins, 4.2 armor, cloud-build pipeline |
| 5 (Jan 2027) | GENESIS early-stage application | Internal TestFlight (≤100); **Alpha** — moderated sessions, diary study #1 |
| 6 (Feb 2027) | Buffer / TM office actions | P3 completes; alpha continues; Play closed track opens (QA — §3.3); P2 true-offline starts |
| 7 (Mar 2027) | — | P2 completes; **Open beta** (Play open track); content publishing starts (post-verification benchmark, §4.3) |
| 8 (Apr 2027) | **Go/no-go: TM opposition-window status checked** — if opposed by a credible senior user, invoke the rename gate before store listings and PR spend (§2.4) | Beta iteration; diary study #2 |
| 9 (May 2027) | Store listings final; ASO tool live | **App Review submission** (critical path; one rejection cycle budgeted) |
| 10 (Jun 2027) | — | **Store launch, both platforms; first revenue** |
| 11 (Jul 2027) | Assess SISFS/GENESIS outcomes | Nano/micro influencer wave; PR pitches |
| 12 (Aug 2027) | **Elevate window** (Aug 15–Sep 15 per 2025 cycle — [elevate.startupkarnataka.in](https://elevate.startupkarnataka.in/)); raise/no-raise decision per 4.2 gates | Post-launch review against the §4.4 absolute gates |

---

## 5. Risks, fallacies named, and open questions

### 5.1 The five risks that matter

1. **The name.** "Almari" walks into a crowded field (§2.4): a 2019 garment-
   storage startup of the same name, a secondhand-clothing app on the App
   Store, a preloved marketplace, a saree brand — plus Section 9
   descriptiveness for a Hindi word meaning wardrobe. Mitigation is procedural
   and already scheduled: attorney clearance before brand spend, device-mark
   filing, a rename gate priced at ₹25–75K now versus several lakh and
   years of opposition defence after launch, and the month-8 opposition-window
   go/no-go before store listings and PR spend (§4.5). This is the plan's
   single largest controllable risk.
2. **App Review.** Guideline 4.2 is the top rejection vector for wrapped apps
   (§3.2). The armor is real (native camera, share, haptics, Face ID lock,
   genuine full offline), but one rejection cycle is budgeted into month 9–10
   and a second would push launch a month. Non-fatal, purely calendar.
3. **The ceiling is the plan.** The post-GST conservative case (~₹13.4L/yr ≈
   ₹1.1L/month) is a modest solo income that roughly carries the maintenance
   burn only — Scenario A minus the contractor line and marketing, ≈
   ₹1.0–1.1L/month (§4.1); the moderate case (~₹66.9L/yr) carries Scenario A
   comfortably. If eighteen months of honest effort lands conservative-or-
   below, the correct move under this plan is not to add commerce or a
   subscription — it is to drop to exactly that maintenance mode (the infra
   is ~zero) and let the founder's time go elsewhere. The design contract
   makes the product permanent; it does not require the company to be large.
4. **Key person.** One founder holds the codebase, the design contract, and
   the corporate obligations. Mitigations: everything is documented to an
   unusual degree (the repo's docs/ is the company brain), the verify suites
   gate regressions, and the lossless-export promise means even abandonment
   does not take user data hostage. Still: bus-factor 1 is bus-factor 1.
5. **Category squeeze from above.** Google Photos' Wardrobe feature (June
   2026) commoditizes free cloud cataloguing. Almari's answer is structural —
   ownership and permanence are things a platform feature cannot promise —
   but the squeeze can still absorb the casual middle of the market, leaving
   the committed edges. The plan's volumes assume the edges.

### 5.2 Fallacies we checked ourselves for

- **Survivorship**: Stylebook proves a one-time-purchase wardrobe app can
  *persist*, not that it can *grow*; it is cited here as a floor, never as a
  trajectory. Obsidian is an analogy for cost structure, not for demand —
  its actual revenue is subscription services this plan forbids. The
  composite fact, stated once more: no company we can find sustains a
  business on this exact model (§1.4); the model is an experiment.
- **Vanity TAM**: the category's published market sizes disagree by 2× and
  come from research mills; this plan builds on unit arithmetic instead
  (§1.1, §1.4). Any pitch that quotes "$3.5B market" should be struck. The
  subtler leak is adjacency: §1.3's India statistics evidence shopping and
  browsing, not wear-logging, and are therefore labelled context, not
  addressable demand.
- **Asymmetric use of conversion assumptions**: §4.3 uses a ~5%
  install→paying rate to rule out paid acquisition; the same rate applied to
  §1.4 implies ~100K organic installs behind the Low case. The funnel is
  stated explicitly in §1.4, in both directions, and the scenario rows are
  labelled as illustrative points, not probabilities.
- **The 28%-retention anchor**: the repo's own benchmark uses a 28% D90
  figure that would not survive sourcing (§1.1). It appears in no gate,
  pitch, or store copy — §4.4's gates are absolute and pre-registered — and
  the README's claim should be corrected in the same spirit as its earlier
  abandonment-statistic fix.
- **AI-productivity optimism**: the only RCT evidence available found
  experienced developers *slower* with AI while believing otherwise; the
  schedule therefore counts unassisted engineer-weeks (§3.5) and treats
  Claude Code as risk reduction, not multiplication.
- **"Privacy sells"**: user research says people respond to ownership, not
  privacy (§1.2); the positioning and every marketing angle follow the
  evidence, not the founder's affinity.
- **Sunk-cost on the name**: the rename gate exists precisely so that months
  of attachment to "Almari" cannot outvote a failed clearance search.

### 5.3 Open questions, owned

| Question | Owner | By |
|---|---|---|
| Attorney clearance verdict on "Almari" (classes 9/42/35/25): registered status of the four collisions, passing-off exposure from the 2019 user, and the TM-A use claim (proposed-to-be-used vs user date) | TM attorney, months 1–3 | verdict before any launch spend; use claim at filing |
| Stamp duty and consideration on the IP assignment deed — copyright vs trademark/goodwill components, Section 56(2)(x) exposure at nil value | lawyer + CA, month 2 | at deed execution |
| GST/TCS mechanics for Play and App Store India payouts | CA, at monetization | before store launch |
| Whether the org Play account fully exempts the 12-tester gate for our listing shape | founder, at account creation | month 2 |
| Whether BYOK photo intake is compatible with the "No data collected" / "Data Not Collected" labels, or requires declaring an optional user-initiated transfer to a third-party AI provider | counsel + founder | before the BYOK build ships |
| SISFS incubator shortlist (which three to apply through); what the SISFS/Elevate applications claim about scale and employment, whether that is consistent with §5.4, and which incubators have funded utility/deep-privacy apps | founder | month 3, before the month-4 application |
| iOS storage-eviction behaviour under real low-disk pressure on the ported app | dev, during P3 QA | before TestFlight external |
| Whether "The Annual Fitting" export meets both stores' content rules as a shareable image, and passes its no-shame/no-gamification review (§3.5) | founder, at P4 | post-launch |

### 5.4 What the company will never do

Inherited from the focus group and the design contract, restated here so no
future investor conversation reopens them: no accounts, no cloud sync, no
telemetry or analytics SDKs, no ads, no affiliate or commerce surfaces, no
subscriptions, no item caps, no notifications, no gamification chrome, no
gendered anything, no required fields that erase people, no selling or
sharing of data there is no server to hold. One boundary so the telemetry
ban cannot drift: it binds the shipped binary — no SDK, no network call the
user did not initiate; platform-side aggregate console data, and read-only
ASO tooling over it, are permitted, and nothing in the binary may ever be
added to enrich them (§2.5). A funding conversation that requires any of
these is a conversation about a different company.
