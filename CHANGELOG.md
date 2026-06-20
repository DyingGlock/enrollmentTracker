# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.8] - 2026-06-20

### Fixed

- Active nav tab (Home/Archived) no longer changes colour on hover when already selected.
- Production CSS cache busting after rebuilds, so archived page styles load correctly behind Cloudflare instead of serving stale cached assets.

### Changed

- Build writes content hashes into the manifest and appends them to static asset URLs (`?v=...`).
- Bundled production runtime also reads `dist/manifest.json` for asset resolution.

## [1.0.7] - 2026-06-20

### Added

- Archived page search bar with live client-side filtering by applicant name.
- Multi-select class filter on the archived roster, populated from available archived class numbers.

### Changed

- Link embeds now use a compact summary card with a fixed title and page-specific descriptions that no longer mention class numbers.
- Archived toolbar layout redesigned to remove duplicate totals and show a live “shown” count with separate Failed and Passed outcome stats.
- Search bars now use a larger left-pointing magnifying-glass SVG icon.

## [1.0.6] - 2026-06-13

### Changed

- Sync now only tracks cards with applicant-style titles (`username:userid`), excluding question templates and board utility cards regardless of list.
- Trello list metadata includes closed lists so ignored-list detection works for cards on archived board lists.
- Archived and active queries require both a tracked applicant list and a valid applicant card name.

### Fixed

- Reconciliation no longer re-imports utility-list cards every sync cycle, which had caused Questions, Blacklist, Settings, and other non-applicant records to appear on the archived tab.

## [1.0.5] - 2026-06-09

### Added

- Exam result import script (`npm run db:import-exam`) to backfill Passed/Failed applicants from Trello archived cards.
- Trello pagination helper for boards with more than 1,000 cards.

### Changed

- Sync and tracker queries now ignore board utility lists (`Questions`, `Old Questions`, `Blacklist`, `Settings`, `Information`) so template cards no longer appear in active or archived views.
- Reconciliation removes any previously synced records on ignored lists.

## [1.0.4] - 2026-06-08

### Changed

- Cards moved to the Trello `Failed` list are now archived automatically instead of remaining on the active tracker.
- Failed applicants appear on the archived page with their final `Failed` status preserved during sync and reconciliation.

### Removed

- Removed the Failed count from the active tracker summary banner.

## [1.0.3] - 2026-06-08

### Changed

- Unified site meta, Open Graph, and Twitter card descriptions to a single public-facing summary of the Firestone POST enrollment tracker.

## [1.0.2] - 2026-06-07

### Fixed

- Bundled production servers now locate `build/manifest.json` from the `dist` runtime layout, ensuring generated pages reference the hashed CSS, JavaScript, and logo files that exist in `dist/public`.
- Added regression coverage for production asset resolution from both source and bundled directory layouts.

## [1.0.1] - 2026-06-07

### Fixed

- Production static asset URLs now include the correct `.css`, `.js`, and `.png` extensions from the build manifest, preventing 500 errors when loading tracker assets.
- Static file serving now resolves from the project root so bundled and source server runs use the correct `src/public` or `dist/public` directories.
- Open Graph and social preview image URLs now use the shared asset resolver instead of a hardcoded logo path.

## [1.0.0] - 2026-04-08

### Added

- Trello-backed enrollment tracker with PostgreSQL storage and read-only tracker website.
- Active and archived application pages with live refresh.
- Trello webhook ingestion and periodic full-board reconciliation.
- Production build pipeline with minified and obfuscated browser and server assets.
