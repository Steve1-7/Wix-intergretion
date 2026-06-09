# Wix ↔ HubSpot Integration API Documentation

## Base URL

```
http://localhost:3001/api
```

## Authentication

Most endpoints require a valid HubSpot OAuth connection. The OAuth flow is handled through the `/api/oauth` endpoints.

## Response Format

All API responses follow this structure:

```json
{
  "data": { ... },
  "error": null,
  "timestamp": "2024-06-08T12:00:00Z"
}
```

Error responses:

```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  },
  "data": null,
  "timestamp": "2024-06-08T12:00:00Z"
}
```

## OAuth Endpoints

### Get OAuth Connect URL

Initiates the HubSpot OAuth flow by returning the authorization URL.

**Endpoint:** `GET /api/oauth/connect`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID for multi-tenant setups

**Response:**
```json
{
  "url": "https://app.hubspot.com/oauth/authorize?client_id=...",
  "state": "random-state-string"
}
```

### OAuth Callback

Handles the OAuth callback from HubSpot.

**Endpoint:** `GET /api/oauth/callback`

**Query Parameters:**
- `code`: Authorization code from HubSpot
- `state`: State parameter for CSRF protection

**Response:**
```json
{
  "success": true,
  "message": "HubSpot connected successfully"
}
```

### Disconnect HubSpot

Disconnects the HubSpot integration and clears stored tokens.

**Endpoint:** `POST /api/oauth/disconnect`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID

**Response:**
```json
{
  "success": true,
  "message": "HubSpot disconnected successfully"
}
```

### Get Connection Status

Returns the current HubSpot connection status.

**Endpoint:** `GET /api/oauth/status`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID

**Response:**
```json
{
  "is_connected": true,
  "hubspot_portal_id": 123456,
  "connected_at": "2024-06-08T10:00:00Z",
  "scopes": ["crm.objects.contacts.read", "crm.objects.contacts.write"]
}
```

## Sync Endpoints

### Sync Wix Contact to HubSpot

Triggers a sync operation from Wix to HubSpot.

**Endpoint:** `POST /api/sync/wix-to-hubspot`

**Request Body:**
```json
{
  "wixContactId": "wix-contact-123",
  "wixContactData": {
    "email": "user@example.com",
    "firstname": "John",
    "lastname": "Doe"
  },
  "correlationId": "optional-correlation-id"
}
```

**Response:**
```json
{
  "status": "completed",
  "wix_contact_id": "wix-contact-123",
  "hubspot_contact_id": "hubspot-contact-456",
  "sync_type": "wix_to_hubspot",
  "created_at": "2024-06-08T12:00:00Z"
}
```

### Sync HubSpot Contact to Wix

Triggers a sync operation from HubSpot to Wix.

**Endpoint:** `POST /api/sync/hubspot-to-wix`

**Request Body:**
```json
{
  "hubspotContactId": "hubspot-contact-456",
  "hubspotContactData": {
    "email": "user@example.com",
    "firstname": "John",
    "lastname": "Doe"
  },
  "correlationId": "optional-correlation-id"
}
```

**Response:**
```json
{
  "status": "completed",
  "hubspot_contact_id": "hubspot-contact-456",
  "wix_contact_id": "wix-contact-123",
  "sync_type": "hubspot_to_wix",
  "created_at": "2024-06-08T12:00:00Z"
}
```

### Get Sync Events

Retrieves recent sync events.

**Endpoint:** `GET /api/sync/events`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID
- `limit` (optional): Number of events to return (default: 50, max: 500)

**Response:**
```json
{
  "events": [
    {
      "id": "event-123",
      "wix_site_id": "default",
      "sync_type": "wix_to_hubspot",
      "status": "completed",
      "wix_contact_id": "wix-123",
      "hubspot_contact_id": "hubspot-456",
      "created_at": "2024-06-08T12:00:00Z"
    }
  ],
  "total": 1,
  "limit": 50
}
```

