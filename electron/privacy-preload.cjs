const { contextBridge } = require('electron');

const MODERN_CHROME_VERSION = '134.0.6998.35';
const MODERN_CHROME_MAJOR = '134';

contextBridge.executeInMainWorld({
  func: () => {
    // 1. Privacy Standards
    for (const [key, value] of [['doNotTrack', '1'], ['globalPrivacyControl', true]]) {
      try {
        Object.defineProperty(Navigator.prototype, key, { get: () => value, configurable: true });
      } catch {}
    }

    // 2. High-entropy user-agent client hints and navigator identity for web compatibility
    try {
      const fullUa = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MODERN_CHROME_VERSION} Safari/537.36`;
      Object.defineProperty(Navigator.prototype, 'userAgent', { get: () => fullUa, configurable: true });
      Object.defineProperty(Navigator.prototype, 'appVersion', { get: () => fullUa.replace(/^Mozilla\//, ''), configurable: true });

      const brands = [
        { brand: 'Chromium', version: MODERN_CHROME_MAJOR },
        { brand: 'Google Chrome', version: MODERN_CHROME_MAJOR },
        { brand: 'Not(A:Brand', version: '24' }
      ];

      const userAgentData = {
        brands,
        mobile: false,
        platform: 'Windows',
        getHighEntropyValues: async (hints = []) => {
          const res = {
            brands,
            mobile: false,
            platform: 'Windows',
            platformVersion: '15.0.0',
            architecture: 'x86',
            bitness: '64',
            model: '',
            uaFullVersion: MODERN_CHROME_VERSION,
            fullVersionList: [
              { brand: 'Chromium', version: MODERN_CHROME_VERSION },
              { brand: 'Google Chrome', version: MODERN_CHROME_VERSION },
              { brand: 'Not(A:Brand', version: '24.0.0.0' }
            ]
          };
          const filtered = {};
          for (const h of hints) {
            if (h in res) filtered[h] = res[h];
          }
          return { ...filtered, brands, mobile: false, platform: 'Windows' };
        },
        toJSON: () => ({ brands, mobile: false, platform: 'Windows' })
      };

      Object.defineProperty(Navigator.prototype, 'userAgentData', {
        get: () => userAgentData,
        configurable: true
      });
    } catch {}
  }
});
