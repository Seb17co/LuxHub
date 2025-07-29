# LuxKids Hub - AI-Powered Internal Dashboard

## Overview

LuxKids Hub is a comprehensive internal dashboard that provides AI-powered insights for sales and inventory management. Built with React, TypeScript, Supabase, and OpenAI integration.

## Features

### 🎯 Core Features
- **AI Assistant**: OpenAI-powered chat interface with function calling
- **Sales Analytics**: Real-time sales data from Shopify and SpySystem
- **Inventory Management**: Low stock alerts and inventory tracking
- **Role-Based Access**: Different views for sales, warehouse, and admin users
- **Real-time Notifications**: Live updates via Supabase Realtime
- **Weekly Reports**: Automated PDF report generation

### 🔐 Authentication & Authorization
- Supabase Auth with email/password
- Role-based routing (sales, warehouse, admin)
- Row Level Security (RLS) policies

### 📊 Dashboard Components
- **Sales Summary**: Revenue tracking with period filters
- **Inventory Alerts**: Low stock monitoring
- **AI Chat**: Natural language queries about business data
- **Charts & Visualizations**: Interactive charts using Recharts

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and builds
- **Tailwind CSS** for styling
- **Inter font** for a modern look
- **React Router** for navigation
- **Recharts** for data visualization
- **Heroicons** for UI icons

### Backend
- **Supabase** (PostgreSQL + Auth + Realtime + Edge Functions)
- **OpenAI GPT-4** for AI assistant
- **pgvector** extension for AI embeddings

### External Integrations
- **Shopify** webhooks for order data
- **SpySystem** API integration
- **PDF generation** for reports

## Project Structure

```
LuxHub/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── Login.tsx
│   │   │   ├── Layout.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── SalesView.tsx
│   │   │   ├── InventoryView.tsx
│   │   │   └── AIChat.tsx
│   │   ├── lib/
│   │   │   └── supabase.ts  # Supabase client config
│   │   └── App.tsx
│   ├── package.json
│   └── tailwind.config.js
├── supabase/                # Supabase configuration
│   ├── functions/           # Edge Functions
│   │   ├── sales-summary/
│   │   ├── inventory-top20/
│   │   ├── ai-ask/
│   │   ├── shopify-webhook/
│   │   ├── spy-login-refresh/
│   │   ├── inventory-check/
│   │   └── weekly-report/
│   ├── migrations/          # Database schema
│   └── config.toml
└── docs/
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase CLI
- OpenAI API key
- Shopify store (for webhooks)
- SpySystem API access

### 1. Clone and Setup
```bash
cd LuxHub
```

### 2. Frontend Setup
```bash
cd frontend
# All npm scripts live here. Running them from the repo root will cause
# "ENOENT: no such file or directory, open 'package.json'" errors.
npm install
npm run dev
```

### 3. Supabase Setup
```bash
# Start local Supabase
supabase start

# Apply database migrations
supabase db reset

# Deploy Edge Functions
supabase functions deploy
```

### 4. Environment Variables

Create `.env.local` in frontend directory:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Set these secrets in Supabase:
```
OPENAI_API_KEY=your_openai_key
SHOPIFY_WEBHOOK_SECRET=your_shopify_secret
SPY_USERNAME=your_spy_username
SPY_PASSWORD=your_spy_password
SPY_API_URL=your_spy_api_url
```

## Database Schema

### Core Tables
- `users` - User profiles with roles
- `products` - Product catalog with AI embeddings
- `inventory_snapshots` - Stock level tracking
- `shopify_orders` - Shopify order data
- `spy_orders` - SpySystem order data
- `notifications` - System notifications
- `secrets` - Encrypted API credentials

### Key Features
- **Row Level Security** for data access control
- **pgvector extension** for AI similarity search
- **Real-time subscriptions** for live updates

## API Endpoints (Edge Functions)

### Sales Data
- `GET /sales-summary?period=day|week|month` - Sales aggregation
- `POST /shopify-webhook` - Shopify order webhooks

### Inventory
- `GET /inventory-top20` - Lowest stock items
- `POST /inventory-check` - Scheduled stock monitoring

### AI Assistant
- `POST /ai-ask` - OpenAI chat with function calling

### Automation
- `POST /spy-login-refresh` - SpySystem token refresh
- `POST /weekly-report` - Generate weekly reports

## User Roles & Permissions

### Sales Role
- Access to sales dashboard
- View Shopify and SpySystem orders
- Sales analytics and reports
- AI assistant access

### Warehouse Role
- Access to inventory management
- Low stock alerts
- Inventory analytics
- AI assistant access

### Admin Role
- Full access to all features
- User management
- System configuration
- All data access

## AI Assistant Features

The AI assistant can help with:
- **Sales Queries**: "What are today's sales figures?"
- **Inventory Questions**: "Show me low stock items"
- **Data Analysis**: "Compare Shopify vs SpySystem performance"
- **Report Generation**: "Generate a sales report for this month"

### Function Calling
The AI uses OpenAI's function calling to:
1. Query sales data with `getSales(period)`
2. Retrieve inventory data with `getInventory(sku?, low_stock_only?)`
3. Provide real-time insights with data citations

## Deployment

### Production Deployment
1. Deploy Supabase project to production
2. Deploy frontend to Vercel/Netlify
3. Configure environment variables
4. Set up webhook endpoints
5. Schedule automated functions

### Monitoring & Maintenance
- Monitor Edge Function logs
- Check database performance
- Review AI assistant usage
- Update inventory thresholds

## Development

### Running Tests
```bash
npm run test
```

### Building for Production
```bash
npm run build
```

### Database Migrations
```bash
supabase db diff --schema public
supabase db reset
```

## Security Considerations

- All API keys stored as Supabase secrets
- Row Level Security on all tables
- HMAC verification for webhooks
- Role-based access control
- Secure authentication flow

## Future Enhancements

- Advanced analytics dashboard
- Mobile responsive design
- Slack/Teams integration
- Advanced AI features (forecasting, recommendations)
- Multi-language support
- Advanced reporting features

## Support

For technical support or questions about the LuxKids Hub, please contact the development team.

---

**Built with ❤️ for LuxKids**