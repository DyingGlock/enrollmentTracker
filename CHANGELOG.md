# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
