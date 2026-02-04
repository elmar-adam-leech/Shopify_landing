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

### Shopify OAuth Integration
- **OAuth Flow**: `/api/auth/shopify` initiates OAuth, `/api/auth/callback` handles token exchange
- **Multi-tenancy**: All pages are scoped to stores via `storeId` foreign key
- **Session Storage**: OAuth sessions stored in `shopify_sessions` table
- **Webhook**: `/api/webhooks/app-uninstalled` handles app uninstallation
- **Environment Variables**: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`, `HOST_URL`

### Shopify App Proxy
- **URL Format**: Landing pages accessible at `mystore.myshopify.com/tools/lp/{slug}` via Shopify App Proxy
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

### Shopify Customer Creation
- **Form Submissions**: Creates Shopify customers when form block has `createShopifyCustomer` enabled
- **Phone Calls**: Creates Shopify customers from Twilio call tracking events
- **Tagging**: Automatic source tags (`source:page-slug`, `page:title`, `form-lead`/`phone-lead`)
- **UTM Support**: UTM parameters passed through to customer notes
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