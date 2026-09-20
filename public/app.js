function renderNav() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const page = location.pathname.split('/').pop();
  sidebar.innerHTML = `
    <div class="brand">🛍️ My Store</div>
    <a href="index.html" class="${page === 'index.html' || page === '' ? 'active' : ''}">🏠 Home</a>
    <a href="cart.html" class="${page === 'cart.html' ? 'active' : ''}">🛒 Cart <span id="cartBadge" class="cart-badge" style="display:none;"></span></a>
    <a href="wishlist.html" class="${page === 'wishlist.html' ? 'active' : ''}">❤️ Wishlist</a>
    <a href="orders.html" class="${page === 'orders.html' ? 'active' : ''}">📦 My Orders</a>
    <div class="user-box" id="authLinks">Loading...</div>
  `;
  updateCartBadge();
}

function updateCartBadge() {
  fetch('/api/cart/count')
    .then(res => res.json())
    .then(data => {
      const badge = document.getElementById('cartBadge');
      if (!badge) return;
      if (data.count > 0) {
        badge.textContent = data.count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    })
    .catch(() => {});
}

function checkAuth() {
  renderNav();
  fetch('/api/me')
    .then(res => res.json())
    .then(data => {
      const el = document.getElementById('authLinks');
      if (!el) return;
      if (data.loggedIn) {
        const initials = data.user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        el.innerHTML = `
          <a href="profile.html" class="user-name"><span class="avatar">${initials}</span>${data.user.name}</a>
          <a href="#" class="logout-btn" onclick="logout()">Logout</a>
        `;
      } else {
        el.innerHTML = `
          <div class="auth-links">
            <a href="login.html">Login</a>
            <a href="register.html">Register</a>
          </div>
        `;
      }
    });
}

function showToast(message, type = 'info') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = type;
  requestAnimationFrame(() => toast.classList.add('show'));
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function playAddSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.start(); osc.stop(ctx.currentTime + 0.15);
}


function logout() {
  fetch('/api/logout', { method: 'POST' }).then(() => location.href = 'index.html');
}