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
    const res = await this.client.post('/v2/entities', { id, type, ...attrs }, {
      headers: { 'Content-Type': 'application/json' }
    });
    return res.data;
  }

  async updateEntity(id, attrs) {
    try {
      await this.client.patch(`/v2/entities/${id}/attrs`, attrs, {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      if (e.response?.status === 422) {
        await this.client.post(`/v2/entities/${id}/attrs?options=append`, attrs, {
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