### Get Sync Statistics

Returns sync statistics for a time period.

**Endpoint:** `GET /api/sync/stats`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID
- `hours` (optional): Time period in hours (default: 24, max: 8760)

**Response:**
```json
{
  "completed": 100,
  "failed": 5,
  "pending": 2,
  "skipped": 1,
  "success_rate": 0.95,
  "period_hours": 24
}
```

### Retry Failed Syncs

Retries all failed sync events.

**Endpoint:** `POST /api/sync/retry-failed`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID

**Response:**
```json
{
  "retried": 5,
  "success": 4,
  "failed": 1
}
```

### Move to Dead Letter Queue

Moves a failed sync event to the dead letter queue.

**Endpoint:** `POST /api/sync/dead-letter/:eventId`

**Path Parameters:**
- `eventId`: Sync event ID

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID

**Response:**
```json
{
  "success": true,
  "event_id": "event-123",
  "dead_lettered_at": "2024-06-08T12:00:00Z"
}
```

## Mappings Endpoints

### Get Field Mappings

Retrieves all field mappings for a site.

**Endpoint:** `GET /api/mappings`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID

**Response:**
```json
{
  "mappings": [
    {
      "id": "mapping-123",
      "wix_field": "email",
      "hubspot_property": "email",
      "sync_direction": "both",
      "transform": "lowercase",
      "is_required": true,
      "created_at": "2024-06-08T10:00:00Z"
    }
  ],
  "total": 1
}
```

### Create Field Mapping

Creates a new field mapping.

**Endpoint:** `POST /api/mappings`

**Request Body:**
```json
{
  "wix_field": "email",
  "hubspot_property": "email",
  "sync_direction": "both",
  "transform": "lowercase",
  "is_required": true
}
```

**Response:**
```json
{
  "id": "mapping-123",
  "wix_field": "email",
  "hubspot_property": "email",
  "sync_direction": "both",
  "transform": "lowercase",
  "is_required": true,
  "created_at": "2024-06-08T12:00:00Z"
}
```

### Update Field Mapping

Updates an existing field mapping.

**Endpoint:** `PUT /api/mappings/:id`

**Path Parameters:**
- `id`: Mapping ID

**Request Body:**
```json
{
  "sync_direction": "wix_to_hubspot",
  "transform": "uppercase"
}
```

**Response:**
```json
{
  "id": "mapping-123",
  "wix_field": "email",
  "hubspot_property": "email",
  "sync_direction": "wix_to_hubspot",
  "transform": "uppercase",
  "is_required": true,
  "updated_at": "2024-06-08T12:00:00Z"
}
```

### Delete Field Mapping

Deletes a field mapping.

**Endpoint:** `DELETE /api/mappings/:id`

**Path Parameters:**
- `id`: Mapping ID

**Response:**
```json
{
  "success": true,
  "message": "Mapping deleted successfully"
}
```

### Batch Update Mappings

Updates multiple field mappings at once.

**Endpoint:** `POST /api/mappings/batch`

**Request Body:**
```json
{
  "mappings": [
    {
      "id": "mapping-123",
      "sync_direction": "both"
    },
    {
      "id": "mapping-456",
      "transform": "lowercase"
    }
  ]
}
```

**Response:**
```json
{
  "updated": 2,
  "failed": 0
}
```

### Get Wix Fields

Retrieves available Wix contact fields.

**Endpoint:** `GET /api/mappings/wix-fields`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID

**Response:**
```json
{
  "fields": [
    {
      "key": "email",
      "name": "Email",
      "type": "text",
      "required": true
    },
    {
      "key": "firstname",
      "name": "First Name",
      "type": "text",
      "required": false
    }
  ]
}
```

### Get HubSpot Properties

Retrieves available HubSpot contact properties.

**Endpoint:** `GET /api/mappings/hubspot-properties`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID

