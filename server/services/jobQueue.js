import Queue from 'bull';
import { logger } from '../utils/logger.js';
import { syncEngine } from './syncEngine.js';

// Use Upstash Redis REST API or fallback to standard Redis
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Determine which Redis connection to use
let redisConfig;
if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
  // Use Upstash Redis REST API
  redisConfig = {
    host: UPSTASH_REDIS_REST_URL,
    password: UPSTASH_REDIS_REST_TOKEN,
    tls: {}, // Upstash requires TLS
  };
  logger.info('jobQueue', 'Using Upstash Redis REST API');
} else {
  // Use standard Redis URL
  redisConfig = REDIS_URL;
  logger.info('jobQueue', 'Using standard Redis URL');
}

// Create job queues
export const syncQueue = new Queue('sync-jobs', redisConfig, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const webhookQueue = new Queue('webhook-jobs', redisConfig, {
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 200,
    removeOnFail: 100,
  },
});

// Sync job processor
syncQueue.process('wix-to-hubspot', async (job) => {
  const { wixSiteId, wixContactId, wixContactData, correlationId } = job.data;
  
  logger.info('jobQueue', 'Processing Wix→HubSpot sync job', { 
    jobId: job.id, 
    wixContactId,
    attempt: job.attemptsMade + 1,
  });

  try {
    const result = await syncEngine.syncWixToHubspot(
      wixSiteId, 
      wixContactId, 
      wixContactData, 
      correlationId
    );
    
    logger.info('jobQueue', 'Wix→HubSpot sync job completed', { jobId: job.id });
    return result;
  } catch (error) {
    logger.error('jobQueue', 'Wix→HubSpot sync job failed', { 
      jobId: job.id, 
      error: error.message,
      attempt: job.attemptsMade + 1,
    });
    throw error;
  }
});

syncQueue.process('hubspot-to-wix', async (job) => {
  const { wixSiteId, hubspotContactId, hubspotContactData, correlationId } = job.data;
  
  logger.info('jobQueue', 'Processing HubSpot→Wix sync job', { 
    jobId: job.id, 
    hubspotContactId,
    attempt: job.attemptsMade + 1,
  });

  try {
    const result = await syncEngine.syncHubspotToWix(
      wixSiteId, 
      hubspotContactId, 
      hubspotContactData, 
      correlationId
    );
    
    logger.info('jobQueue', 'HubSpot→Wix sync job completed', { jobId: job.id });
    return result;
  } catch (error) {
    logger.error('jobQueue', 'HubSpot→Wix sync job failed', { 
      jobId: job.id, 
      error: error.message,
      attempt: job.attemptsMade + 1,
    });
    throw error;
  }
});

syncQueue.process('form-submission', async (job) => {
  const { wixSiteId, submission } = job.data;
  
  logger.info('jobQueue', 'Processing form submission job', { 
    jobId: job.id, 
    formId: submission.formId,
    attempt: job.attemptsMade + 1,
  });

  try {
    const result = await syncEngine.processFormSubmission(wixSiteId, submission);
    
    logger.info('jobQueue', 'Form submission job completed', { jobId: job.id });
    return result;
  } catch (error) {
    logger.error('jobQueue', 'Form submission job failed', { 
      jobId: job.id, 
      error: error.message,
      attempt: job.attemptsMade + 1,
    });
    throw error;
  }
});

// Webhook job processor
webhookQueue.process('hubspot-webhook', async (job) => {
  const { wixSiteId, events } = job.data;
  
  logger.info('jobQueue', 'Processing HubSpot webhook job', { 
    jobId: job.id, 
    eventCount: events.length,
    attempt: job.attemptsMade + 1,
  });

  try {
    const results = [];
    for (const event of events) {
      const { syncEngine } = await import('./syncEngine.js');
      const { hubspotService } = await import('./hubspot.js');
      const { tokenManager } = await import('./tokenManager.js');
      
      if (event.eventType === 'contact.creation' || event.eventType === 'contact.propertyChange') {
        const accessToken = await tokenManager.getValidAccessToken(wixSiteId);
        if (accessToken) {
          const contact = await hubspotService.getContact(accessToken, event.objectId);
          if (contact) {
            const result = await syncEngine.syncHubspotToWix(
              wixSiteId, 
              event.objectId, 
              contact, 
              `hubspot_webhook_${event.objectId}`
            );
            results.push(result);
          }
        }
      }
    }
    
    logger.info('jobQueue', 'HubSpot webhook job completed', { jobId: job.id, resultsCount: results.length });
    return { processed: results.length };
  } catch (error) {
    logger.error('jobQueue', 'HubSpot webhook job failed', { 
      jobId: job.id, 
      error: error.message,
      attempt: job.attemptsMade + 1,
    });
    throw error;
  }
});

