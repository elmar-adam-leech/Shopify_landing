# Shopify Page Builder App

## Overview

A drag-and-drop page builder application designed for Shopify merchants to create dynamic product landing pages for advertising. The app provides a visual editor with reusable blocks (hero banners, product grids, forms, etc.) that can be arranged via drag-and-drop, with built-in support for ad pixel tracking (Meta, Google, TikTok, Pinterest) and form submissions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **UI Components**: shadcn/ui component library (Radix UI primitives)
- **Drag and Drop**: dnd-kit library for sortable block manipulation
- **Build Tool**: Vite

### Backend Architecture
- **Runtime**: Node.js with Express
- **API Design**: RESTful endpoints under `/api/` prefix
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Schema Validation**: Zod for runtime type checking

### Shopify OAuth Integration (Dual Token Flow)
- **Offline Token Flow** (`/api/auth/shopify` → `/api/auth/callback`):
  - Long-lived access tokens for background operations (webhooks, scheduled tasks)
  - Persists in `shopify_sessions` table with `isOnline: false`
  - Never expires until app is uninstalled
- **Online Token Flow** (`/api/auth/online` → `/api/auth/online/callback`):
  - Short-lived tokens for embedded app sessions (per-user access)
  - Includes user info in `onlineAccessInfo` field
  - Expires and requires re-auth
- **Auto-redirect Chain**: Offline auth → Online auth → Embedded app with shop/host params
- **Host Preservation**: Host parameter preserved across OAuth redirects for embedded context
- **Multi-tenancy**: All pages are scoped to stores via `storeId` foreign key
- **Session Storage**: OAuth sessions stored in `shopify_sessions` table with expiry tracking
- **Webhook**: `/api/webhooks/app-uninstalled` handles app uninstallation
- **Environment Variables**: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`, `HOST_URL`, `VITE_SHOPIFY_API_KEY` (for frontend)

### Shopify Auth Security (`server/shopify-auth.ts`)
- **validateShopMiddleware**: Protects API routes with:
  - Shop domain format validation
  - HMAC verification (for Shopify redirects)
  - Session token JWT verification (for embedded app requests)
  - Full JWT validation: signature, exp, iat, nbf, aud, iss, dest
  - Dev mode bypass with warning (non-production only)
- **Session Helpers**: `getSessionForShop()`, `getOnlineSession()`, `getOfflineSession()`
  - Prefers valid online session, falls back to offline
  - Automatically cleans up expired online sessions

### Shopify App Bridge Integration (`client/src/components/providers/AppBridgeProvider.tsx`)
- **ShopifyProviders**: Wraps app with AppBridgeContext and Polaris
- **Hooks**:
  - `useAppBridge()`: Access app instance, shop, host, isEmbedded
  - `useShopOrigin()`: Get shop/host context
  - `useSessionToken()`: Get session token with auto-refresh
  - `useShopifyRedirect()`: Redirect to auth with preserved host
  - `useAuthenticatedFetch()`: Make authenticated API calls
- **Query Client Integration**: `authenticatedFetch` adds session token to all API requests in embedded context

### Shopify App Proxy
- **URL Format**: Landing pages accessible at `mystore.myshopify.com/tools/lp/{slug}` via Shopify App Proxy

#### App Proxy Setup (Required for Preview URLs)
To enable landing page preview via `mystore.myshopify.com/tools/lp/{slug}`:
1. Go to your **Shopify Partner Dashboard** → Apps → Your App
2. Click **Configuration** → **App proxy**
3. Add a new proxy with:
   - **Subpath prefix**: `tools`
   - **Subpath**: `lp`
   - **Proxy URL**: `https://YOUR-REPLIT-APP-URL.replit.app/pages/proxy`
4. Save changes

The app proxy routes requests through Shopify to your app, enabling:
- Landing pages on your store's domain (better for SEO/ads)
- Shopify theme integration (with `?liquid=true`)
- HMAC signature verification for security

- **Signature Verification**: HMAC-SHA256 verification of Shopify proxy requests (`server/lib/proxy-signature.ts`)
  - Production: Hard-fails if SHOPIFY_API_SECRET not configured (returns 500)
  - Development: Allows bypass with warning for testing
- **Server-Side Rendering**: Full SSR of landing pages for fast load times and SEO (`server/lib/page-renderer.ts`)
- **Block Rendering**: All 9 block types rendered to HTML (hero, product, text, image, button, form, phone, chat, product-grid)
- **Dynamic Products**: Client-side hydration for dynamic SKU loading via Storefront API (hash-based: `#SKU-HERE`)
- **Pixel Integration**: Automatic injection of Meta/Google/TikTok/Pinterest pixel scripts
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- **Caching**: 5-minute public cache for rendered pages
- **Storefront Token**: `storefrontAccessToken` field on stores for public product API access
- **Liquid Wrapper**: Add `?liquid=true` query param to render within Shopify theme (uses `{{ content_for_header }}` and `{{ content_for_layout }}`)

