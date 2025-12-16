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

### Data Model
The core entities are:
- **Pages**: Landing pages with title, slug, blocks array, pixel settings, and publish status
- **Blocks**: JSON structure containing block type, configuration, and order
- **Form Submissions**: Captured form data linked to pages
- **Users**: Basic user accounts

### Page Builder Block Types
- Hero Banner, Product Grid, Text Block, Image Block
- Button Block, Form Block, Phone Block, Chat Block

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

### Development Tools
- **Vite**: Frontend development server with HMR
- **esbuild**: Production server bundling
- **TypeScript**: Full type safety across the stack