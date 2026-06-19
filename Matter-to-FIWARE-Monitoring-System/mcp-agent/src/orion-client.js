const axios = require('axios');
const config = require('../config');

class OrionClient {
  constructor() {
    this.baseURL = config.orion.baseUrl();
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000
    });
  }

  sanitizeString(value) {
    if (typeof value !== 'string') return value;
    // Orion rejects some characters in attribute values. Keep stored audit text
    // readable while removing forbidden punctuation and mojibake/control chars.
    return value
      .replace(/\r\n/g, '\n')
      .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
      .replace(/\u00B0/g, ' deg')
      .replace(/[<>"'=;()]/g, ' ')
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  sanitizePayload(input) {
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizePayload(item));
    }
    if (input && typeof input === 'object') {
      const out = {};
      for (const [key, value] of Object.entries(input)) {
        out[key] = this.sanitizePayload(value);
      }
      return out;
    }
    if (typeof input === 'string') {
      return this.sanitizeString(input);
    }
    return input;
  }

  async getEntities(type) {
    let url = '/v2/entities?limit=1000';
    if (type) url += `&type=${type}`;
    const res = await this.client.get(url, { headers: { 'Accept': 'application/json' } });
    return res.data;
  }

  async getEntity(id) {
    try {
      const res = await this.client.get(`/v2/entities/${id}`, { headers: { 'Accept': 'application/json' } });
      return res.data;
    } catch (e) {
      if (e.response?.status === 404) return null;
      throw e;
    }
  }

  async createEntity(id, type, attrs) {
    const safeAttrs = this.sanitizePayload(attrs);
    const res = await this.client.post('/v2/entities', { id, type, ...safeAttrs }, {
      headers: { 'Content-Type': 'application/json' }
    });
    return res.data;
  }

  async updateEntity(id, attrs) {
    const safeAttrs = this.sanitizePayload(attrs);
    try {
      await this.client.patch(`/v2/entities/${id}/attrs`, safeAttrs, {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      if (e.response?.status === 422) {
        await this.client.post(`/v2/entities/${id}/attrs?options=append`, safeAttrs, {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (e.response?.status === 404) {
        return null;
      } else {
        throw e;
      }
    }
  }

  async upsertEntity(id, type, attrs) {
    const existing = await this.getEntity(id);
    if (existing) {
      await this.updateEntity(id, attrs);
      return 'updated';
    }
    await this.createEntity(id, type, attrs);
    return 'created';
  }

  async checkHealth() {
    try {
      const res = await this.client.get('/version');
      return res.data;
    } catch {
      return null;
    }
  }
}

module.exports = OrionClient;
