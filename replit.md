# Shopify Page Builder App

## Overview

A drag-and-drop page builder for Shopify merchants to create dynamic product landing pages for advertising. It features a visual editor with reusable blocks, supports ad pixel tracking (Meta, Google, TikTok, Pinterest), and handles form submissions. The app aims to provide a powerful yet intuitive tool for merchants to enhance their marketing efforts and drive sales through highly customizable landing pages.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: Tailwind CSS with CSS variables
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Drag and Drop**: dnd-kit
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express
- **API Design**: RESTful endpoints
- **Database ORM**: Drizzle ORM v0.45.2 with PostgreSQL
- **Schema Validation**: Zod

### Shopify Integration
- **OAuth**: Dual token flow (offline for background, online for embedded app sessions) with auto-redirects and host preservation.
- **Security**: `validateShopMiddleware` for API protection (shop validation, HMAC, JWT verification).
- **App Bridge**: Integration for embedded app functionality (session tokens, authenticated fetch).
- **App Proxy**: Enables landing pages on Shopify store domains (`/tools/lp/{slug}`) with signature verification and server-side rendering.

### Core Features
- **Public Pages**: Published pages accessible via `/p/{slug}` with 5-minute caching and security headers.
- **Page Builder**: Visual editor with drag-and-drop, responsive preview, and block-level A/B testing.
- **Block Types**: Hero Banner, Product Grid, Text, Image, Button, Form, Phone, Chat, Container (flex row/column with auto-layout), Section (full-width wrapper with maxWidth).
- **Nested Blocks**: `Block.children?: Block[]` enables container/section nesting. Tree helpers in `client/src/components/editor/blockTree.ts` (`findBlockById`, `findParentOf`, `insertBlockAt`, `removeBlockById`, `moveBlock`, `updateBlockById`, `isDescendantOf`) keep ordering reindexed and prevent moving a container into its own descendants. Server renderer (`server/lib/page-renderer.ts`) recursively renders containers/sections as flex divs, falling through transparently for legacy flat `blocks[]` pages.
- **Published-Page Interactions Runtime**: `server/lib/page-renderer.ts` injects three small IIFEs at the end of every rendered page: (1) on-click runtime reads `data-onclick-action` to perform link / link-new-tab / scroll / open-form, (2) visibility runtime reads `data-visibility-rules` (JSON) and toggles `display` based on URL params + `document.referrer`, and (3) A/B testing runtime reads `data-ab-block` / `data-ab-variant` / `data-ab-traffic`, picks one weighted variant per visitor, persists assignment in `localStorage` under a `pb_ab_variant_<pageId>_<blockId>` key (with `pb_visitor_id` for the visitor) — namespaced by page so the same block ID across different pages stays independent — and removes the non-selected variants. A one-time migration also honors any legacy `pb_ab_variant_block_<blockId>` value. Each AB-enabled block is rendered with all variants wrapped in `hidden` divs and revealed by the runtime; visibility wrappers render `display:none` initial to avoid FOUC.
- **Recursive DnD**: Editor uses dnd-kit with custom collision detection (`pointerWithin` over block sortables first, then `closestCenter` over blocks for inter-block whitespace, with the root canvas droppable as a final fallback). Each container block hosts its own SortableContext (vertical or horizontal based on `direction`) for its children. Drop intent is computed by zone in `onDragOver` from the real pointer Y vs the over rect: leaf blocks split top-half / bottom-half (before / after), container blocks split top 25% / middle 50% / bottom 25% (before / inside / after). A window pointermove listener active during drag tracks pointer Y; the keyboard sensor falls back to the dragged item's translated rect center. Indicators: 2px primary line for before/after, dashed primary outline on the block for inside, dashed outline on the canvas for inside-root.
- **Data Model**: Stores, Pages, Blocks, Form Submissions, Users.
- **Performance**: SQL aggregation, upsert for products, database indexing, caching, code splitting, memoization, DOMPurify sanitization for user HTML content. Response compression (gzip/brotli) via `compression` middleware. Static asset caching (1yr immutable for hashed `/assets`, no-cache for HTML). Vite manual chunk splitting for large vendor libs (Polaris, recharts, framer-motion, dnd-kit, react-hook-form, tanstack). Lazy-loaded editor sub-components (BlockSettings, PixelSettings, PageSettings, VersionHistory). Deferred sync scheduler startup (45s delay).
- **Security**: Store ownership validation, audit logging, typed request properties, pixel ID sanitization, preview route auth gating, ErrorBoundary for graceful error recovery.
- **Pagination**: Server-side pagination on pages list (`/api/pages/list`) and form submissions (`/api/pages/:id/submissions`) endpoints — responses are `{ data, total, limit, offset }`.

### Backend Architecture
- **Modular Routers**: API routes organized by domain (`admin`, `proxy`, `stores`, `products`, `pages`, `analytics`, `ab-tests`).
- **Orchestration**: `server/routes.ts` applies middleware and mounts routers.
- **Design Patterns**: Monorepo structure, shared schema (`/shared`), path aliases, component-based UI.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **Drizzle ORM**: For schema management and queries.

### Third-Party Libraries
- **@dnd-kit**: Drag-and-drop functionality.
- **@tanstack/react-query**: Data fetching and caching.
- **Radix UI**: Accessible UI primitives.
- **react-icons**: Icon set.
- **date-fns**: Date utilities.
- **uuid**: Unique ID generation.

### Ad Platform Integrations
- Meta Pixel
- Google Ads / Tag Manager
- TikTok Pixel
- Pinterest Tag

### Shopify APIs
- **GraphQL Admin API**: For Shopify customer creation/updates (search, create, update with UTM tagging and consent management) and product synchronization.
- **Storefront API**: Used for dynamic product loading on public pages.

### Communication Services
- **Twilio**: For call tracking integration (Dynamic Number Insertion, call logging, number management).

## Deployment & Operations

### Required Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — Secret for admin session cookies
- `ENCRYPTION_SALT` — (required in production) Salt for PII encryption
- `HOST_URL` — (required in production) Public URL of the app (e.g., `https://app.example.com`); prevents localhost fallbacks in OAuth redirects

### Optional Environment Variables
- `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` — Shopify OAuth (app disabled without these)
- `SHOPIFY_APP_HANDLE` — Shopify admin redirect handle
- `SHOPIFY_SCOPES` — Comma-separated OAuth scopes
- `SHOPIFY_STORE_URL` — Default store URL for legacy single-tenant mode
- `SHOP` — Single-tenant shop enforcement
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` — Global Twilio fallback
- `DEV_TEST_SECRET` — Required to use test endpoints in development
- `NEON_SECRET` — Neon serverless driver connection (used in production instead of DATABASE_URL)

### Health Check
- `GET /health` — Returns `{ status, database, uptime, timestamp }`. Returns 503 if DB is unreachable.

### Graceful Shutdown
- On `SIGTERM` / `SIGINT`: stops sync scheduler, stops login-attempt prune timer, drains HTTP connections, closes DB pool, then exits. Forceful exit after 15 seconds.

### Background Tasks
- **Sync scheduler** (`server/lib/sync-scheduler.ts`): Checks every 5 minutes for stores needing product sync. Cleaned up on shutdown.
- **Login attempt pruner** (`server/admin-auth.ts`): Cleans stale rate-limit entries every 5 minutes. Cleaned up on shutdown.