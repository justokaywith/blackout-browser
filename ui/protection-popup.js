(async function() {
  try {
    const info = await window.blackout?.getProtectionMode?.();
    const activeMode = info?.settings?.id || 'balanced';
    document.querySelectorAll('.item').forEach(btn => {
      if (btn.dataset.mode === activeMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  } catch (e) {}

  document.querySelectorAll('.item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode;
      if (window.blackout?.setProtectionMode) {
        await window.blackout.setProtectionMode(mode);
      }
      window.blackout?.closeMenuPopup?.();
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.blackout?.closeMenuPopup?.();
    }
  });
})();
