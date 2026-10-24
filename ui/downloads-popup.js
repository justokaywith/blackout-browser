(() => {
  const listEl = document.getElementById('downloads-menu-list');
  const clearBtn = document.getElementById('downloads-clear-all');
  const openFolderBtn = document.getElementById('menu-open-downloads-folder');

  const downloads = new Map();

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let val = bytes;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i++;
    }
    return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function renderList() {
    const items = [...downloads.values()].reverse();
    if (items.length === 0) {
      listEl.innerHTML = '<div class="downloads-empty-state">No downloads yet</div>';
      return;
    }

    listEl.replaceChildren();
    for (const dl of items.slice(0, 20)) {
      const el = document.createElement('div');
      el.className = 'dl-item';

      const row = document.createElement('div');
      row.className = 'dl-item-row';

      const main = document.createElement('div');
      main.className = 'dl-item-main';

      const icon = document.createElement('div');
      icon.className = `dl-file-icon ${dl.state || 'progressing'}`;
      icon.textContent = dl.state === 'completed' ? '✓' : (dl.state === 'failed' ? '✕' : '↓');

      const meta = document.createElement('div');
      meta.className = 'dl-file-meta';

      const name = document.createElement('span');
      name.className = 'dl-filename';
      name.textContent = dl.filename;
      name.title = dl.filename;
      if (dl.state === 'completed' && dl.savePath) {
        name.addEventListener('click', () => {
          if (window.blackout?.openFile) {
            window.blackout.openFile(dl.savePath);
          } else {
            window.blackout?.openDownload(dl.savePath);
          }
        });
      }

      const statusText = document.createElement('span');
      statusText.className = 'dl-status-text';

      if (dl.state === 'progressing') {
        const pct = dl.totalBytes > 0 ? Math.round((dl.receivedBytes / dl.totalBytes) * 100) : 0;
        const remaining = Math.max(0, dl.totalBytes - dl.receivedBytes);
        statusText.textContent = dl.totalBytes > 0
          ? `${pct}% · ${formatBytes(dl.receivedBytes)} of ${formatBytes(dl.totalBytes)} (${formatBytes(remaining)} left)`
          : `${formatBytes(dl.receivedBytes)} downloaded`;
      } else if (dl.state === 'completed') {
        statusText.textContent = `Completed · ${formatBytes(dl.totalBytes || dl.receivedBytes)}${dl.completedTime ? ' · ' + dl.completedTime : ''}`;
      } else {
        statusText.textContent = 'Failed or cancelled';
      }

      meta.append(name, statusText);
      main.append(icon, meta);
      row.appendChild(main);
      if (dl.state === 'progressing') {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'dl-action-btn dl-cancel-btn';
        cancel.textContent = 'Cancel';
        cancel.setAttribute('aria-label', `Cancel download ${dl.filename}`);
        cancel.addEventListener('click', async () => {
          cancel.disabled = true;
          const cancelled = await window.blackout?.cancelDownload?.(dl.id).catch(() => false);
          if (cancelled) { dl.state = 'cancelled'; renderList(); }
          else { cancel.disabled = false; cancel.textContent = 'Unavailable'; }
        });
        row.appendChild(cancel);
      }

      if (dl.state === 'completed' && dl.savePath) {
        const actions = document.createElement('div');
        actions.className = 'dl-actions';
        const showBtn = document.createElement('button');
        showBtn.type = 'button';
        showBtn.className = 'dl-action-btn';
        showBtn.textContent = 'Folder';
        showBtn.title = 'Show in folder';
        showBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.blackout?.openDownload(dl.savePath);
        });
        actions.appendChild(showBtn);
        row.appendChild(actions);
      }

      el.appendChild(row);

      if (dl.state === 'progressing') {
        const barWrap = document.createElement('div');
        barWrap.className = 'dl-progress-bar-wrap';
        const barFill = document.createElement('div');
        barFill.className = 'dl-progress-bar-fill';
        const pct = dl.totalBytes > 0 ? Math.min(100, Math.round((dl.receivedBytes / dl.totalBytes) * 100)) : 30;
        barFill.style.width = `${pct}%`;
        barWrap.appendChild(barFill);
        el.appendChild(barWrap);
      }

      listEl.appendChild(el);
    }
  }

  // Load existing downloads
  if (window.blackout?.getDownloads) {
    window.blackout.getDownloads().then(items => {
      if (Array.isArray(items)) {
        for (const item of items) {
          downloads.set(item.id, item);
        }
        renderList();
      }
    }).catch(() => {});
  }

  // Listen for live download events
  if (window.blackout?.onState) {
    window.blackout.onState(state => {
      if (state.type === 'download-start') {
        downloads.set(state.id, {
          id: state.id,
          filename: state.filename,
          receivedBytes: 0,
          totalBytes: state.totalBytes || 0,
          state: 'progressing'
        });
        renderList();
      } else if (state.type === 'download-progress') {
        const item = downloads.get(state.id) || { id: state.id, filename: state.filename };
        item.receivedBytes = state.receivedBytes;
        item.totalBytes = state.totalBytes || item.totalBytes;
        item.state = 'progressing';
        downloads.set(state.id, item);
        renderList();
      } else if (state.type === 'download-completed') {
        const item = downloads.get(state.id) || { id: state.id, filename: state.filename };
        item.state = 'completed';
        item.savePath = state.savePath;
        item.totalBytes = state.totalBytes || item.totalBytes;
        item.completedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        downloads.set(state.id, item);
        renderList();
      } else if (state.type === 'download-failed') {
        const item = downloads.get(state.id) || { id: state.id, filename: state.filename };
        item.state = 'failed';
        downloads.set(state.id, item);
        renderList();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      for (const [id,download] of downloads) if (download.state !== 'progressing') downloads.delete(id);
      renderList();
      window.blackout?.clearDownloads?.();
    });
  }

  if (openFolderBtn) {
    openFolderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.blackout?.openDownloadsFolder?.();
      window.blackout?.closeMenuPopup?.();
    });
  }
})();
