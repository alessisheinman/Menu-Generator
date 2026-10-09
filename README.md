# Kitchen Menu Generator

Build catered-event kitchen menus from saved dishes and templates, then download a `.docx` that matches the existing menu format (Calibri 20pt, red DAY / VENUE / TIME + PPL header, one meal per page).

## Use

1. **Events → New event**: name + venue.
2. **+ Add day**, then **+ Breakfast / Lunch / Dinner / Custom**. Each meal loads its template (lunch = cuisine + salad bar, dinner = 2 starch / 2 protein / 2 veg / desserts).
3. Type quantities. Swap dishes with ⇄, search any dish, add note lines, drag or ↑↓ to reorder, duplicate meals or whole days.
4. **Download .docx**.

**From an approved proposal:** Events → **From proposal…** lists the proposals saved in this browser by the Proposed Menu Generator (both sites share alessisheinman.github.io, so they can see each other's saved data), or choose a proposal backup file. Days, meals, dishes and tags come across; descriptions are dropped and quantities are left blank.

Everything saves automatically in this browser. Use **Export backup** regularly and **Import** to move to another computer.
The **Catalog** tab edits dishes, tags, templates, venues and the salad bar (affects new menus only).

## Develop

```bash
npm install
npm run dev     # http://localhost:5173
npm test
npm run build
```

Design spec: `docs/superpowers/specs/2026-10-05-menu-generator-design.md`.

## Deploy (GitHub Pages)

1. Create a GitHub repo and push `main`.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. Every push to `main` runs tests, builds and deploys via `.github/workflows/deploy.yml`.

`Finished Menus/` and the original `dog photos/` are git-ignored and never uploaded. The repo is public on a free plan.