**Response:**
```json
{
  "properties": [
    {
      "name": "email",
      "label": "Email",
      "type": "string",
      "required": true
    },
    {
      "name": "firstname",
      "label": "First Name",
      "type": "string",
      "required": false
    }
  ]
}
```

## Forms Endpoints

### Get HubSpot Forms

Retrieves available HubSpot forms.

**Endpoint:** `GET /api/forms/hubspot`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID

**Response:**
```json
{
  "forms": [
    {
      "id": "form-123",
      "name": "Contact Form",
      "fields": [
        {
          "name": "email",
          "label": "Email",
          "required": true
        }
      ]
    }
  ]
}
```

### Submit to HubSpot Form

Submits data to a HubSpot form.

**Endpoint:** `POST /api/forms/submit`

**Request Body:**
```json
{
  "formId": "form-123",
  "email": "user@example.com",
  "firstname": "John",
  "lastname": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "submission_id": "submission-456",
  "submitted_at": "2024-06-08T12:00:00Z"
}
```

### Process Wix Form Submission

Processes a Wix form submission and syncs to HubSpot.

**Endpoint:** `POST /api/forms/wix-submission`

**Request Body:**
```json
{
  "wix_site_id": "default",
  "formId": "wix-form-123",
  "submissionId": "submission-456",
  "email": "user@example.com",
  "firstname": "John",
  "lastname": "Doe",
  "utm_source": "google",
  "utm_medium": "cpc",
  "page_url": "https://example.com/contact"
}
```

**Response:**
```json
{
  "status": "processed",
  "submission_id": "submission-456",
  "hubspot_contact_id": "hubspot-789",
  "created_at": "2024-06-08T12:00:00Z"
}
```

### Get Form Submissions

Retrieves form submission history.

**Endpoint:** `GET /api/forms/submissions`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID
- `limit` (optional): Number of submissions to return (default: 50)

**Response:**
```json
{
  "submissions": [
    {
      "id": "submission-456",
      "form_id": "form-123",
      "email": "user@example.com",
      "submitted_at": "2024-06-08T12:00:00Z",
      "utm_source": "google"
    }
  ],
  "total": 1
}
```

## Settings Endpoints

### Get Sync Settings

Retrieves sync configuration settings.

**Endpoint:** `GET /api/settings`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID

**Response:**
```json
{
  "conflict_resolution_strategy": "last_updated_wins",
  "sync_enabled": true,
  "wix_to_hubspot_enabled": true,
  "hubspot_to_wix_enabled": true,
  "deduplication_window_seconds": 300,
  "max_concurrent_syncs": 10,
  "retry_delay_seconds": 60
}
```

### Update Sync Settings

Updates sync configuration settings.

**Endpoint:** `PUT /api/settings`

**Request Body:**
```json
{
  "conflict_resolution_strategy": "wix_wins",
  "sync_enabled": false,
  "deduplication_window_seconds": 600
}
```

**Response:**
```json
{
  "conflict_resolution_strategy": "wix_wins",
  "sync_enabled": false,
  "wix_to_hubspot_enabled": true,
  "hubspot_to_wix_enabled": true,
  "deduplication_window_seconds": 600,
  "max_concurrent_syncs": 10,
  "retry_delay_seconds": 60,
  "updated_at": "2024-06-08T12:00:00Z"
}
```

### Get Dead Letter Queue

Retrieves items in the dead letter queue.

**Endpoint:** `GET /api/settings/dead-letter`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID

**Response:**
```json
{
  "items": [
    {
      "id": "dlq-123",
      "event_id": "event-456",
      "error_message": "Rate limit exceeded",
      "retry_count": 3,
      "dead_lettered_at": "2024-06-08T12:00:00Z"
    }
  ],
  "total": 1
}
```

### Resolve Dead Letter Item

Resolves a dead letter queue item by retrying it.

