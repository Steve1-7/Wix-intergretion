import 'dotenv/config';
import { logger } from '../utils/logger.js';

const WIX_API_BASE = 'https://www.wixapis.com';
const WIX_CONTACTS_API = `${WIX_API_BASE}/crm/v1/contacts`;
const WIX_FORMS_API = `${WIX_API_BASE}/crm/v1/forms`;

const WIX_API_KEY = process.env.WIX_API_KEY;
const WIX_ACCOUNT_ID = process.env.WIX_ACCOUNT_ID;
const WIX_SITE_ID = process.env.WIX_SITE_ID;

if (!WIX_API_KEY) {
  logger.warn('wix', 'WIX_API_KEY not set, Wix integration will not work');
}

function wixHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': WIX_API_KEY,
  };

  if (WIX_ACCOUNT_ID) {
    headers['wix-account-id'] = WIX_ACCOUNT_ID;
  }

  if (WIX_SITE_ID) {
    headers['wix-site-id'] = WIX_SITE_ID;
  }

  return headers;
}

async function wixFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${WIX_API_BASE}${path}`;
  const headers = { ...wixHeaders(), ...options.headers };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const error = new Error(`Wix rate limit exceeded, retry after ${retryAfter || 10}s`);
    error.retryable = true;
    error.retryAfter = parseInt(retryAfter) || 10;
    throw error;
  }

  if (!response.ok) {
    const body = await response.text();
    logger.error('wix', `API error ${response.status}`, { path, status: response.status, body: body.slice(0, 500) });
    const error = new Error(`Wix API error: ${response.status} - ${body}`);
    error.statusCode = response.status;
    error.retryable = response.status >= 500 || response.status === 429;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

export const wixService = {
  async getContact(contactId) {
    if (!WIX_API_KEY) {
      throw new Error('WIX_API_KEY not configured');
    }
    return wixFetch(`/crm/v1/contacts/${contactId}`);
  },

  async createContact(contactData) {
    if (!WIX_API_KEY) {
      throw new Error('WIX_API_KEY not configured');
    }

    const body = {
      info: {
        name: {
          first: contactData.firstname || '',
          last: contactData.lastname || '',
        },
        emails: contactData.email ? [{ email: contactData.email }] : [],
        phones: contactData.phone ? [{ phone: contactData.phone }] : [],
        company: contactData.company ? { name: contactData.company } : undefined,
      },
    };

    return wixFetch('/crm/v1/contacts', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async updateContact(contactId, contactData) {
    if (!WIX_API_KEY) {
      throw new Error('WIX_API_KEY not configured');
    }

    const body = {
      contact: {
        info: {
          name: {
            first: contactData.firstname || '',
            last: contactData.lastname || '',
          },
          emails: contactData.email ? [{ email: contactData.email }] : [],
          phones: contactData.phone ? [{ phone: contactData.phone }] : [],
          company: contactData.company ? { name: contactData.company } : undefined,
        },
      },
    };

    return wixFetch(`/crm/v1/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  async queryContacts(query = {}) {
    if (!WIX_API_KEY) {
      throw new Error('WIX_API_KEY not configured');
    }
    return wixFetch('/crm/v1/contacts/query', {
      method: 'POST',
      body: JSON.stringify(query),
    });
  },

  async searchContactByEmail(email) {
    if (!WIX_API_KEY) {
      throw new Error('WIX_API_KEY not configured');
    }

    return wixFetch('/crm/v1/contacts/query', {
      method: 'POST',
      body: JSON.stringify({
        query: {
          filter: {
            'info.emails.email': { $eq: email },
          },
        },
      }),
    });
  },

  async getFormSubmissions(formId, limit = 50) {
    if (!WIX_API_KEY) {
      throw new Error('WIX_API_KEY not configured');
    }
    return wixFetch(`/crm/v1/forms/${formId}/submissions?limit=${limit}`);
  },

  async registerWebhook(webhookUrl, events = ['ContactCreated', 'ContactUpdated', 'FormSubmitted']) {
    if (!WIX_API_KEY) {
      throw new Error('WIX_API_KEY not configured');
    }

    const body = {
      url: webhookUrl,
      events: events,
    };

    return wixFetch('/crm/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async listWebhooks() {
    if (!WIX_API_KEY) {
      throw new Error('WIX_API_KEY not configured');
    }
    return wixFetch('/crm/v1/webhooks');
  },

  async deleteWebhook(webhookId) {
    if (!WIX_API_KEY) {
      throw new Error('WIX_API_KEY not configured');
    }
    return wixFetch(`/crm/v1/webhooks/${webhookId}`, {
      method: 'DELETE',
    });
  },

  getContactFields() {
    return [
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'firstname', label: 'First Name', type: 'string' },
      { key: 'lastname', label: 'Last Name', type: 'string' },
      { key: 'phone', label: 'Phone', type: 'phone' },
      { key: 'company', label: 'Company', type: 'string' },
      { key: 'address', label: 'Address', type: 'object' },
      { key: 'birthday', label: 'Birthday', type: 'date' },
      { key: 'title', label: 'Title', type: 'string' },
      { key: 'website', label: 'Website', type: 'url' },
    ];
  },

  mapWixContactToFields(wixContact) {
    const info = wixContact?.info || wixContact?.contact?.info || {};
    return {
      email: info.emails?.[0]?.email || '',
      firstname: info.name?.first || '',
      lastname: info.name?.last || '',
      phone: info.phones?.[0]?.phone || '',
      company: info.company?.name || '',
      title: info.title || '',
      address: info.address ? JSON.stringify(info.address) : '',
      birthday: info.dateOfBirth || '',
      website: info.urls?.[0]?.url || '',
    };
  },

  mapFieldsToWixContact(fields) {
    const contact = {
      info: {
        name: {
          first: fields.firstname || '',
          last: fields.lastname || '',
        },
        emails: fields.email ? [{ email: fields.email, tag: 'main' }] : [],
        phones: fields.phone ? [{ phone: fields.phone, tag: 'main' }] : [],
      },
    };

    if (fields.company) {
      contact.info.company = { name: fields.company };
    }

    if (fields.title) {
      contact.info.title = fields.title;
    }

    if (fields.address) {
      try {
        contact.info.address = typeof fields.address === 'string' 
          ? JSON.parse(fields.address) 
          : fields.address;
      } catch {
        // If address is not valid JSON, skip it
      }
    }

    if (fields.birthday) {
      contact.info.dateOfBirth = fields.birthday;
    }

    if (fields.website) {
      contact.info.urls = [{ url: fields.website }];
    }

    return contact;
  },
};
