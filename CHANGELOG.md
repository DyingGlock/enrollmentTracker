# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
