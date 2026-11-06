const MODERN_CHROME_VERSION = '134.0.6998.35';
const GOOGLE_AUTH_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0';

function isGoogleAuthUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === 'accounts.google.com' ||
           host.endsWith('.accounts.google.com') ||
           (host.endsWith('google.com') && (parsed.pathname.startsWith('/signin') || parsed.pathname.startsWith('/ServiceLogin')));
  } catch {
    return false;
  }
}

function browserUserAgent(chromium = process.versions?.chrome, platform = process.platform, targetUrl = '') {
  if (isGoogleAuthUrl(targetUrl)) {
    return GOOGLE_AUTH_USER_AGENT;
  }
  if (chromium !== undefined && !/^\d+\.\d+\.\d+\.\d+$/.test(chromium || '')) return null;
  const version = (/^\d+\.\d+\.\d+\.\d+$/.test(chromium || '')) ? chromium : MODERN_CHROME_VERSION;
  const os = platform === 'darwin'
    ? 'Macintosh; Intel Mac OS X 10_15_7'
    : platform === 'linux'
      ? 'X11; Linux x86_64'
      : 'Windows NT 10.0; Win64; x64';
  return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
}

function privacyHeaders(headers, chromium = process.versions?.chrome, targetUrl = '') {
  const result = { ...headers };
  for (const key of Object.keys(result)) {
    if (['dnt', 'sec-gpc'].includes(key.toLowerCase())) delete result[key];
  }
  result.DNT = '1';
  result['Sec-GPC'] = '1';

  if (isGoogleAuthUrl(targetUrl)) {
    // For Google authentication, provide clean Firefox headers:
    // Strip Chromium client hints so Google serves standard web auth without BotGuard embedded blocks
    for (const key of Object.keys(result)) {
      const lower = key.toLowerCase();
      if (lower === 'user-agent' || lower.startsWith('sec-ch-ua')) {
        delete result[key];
      }
    }
    result['User-Agent'] = GOOGLE_AUTH_USER_AGENT;
    return result;
  }

  const ua = browserUserAgent(chromium, undefined, targetUrl);
  if (ua) {
    for (const key of Object.keys(result)) {
      if (key.toLowerCase() === 'user-agent') delete result[key];
    }
    result['User-Agent'] = ua;
  }
  return result;
}

module.exports = {
  browserUserAgent,
  privacyHeaders,
  MODERN_CHROME_VERSION,
  GOOGLE_AUTH_USER_AGENT,
  isGoogleAuthUrl
};