### Data Model
The core entities are:
- **Stores**: Shopify stores with OAuth credentials, install status, and settings
- **Pages**: Landing pages with title, slug, blocks array, pixel settings, and publish status (scoped to store)
- **Blocks**: JSON structure containing block type, configuration, and order
- **Form Submissions**: Captured form data linked to pages and stores
- **Users**: Basic user accounts with store role assignments

### Page Builder Block Types
- Hero Banner, Product Grid, Text Block, Image Block
- Button Block, Form Block, Phone Block, Chat Block

### Editor Features
- **Flow-based Layout**: Blocks are arranged vertically with drag-and-drop reordering (freeform positioning removed)
- **Responsive Preview**: Desktop/tablet/mobile viewport toggle for preview sizing
- **Multi-step Forms**: Forms support multiple steps with field assignment and navigation
- **Custom Pixel Events**: Define custom events that can be triggered by form submissions, button clicks, and product actions

### A/B Testing (Block-Level)
- Each block can have multiple variants with different configurations
- Traffic percentage controls for variant distribution
- Variants configured via tabbed interface in BlockSettings
- Visitor variant assignments persisted in localStorage
- Analytics tracking includes variant ID for performance measurement

### Performance Optimizations
- Public cached API endpoint (`/api/public/pages/:id`) with 5-minute cache and stale-while-revalidate
- Image blocks use lazy loading (`loading="lazy"`, `decoding="async"`)
- TanStack Query with 5-minute staleTime for client-side caching

### Key Design Patterns
- **Monorepo Structure**: Client (`/client`), server (`/server`), and shared code (`/shared`)
- **Shared Schema**: Database schema and Zod validators in `/shared/schema.ts` used by both frontend and backend
- **Path Aliases**: `@/` for client source, `@shared/` for shared modules
- **Component-Based UI**: Block previews and settings panels are modular React components

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Schema management and queries with `drizzle-kit push` for migrations

### Third-Party Libraries
- **@dnd-kit**: Drag-and-drop functionality for the visual editor
- **@tanstack/react-query**: Data fetching and caching
- **Radix UI**: Accessible UI primitives (dialogs, dropdowns, forms, etc.)
- **react-icons**: Icon set including brand icons for ad platforms
- **date-fns**: Date formatting utilities
- **uuid**: Unique identifier generation for blocks

### Ad Platform Integrations (Configured via UI)
- Meta Pixel
- Google Ads / Tag Manager
- TikTok Pixel
- Pinterest Tag

### Shopify Customer Creation (GraphQL Admin API)
- **API Version**: GraphQL Admin API 2025-01 (`server/lib/shopify.ts`)
- **Search Before Create**: Uses `customerSearch` query to find existing customers by email OR phone
- **Create New**: Uses `customerCreate` mutation with optional email marketing consent
- **Update Existing**: Uses `customerUpdate` mutation to append tags to existing customers
- **Form Submissions**: Creates/updates Shopify customers when form block has `createShopifyCustomer` enabled
- **Phone Calls**: Creates Shopify customers from Twilio call tracking events
- **Full UTM Tagging**: Customer tags include `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`
- **Configurable Source Tags**: Set `shopifyCustomerTagSource: false` to disable `page:slug` and `form:blockId` tags
- **Email Marketing Consent**: Opt-in consent passed when form has `consent` or `marketing` field set to true
- **Customer ID Storage**: `shopifyCustomerId` field on `formSubmissions` stores the Shopify GID
- **Analytics Integration**: Form submissions log `form_submission` events with full UTM parameters
- **OAuth Scopes**: Requires `write_customers` and `read_customers` scopes

### Twilio Call Tracking Integration
- **Dynamic Number Insertion (DNI)**: Swap phone numbers based on GCLID/UTM parameters
- **Tracking Numbers**: Per-store tracking numbers with forwarding configuration
- **Call Logging**: All calls logged with GCLID, duration, and status
- **Webhooks**: `/api/incoming-call` and `/api/call-status` for Twilio callbacks
- **Number Management**: `/api/twilio/available-numbers` and `/api/twilio/purchase-number` endpoints
- **Environment Variables**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (must be added manually as secrets)

### Development Tools
- **Vite**: Frontend development server with HMR
- **esbuild**: Production server bundling
- **TypeScript**: Full type safety across the stack