**Endpoint:** `PUT /api/settings/dead-letter/:id/resolve`

**Path Parameters:**
- `id`: Dead letter item ID

**Response:**
```json
{
  "success": true,
  "message": "Dead letter item resolved successfully"
}
```

## Dashboard Endpoints

### Get Dashboard Overview

Retrieves dashboard overview statistics.

**Endpoint:** `GET /api/dashboard/overview`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID

**Response:**
```json
{
  "total_contacts": 1000,
  "synced_contacts": 950,
  "sync_rate": 0.95,
  "last_sync": "2024-06-08T12:00:00Z",
  "connection_status": {
    "is_connected": true,
    "hubspot_portal_id": 123456
  }
}
```

### Get Sync Timeline

Retrieves sync timeline data for visualization.

**Endpoint:** `GET /api/dashboard/sync-timeline`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID
- `hours` (optional): Time period in hours (default: 24)

**Response:**
```json
{
  "timeline": [
    {
      "timestamp": "2024-06-08T12:00:00Z",
      "count": 10,
      "status": "completed"
    }
  ],
  "total": 10
}
```

### Get Contact Mappings

Retrieves recent contact mappings.

**Endpoint:** `GET /api/dashboard/contact-mappings`

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID
- `limit` (optional): Number of mappings to return (default: 20)

**Response:**
```json
{
  "mappings": [
    {
      "id": "mapping-123",
      "wix_contact_id": "wix-456",
      "hubspot_contact_id": "hubspot-789",
      "last_synced_at": "2024-06-08T12:00:00Z"
    }
  ],
  "total": 1
}
```

## GDPR Endpoints

### Export Site Data

Exports all data for a site (Right to Data Portability).

**Endpoint:** `GET /api/gdpr/export/:wixSiteId`

**Path Parameters:**
- `wixSiteId`: Wix site ID

**Response:**
```json
{
  "wix_site_id": "default",
  "export_date": "2024-06-08T12:00:00Z",
  "integration_settings": { ... },
  "sync_settings": { ... },
  "field_mappings": [ ... ],
  "contact_mappings": [ ... ],
  "sync_events": [ ... ],
  "form_submissions": [ ... ]
}
```

### Delete Site Data

Deletes all data for a site (Right to be Forgotten).

**Endpoint:** `DELETE /api/gdpr/site/:wixSiteId`

**Path Parameters:**
- `wixSiteId`: Wix site ID

**Response:**
```json
{
  "success": true,
  "results": {
    "sync_events": 100,
    "form_submissions": 50,
    "contact_mappings": 1000,
    "field_mappings": 10
  }
}
```

### Data Retention Cleanup

Deletes data older than retention period.

**Endpoint:** `POST /api/gdpr/retention/cleanup`

**Response:**
```json
{
  "success": true,
  "results": {
    "sync_events": 50,
    "form_submissions": 20,
    "dead_letter_queue": 5
  }
}
```

### Get Retention Statistics

Retrieves data retention statistics.

**Endpoint:** `GET /api/gdpr/retention/stats`

**Response:**
```json
{
  "sync_events": {
    "total": 1000,
    "expired": 50,
    "retention_days": 90
  },
  "form_submissions": {
    "total": 500,
    "expired": 20,
    "retention_days": 365
  }
}
```

## Health Endpoints

### Health Check

