const axios = require('axios');
const config = require('../config');

class OrionClient {
  constructor() {
    this.client = axios.create({
      baseURL: config.orion.baseUrl(),
      timeout: 10000
    });
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

  async upsertEntity(id, type, attrs) {
    const existing = await this.getEntity(id);
    if (existing) {
      try {
        await this.client.patch(`/v2/entities/${id}/attrs`, attrs, {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        if (e.response?.status === 422) {
          await this.client.post(`/v2/entities/${id}/attrs?options=append`, attrs, {
            headers: { 'Content-Type': 'application/json' }
          });
        } else throw e;
      }
      return 'updated';
    }
    await this.client.post('/v2/entities', { id, type, ...attrs }, {
      headers: { 'Content-Type': 'application/json' }
    });
    return 'created';
  }

  async checkHealth() {
    try {
      const res = await this.client.get('/version');
      return res.data;
    } catch { return null; }
  }
}

module.exports = OrionClient;
