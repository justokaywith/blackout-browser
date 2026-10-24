(async function() {
  const listEl = document.getElementById('extensions-list');
  let pinnedIds = [];
  try {
    const params = new URLSearchParams(window.location.search);
    const qPinned = params.get('pinned');
    if (qPinned) {
      pinnedIds = JSON.parse(qPinned);
    } else {
      pinnedIds = JSON.parse(localStorage.getItem('blackout-pinned-extensions') || '[]');
    }
  } catch (e) {
    pinnedIds = [];
  }

  function escapeHtml(text) {
    return String(text || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function renderList() {
    try {
      const extensions = (await window.blackout?.extensions?.list?.()) || [];
      if (!extensions.length) {
        listEl.innerHTML = '<div class="empty-state">No custom extensions loaded yet.</div>';
        return;
      }
      listEl.innerHTML = extensions.map(ext => {
        const isPinned = pinnedIds.includes(ext.id);
        const iconHtml = ext.iconDataUrl
          ? `<img src="${ext.iconDataUrl}" style="width:20px;height:20px;border-radius:4px;object-fit:contain;flex-shrink:0;">`
          : `<span style="font-size:16px;flex-shrink:0;">🧩</span>`;
        return `
          <div class="ext-item">
            <button type="button" class="ext-main" data-id="${escapeHtml(ext.id)}">
              ${iconHtml}
              <div class="ext-info">
                <b>${escapeHtml(ext.name)}</b>
                <small>${ext.popup ? 'Click to open popup' : 'v' + escapeHtml(ext.version)}</small>
              </div>
            </button>
            <button type="button" class="ext-pin ${isPinned ? 'pinned' : ''}" data-id="${escapeHtml(ext.id)}" title="${isPinned ? 'Unpin from navbar' : 'Pin to navbar'}">📌</button>
          </div>`;
      }).join('');

      listEl.querySelectorAll('.ext-main').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          window.blackout?.triggerAppAction?.('open-extension-item', { id });
          window.blackout?.closeMenuPopup?.();
        });
      });

      listEl.querySelectorAll('.ext-pin').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          if (pinnedIds.includes(id)) {
            pinnedIds = pinnedIds.filter(x => x !== id);
            btn.classList.remove('pinned');
            btn.title = 'Pin to navbar';
          } else {
            pinnedIds.push(id);
            btn.classList.add('pinned');
            btn.title = 'Unpin from navbar';
          }
          try {
            localStorage.setItem('blackout-pinned-extensions', JSON.stringify(pinnedIds));
          } catch (err) {}
          window.blackout?.triggerAppAction?.('set-pinned-extensions', { pinnedIds });
        });
      });
    } catch (e) {
      console.error('Failed to load extensions in popup:', e);
      listEl.innerHTML = '<div class="empty-state">Could not load extensions.</div>';
    }
  }

  await renderList();

  document.getElementById('btn-manage')?.addEventListener('click', () => {
    window.blackout?.triggerAppAction?.('open-extensions-dialog');
    window.blackout?.closeMenuPopup?.();
  });

  document.getElementById('btn-load-unpacked')?.addEventListener('click', async () => {
    window.blackout?.closeMenuPopup?.();
    if (window.blackout?.extensions?.loadUnpacked) {
      await window.blackout.extensions.loadUnpacked();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.blackout?.closeMenuPopup?.();
    }
  });
})();