Comprehensive health check of all system components.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "timestamp": "2024-06-08T12:00:00Z",
  "uptime": 3600,
  "environment": "production",
  "status": "healthy",
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Connected"
    },
    "jobQueue": {
      "status": "healthy",
      "sync": { "waiting": 0, "active": 0, "completed": 100, "failed": 0 },
      "webhook": { "waiting": 0, "active": 0, "completed": 200, "failed": 0 }
    },
    "hubspot": {
      "status": "healthy",
      "connected": true,
      "portalId": 123456
    },
    "wix": {
      "status": "healthy",
      "configured": true
    },
    "memory": {
      "status": "healthy",
      "heapUsed": "100MB",
      "heapTotal": "200MB",
      "rss": "150MB"
    }
  }
}
```

### Readiness Probe

Checks if the application is ready to receive traffic.

**Endpoint:** `GET /health/readiness`

**Response:**
```json
{
  "ready": true,
  "checks": {
    "database": true,
    "redis": true
  }
}
```

### Liveness Probe

Checks if the application process is running.

**Endpoint:** `GET /health/liveness`

**Response:**
```json
{
  "alive": true,
  "uptime": 3600,
  "timestamp": "2024-06-08T12:00:00Z"
}
```

## Webhook Endpoints

### HubSpot Webhook

Receives webhook events from HubSpot.

**Endpoint:** `POST /api/webhooks/hubspot`

**Headers:**
- `X-HubSpot-Signature`: HMAC signature for verification

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID

**Request Body:**
```json
[
  {
    "eventId": "event-123",
    "subscriptionId": "sub-456",
    "portalId": 123456,
    "appId": 789,
    "occurredAt": 1717833600000,
    "eventType": "contact.propertyChange",
    "objectId": "contact-789",
    "propertyName": "email",
    "propertyValue": "new-email@example.com",
    "changes": [
      {
        "property": "email",
        "oldValue": {
          "value": "old-email@example.com"
        },
        "newValue": {
          "value": "new-email@example.com"
        }
      }
    ]
  }
]
```

**Response:**
```json
{
  "received": true,
  "events_processed": 1
}
```

### Wix Webhook

Receives webhook events from Wix.

**Endpoint:** `POST /api/webhooks/wix`

**Headers:**
- `X-Wix-Signature`: HMAC signature for verification

**Query Parameters:**
- `wix_site_id` (optional): Wix site ID

**Request Body:**
```json
{
  "data": {
    "contactId": "wix-123",
    "email": "user@example.com",
    "firstname": "John"
  },
  "type": "contact.created"
}
```

**Response:**
```json
{
  "received": true,
  "processed": true
}
```

### Register HubSpot Webhook

Registers a webhook with HubSpot.

**Endpoint:** `POST /api/webhooks/register/hubspot`

**Request Body:**
```json
{
  "callback_url": "https://your-domain.com/api/webhooks/hubspot",
  "event_type": "contact.propertyChange"
}
```

**Response:**
```json
{
  "status": "registered",
  "webhookId": "webhook-123",
  "callbackUrl": "https://your-domain.com/api/webhooks/hubspot",
  "eventType": "contact.propertyChange",
  "message": "Webhook registered successfully in HubSpot"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Invalid request parameters |
| `UNAUTHORIZED` | Invalid or missing authentication |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMIT_EXCEEDED` | API rate limit exceeded |
| `HUBSPOT_ERROR` | HubSpot API error |
| `WIX_ERROR` | Wix API error |
| `SYNC_ERROR` | Sync operation failed |
| `CONFLICT` | Data conflict detected |
| `INTERNAL_ERROR` | Internal server error |

## Rate Limiting

- **API endpoints**: 100 requests per minute per IP
- **OAuth endpoints**: 10 requests per minute per IP
- **Webhook endpoints**: 1000 requests per minute per IP

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Pagination

List endpoints support pagination via query parameters:
- `limit`: Number of items per page (default: 50, max: 500)
- `offset`: Number of items to skip (default: 0)

## Filtering

Some endpoints support filtering via query parameters. Refer to specific endpoint documentation for available filters.

## Webhooks

Webhooks are delivered with HMAC signatures for verification. Configure your webhook secret in the environment variables.

## SDK Integration

For direct SDK integration, refer to the service layer:
- `server/services/hubspot.js` - HubSpot API service
- `server/services/wix.js` - Wix API service
- `server/services/syncEngine.js` - Sync engine
- `server/services/tokenManager.js` - OAuth token management
