/**
 * Semantic Proxy
 * Chuyển đổi Matter Event data model sang NGSI-v2 (flat attributes)
 * Tuân thủ 100% quy tắc ánh xạ (Mapping Rule)
 */

const config = require('../config');

class SemanticProxy {
  /**
   * Chuyển đổi sự kiện Matter sang NGSI-v2 entity
   * 
   * Input: Matter event
   * Output: NGSI-v2 entity với attributes phẳng (no nested JSON)
   */
  static matterEventToNGSIEntity(event) {
    const {
      nodeId,
      endpointId,
      clusterId,
      attributeName,
      attributeValue,
      deviceType
    } = event;

    // Sử dụng deviceType được truyền từ event, nếu không có thì deduce từ clusterId
    const type = deviceType || this.getDeviceTypeFromCluster(clusterId);

    // Tạo EntityID theo NGSI-LD format
    const entityId = `urn:ngsi-ld:MatterDevice:${nodeId}_${endpointId}`;

    // Lấy thông tin type từ mapping
    const attributeConfig = config.matterToNGSI[attributeName] || {
      type: 'String'
    };

    // Tạo NGSI attribute chuẩn (flat structure)
    const ngsiAttribute = {
      type: attributeConfig.type,
      value: this.convertValue(attributeValue, attributeConfig.type)
    };

    // Thêm unit nếu có
    if (attributeConfig.unit) {
      ngsiAttribute.metadata = {
        unit: {
          type: 'string',
          value: attributeConfig.unit
        }
      };
    }

    // Thêm timestamp
    if (!ngsiAttribute.metadata) {
      ngsiAttribute.metadata = {};
    }
    ngsiAttribute.metadata.timestamp = {
      type: 'string',
      value: new Date().toISOString()
    };

    return {
      entityId,
      deviceType: type,
      attributes: {
        [attributeName]: ngsiAttribute
      }
    };
  }

  /**
   * Lấy Device Type từ Matter Cluster ID
   */
  static getDeviceTypeFromCluster(clusterId) {
    const clusterMap = {
      0x0005: 'Scenes',
      0x0006: 'OnOffLight',
      0x0008: 'ColorDimmer',
      0x0402: 'TemperatureSensor',
      0x0405: 'HumiditySensor',
      0x0B04: 'ElectricalMeasurement'
    };

    return clusterMap[clusterId] || 'Device';
  }

  /**
   * Chuyển đổi giá trị theo loại dữ liệu NGSI-v2
   */
  static convertValue(value, type) {
    switch (type) {
      case 'Number':
        return parseFloat(value);
      case 'Boolean':
        return Boolean(value);
      case 'Integer':
        return parseInt(value, 10);
      default:
        return String(value);
    }
  }

  /**
   * Tạo NGSI-v2 attributes object từ danh sách Matter events
   * Gom nhóm các attribute của cùng 1 entity
   */
  static aggregateAttributesFromEvents(events) {
    const aggregated = {};

    events.forEach(event => {
      const ngsiData = this.matterEventToNGSIEntity(event);
      const { entityId, deviceType, attributes } = ngsiData;

      if (!aggregated[entityId]) {
        aggregated[entityId] = {
          type: deviceType,
          attributes: {}
        };
      }

      // Merge attributes
      Object.assign(aggregated[entityId].attributes, attributes);
    });

    return aggregated;
  }

  /**
   * Tạo payload POST cho Orion (tạo entity mới)
   */
  static createOrionPayload(entityId, deviceType, attributes) {
    return {
      id: entityId,
      type: deviceType,
      ...attributes
    };
  }

  /**
   * Tạo payload PATCH cho Orion (cập nhật attributes)
   */
  static updateOrionPayload(attributes) {
    return attributes;
  }

  /**
   * Xác nhận tính hợp lệ của NGSI-v2 entity
   */
  static validateNGSIEntity(entity) {
    if (!entity.id) {
      throw new Error('Entity không có ID');
    }
    if (!entity.type) {
      throw new Error('Entity không có type');
    }
    return true;
  }
}

module.exports = SemanticProxy;
