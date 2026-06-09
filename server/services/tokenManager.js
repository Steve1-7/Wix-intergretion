import { supabase } from '../db.js';
import { hubspotService } from './hubspot.js';
import { logger } from '../utils/logger.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

export const tokenManager = {
  async getTokens(wixSiteId) {
    const { data, error } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('wix_site_id', wixSiteId)
      .eq('is_connected', true)
      .single();

    if (error || !data) {
      logger.warn('tokenManager', 'No active tokens found', { wixSiteId });
      return null;
    }

    // Decrypt tokens before returning
    try {
      return {
        ...data,
        access_token: decrypt(data.access_token),
        refresh_token: decrypt(data.refresh_token),
      };
    } catch (err) {
      logger.error('tokenManager', 'Failed to decrypt tokens', { wixSiteId, error: err.message });
      return null;
    }
  },

  async getValidAccessToken(wixSiteId) {
    const tokens = await this.getTokens(wixSiteId);
    if (!tokens) return null;

    const expiresAt = new Date(tokens.token_expires_at).getTime();
    const now = Date.now();

    if (expiresAt - now > REFRESH_BUFFER_MS) {
      return tokens.access_token;
    }

    logger.info('tokenManager', 'Token expiring soon, refreshing', { wixSiteId });
    return this.refreshAndGetAccessToken(wixSiteId, tokens);
  },

  async refreshAndGetAccessToken(wixSiteId, tokens) {
    try {
      const newTokens = await hubspotService.refreshTokens(tokens.refresh_token);

      // Encrypt new tokens before storing
      const encryptedAccessToken = encrypt(newTokens.access_token);
      const encryptedRefreshToken = encrypt(newTokens.refresh_token);

      const { data, error } = await supabase
        .from('integration_settings')
        .update({
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('wix_site_id', wixSiteId)
        .eq('is_connected', true)
        .select()
        .single();

      if (error) {
        logger.error('tokenManager', 'Failed to update refreshed tokens', { error: error.message });
        throw new Error('Failed to store refreshed tokens');
      }

      logger.info('tokenManager', 'Tokens refreshed successfully', { wixSiteId });
      return newTokens.access_token;
    } catch (err) {
      logger.error('tokenManager', 'Token refresh failed', { error: err.message });

      if (err.message?.includes('invalid_grant')) {
        await this.disconnect(wixSiteId);
      }

      throw err;
    }
  },

  async storeTokens(wixSiteId, tokenData) {
    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(tokenData.access_token);
    const encryptedRefreshToken = encrypt(tokenData.refresh_token);

    const { data, error } = await supabase
      .from('integration_settings')
      .upsert({
        wix_site_id: wixSiteId,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        hubspot_portal_id: tokenData.portal_id || null,
        scopes: tokenData.scope?.split(' ') || [],
        connected_at: new Date().toISOString(),
        is_connected: true,
        disconnected_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'wix_site_id' })
      .select()
      .single();

    if (error) {
      logger.error('tokenManager', 'Failed to store tokens', { error: error.message });
      throw new Error('Failed to store OAuth tokens');
    }

    return data;
  },

  async disconnect(wixSiteId) {
    const { error } = await supabase
      .from('integration_settings')
      .update({
        is_connected: false,
        disconnected_at: new Date().toISOString(),
        access_token: '',
        refresh_token: '',
        updated_at: new Date().toISOString(),
      })
      .eq('wix_site_id', wixSiteId);

    if (error) {
      logger.error('tokenManager', 'Failed to disconnect', { error: error.message });
      throw new Error('Failed to disconnect');
    }

    logger.info('tokenManager', 'HubSpot disconnected', { wixSiteId });
  },

  async getConnectionStatus(wixSiteId) {
    const { data } = await supabase
      .from('integration_settings')
      .select('is_connected, hubspot_portal_id, connected_at, scopes')
      .eq('wix_site_id', wixSiteId)
      .single();

    return data || { is_connected: false };
  },
};
