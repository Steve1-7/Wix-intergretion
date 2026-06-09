# Wix ↔ HubSpot Integration App

A production-ready Wix application that enables Wix site owners to securely connect their HubSpot account, synchronize contacts bi-directionally, embed or integrate forms, and maintain reliable lead/contact synchronization between Wix and HubSpot.

## Features

- **Secure OAuth Connection**: HubSpot OAuth 2.0 with automatic token refresh and encrypted storage
- **Bi-Directional Contact Sync**: Automatic two-way synchronization with conflict resolution
- **Field Mapping Dashboard**: Configurable field mapping between Wix and HubSpot properties
- **Form & Lead Capture**: Wix form submissions with UTM attribution tracking
- **Sync Monitoring**: Real-time sync events, statistics, and error tracking
- **Production-Grade Security**: Token encryption, rate limiting, input validation, and masked logging
- **GDPR Compliant**: Data retention policies, right-to-delete, and audit trails

## Architecture

### Backend (Node.js/Express)
- **Server**: Express.js with security middleware (Helmet, rate limiting)
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Job Queue**: Bull (Redis) for async processing and automatic retries
- **Services**: HubSpot API, Wix API, Sync Engine, Token Manager
- **Webhooks**: HubSpot and Wix webhook processing with deduplication

### Frontend (React)
- **Framework**: React with Vite
- **Routing**: React Router
- **Styling**: Custom CSS with CSS variables
- **Components**: Dashboard, Connect, Field Mappings, Sync Monitor, Forms, Settings

## Prerequisites

