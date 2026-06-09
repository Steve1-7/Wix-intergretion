import 'dotenv/config';
import { logger } from '../utils/logger.js';

const HUBSPOT_BASE_URL = 'https://api.hubapi.com';
const HUBSPOT_OAUTH_BASE = 'https://app.hubspot.com/oauth/authorize';
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

const CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI;
const HUBSPOT_PAT = process.env.HUBSPOT_PAT;

const SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.schemas.contacts.read',
  'forms',
  'oauth',
].join(' ');

// Check if using PAT (Personal Access Token) or OAuth
function usePAT() {
  return !!HUBSPOT_PAT;
}

// Get access token (PAT or OAuth)
function getAccessToken(oauthAccessToken) {
  if (usePAT()) {
    return HUBSPOT_PAT;
  }
  return oauthAccessToken;
}

async function hubspotFetch(accessToken, path, options = {}) {
  const token = getAccessToken(accessToken);
  const url = path.startsWith('http') ? path : `${HUBSPOT_BASE_URL}${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const error = new Error(`HubSpot rate limit exceeded, retry after ${retryAfter}s`);
    error.retryable = true;
    error.retryAfter = parseInt(retryAfter) || 10;
    throw error;
  }

  if (!response.ok) {
    const body = await response.text();
    logger.error('hubspot', `API error ${response.status}`, { path, status: response.status, body: body.slice(0, 500) });
    const error = new Error(`HubSpot API error: ${response.status}`);
    error.statusCode = response.status;
    error.retryable = response.status >= 500 || response.status === 429;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

export const hubspotService = {
  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      response_type: 'code',
      state,
    });
    return `${HUBSPOT_OAUTH_BASE}?${params.toString()}`;
  },

  async exchangeCodeForTokens(code) {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
    });

    const response = await fetch(HUBSPOT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${body}`);
    }

    return response.json();
  },

  async refreshTokens(refreshToken) {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    });

    const response = await fetch(HUBSPOT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Token refresh failed: ${response.status} - ${body}`);
    }

    return response.json();
  },

  async getContact(accessToken, contactId) {
    return hubspotFetch(accessToken, `/crm/v3/objects/contacts/${contactId}?properties=email,firstname,lastname,phone,company,lastmodifieddate`);
  },

  async createContact(accessToken, properties) {
    return hubspotFetch(accessToken, '/crm/v3/objects/contacts', {
      method: 'POST',
      body: JSON.stringify({ properties }),
    });
  },

  async updateContact(accessToken, contactId, properties) {
    return hubspotFetch(accessToken, `/crm/v3/objects/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
  },

  async searchContactByEmail(accessToken, email) {
    return hubspotFetch(accessToken, '/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
        properties: ['email', 'firstname', 'lastname', 'phone', 'company'],
      }),
    });
  },

  async getContactProperties(accessToken) {
    const result = await hubspotFetch(accessToken, '/crm/v3/properties/contacts?archived=false');
    return result.results || [];
  },

  async getForms(accessToken) {
    const result = await hubspotFetch(accessToken, '/forms/v2/forms');
    return Array.isArray(result) ? result : [];
  },

  async submitForm(accessToken, portalId, formGuid, fields, context = {}) {
    const body = {
      fields: Object.entries(fields).map(([name, value]) => ({ name, value })),
      context: {
        pageUri: context.pageUrl || '',
        pageName: context.pageName || '',
        hutk: context.hutk || '',
      },
    };

    if (context.utm_source) body.context.utm_source = context.utm_source;
    if (context.utm_medium) body.context.utm_medium = context.utm_medium;
    if (context.utm_campaign) body.context.utm_campaign = context.utm_campaign;

    const url = `https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formGuid}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Form submission failed: ${response.status} - ${text}`);
    }

    return response.json();
  },

  async getAccountInfo(accessToken) {
    return hubspotFetch(accessToken, '/oauth/v1/access-tokens/GET');
  },

  async getRecentContacts(accessToken, after = null, limit = 100) {
    const params = new URLSearchParams({ limit: limit.toString(), properties: 'email,firstname,lastname,phone,company,lastmodifieddate' });
    if (after) params.set('after', after);
    return hubspotFetch(accessToken, `/crm/v3/objects/contacts?${params.toString()}`);
  },

  async registerWebhook(accessToken, targetUrl, webhookData) {
    return hubspotFetch(accessToken, '/webhooks/v3/' + process.env.HUBSPOT_CLIENT_ID + '/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        active: webhookData.active,
        eventType: webhookData.eventType,
        objectId: webhookData.objectId,
        propertyName: webhookData.propertyName,
        secret: webhookData.secret,
      }),
    });
  },

  async listWebhooks(accessToken) {
    return hubspotFetch(accessToken, '/webhooks/v3/' + process.env.HUBSPOT_CLIENT_ID + '/subscriptions');
  },

  async deleteWebhook(accessToken, subscriptionId) {
    return hubspotFetch(accessToken, '/webhooks/v3/' + process.env.HUBSPOT_CLIENT_ID + '/subscriptions/' + subscriptionId, {
      method: 'DELETE',
    });
  },
};
