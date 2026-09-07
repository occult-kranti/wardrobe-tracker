# Alpha release links

The GitHub Pages workflow publishes these addresses from main. The Rose atelier, event stylist and operator workbench release is described in [the validation record](56-alpha-release-validation.md). Follow the [deployment workflow](https://github.com/occult-kranti/wardrobe-tracker/actions/workflows/deploy.yml) for its current build status.

| Hosted surface | Link |
|---|---|
| Main alpha | [Almari](https://occult-kranti.github.io/wardrobe-tracker/) |
| Event stylist | [What should I wear?](https://occult-kranti.github.io/wardrobe-tracker/#/events/style) — open a wardrobe first |
| Outfits and Calendar shortcut | [Outfits](https://occult-kranti.github.io/wardrobe-tracker/#/outfits) |
| Operator monitor and AI workbench | [Portal](https://occult-kranti.github.io/wardrobe-tracker/portal/) — public shell; existing admin token required for calls |
| Tester introduction | [Alpha welcome](https://occult-kranti.github.io/wardrobe-tracker/alpha.html) |
| Separate V2 glass design | [V2](https://occult-kranti.github.io/wardrobe-tracker/v2/) |
| Social feature showcase | [Showcase](https://occult-kranti.github.io/wardrobe-tracker/showcase/) |
| Mobile design gallery | [Mobile version 1](https://occult-kranti.github.io/wardrobe-tracker/mobile_version_v1/) |
| Company work board | [Workroom](https://occult-kranti.github.io/wardrobe-tracker/company/tracker.html) |
| Engineering board | [Tech Workbench](https://occult-kranti.github.io/wardrobe-tracker/company/build.html) |
| Public launch board | [Shipping Almari](https://occult-kranti.github.io/wardrobe-tracker/company/ship.html) |
| Earlier V2 demonstrations | [Widescreen film](https://occult-kranti.github.io/wardrobe-tracker/demo.mp4) · [Vertical film](https://occult-kranti.github.io/wardrobe-tracker/demo-vertical.mp4) |

V2 and Showcase build from their own branches. They retain their separate designs; the new default and navigation belong to the main alpha.

| Local on this computer | Link | Restart command |
|---|---|---|
| Updated alpha | [App](http://127.0.0.1:4174/) | npm run preview -- --port 4174 --host 127.0.0.1 --strictPort |
| Updated outfits | [Outfits](http://127.0.0.1:4174/#/outfits) | Same app server |
| Event stylist | [Ask AI](http://127.0.0.1:4174/#/events/style) | Same app server |
| Operator portal | [Monitor and AI tests](http://127.0.0.1:4177/) | npm run preview:portal, after npm run build:portal |
| Theme and navigation captures | [Rose gallery](http://127.0.0.1:4176/rose/) | npm run review:alpha |
| Live model/image evidence | [Model comparison](http://127.0.0.1:4176/workbench/) | Same review server |
| Recorded event refinement | [First and updated outfits](http://127.0.0.1:4176/) | Same review server |
| Complete alpha review | [58 screen captures](http://127.0.0.1:4176/screens/) | Same review server |

Local servers must remain running. localhost and127.0.0.1 have different browser storage; use the links consistently for the same local wardrobe. Generated evidence stays under ignored shots/ and is not part of the public deployment.

| Backend | Endpoint | Expected unauthenticated response |
|---|---|---|
| Consumer AI relay | [ai-proxy](https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/ai-proxy) | GET405; model calls require POST |
| Private operational statistics | [admin-stats](https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/admin-stats) |401 without the admin token |
| Operator model testing | [admin-ai](https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/admin-ai) |401 without the admin token |
| Optional alpha usage collector | [usage](https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/usage) |404 in the last live check; not deployed as part of this release |

Developer destinations: [repository](https://github.com/occult-kranti/wardrobe-tracker), [Pages workflow](https://github.com/occult-kranti/wardrobe-tracker/actions/workflows/deploy.yml), [Supabase project](https://supabase.com/dashboard/project/wvupsqfevlrmhqfjreyx). Management requires the appropriate signed-in account.
