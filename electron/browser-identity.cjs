function browserUserAgent(chromium,platform=process.platform) {
  if(!/^\d+\.\d+\.\d+\.\d+$/.test(chromium || ''))return null;
  const os=platform==='darwin'?'Macintosh; Intel Mac OS X 10_15_7':platform==='linux'?'X11; Linux x86_64':'Windows NT 10.0; Win64; x64';
  return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromium} Safari/537.36`;
}
function privacyHeaders(headers,chromium=process.versions.chrome) {
  const result={...headers};
  for(const key of Object.keys(result))if(['dnt','sec-gpc'].includes(key.toLowerCase()))delete result[key];
  result.DNT='1';result['Sec-GPC']='1';
  const ua=browserUserAgent(chromium);
  if(ua){for(const key of Object.keys(result))if(key.toLowerCase()==='user-agent')delete result[key];result['User-Agent']=ua;}
  return result;
}
module.exports={browserUserAgent,privacyHeaders};
