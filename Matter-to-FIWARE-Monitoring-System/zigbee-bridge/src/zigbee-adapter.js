/**
 * Zigbee Adapter - Translates zigbee2mqtt MQTT messages to NGSI-v2 format.
 *
 * zigbee2mqtt publishes to:
 *   zigbee2mqtt/<friendly_name>  -> device state (JSON)
 *   zigbee2mqtt/bridge/devices    -> device list (on connect)
 *   zigbee2mqtt/bridge/event      -> device events (join, leave, etc.)
 *
 * This adapter parses those messages and upserts NGSI-v2 entities to Orion.
 */

const config = require('../config');

class ZigbeeAdapter {
  constructor(deviceRegistry) {
    this.registry = deviceRegistry;
    this.deviceTypeCache = new Map();
  }

  /**
   * Process a zigbee2mqtt device list message (bridge/devices)
   */
  processDeviceList(devices) {
    for (const device of devices) {
      if (!device.friendly_name || device.friendly_name === 'Coordinator') continue;

      const deviceType = this.detectDeviceType(device);
      const capabilities = device.definition?.exposes || [];

      this.registry.register(
        device.ieee_address,
        device.friendly_name,
        deviceType,
        capabilities
      );
    }
  }

  /**
   * Process a zigbee2mqtt state message (zigbee2mqtt/<name>)
   * Returns NGSI-v2 entity data or null if not a recognized device.
   */
  processStateMessage(friendlyName, state) {
    const device = this.registry.getByFriendlyName(friendlyName);
    if (!device) {
      // Auto-register unknown devices
      const deviceType = this.guessTypeFromState(state);
      const entityId = `urn:ngsi-ld:ZigbeeDevice:${friendlyName.replace(/\s+/g, '_')}`;
      this.registry.register('auto', friendlyName, deviceType, []);
      return this.buildNGSIUpdate(entityId, deviceType, state);
    }

    this.registry.updateLastSeen(device.ieeeAddr);
    return this.buildNGSIUpdate(device.entityId, device.deviceType, state);
  }

  /**
   * Build NGSI-v2 attribute update payload from Zigbee state
   */
  buildNGSIUpdate(entityId, deviceType, state) {
    const mapping = config.deviceMap[deviceType] || { type: 'ZigbeeDevice', attrs: {} };
    const attrs = {};
    const timestamp = new Date().toISOString();
    const registeredDevice = this.registry.getAll().find(device => device.entityId === entityId);

    attrs.protocol = { type: 'Text', value: 'zigbee' };
    attrs.online = { type: 'Boolean', value: true };
    attrs.lastSeen = { type: 'DateTime', value: timestamp };
    if (registeredDevice?.friendlyName) {
      attrs.friendlyName = { type: 'Text', value: registeredDevice.friendlyName };
    }

    // Map known attributes
    for (const [zigbeeKey, ngsiKey] of Object.entries(mapping.attrs)) {
      if (state[zigbeeKey] !== undefined) {
        const value = state[zigbeeKey];
        const type = this.inferNGSIType(value);
        attrs[ngsiKey] = {
          type,
          value: type === 'Boolean' ? (value === 'ON' ? true : value === 'OFF' ? false : !!value) : value,
          metadata: {
            timestamp: { type: 'DateTime', value: timestamp },
            source: { type: 'string', value: 'zigbee' }
          }
        };
      }
    }

    // Handle generic numeric attributes (temperature, humidity, etc.)
    if (state.humidity !== undefined && !attrs.measuredValue) {
      attrs.measuredValue = {
        type: 'Number', value: state.humidity,
        metadata: { unit: { type: 'string', value: '%RH' }, timestamp: { type: 'DateTime', value: timestamp } }
      };
    }
    if (state.temperature !== undefined) {
      attrs.temperature = {
        type: 'Number', value: state.temperature,
        metadata: { unit: { type: 'string', value: 'C' }, timestamp: { type: 'DateTime', value: timestamp } }
      };
    }
    if (state.power !== undefined && !attrs.activePower) {
      attrs.activePower = {
        type: 'Number', value: state.power,
        metadata: { unit: { type: 'string', value: 'W' }, timestamp: { type: 'DateTime', value: timestamp } }
      };
    }
    if (state.state !== undefined && !attrs.onOff) {
      attrs.onOff = {
        type: 'Boolean', value: state.state === 'ON',
        metadata: { timestamp: { type: 'DateTime', value: timestamp } }
      };
    }
    if (state.water_leak !== undefined) {
      attrs.waterLeak = {
        type: 'Boolean', value: !!state.water_leak,
        metadata: { timestamp: { type: 'DateTime', value: timestamp } }
      };
    }
    if (state.occupancy !== undefined) {
      attrs.occupancy = {
        type: 'Boolean', value: !!state.occupancy,
        metadata: { timestamp: { type: 'DateTime', value: timestamp } }
      };
    }
    if (state.battery !== undefined) {
      attrs.battery = {
        type: 'Number', value: state.battery,
        metadata: { unit: { type: 'string', value: '%' }, timestamp: { type: 'DateTime', value: timestamp } }
      };
    }

    if (Object.keys(attrs).length === 0) return null;

    return { entityId, type: mapping.type || 'ZigbeeDevice', attrs };
  }

  detectDeviceType(device) {
    const type = device.definition?.description?.toLowerCase() || '';
    const exposes = device.definition?.exposes || [];
    const exposeTypes = exposes.map(e => e.type);

    if (type.includes('humidity') || type.includes('water')) return 'humidity';
    if (type.includes('plug') || type.includes('outlet')) return 'smart_plug';
    if (type.includes('light') || type.includes('lamp') || type.includes('bulb')) return 'light';
    if (type.includes('occupancy') || type.includes('motion')) return 'occupancy';
    if (type.includes('leak') || type.includes('flood')) return 'water_leak';
    if (exposeTypes.includes('humidity')) return 'temperature_humidity';
    if (exposeTypes.includes('switch') || exposeTypes.includes('outlet')) return 'smart_plug';
    if (exposeTypes.includes('light')) return 'light';

    return 'unknown';
  }

  guessTypeFromState(state) {
    if (state.humidity !== undefined) return 'humidity';
    if (state.power !== undefined) return 'smart_plug';
    if (state.water_leak !== undefined) return 'water_leak';
    if (state.occupancy !== undefined) return 'occupancy';
    if (state.brightness !== undefined) return 'light';
    if (state.state !== undefined) return 'smart_plug';
    return 'unknown';
  }

  inferNGSIType(value) {
    if (typeof value === 'boolean') return 'Boolean';
    if (typeof value === 'number') return 'Number';
    return 'Text';
  }
}

module.exports = ZigbeeAdapter;
