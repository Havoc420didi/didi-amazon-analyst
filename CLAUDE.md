# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Amazon Analyst is an Amazon operations analysis platform built with Next.js 15, React 19, and TypeScript. The application provides inventory management, analytics, and AI-powered insights for Amazon sellers.

## Essential Commands

### Development
```bash
# Install dependencies
pnpm install

# Start development server (with Turbopack)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Bundle analysis
pnpm analyze
```

### Database Operations
```bash
# Generate new migrations after schema changes
pnpm db:generate

# Apply migrations to database
pnpm db:migrate

# Open Drizzle Studio (database UI)
pnpm db:studio

# Push schema changes directly (development only)
pnpm db:push
```

### Docker
```bash
# Build Docker image
pnpm docker:build
```

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 App Router, React 19, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **UI**: Shadcn UI, Radix UI, Tailwind CSS
- **Auth**: NextAuth.js v5 (beta)
- **AI**: Multiple providers via AI SDK (OpenAI, DeepSeek, etc.)
- **Payments**: Stripe
- **File Storage**: AWS S3
- **Internationalization**: next-intl

### Key Directory Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── [locale]/          # Internationalized routes
│   │   ├── (admin)/       # Admin panel routes
│   │   ├── (default)/     # Public and user routes
│   │   │   ├── (console)/ # User dashboard
│   │   │   └── inventory/ # Inventory management
│   │   └── auth/          # Authentication pages
│   └── api/               # API routes
├── components/            # React components
│   ├── blocks/           # Page section components
│   ├── ui/              # Shadcn UI components
│   ├── inventory/       # Inventory-specific components
│   └── [feature]/       # Feature-specific components
├── db/                   # Database configuration and schema
│   ├── schema.ts        # Drizzle ORM schema definitions
│   ├── config.ts        # Database configuration
│   └── migrations/      # Auto-generated migrations
├── lib/                 # Utility functions
├── types/               # TypeScript type definitions
├── services/            # Business logic layer
├── auth/                # Authentication configuration
└── i18n/               # Internationalization setup
```

### Core Database Schema
The application manages several key entities:
- **Users**: User accounts with invite system and affiliate support
- **Orders**: Stripe payment processing with subscription support
- **Credits**: User credit system for API usage
- **InventoryRecords**: Core inventory data with sales and advertising metrics
- **Posts**: Blog/content management
- **APIKeys**: User-generated API keys for external access

### Authentication Flow
- NextAuth.js v5 with Google and GitHub providers
- Session-based authentication with JWT tokens
- Admin role system based on email configuration
- One-tap Google login support

### Inventory Management System
- Multi-warehouse support (UK, EU)
- ASIN-based product tracking
- Daily sales and inventory data
- Advertising performance metrics (ACOS, CTR, conversion rates)
- Excel upload functionality for bulk data import

### AI Integration
- Multiple AI providers supported via Vercel AI SDK
- Video generation capabilities (Kling AI)
- Text generation and analysis features
- Configurable provider selection

## Development Guidelines

### Code Style
- Use functional components and hooks (avoid classes)
- Prefer named exports over default exports
- Use interfaces instead of types unless union types are needed
- Follow existing naming conventions:
  - Components: PascalCase (`UserProfile.tsx`)
  - Files/directories: kebab-case (`inventory-dashboard`)
  - Variables: camelCase with descriptive prefixes (`isLoading`, `hasError`)

### React/Next.js Best Practices
- Minimize `"use client"` usage - prefer Server Components
- Use Suspense boundaries for client components
- Follow Next.js App Router conventions for routing and data fetching
- Implement proper error boundaries and loading states

### Database Operations
- All schema changes must generate migrations via `pnpm db:generate`
- Use proper indexing for query optimization (see `inventoryRecords` table)
- Follow existing patterns for service layer database interactions

### Internationalization
- All user-facing text should use next-intl
- Translation files are in `src/i18n/messages/`
- Support for English (en) and Chinese (zh)

## Environment Setup

Copy `.env.example` to `.env.development` and configure:
- `DATABASE_URL`: PostgreSQL connection string
- `AUTH_SECRET`: NextAuth secret (generate with `openssl rand -base64 32`)
- `AUTH_GOOGLE_ID/SECRET`: Google OAuth credentials
- Stripe keys for payment processing
- AWS S3 credentials for file storage

## Testing

Currently no test framework is configured. When adding tests, check existing patterns in the codebase first.

## Important Notes

- The project uses Turbopack for faster development builds
- Drizzle Studio provides a web UI for database management
- The inventory system supports unique daily records per ASIN/location
- Admin access is controlled via `ADMIN_EMAILS` environment variable
- The application supports both light and dark themes