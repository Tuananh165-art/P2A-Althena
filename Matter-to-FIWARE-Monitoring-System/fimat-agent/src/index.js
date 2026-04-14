/**
 * FIMAT Agent - Main Entry Point
 * 
 * Luồng hoạt động:
 * 1. Khởi tạo kết nối Matter Controller
 * 2. Lắng nghe sự kiện từ Matter devices
 * 3. Chuyển đổi dữ liệu sang NGSI-v2 (Semantic Proxy)
 * 4. Gửi POST/PATCH requests lên FIWARE Orion
 */

const MatterController = require('./matter-controller');
const SemanticProxy = require('./semantic-proxy');
const OrionClient = require('./orion-client');
const config = require('../config');

class FIMATAgent {
  constructor() {
    this.matterController = new MatterController();
    this.orionClient = new OrionClient();
    this.processedEntities = new Map(); // Lưu cache entity state
    this.entityQueues = new Map(); // Serialize xử lý theo từng entity để tránh race create/update
  }

  /**
   * Khởi động FIMAT Agent
   */
  async start() {
    console.log('\n🚀 Khởi động FIMAT Agent (FIWARE IoT Agent for Matter)');
    console.log('═'.repeat(60));

    try {
      // 1. Kiểm tra kết nối Orion
      console.log('\n[Step 1] Kiểm tra kết nối FIWARE Orion...');
      const orionHealth = await this.orionClient.checkHealth();
      if (!orionHealth) {
        throw new Error('Không thể kết nối đến FIWARE Orion');
      }

      // 2. Khởi tạo Matter Controller
      console.log('\n[Step 2] Khởi tạo Matter Controller...');
      const controllerReady = await this.matterController.initialize();
      if (!controllerReady) {
        throw new Error('Không thể khởi tạo Matter Controller');
      }

      // 3. Lắng nghe sự kiện từ Matter devices
      console.log('\n[Step 3] Lắng nghe sự kiện từ Matter devices...');
      this.listenToMatterEvents();

      // 4. Kiểm tra danh sách thiết bị
      console.log('\n[Step 4] Danh sách thiết bị đã kết nối:');
      const devices = this.matterController.getConnectedDevices();
      devices.forEach(device => {
        console.log(`  📍 ${device.deviceType} (NodeID: ${device.nodeId})`);
      });

      console.log('\n✅ FIMAT Agent khởi động thành công!');
      console.log('═'.repeat(60) + '\n');
    } catch (error) {
      console.error('\n❌ Lỗi khởi động FIMAT Agent:', error.message);
      process.exit(1);
    }
  }

  /**
   * Đưa event vào hàng đợi theo từng entity để tránh create trùng song song
   */
  enqueueEntityEvent(entityId, handler) {
    const prev = this.entityQueues.get(entityId) || Promise.resolve();

    const next = prev
      .then(handler)
      .catch((error) => {
        console.error(`  ❌ Lỗi xử lý sự kiện:`, error.message);
      });

    this.entityQueues.set(
      entityId,
      next.finally(() => {
        if (this.entityQueues.get(entityId) === next) {
          this.entityQueues.delete(entityId);
        }
      })
    );
  }

  /**
   * Ensure entity tồn tại trên Orion trước khi update
   */
  async ensureEntityExists(entityId, deviceType, attributes) {
    const remoteEntity = await this.orionClient.getEntity(entityId);

    if (remoteEntity) {
      this.processedEntities.set(entityId, {
        type: remoteEntity.type || deviceType,
        attributes: {}
      });
      return 'exists';
    }

    console.log(`  → Tạo Entity mới: ${entityId}`);
    await this.orionClient.createEntity(entityId, deviceType, attributes);
    this.processedEntities.set(entityId, { type: deviceType, attributes: {} });
    return 'created';
  }

  /**
   * Xử lý 1 event Matter
   */
  async handleMatterEvent(event) {
    // 1. Chuyển đổi sự kiện Matter sang NGSI-v2
    const ngsiData = SemanticProxy.matterEventToNGSIEntity(event);
    const { entityId, deviceType, attributes } = ngsiData;

    console.log(`\n📨 Sự kiện từ Matter [NodeID: ${event.nodeId}]`);
    console.log(`  Attribute: ${event.attributeName} = ${event.attributeValue}`);

    const knownEntity = this.processedEntities.get(entityId);

    if (!knownEntity) {
      const state = await this.ensureEntityExists(entityId, deviceType, attributes);
      if (state === 'exists') {
        console.log(`  ℹ️ Entity đã tồn tại, chuyển sang UPDATE`);
        const updatePayload = SemanticProxy.updateOrionPayload(attributes);
        await this.orionClient.updateEntityAttributes(entityId, updatePayload);
      }
    } else {
      console.log(`  → Cập nhật Entity: ${entityId}`);
      const updatePayload = SemanticProxy.updateOrionPayload(attributes);
      await this.orionClient.updateEntityAttributes(entityId, updatePayload);
    }

    // Merge attributes vào cache
    const cache = this.processedEntities.get(entityId) || { type: deviceType, attributes: {} };
    Object.assign(cache.attributes, attributes);
    this.processedEntities.set(entityId, cache);

    console.log(`  ✅ Đã gửi lên Orion`);
  }

  /**
   * Lắng nghe sự kiện từ Matter devices
   */
  listenToMatterEvents() {
    this.matterController.on('device_event', (event) => {
      const ngsiData = SemanticProxy.matterEventToNGSIEntity(event);
      this.enqueueEntityEvent(ngsiData.entityId, () => this.handleMatterEvent(event));
    });
  }

  /**
   * Lấy danh sách tất cả entities từ Orion
   */
  async getAllEntities() {
    try {
      const entities = await this.orionClient.getAllEntities();
      return entities;
    } catch (error) {
      console.error('Lỗi lấy entities:', error.message);
      return [];
    }
  }

  /**
   * Dừng agent
   */
  stop() {
    console.log('\n🛑 Dừng FIMAT Agent');
    this.matterController.disconnect();
  }
}

// Main execution
if (require.main === module) {
  const agent = new FIMATAgent();

  // Khởi động agent
  agent.start().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

  // Xử lý Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Nhận tín hiệu dừng...');
    agent.stop();
    process.exit(0);
  });

  // API endpoint để lấy thông tin entities
  const express = require('express');
  const app = express();

  app.get('/entities', async (req, res) => {
    try {
      const entities = await agent.getAllEntities();
      res.json(entities);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'FIMAT Agent is running' });
  });

  const PORT = config.agent.port;
  app.listen(PORT, () => {
    console.log(`\n📡 FIMAT Agent API chạy trên http://localhost:${PORT}`);
  });
}

module.exports = FIMATAgent;
