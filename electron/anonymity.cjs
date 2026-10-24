// Blackout Anonymity & Anti-Fingerprinting Shield
// Injected into web pages in Extra mode to prevent invasive cross-site hardware tracking.
// Strictly whitelists authentication and identity providers (e.g. Google Sign-In, Microsoft, Apple, GitHub)
// to prevent breaking device integrity verification, BotGuard, and OAuth flows.

const AUTH_DOMAINS = [
  'google.com',
  'accounts.google.com',
  'gstatic.com',
  'googleapis.com',
  'youtube.com',
  'googlevideo.com',
  'appleid.apple.com',
  'apple.com',
  'login.microsoftonline.com',
  'live.com',
  'github.com',
  'auth0.com',
  'okta.com'
];

function isAuthDomain(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  const host = hostname.toLowerCase();
  return AUTH_DOMAINS.some(domain => host === domain || host.endsWith('.' + domain));
}

const FINGERPRINT_SHIELD_SCRIPT = `
(function() {
  if (window.__blackout_anonymity_active) return;

  // Never tamper with authentication, video streaming, or identity verification providers
  try {
    const host = window.location.hostname.toLowerCase();
    const authList = ['google.com', 'accounts.google.com', 'gstatic.com', 'googleapis.com', 'youtube.com', 'googlevideo.com', 'apple.com', 'microsoft.com', 'microsoftonline.com', 'github.com', 'auth0.com', 'okta.com'];
    if (authList.some(d => host === d || host.endsWith('.' + d))) {
      return;
    }
  } catch (e) {}

  window.__blackout_anonymity_active = true;

  // 1. Canvas Fingerprint Noise Injection (safely applied only to large canvases, preserving BotGuard/icons)
  try {
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;

    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      const ctx = this.getContext('2d');
      if (ctx && this.width > 64 && this.height > 64) {
        try {
          const imgData = ctx.getImageData(0, 0, Math.min(10, this.width), Math.min(10, this.height));
          imgData.data[0] = (imgData.data[0] + 1) % 256;
          ctx.putImageData(imgData, 0, 0);
        } catch(e) {}
      }
      return origToDataURL.apply(this, args);
    };

    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
      const imgData = origGetImageData.apply(this, args);
      // Only subtly jitter large canvas readouts, never small integrity probes (like BotGuard or captcha)
      if (this.canvas && this.canvas.width > 64 && this.canvas.height > 64 && imgData.data.length > 64) {
        imgData.data[0] = (imgData.data[0] ^ 1);
      }
      return imgData;
    };
  } catch(e) {}

  // 2. WebGL GPU Vendor & Renderer Masking
  try {
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param) {
      // UNMASKED_VENDOR_WEBGL (0x9245)
      if (param === 0x9245) return 'Intel Inc.';
      // UNMASKED_RENDERER_WEBGL (0x9246)
      if (param === 0x9246) return 'Intel Iris OpenGL Engine';
      return getParameter.apply(this, arguments);
    };

    if (window.WebGL2RenderingContext) {
      const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(param) {
        if (param === 0x9245) return 'Intel Inc.';
        if (param === 0x9246) return 'Intel Iris OpenGL Engine';
        return getParameter2.apply(this, arguments);
      };
    }
  } catch(e) {}

  // 3. Hardware Normalization
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4, configurable: true });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });
  } catch(e) {}
})();
`;

function injectAnonymityShield(webContents) {
  try {
    const currentUrl = webContents.getURL();
    if (currentUrl) {
      const parsed = new URL(currentUrl);
      if (isAuthDomain(parsed.hostname)) {
        return;
      }
    }
  } catch {}
  webContents.executeJavaScript(FINGERPRINT_SHIELD_SCRIPT).catch(() => {});
}

module.exports = {
  AUTH_DOMAINS,
  isAuthDomain,
  FINGERPRINT_SHIELD_SCRIPT,
  injectAnonymityShield
};
