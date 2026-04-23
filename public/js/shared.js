// public/js/shared.js — Sidebar rendering, toast system, session check

(async function () {
  // ── Fetch current user ──────────────────────────────────────────────────
  let me = null;
  try {
    const res = await fetch('/auth/me');
    if (!res.ok) { window.location.href = '/login'; return; }
    me = await res.json();
  } catch {
    window.location.href = '/login';
    return;
  }

  const isAdmin  = me.role === 'admin';
  const initials = me.username.substring(0, 2).toUpperCase();
  const page     = window.location.pathname;

  // ── Render sidebar ──────────────────────────────────────────────────────
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <div class="logo-mark">IT</div>
      <div>
        <div class="brand-text">CompanyDB</div>
        <div class="brand-sub">InnoThoughts</div>
      </div>
    </div>

    <div class="nav-section">Workspace</div>
    <a class="nav-link ${page==='/input'?'active':''}" href="/input">
      <i class="icon">✏️</i> New Entry
    </a>
    <a class="nav-link ${page==='/vault'?'active':''}" href="/vault">
      <i class="icon">🗄️</i> The Vault
    </a>

    ${isAdmin ? `
    <div class="nav-section" style="margin-top:12px;">Admin</div>
    <a class="nav-link ${page==='/admin'?'active':''}" href="/admin">
      <i class="icon">👥</i> Users
    </a>
    <a class="nav-link ${page==='/health'?'active':''}" href="/health">
      <i class="icon">💊</i> DB Health
    </a>
    ` : ''}

    <div class="sidebar-footer">
      <div class="user-chip" id="userChip" title="Account options">
        <div class="user-avatar">${initials}</div>
        <div class="user-info">
          <div class="user-name">${me.username}</div>
          <div class="user-role">${me.role}</div>
        </div>
      </div>
      <div id="userMenu" style="display:none;margin-top:8px;">
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:6px;" id="changePwdBtn">Change Password</button>
        <button class="btn btn-danger btn-sm" style="width:100%;" id="logoutBtn">Sign Out</button>
      </div>
    </div>
  `;

  // Toggle user menu
  document.getElementById('userChip').addEventListener('click', () => {
    const m = document.getElementById('userMenu');
    m.style.display = m.style.display === 'none' ? 'block' : 'none';
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  });

  // Change password (inline prompt)
  document.getElementById('changePwdBtn').addEventListener('click', () => {
    showChangePwdModal();
  });

  // ── Change password modal (inline, shared) ───────────────────────────────
  function showChangePwdModal() {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop open';
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>Change Password</h2>
          <button class="modal-close" id="_cpClose">✕</button>
        </div>
        <form id="_cpForm">
          <div class="form-group">
            <label class="form-label">Current Password</label>
            <input class="form-control" type="password" id="_cpCurrent" required autocomplete="current-password"/>
          </div>
          <div class="form-group">
            <label class="form-label">New Password</label>
            <input class="form-control" type="password" id="_cpNew" required autocomplete="new-password" placeholder="Min 6 chars"/>
          </div>
          <div id="_cpErr" style="color:var(--danger);font-size:.8rem;display:none;margin-bottom:8px;"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" id="_cpCancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="_cpSubmit">Update Password</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(backdrop);

    const close = () => document.body.removeChild(backdrop);
    document.getElementById('_cpClose').addEventListener('click', close);
    document.getElementById('_cpCancel').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

    document.getElementById('_cpForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('_cpSubmit');
      const err = document.getElementById('_cpErr');
      btn.disabled = true; btn.textContent = 'Updating…';
      const res = await fetch('/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: document.getElementById('_cpCurrent').value, newPassword: document.getElementById('_cpNew').value }),
      });
      const data = await res.json();
      if (data.success) { showToast('Password updated!', 'success'); close(); }
      else { err.textContent = data.error; err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Update Password'; }
    });
  }
})();

// ── Toast system ──────────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  const icons  = { success: '✓', error: '✕', info: 'ℹ' };
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(() => toast.remove(), 300); }, duration);
}
