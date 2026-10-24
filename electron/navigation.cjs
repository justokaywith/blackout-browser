const SEARCH_ENGINES = Object.freeze({
  duckduckgo: 'https://duckduckgo.com/?q=',
  google: 'https://www.google.com/search?q=',
  brave: 'https://search.brave.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  ecosia: 'https://www.ecosia.org/search?q=',
  startpage: 'https://www.startpage.com/sp/search?query='
});

function normalizeTarget(input, searchEngine = 'duckduckgo') {
  if (typeof input !== 'string') throw new TypeError('Enter a web address or search phrase.');
  const value = input.trim();
  const isHttpUrl = /^https?:\/\//i.test(value);
  const maxLen = isHttpUrl ? 32768 : 2048;
  if (!value || value.length > maxLen || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError('Enter a valid web address or search phrase.');
  }

  const baseUrl = SEARCH_ENGINES[searchEngine] || SEARCH_ENGINES.duckduckgo;

  if (/\s/.test(value) || (!/^[a-z][a-z\d+.-]*:/i.test(value) && !value.includes('.'))) {
    return baseUrl + encodeURIComponent(value);
  }

  // Treat email addresses and @ handles without explicit web scheme as search phrases
  if (value.includes('@') && !/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
    return baseUrl + encodeURIComponent(value);
  }

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  let target;
  try {
    target = new URL(candidate);
  } catch {
    return baseUrl + encodeURIComponent(value);
  }

  if (target.protocol === 'http:') target.protocol = 'https:';
  if (target.protocol !== 'https:' || target.username || target.password || !target.hostname) {
    throw new TypeError('Only public HTTPS web addresses are supported.');
  }
  return target.href;
}

module.exports = { normalizeTarget, SEARCH_ENGINES };
