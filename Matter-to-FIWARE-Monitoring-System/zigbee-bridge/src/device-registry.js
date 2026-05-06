/**
 * Device Registry - Tracks discovered Zigbee devices and their capabilities.
 */

class DeviceRegistry {
  constructor() {
    this.devices = new Map();
  }

  register(ieeeAddr, friendlyName, deviceType, capabilities) {
    this.devices.set(ieeeAddr, {
      ieeeAddr,
      friendlyName,
      deviceType,
      capabilities,
      lastSeen: new Date().toISOString(),
      entityId: `urn:ngsi-ld:ZigbeeDevice:${friendlyName.replace(/\s+/g, '_')}`
    });
    console.log(`[Registry] Registered: ${friendlyName} (${deviceType}) -> ${ieeeAddr}`);
  }

  get(ieeeAddr) {
    return this.devices.get(ieeeAddr);
  }

  getByFriendlyName(name) {
    for (const device of this.devices.values()) {
      if (device.friendlyName === name) return device;
    }
    return null;
  }

  getAll() {
    return Array.from(this.devices.values());
  }

  updateLastSeen(ieeeAddr) {
    const device = this.devices.get(ieeeAddr);
    if (device) device.lastSeen = new Date().toISOString();
  }
}

module.exports = DeviceRegistry;