- Node.js 18+ 
- Redis (for job queue)
- Supabase account
- HubSpot Developer account
- Wix API credentials

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/wix-hubspot-integration.git
cd wix-hubspot-integration
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Create a new project in [Supabase](https://supabase.com)
2. Run the database migration:
```bash
psql -h <your-host> -U <your-user> -d <your-database> -f supabase/migrations/20260608125632_001_initial_schema.sql
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# HubSpot OAuth
HUBSPOT_CLIENT_ID=your-client-id
HUBSPOT_CLIENT_SECRET=your-client-secret
HUBSPOT_REDIRECT_URI=http://localhost:3001/api/oauth/callback
HUBSPOT_WEBHOOK_SECRET=your-webhook-secret

# Wix API
WIX_API_KEY=your-api-key
WIX_ACCOUNT_ID=your-account-id
WIX_SITE_ID=your-site-id

# Security
ENCRYPTION_KEY=your-32-character-encryption-key

# Redis (for job queue)
REDIS_URL=redis://localhost:6379

# Server
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
```

### 5. Start Redis

```bash
redis-server
```

### 6. Run the Application

```bash
npm run dev
```

This will start both the server (port 3001) and the client (port 5173) concurrently.

## HubSpot OAuth Setup

### 1. Create HubSpot App

1. Go to [HubSpot Developer Portal](https://developers.hubspot.com)
2. Create a new app
3. Configure OAuth settings:
   - Redirect URL: `http://localhost:3001/api/oauth/callback` (or your production URL)
   - Scopes: `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.schemas.contacts.read`, `forms`, `oauth`

### 2. Get Credentials

- Copy the Client ID and Client Secret to your `.env` file

## Wix API Setup

### 1. Get Wix API Key

1. Go to [Wix Developers](https://dev.wix.com)
2. Create a new project
3. Generate API key and account ID
4. Add to your `.env` file

## Usage

### Connect HubSpot

1. Navigate to the Connect page in the dashboard
2. Click "Connect HubSpot"
3. Authorize the app in HubSpot
4. Tokens will be stored securely and auto-refreshed

### Configure Field Mappings

1. Go to Field Mappings page
2. Add mappings between Wix fields and HubSpot properties
3. Set sync direction (Wix→HubSpot, HubSpot→Wix, or Bi-Directional)
4. Apply transforms if needed (lowercase, uppercase, trim, format phone)
5. Save your mappings

### Monitor Sync Activity

1. Go to Sync Monitor page
2. View recent sync events with status
3. Check sync statistics (completed, failed, pending)
4. Retry failed events if needed
5. Review dead letter queue for permanently failed events

### Configure Settings

1. Go to Settings page
2. Set conflict resolution strategy
3. Configure sync direction preferences
4. Adjust deduplication window
5. Set max concurrent syncs and retry delay

## API Endpoints

### OAuth
- `GET /api/oauth/connect` - Get HubSpot OAuth URL
- `GET /api/oauth/callback` - OAuth callback handler
- `POST /api/oauth/disconnect` - Disconnect HubSpot
- `GET /api/oauth/status` - Get connection status

### Sync
- `POST /api/sync/wix-to-hubspot` - Trigger Wix→HubSpot sync
- `POST /api/sync/hubspot-to-wix` - Trigger HubSpot→Wix sync
- `GET /api/sync/events` - Get recent sync events
- `GET /api/sync/stats` - Get sync statistics
- `POST /api/sync/retry-failed` - Retry failed syncs

### Mappings
- `GET /api/mappings` - Get field mappings
- `POST /api/mappings` - Create mapping
- `PUT /api/mappings/:id` - Update mapping
- `DELETE /api/mappings/:id` - Delete mapping
- `POST /api/mappings/batch` - Batch update mappings
- `GET /api/mappings/wix-fields` - Get Wix field definitions
- `GET /api/mappings/hubspot-properties` - Get HubSpot properties

### Forms
- `GET /api/forms/hubspot` - Get HubSpot forms
- `POST /api/forms/submit` - Submit to HubSpot form
- `POST /api/forms/wix-submission` - Process Wix form submission
- `GET /api/forms/submissions` - Get submission history

### Settings
- `GET /api/settings` - Get sync settings
- `PUT /api/settings` - Update sync settings
- `GET /api/settings/dead-letter` - Get dead letter queue
- `PUT /api/settings/dead-letter/:id/resolve` - Resolve dead letter item

### Dashboard
- `GET /api/dashboard/overview` - Get dashboard overview
- `GET /api/dashboard/sync-timeline` - Get sync timeline
- `GET /api/dashboard/contact-mappings` - Get contact mappings

### Health
- `GET /health` - Comprehensive health check
- `GET /health/readiness` - Readiness probe
- `GET /health/liveness` - Liveness probe

## Database Schema

### Tables

- **integration_settings**: OAuth tokens and connection status
- **contact_mappings**: Wix↔HubSpot contact ID mappings
- **field_mappings**: Field mapping configuration
- **sync_events**: Sync event log and audit trail
- **dead_letter_queue**: Permanently failed sync events
- **form_submissions**: Form submission tracking with UTM data
- **sync_conflicts**: Conflict resolution log
- **sync_settings**: Global sync configuration

## Security Features

- **Token Encryption**: OAuth tokens encrypted at rest using AES-256
- **Rate Limiting**: API rate limiting with configurable limits
- **Input Validation**: Request validation using express-validator
- **Masked Logging**: Sensitive data masked in logs
- **CORS Protection**: Configurable CORS policies
- **Helmet**: Security headers via Helmet middleware

## GDPR Compliance

- **Data Retention**: Configurable retention policies for sync events and submissions
- **Right to Delete**: API endpoint to delete all user data
- **Data Export**: API endpoint to export user data
- **Audit Trail**: Complete audit trail of all sync operations

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Deployment

### Production Deployment

1. Set `NODE_ENV=production` in environment variables
2. Use production Supabase and Redis instances
3. Configure proper CORS origins
4. Set up SSL/TLS certificates
5. Configure proper rate limits
6. Enable monitoring and alerting

### Docker Deployment

```bash
# Build Docker image
docker build -t wix-hubspot-integration .

# Run container
docker run -p 3001:3001 --env-file .env wix-hubspot-integration
```

## Monitoring

### Health Checks

- **Health**: `GET /health` - Overall system health
- **Readiness**: `GET /health/readiness` - Ready to receive traffic
- **Liveness**: `GET /health/liveness` - Process is running

### Metrics

- Sync success rate
- Sync latency
- Error rate
- Queue depth
- Database connection pool

## Troubleshooting

### Common Issues

**HubSpot connection fails**
- Verify Client ID and Secret are correct
- Check redirect URL matches HubSpot app settings
- Ensure required scopes are granted

**Sync events failing**
- Check dead letter queue for error details
- Verify field mappings are correct
- Check rate limits and API quotas

**Webhooks not receiving events**
- Verify webhook registration in HubSpot
- Check webhook secret matches
- Ensure callback URL is publicly accessible

## Support

- Email: support@yourcompany.com
- Documentation: https://docs.yourcompany.com/wix-hubspot
- Status Page: https://status.yourcompany.com

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Changelog

### 1.0.0 (2024-06-08)
- Initial release
- Bi-directional contact sync
- Field mapping dashboard
- Form capture with UTM tracking
- OAuth integration
- Production-ready security features
