const loginSection = document.getElementById('loginSection');
const dashboard = document.getElementById('dashboard');
const adminLoginForm = document.getElementById('adminLoginForm');
const loginMessage = document.getElementById('loginMessage');
const logoutBtn = document.getElementById('logoutBtn');
const prizeForm = document.getElementById('prizeForm');
const prizeMessage = document.getElementById('prizeMessage');
const prizeTableBody = document.getElementById('prizeTableBody');
const participantTableBody = document.getElementById('participantTableBody');
const spinTableBody = document.getElementById('spinTableBody');
const prizeRowTemplate = document.getElementById('prizeRowTemplate');
const resetPrizeFormBtn = document.getElementById('resetPrizeForm');

let authToken = localStorage.getItem('adk-admin-token') || '';
let autoRefreshInterval;

function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('adk-admin-token', token);
  } else {
    localStorage.removeItem('adk-admin-token');
  }
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`
  };
}

function showMessage(element, message, type = 'info') {
  if (!element) return;
  element.textContent = message;
  element.style.color = type === 'error' ? '#d90429' : type === 'success' ? '#127681' : '#7082a8';
}

function toggleDashboard(isVisible) {
  loginSection.hidden = isVisible;
  dashboard.hidden = !isVisible;
  logoutBtn.hidden = !isVisible;
  if (!isVisible && autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = undefined;
  }
}

async function login(password) {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Giriş başarısız' }));
      throw new Error(error.error || 'Giriş başarısız');
    }
    const data = await res.json();
    setAuthToken(data.token);
    showMessage(loginMessage, 'Giriş başarılı. Panel yükleniyor...', 'success');
    toggleDashboard(true);
    await loadDashboardData();
    autoRefreshInterval = setInterval(loadDashboardData, 30000);
  } catch (err) {
    showMessage(loginMessage, err.message, 'error');
  }
}

async function fetchWithAuth(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: options.headers ? options.headers : authHeaders()
  });
  if (res.status === 401) {
    setAuthToken('');
    toggleDashboard(false);
    throw new Error('Oturumunuz sonlandı. Lütfen tekrar giriş yapın.');
  }
  return res;
}

function renderPrizeTable(prizes) {
  prizeTableBody.innerHTML = '';
  prizes.forEach((prize) => {
    const row = prizeRowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = prize.id;
    row.children[0].textContent = prize.title;
    row.children[1].textContent = prize.description || '-';
    row.children[2].textContent = Number(prize.probability).toFixed(2);
    row.children[3].innerHTML = prize.imageUrl
      ? `<img src="${prize.imageUrl}" alt="${prize.title}" />`
      : '<span>-</span>';
    prizeTableBody.appendChild(row);
  });
}

function renderParticipantTable(participants) {
  participantTableBody.innerHTML = '';
  participants.forEach((p) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="strong">${p.full_name}</td>
      <td>${p.email || '-'}</td>
      <td>${p.phone || '-'}</td>
      <td>${p.interested_language || '-'}</td>
      <td>${p.ip_address || '-'}</td>
      <td>${p.spin_count}</td>
      <td>${p.bonus_spins_available - p.bonus_spins_used}</td>
      <td>${new Date(p.created_at).toLocaleString('tr-TR')}</td>
    `;
    participantTableBody.appendChild(row);
  });
}

function renderSpinTable(spins) {
  spinTableBody.innerHTML = '';
  spins.forEach((spin) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${spin.full_name || '-'}</td>
      <td><span class="strong">${spin.prize_title}</span><br /><small>${spin.prize_description || ''}</small></td>
      <td>${spin.spin_number}</td>
      <td>${spin.ip_address || '-'}</td>
      <td>${new Date(spin.created_at).toLocaleString('tr-TR')}</td>
    `;
    spinTableBody.appendChild(row);
  });
}

async function loadDashboardData() {
  try {
    const [prizesRes, participantsRes, spinsRes] = await Promise.all([
      fetchWithAuth('/api/prizes'),
      fetchWithAuth('/api/participants'),
      fetchWithAuth('/api/spins')
    ]);

    const prizesData = await prizesRes.json();
    const participantsData = await participantsRes.json();
    const spinsData = await spinsRes.json();

    renderPrizeTable(prizesData.prizes);
    renderParticipantTable(participantsData.participants);
    renderSpinTable(spinsData.spins);
  } catch (err) {
    console.error(err);
    showMessage(prizeMessage, err.message, 'error');
  }
}

adminLoginForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const password = adminLoginForm.password.value.trim();
  login(password);
});

logoutBtn?.addEventListener('click', () => {
  setAuthToken('');
  toggleDashboard(false);
  showMessage(loginMessage, 'Çıkış yaptınız. Lütfen tekrar giriş yapın.');
});

prizeForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!authToken) return showMessage(prizeMessage, 'Önce giriş yapmalısınız.', 'error');
  const formData = new FormData(prizeForm);
  const payload = Object.fromEntries(formData.entries());
  const method = payload.id ? 'PUT' : 'POST';
  const url = payload.id ? `/api/prizes/${payload.id}` : '/api/prizes';
  payload.probability = Number(payload.probability);
  if (Number.isNaN(payload.probability)) {
    return showMessage(prizeMessage, 'Geçerli bir olasılık değeri giriniz.', 'error');
  }

  try {
    const res = await fetchWithAuth(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'İşlem başarısız' }));
      throw new Error(error.error || 'İşlem başarısız');
    }
    showMessage(prizeMessage, 'Hediye havuzu güncellendi.', 'success');
    prizeForm.reset();
    await loadDashboardData();
  } catch (err) {
    showMessage(prizeMessage, err.message, 'error');
  }
});

resetPrizeFormBtn?.addEventListener('click', () => {
  prizeForm.reset();
  showMessage(prizeMessage, 'Form sıfırlandı.');
});

prizeTableBody?.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const row = target.closest('tr');
  if (!row) return;
  const prizeId = row.dataset.id;
  if (target.dataset.action === 'edit') {
    const cells = row.children;
    document.getElementById('prizeId').value = prizeId;
    document.getElementById('prizeTitle').value = cells[0].textContent;
    document.getElementById('prizeDescription').value = cells[1].textContent === '-' ? '' : cells[1].textContent;
    const imageEl = cells[3].querySelector('img');
    document.getElementById('prizeImage').value = imageEl ? imageEl.src : '';
    document.getElementById('prizeProbability').value = cells[2].textContent;
    showMessage(prizeMessage, 'Hediye düzenleniyor. Güncelledikten sonra kaydedin.');
  }
  if (target.dataset.action === 'delete') {
    if (!confirm('Bu hediyeyi silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetchWithAuth(`/api/prizes/${prizeId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (!res.ok && res.status !== 204) {
        const error = await res.json().catch(() => ({ error: 'Silme başarısız' }));
        throw new Error(error.error || 'Silme başarısız');
      }
      showMessage(prizeMessage, 'Hediye silindi.', 'success');
      await loadDashboardData();
    } catch (err) {
      showMessage(prizeMessage, err.message, 'error');
    }
  }
});

if (authToken) {
  toggleDashboard(true);
  loadDashboardData().then(() => {
    autoRefreshInterval = setInterval(loadDashboardData, 30000);
  });
}
