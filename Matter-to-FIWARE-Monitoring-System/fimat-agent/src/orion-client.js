/**
 * Orion Client
 * NGSI Agent: Gửi HTTP POST/PATCH requests đến FIWARE Orion Context Broker
 */

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

  /**
   * Lấy Entity từ Orion
   */
  async getEntity(entityId) {
    try {
      const response = await this.client.get(`/v2/entities/${entityId}`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`[OrionClient] Entity ${entityId} không tồn tại - sẽ tạo mới`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Tạo Entity mới trong Orion
   * Định dạng NGSI-v2 với attributes phẳng (flat)
   */
  async createEntity(entityId, entityType, attributes) {
    try {
      const entity = {
        id: entityId,
        type: entityType,
        ...attributes
      };

      const response = await this.client.post('/v2/entities', entity);
      console.log(`[OrionClient] ✅ Tạo Entity: ${entityId}`);
      return response.data;
    } catch (error) {
      console.error(`[OrionClient] ❌ Lỗi tạo Entity:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Cập nhật Entity (PATCH)
   * Chỉ cập nhật các attributes đã thay đổi
   */
  async updateEntityAttributes(entityId, attributes) {
    try {
      // Cập nhật attribute đã tồn tại
      const response = await this.client.patch(
        `/v2/entities/${entityId}/attrs`,
        attributes,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`[OrionClient] ✅ Cập nhật Entity: ${entityId}`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`[OrionClient] Entity ${entityId} không tồn tại - đang tạo mới...`);
        return null;
      }

      // Nếu attribute chưa tồn tại (422), fallback sang append để tự tạo mới attribute
      if (error.response && error.response.status === 422) {
        try {
          const appendResponse = await this.client.post(
            `/v2/entities/${entityId}/attrs?options=append`,
            attributes,
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
          console.log(`[OrionClient] ✅ Append attributes: ${entityId}`);
          return appendResponse.data;
        } catch (appendError) {
          console.error(`[OrionClient] ❌ Lỗi append attributes:`, appendError.response?.data || appendError.message);
          throw appendError;
        }
      }

      console.error(`[OrionClient] ❌ Lỗi cập nhật Entity:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Lấy danh sách tất cả Entities
   */
  async getAllEntities(type = null) {
    try {
      let url = '/v2/entities?limit=1000';
      if (type) {
        url += `&type=${type}`;
      }
      const response = await this.client.get(url);
      return response.data;
    } catch (error) {
      console.error(`[OrionClient] ❌ Lỗi lấy entities:`, error.message);
      throw error;
    }
  }

  /**
   * Xóa Entity
   */
  async deleteEntity(entityId) {
    try {
      await this.client.delete(`/v2/entities/${entityId}`);
      console.log(`[OrionClient] ✅ Xóa Entity: ${entityId}`);
    } catch (error) {
      console.error(`[OrionClient] ❌ Lỗi xóa Entity:`, error.message);
      throw error;
    }
  }

  /**
   * Kiểm tra kết nối đến Orion
   */
  async checkHealth() {
    try {
      const response = await this.client.get('/version');
      const version = response.data?.orion?.version || 'unknown';
      console.log(`[OrionClient] ✅ Kết nối thành công: Orion v${version}`);
      return response.data;
    } catch (error) {
      console.error(`[OrionClient] ❌ Không thể kết nối đến Orion:`, error.message);
      return null;
    }
  }
}

module.exports = OrionClient;
