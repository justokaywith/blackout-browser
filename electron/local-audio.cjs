const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');

function localAudioResponse(request, file) {
  if (!fs.existsSync(file)) return new Response('Downloaded audio was not found.', { status: 404 });
  const size = fs.statSync(file).size;
  const type = { '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.webm': 'audio/webm', '.ogg': 'audio/ogg' }[path.extname(file)] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  const range = request.headers.get('range');
  let start = 0, end = size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    if (!match[1]) start = Math.max(0, size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = String(end - start + 1);
  if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });
  const body = Readable.toWeb(fs.createReadStream(file, { start, end }));
  return new Response(body, { status: range ? 206 : 200, headers });
}
module.exports = { localAudioResponse };