webhookQueue.process('wix-webhook', async (job) => {
  const { wixSiteId, data, type } = job.data;
  
  logger.info('jobQueue', 'Processing Wix webhook job', { 
    jobId: job.id, 
    type,
    attempt: job.attemptsMade + 1,
  });

  try {
    if (type === 'contact.created' || type === 'contact.updated') {
      const wixContactId = data?.contactId || data?.id;
      if (wixContactId) {
        const result = await syncEngine.syncWixToHubspot(
          wixSiteId, 
          wixContactId, 
          data, 
          `wix_webhook_${wixContactId}`
        );
        return result;
      }
    } else if (type === 'form.submitted') {
      const result = await syncEngine.processFormSubmission(wixSiteId, {
        formId: data?.formId,
        submissionId: data?.submissionId,
        email: data?.email,
        firstname: data?.firstname,
        lastname: data?.lastname,
        phone: data?.phone,
        utm_source: data?.utm_source,
        utm_medium: data?.utm_medium,
        utm_campaign: data?.utm_campaign,
        utm_term: data?.utm_term,
        utm_content: data?.utm_content,
        page_url: data?.pageUrl,
        referrer: data?.referrer,
        landing_page: data?.landingPage,
        session_id: data?.sessionId,
      });
      return result;
    }
    
    logger.info('jobQueue', 'Wix webhook job completed', { jobId: job.id });
    return { status: 'processed' };
  } catch (error) {
    logger.error('jobQueue', 'Wix webhook job failed', { 
      jobId: job.id, 
      error: error.message,
      attempt: job.attemptsMade + 1,
    });
    throw error;
  }
});

// Job queue management functions
export const jobQueueManager = {
  async addWixToHubspotJob(wixSiteId, wixContactId, wixContactData, correlationId) {
    return syncQueue.add('wix-to-hubspot', {
      wixSiteId,
      wixContactId,
      wixContactData,
      correlationId,
    }, {
      priority: 5,
    });
  },

  async addHubspotToWixJob(wixSiteId, hubspotContactId, hubspotContactData, correlationId) {
    return syncQueue.add('hubspot-to-wix', {
      wixSiteId,
      hubspotContactId,
      hubspotContactData,
      correlationId,
    }, {
      priority: 5,
    });
  },

  async addFormSubmissionJob(wixSiteId, submission) {
    return syncQueue.add('form-submission', {
      wixSiteId,
      submission,
    }, {
      priority: 3, // Form submissions are high priority
    });
  },

  async addHubspotWebhookJob(wixSiteId, events) {
    return webhookQueue.add('hubspot-webhook', {
      wixSiteId,
      events,
    }, {
      priority: 7,
    });
  },

  async addWixWebhookJob(wixSiteId, data, type) {
    return webhookQueue.add('wix-webhook', {
      wixSiteId,
      data,
      type,
    }, {
      priority: 7,
    });
  },

  async getQueueStats() {
    const [syncWaiting, syncActive, syncCompleted, syncFailed] = await Promise.all([
      syncQueue.getWaiting(),
      syncQueue.getActive(),
      syncQueue.getCompleted(),
      syncQueue.getFailed(),
    ]);

    const [webhookWaiting, webhookActive, webhookCompleted, webhookFailed] = await Promise.all([
      webhookQueue.getWaiting(),
      webhookQueue.getActive(),
      webhookQueue.getCompleted(),
      webhookQueue.getFailed(),
    ]);

    return {
      sync: {
        waiting: syncWaiting.length,
        active: syncActive.length,
        completed: syncCompleted.length,
        failed: syncFailed.length,
      },
      webhook: {
        waiting: webhookWaiting.length,
        active: webhookActive.length,
        completed: webhookCompleted.length,
        failed: webhookFailed.length,
      },
    };
  },

  async retryFailedJobs() {
    const syncFailed = await syncQueue.getFailed();
    const webhookFailed = await webhookQueue.getFailed();

    let retried = 0;

    for (const job of syncFailed) {
      if (job.attemptsMade < 3) {
        await job.retry();
        retried++;
      }
    }

    for (const job of webhookFailed) {
      if (job.attemptsMade < 5) {
        await job.retry();
        retried++;
      }
    }

    return { retried };
  },

  async cleanOldJobs() {
    await syncQueue.clean(24 * 60 * 60 * 1000, 100); // Clean jobs older than 24 hours
    await webhookQueue.clean(24 * 60 * 60 * 1000, 200);
  },

  async close() {
    await syncQueue.close();
    await webhookQueue.close();
  },
};

// Error handlers
syncQueue.on('failed', (job, err) => {
  logger.error('jobQueue', 'Sync job failed permanently', { 
    jobId: job?.id, 
    error: err.message,
    attempts: job?.attemptsMade,
  });
});

webhookQueue.on('failed', (job, err) => {
  logger.error('jobQueue', 'Webhook job failed permanently', { 
    jobId: job?.id, 
    error: err.message,
    attempts: job?.attemptsMade,
  });
});

syncQueue.on('completed', (job, result) => {
  logger.info('jobQueue', 'Sync job completed successfully', { jobId: job.id });
});

webhookQueue.on('completed', (job, result) => {
  logger.info('jobQueue', 'Webhook job completed successfully', { jobId: job.id });
});

export default { syncQueue, webhookQueue, jobQueueManager };
