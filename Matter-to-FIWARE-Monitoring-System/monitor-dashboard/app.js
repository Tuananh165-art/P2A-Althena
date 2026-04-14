/**
 * Monitor Dashboard - app.js
 * Gọi API Orion định kỳ để lấy dữ liệu entities và hiển thị lên giao diện
 */

const ORION_BASE_URL = 'http://localhost:3001'; // Proxy server với CORS support
const FIMAT_AGENT_URL = 'http://localhost:3000';
const REFRESH_INTERVAL = 3000; // 3 giây

// Trạng thái ứng dụng
const appState = {
  orionConnected: false,
  entities: {},
  alerts: [],
  lastUpdate: null
};

/**
 * Khởi động ứng dụng
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Khởi động Monitor Dashboard');
  
  // Kiểm tra kết nối Orion
  checkOrionConnection();
  
  // Bắt đầu cập nhật định kỳ
  setInterval(fetchEntitiesFromOrion, REFRESH_INTERVAL);
  
  // Lắng nghe sự kiện nút bấm
  document.getElementById('toggle-plug').addEventListener('click', togglePlug);
});

/**
 * Kiểm tra kết nối FIWARE Orion
 */
async function checkOrionConnection() {
  try {
    console.log('🔍 Kiểm tra kết nối Orion...');
    const response = await fetch(`${ORION_BASE_URL}/version`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    if (response.ok) {
      appState.orionConnected = true;
      updateOrionStatus(true, 'Đã kết nối');
      console.log('✅ Kết nối Orion thành công');
    } else {
      updateOrionStatus(false, 'Lỗi kết nối');
      console.warn('⚠️ Lỗi kết nối:', response.status);
    }
  } catch (error) {
    console.error('❌ Không thể kết nối Orion:', error);
    updateOrionStatus(false, 'Không thể kết nối');
  }
}

/**
 * Cập nhật trạng thái Orion trên UI
 */
function updateOrionStatus(connected, text) {
  const statusDot = document.getElementById('orion-status');
  const statusText = document.getElementById('orion-text');
  
  if (connected) {
    statusDot.style.backgroundColor = '#4caf50'; // Green
    statusDot.innerHTML = '●';
  } else {
    statusDot.style.backgroundColor = '#f44336'; // Red
    statusDot.innerHTML = '●';
  }
  
  statusText.textContent = text;
}

/**
 * Lấy danh sách entities từ FIWARE Orion
 */
async function fetchEntitiesFromOrion() {
  try {
    console.log('📡 Đang lấy dữ liệu từ Orion...');
    
    const response = await fetch(`${ORION_BASE_URL}/v2/entities`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const entities = await response.json();
    console.log('📥 Entities nhận được:', entities.length, 'items', entities);
    
    appState.lastUpdate = new Date().toLocaleTimeString('vi-VN');
    document.getElementById('last-update').textContent = appState.lastUpdate;
    
    // Cập nhật trạng thái kết nối
    if (!appState.orionConnected) {
      appState.orionConnected = true;
      updateOrionStatus(true, 'Đã kết nối');
    }
    
    // Xử lý entities
    processEntities(entities);
    
    // Hiển thị JSON debug
    document.getElementById('debug-json').textContent = JSON.stringify(entities, null, 2);
    
  } catch (error) {
    console.error('❌ Lỗi lấy entities từ Orion:', error);
    console.error('Error details:', error.message, error.stack);
    updateOrionStatus(false, `Lỗi: ${error.message}`);
  }
}

/**
 * Xử lý và hiển thị entities
 */
function processEntities(entities) {
  console.log('🔄 Xử lý entities:', entities.length, 'entities');
  
  appState.entities = {};

  // Tạo HTML danh sách entities
  let entriesList = '';

  entities.forEach(entity => {
    console.log('📦 Processing entity:', entity.id, entity.type);
    appState.entities[entity.id] = entity;

    // Tìm kiếm attribute để hiển thị
    let attributes = [];
    for (const key in entity) {
      if (key !== 'id' && key !== 'type') {
        const attr = entity[key];
        const value = attr.value !== undefined ? attr.value : attr;
        const type = attr.type || typeof value;
        attributes.push(`${key}: ${value} (${type})`);

        // Cập nhật trạng thái thiết bị cụ thể
        updateDeviceUI(entity.id, key, value, attr);
      }
    }

    // Tạo HTML cho entity
    entriesList += `
      <div class="entity-item">
        <div class="entity-header">
          <strong>${entity.type}</strong>
          <span class="entity-id">${entity.id}</span>
        </div>
        <div class="entity-attributes">
          ${attributes.map(attr => `<div class="attribute">${attr}</div>`).join('')}
        </div>
      </div>
    `;
  });

  document.getElementById('entities-list').innerHTML = entriesList || '<p class="no-data">Không có entities</p>';
  console.log('✅ Render entities thành công');

  // Kiểm tra cảnh báo
  checkAlerts();
}

/**
 * Cập nhật giao diện thiết bị
 */
function updateDeviceUI(entityId, attributeName, value, attrObject) {
  // Cảm biến độ ẩm
  if (entityId.includes('1_1') && attributeName === 'measuredValue') {
    console.log('💧 Update humidity:', value);
    document.getElementById('humidity-value').textContent = value.toFixed(1);
    document.getElementById('humidity-progress').style.width = (value / 100 * 100) + '%';
    
    // Xác định trạng thái
    let status = '✅ Bình thường';
    let statusColor = '#4caf50';
    if (value > 80) {
      status = '⚠️ Cảnh báo - Ẩm cao';
      statusColor = '#ff9800';
    }
    if (value > 90) {
      status = '🚨 Nguy hiểm - Có nguy cơ ngập';
      statusColor = '#f44336';
    }
    
    const statusElem = document.getElementById('humidity-status');
    statusElem.textContent = status;
    statusElem.style.color = statusColor;
  }

  // Ổ cắm thông minh
  if (entityId.includes('2_1')) {
    // On/Off status
    if (attributeName === 'onOff') {
      console.log('🔌 Update plug status:', value);
      const status = value ? 'BẬT' : 'TẮT';
      const color = value ? '#4caf50' : '#999';
      const badge = document.getElementById('plug-status');
      badge.textContent = status;
      badge.style.backgroundColor = color;
    }

    // Power
    if (attributeName === 'activePower') {
      console.log('⚡ Update power:', value);
      document.getElementById('power-value').textContent = value;
      document.getElementById('power-progress').style.width = (value / 1000 * 100) + '%';
    }
  }
}

/**
 * Kiểm tra và cập nhật cảnh báo
 */
function checkAlerts() {
  const alerts = [];

  // Kiểm tra độ ẩm cao
  for (const entityId in appState.entities) {
    const entity = appState.entities[entityId];
    if (entity.measuredValue && entity.measuredValue.value > 85) {
      alerts.push({
        type: 'warning',
        message: `⚠️ Độ ẩm cao: ${entity.measuredValue.value.toFixed(1)}% - Nguy cơ ngập lụt!`,
        severity: 'high'
      });
    }
  }

  // Hiển thị cảnh báo
  const alertsContainer = document.getElementById('alerts-container');
  if (alerts.length > 0) {
    alertsContainer.innerHTML = alerts
      .map(alert => `
        <div class="alert alert-${alert.severity}">
          ${alert.message}
        </div>
      `)
      .join('');
  } else {
    alertsContainer.innerHTML = '<p class="no-alerts">❌ Không có cảnh báo</p>';
  }

  appState.alerts = alerts;
}

/**
 * Toggle ổ cắm thông minh (Mô phỏng)
 */
async function togglePlug() {
  console.log('🔌 Giả lập bật/tắt ổ cắm');
  alert('Chức năng này sẽ gửi lệnh điều khiển tới FIWARE Orion\n(Trong phiên bản tiếp theo)');
}

/**
 * Lấy tất cả entities từ FIMAT Agent
 */
async function fetchFromFIMATAgent() {
  try {
    const response = await fetch(`${FIMAT_AGENT_URL}/entities`);
    if (response.ok) {
      const entities = await response.json();
      console.log('📊 Entities từ FIMAT Agent:', entities);
    }
  } catch (error) {
    console.log('⚠️ FIMAT Agent không sẵn sàng');
  }
}

// Hàm hỗ trợ để format giá trị
function formatValue(value) {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  if (typeof value === 'boolean') {
    return value ? 'ON' : 'OFF';
  }
  return String(value);
}

console.log('✅ App.js đã tải');
