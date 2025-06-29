# Amazon Analyst

Your AI-powered Amazon operations director for data-driven business optimization.

## Overview

Amazon Analyst is an intelligent Amazon operations analysis platform that provides 24/7 monitoring, AI-driven insights, and actionable recommendations to optimize your Amazon business performance.

## Features

- **Real-time Data Monitoring**: Track sales, inventory, rankings, and advertising data around the clock
- **AI-Powered Analysis**: Transform complex data into actionable business insights
- **Smart Inventory Management**: Predict replenishment needs and optimize capital efficiency
- **PPC Campaign Optimization**: Analyze ad performance and improve ROI
- **Competitor Monitoring**: Stay ahead with competitor price and strategy tracking
- **Automated Reporting**: Generate custom reports with export capabilities

## Quick Start

1. Install dependencies

```bash
pnpm install
```

2. Set up environment variables

```bash
cp .env.example .env.development
```

3. Run the development server

```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Components**: Shadcn UI, Radix UI, Tailwind CSS
- **Database**: Supabase with Drizzle ORM
- **AI Integration**: Multiple AI providers (OpenAI, DeepSeek, etc.)
- **Authentication**: NextAuth.js
- **Internationalization**: next-intl

## Project Structure

```
src/
├── app/           # Next.js App Router pages
├── components/    # React components
├── lib/          # Utility functions
├── services/     # Business logic layer
├── db/           # Database configuration
├── i18n/         # Internationalization
└── types/        # TypeScript definitions
```

## Development

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Run linting
pnpm lint

# Database operations
pnpm db:studio    # Open database studio
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Run migrations
```

## License

All rights reserved.
