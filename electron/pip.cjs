/**
 * electron/pip.cjs — Blackout Video Pop-Out (Picture-in-Picture) Player
 *
 * Provides:
 * 1. Floating hover overlay pill on web videos (YouTube, Vimeo, Twitch, HTML5)
 * 2. Native Picture-in-Picture activation from toolbar button, context menu, or Alt+P
 */

const PIP_OVERLAY_CSS = `
  .blackout-pip-pill {
    position: absolute !important;
    top: 16px !important;
    left: 50% !important;
    transform: translateX(-50%) translateY(0) !important;
    z-index: 2147483647 !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 7px !important;
    padding: 7px 15px !important;
    border-radius: 24px !important;
    background: rgba(9, 10, 17, 0.90) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border: 1px solid rgba(154, 122, 255, 0.45) !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45), 0 0 12px rgba(154, 122, 255, 0.22) !important;
    color: #f4f1ff !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    letter-spacing: 0.02em !important;
    cursor: pointer !important;
    pointer-events: auto !important;
    user-select: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
    transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.22s, border-color 0.15s, background 0.15s !important;
  }
  .blackout-pip-pill.visible {
    opacity: 1 !important;
    visibility: visible !important;
  }
  .blackout-pip-pill:hover {
    background: rgba(22, 24, 38, 0.96) !important;
    border-color: #9a7aff !important;
    transform: translateX(-50%) translateY(-2px) scale(1.03) !important;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.55), 0 0 16px rgba(154, 122, 255, 0.35) !important;
  }
  .blackout-pip-pill svg {
    width: 15px !important;
    height: 15px !important;
    stroke: #9a7aff !important;
    stroke-width: 2 !important;
    fill: none !important;
    flex-shrink: 0 !important;
    transition: stroke 0.15s !important;
  }
  .blackout-pip-pill:hover svg {
    stroke: #ff684d !important;
  }
`;

const PIP_OVERLAY_SCRIPT = `
(function() {
  if (window.__blackout_pip_active) return;
  window.__blackout_pip_active = true;

  let activePill = null;
  let activeVideo = null;
  let hideTimer = null;

  function createPill() {
    const pill = document.createElement('div');
    pill.className = 'blackout-pip-pill';
    pill.setAttribute('aria-label', 'Pop out video player');
    pill.innerHTML = '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><rect x="11" y="9" width="9" height="6" rx="1" ry="1" fill="#9a7aff" fill-opacity="0.25"></rect><polyline points="15 11 18 8 18 11"></polyline></svg><span class="pip-label">Pop out</span>';

    pill.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!activeVideo) return;
      try {
        if (document.pictureInPictureElement === activeVideo) {
          await document.exitPictureInPicture();
        } else {
          await activeVideo.requestPictureInPicture();
        }
        updatePillState();
      } catch (err) {
        console.warn('Blackout PiP request failed:', err);
      }
    });

    document.body.appendChild(pill);
    return pill;
  }

  function updatePillState() {
    if (!activePill || !activeVideo) return;
    const label = activePill.querySelector('.pip-label');
    const isInPip = document.pictureInPictureElement === activeVideo;
    if (label) {
      label.textContent = isInPip ? 'Exit pop-out' : 'Pop out';
    }
  }

  function getBestContainer(video) {
    const ytPlayer = video.closest('#movie_player, .html5-video-player');
    if (ytPlayer) return ytPlayer;
    const container = video.closest('.video-js, [data-player], .player-container, .jwplayer, .vjs-tech') || video.parentElement;
    return container || video;
  }

  function positionPill(video) {
    if (!activePill) activePill = createPill();
    activeVideo = video;
    updatePillState();

    const target = getBestContainer(video);
    const rect = target.getBoundingClientRect();
    if (rect.width < 160 || rect.height < 100 || rect.bottom < 0 || rect.top > window.innerHeight) {
      hidePill();
      return;
    }

    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const topPos = rect.top + scrollY + 16;
    const leftPos = rect.left + scrollX + (rect.width / 2);

    activePill.style.top = topPos + 'px';
    activePill.style.left = leftPos + 'px';
    activePill.classList.add('visible');
  }

  function hidePill() {
    if (activePill) {
      activePill.classList.remove('visible');
    }
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hidePill, 1600);
  }

  document.addEventListener('mousemove', (e) => {
    const target = e.target;
    if (!target) return;
    if (activePill && activePill.contains(target)) {
      clearTimeout(hideTimer);
      return;
    }

    const video = target.tagName === 'VIDEO' ? target : target.closest?.('video, #movie_player, .html5-video-player')?.querySelector?.('video') || (target.querySelector ? target.querySelector('video') : null);
    if (video && video.readyState >= 1) {
      clearTimeout(hideTimer);
      positionPill(video);
      scheduleHide();
    } else if (activePill && activePill.classList.contains('visible')) {
      scheduleHide();
    }
  }, { passive: true });

  document.addEventListener('leavepictureinpicture', () => updatePillState(), { passive: true });
  document.addEventListener('enterpictureinpicture', () => updatePillState(), { passive: true });
})();
`;

function injectPipOverlay(webContents) {
  try {
    webContents.insertCSS(PIP_OVERLAY_CSS).catch(() => {});
    webContents.executeJavaScript(PIP_OVERLAY_SCRIPT).catch(() => {});
  } catch {}
}

async function togglePictureInPicture(context) {
  const contents = context?.activeTab?.view?.webContents;
  if (!contents || contents.isDestroyed()) return false;

  try {
    const result = await contents.executeJavaScript(`
      (async () => {
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
            return false;
          }
          const videos = Array.from(document.querySelectorAll('video'));
          const target = videos.find(v => !v.paused && v.readyState >= 1) ||
                         videos.find(v => !v.paused) ||
                         videos.find(v => v.readyState >= 1) ||
                         videos[0];
          if (target) {
            await target.requestPictureInPicture();
            return true;
          }
        } catch (err) {
          console.warn('PiP toggle error:', err);
        }
        return false;
      })()
    `, true);
    return Boolean(result);
  } catch (err) {
    return false;
  }
}

module.exports = {
  PIP_OVERLAY_CSS,
  PIP_OVERLAY_SCRIPT,
  injectPipOverlay,
  togglePictureInPicture
};
