// Blackout Browser WireGuard & VPN Tunnel Manager

function parseWireGuardConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== 'string') {
    throw new Error('Config must be a valid text string.');
  }

  const lines = rawConfig.split(/\r?\n/);
  let currentSection = null;
  const config = {
    interface: {},
    peer: {}
  };

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1).trim().toLowerCase();
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim().toLowerCase();
    const value = line.slice(eqIndex + 1).trim();

    if (currentSection === 'interface') {
      config.interface[key] = value;
    } else if (currentSection === 'peer') {
      config.peer[key] = value;
    }
  }

  if (!config.interface.privatekey && !config.peer.publickey) {
    throw new Error('Invalid WireGuard config: missing Interface or Peer keys.');
  }

  return {
    privateKey: config.interface.privatekey || '',
    address: config.interface.address || '10.0.0.2/32',
    dns: config.interface.dns || '1.1.1.1, 9.9.9.9',
    publicKey: config.peer.publickey || '',
    endpoint: config.peer.endpoint || '',
    allowedIPs: config.peer.allowedips || '0.0.0.0/0',
    persistentKeepalive: config.peer.persistentkeepalive || '25'
  };
}

module.exports = {
  parseWireGuardConfig
};
