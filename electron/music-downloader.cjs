const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

function downloadYouTubeAudio(videoId, destination) {
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId || '')) return Promise.reject(new Error('Invalid YouTube video address.'));
  const candidates = [
    path.join(process.resourcesPath || '', 'bin', 'yt-dlp.exe'),
    path.join(__dirname, '..', 'vendor', 'yt-dlp.exe')
  ];
  const executable = candidates.find(file => fs.existsSync(file));
  if (!executable) return Promise.reject(new Error('The audio download component is missing from this installation.'));
  return new Promise((resolve, reject) => {
    execFile(executable, [
      '--ignore-config', '--no-playlist', '--no-progress', '--no-warnings', '--no-overwrites',
      '--max-filesize', '100M', '--format', 'bestaudio[ext=m4a]',
      '--output', destination, '--', `https://www.youtube.com/watch?v=${videoId}`
    ], { windowsHide: true, timeout: 180000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error((stderr || error.message).slice(-700)));
      else resolve(destination);
    });
  });
}
module.exports = { downloadYouTubeAudio };
