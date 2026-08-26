// public/js/shared.js — Modern Sidebar, Toasts, Session Management

(async function () {
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

  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.innerHTML = `
    <div>
      <div class="sidebar-brand">
        <div class="logo-mark">SW</div>
        <div>
          <div class="brand-text">Skywalker</div>
          <div class="brand-sub">Cloud Data Vault</div>
        </div>
      </div>

      <div class="nav-section">WORKSPACE</div>
      <nav style="display:flex;flex-direction:column;gap:2px;">
        <a class="nav-link ${page==='/vault'?'active':''}" href="/vault">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
          The Vault
        </a>
        <a class="nav-link ${page==='/input'?'active':''}" href="/input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          New Entry
        </a>
      </nav>

      ${isAdmin ? `
      <div class="nav-section" style="margin-top:16px;">ADMINISTRATION</div>
      <nav style="display:flex;flex-direction:column;gap:2px;">
        <a class="nav-link ${page==='/admin'?'active':''}" href="/admin">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          User Accounts
        </a>
        <a class="nav-link ${page==='/health'?'active':''}" href="/health">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          Database Health
        </a>
      </nav>
      ` : ''}

      <div class="sidebar-cta">
        <h4>Cloud Data Vault</h4>
        <p>Upload files & team notes securely</p>
        <a href="/input" class="cta-btn">+ Upload File</a>
      </div>
    </div>

    <div class="sidebar-footer">
      <div class="user-chip" id="userChip" title="Account settings">
        <div class="user-avatar">${initials}</div>
        <div class="user-info">
          <div class="user-name">${me.username}</div>
          <div class="user-role">${me.role}</div>
        </div>
      </div>
      <div id="userMenu" style="display:none;margin-top:8px;background:#ffffff;border:1px solid var(--border);border-radius:var(--radius-lg);padding:6px;box-shadow:var(--shadow-md);">
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:4px;justify-content:flex-start;" id="changePwdBtn">Change Password</button>
        <button class="btn btn-danger btn-sm" style="width:100%;justify-content:flex-start;" id="logoutBtn">Sign Out</button>
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

  // Change password
  document.getElementById('changePwdBtn').addEventListener('click', () => {
    showChangePwdModal();
  });

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
          <div class="form-group">
            <label class="form-label">Confirm New Password</label>
            <input class="form-control" type="password" id="_cpConfirm" required autocomplete="new-password"/>
          </div>
          <div id="_cpError" style="color:var(--danger);font-size:0.8rem;margin-bottom:12px;display:none;"></div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button type="button" class="btn btn-ghost" id="_cpCancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="_cpSubmit">Save Password</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(backdrop);

    const close = () => backdrop.remove();
    backdrop.querySelector('#_cpClose').onclick  = close;
    backdrop.querySelector('#_cpCancel').onclick = close;

    backdrop.querySelector('#_cpForm').onsubmit = async (e) => {
      e.preventDefault();
      const current = document.getElementById('_cpCurrent').value;
      const next    = document.getElementById('_cpNew').value;
      const confirm = document.getElementById('_cpConfirm').value;
      const errEl   = document.getElementById('_cpError');
      errEl.style.display = 'none';

      if (next !== confirm) {
        errEl.textContent = 'Passwords do not match';
        errEl.style.display = 'block';
        return;
      }

      const res = await fetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (data.success) {
        close();
        showToast('Password changed successfully');
      } else {
        errEl.textContent = data.error || 'Failed to change password';
        errEl.style.display = 'block';
      }
    };
  }
})();

// Shared Toast System
function showToast(msg, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s';
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}
