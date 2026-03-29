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
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Schema Validation**: Zod

### Shopify Integration
- **OAuth**: Dual token flow (offline for background, online for embedded app sessions) with auto-redirects and host preservation.
- **Security**: `validateShopMiddleware` for API protection (shop validation, HMAC, JWT verification).
- **App Bridge**: Integration for embedded app functionality (session tokens, authenticated fetch).
- **App Proxy**: Enables landing pages on Shopify store domains (`/tools/lp/{slug}`) with signature verification and server-side rendering.

### Core Features
- **Public Pages**: Published pages accessible via `/p/{slug}` with 5-minute caching and security headers.
- **Page Builder**: Visual editor with drag-and-drop, responsive preview, and block-level A/B testing.
- **Block Types**: Hero Banner, Product Grid, Text, Image, Button, Form, Phone, Chat.
- **Data Model**: Stores, Pages, Blocks, Form Submissions, Users.
- **Performance**: SQL aggregation, upsert for products, database indexing, caching, code splitting, memoization, DOMPurify sanitization for user HTML content.
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