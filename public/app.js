const prizeListEl = document.getElementById('prizeList');
const leadForm = document.getElementById('leadForm');
const spinButton = document.getElementById('spinButton');
const wheelEl = document.getElementById('wheel');
const leadMessage = document.getElementById('leadMessage');
const resultBox = document.getElementById('spinResult');
const resultText = document.getElementById('resultText');
const referralBox = document.getElementById('referralBox');
const referralLinkInput = document.getElementById('referralLink');
const copyReferralBtn = document.getElementById('copyReferral');
const referralGroup = document.getElementById('referralGroup');
const referralCodeInput = document.getElementById('referralCode');
const yearEl = document.getElementById('year');

const referralFromUrl = new URLSearchParams(window.location.search).get('ref');
let prizes = [];
let segments = [];
let currentRotation = 0;
let spinning = false;
let currentUser = null;
let audioContext;

if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

async function fetchPrizes() {
  try {
    const res = await fetch('/api/prizes');
    if (!res.ok) throw new Error('Hediyeler yüklenemedi');
    const data = await res.json();
    prizes = data.prizes || [];
    renderPrizeCards(prizes);
    buildWheel(prizes);
  } catch (err) {
    console.error(err);
    leadMessage.textContent = 'Hediyeler yüklenirken bir sorun oluştu.';
  }
}

function renderPrizeCards(items) {
  if (!Array.isArray(items) || !items.length) {
    prizeListEl.innerHTML = '<p>Henüz hediye tanımlanmadı. Lütfen daha sonra tekrar deneyiniz.</p>';
    return;
  }
  prizeListEl.innerHTML = items
    .map(
      (item) => `
        <article class="prize-card">
          <div class="prize-card__image">
            ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.title}" loading="lazy" />` : '<span>Görsel eklenmedi</span>'}
          </div>
          <div class="prize-card__body">
            <h3>${item.title}</h3>
            <p>${item.description || 'Detay yakında eklenecek.'}</p>
            <span class="probability">Kazanma oranı: ${Number(item.probability).toFixed(2)}</span>
          </div>
        </article>
      `
    )
    .join('');
}

function generateSliceColors(count) {
  const palette = [
    '#dc2f2f',
    '#0c3c78',
    '#ff9f1c',
    '#136f63',
    '#f15152',
    '#127681',
    '#d90368',
    '#22577a'
  ];
  return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
}

function buildWheel(items) {
  wheelEl.innerHTML = '';
  if (!items.length) {
    wheelEl.style.background = 'radial-gradient(circle, #fff 0 45%, rgba(12, 60, 120, 0.15) 45%)';
    return;
  }

  const colors = generateSliceColors(items.length);
  const sliceAngle = 360 / items.length;
  const gradientStops = items
    .map((_, index) => {
      const start = index * sliceAngle;
      const end = start + sliceAngle;
      return `${colors[index]} ${start}deg ${end}deg`;
    })
    .join(', ');

  wheelEl.style.background = `radial-gradient(circle at center, #ffffff 0 18%, rgba(255, 255, 255, 0) 18%), conic-gradient(${gradientStops})`;
  wheelEl.style.transform = 'rotateX(12deg) rotateZ(0deg)';
  currentRotation = 0;

  segments = items.map((item, index) => {
    const segment = document.createElement('div');
    segment.className = 'segment';
    const rotation = index * sliceAngle + sliceAngle / 2;
    segment.style.transform = `rotate(${rotation}deg) translate(-50%, -92%)`;
    segment.style.setProperty('--segment-angle', `${rotation}deg`);
    segment.innerHTML = `
      <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=200&q=60'}" alt="${item.title}" />
      <span>${item.title}</span>
    `;
    wheelEl.appendChild(segment);
    return {
      element: segment,
      item,
      rotation
    };
  });
}

function updateSpinButton(state) {
  if (!spinButton) return;
  spinButton.disabled = !state.canSpin;
  spinButton.textContent = state.canSpin ? state.label : state.labelDisabled;
}

function updateReferralSection(link, code, showBox = false) {
  if (!referralGroup || !referralBox) return;
  if (link) {
    referralGroup.hidden = false;
    referralCodeInput.value = code;
    referralLinkInput.value = link;
    referralBox.hidden = !showBox;
  } else {
    referralGroup.hidden = true;
    referralBox.hidden = true;
  }
}

function updateLeadMessage(message, type = 'info') {
  if (!leadMessage) return;
  leadMessage.textContent = message;
  leadMessage.style.color = type === 'error' ? '#d90429' : type === 'success' ? '#127681' : '#607093';
}

function resolveSpinState(stats) {
  if (!stats) {
    return { canSpin: false, label: 'Çarkı Çevir', labelDisabled: 'Önce formu doldurun' };
  }
  const { spinCount = 0, bonusAvailable = 0, bonusUsed = 0 } = stats;
  const bonusRemaining = bonusAvailable - bonusUsed;
  if (spinCount === 0) {
    return { canSpin: true, label: 'Çarkı Çevir', labelDisabled: 'Çarkı Çevir' };
  }
  if (bonusRemaining > 0) {
    return { canSpin: true, label: 'Ek Spin Hakkını Kullan', labelDisabled: 'Ek Spin Hakkını Kullan' };
  }
  return { canSpin: false, label: 'Çarkı Çevir', labelDisabled: 'Spin hakkınız tükendi' };
}

function animateWheelToPrize(prize) {
  if (!prize || !segments.length) return;
  const sliceAngle = 360 / segments.length;
  const index = segments.findIndex((segment) => segment.item.id === prize.id);
  const randomOffset = Math.random() * (sliceAngle - 8) + 4; // avoid borders
  const targetAngle = index * sliceAngle + sliceAngle / 2;
  const rotation = 360 * 6 + (360 - targetAngle) + randomOffset;
  currentRotation += rotation;
  wheelEl.style.transition = 'transform 5s cubic-bezier(0.17, 0.82, 0.24, 0.99)';
  wheelEl.style.transform = `rotateX(12deg) rotateZ(${currentRotation}deg)`;

  return new Promise((resolve) => {
    setTimeout(() => {
      wheelEl.style.transition = 'none';
      currentRotation = currentRotation % 360;
      wheelEl.style.transform = `rotateX(12deg) rotateZ(${currentRotation}deg)`;
      resolve();
    }, 5200);
  });
}

function ensureAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
    }
  }
  if (audioContext?.state === 'suspended') {
    audioContext.resume();
  }
}

function playSpinSound() {
  ensureAudioContext();
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(320, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(1320, audioContext.currentTime + 3.2);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.35, audioContext.currentTime + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 3.4);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 3.6);
}

async function handleSpin() {
  if (!currentUser || spinning) return;
  const state = resolveSpinState(currentUser.stats);
  if (!state.canSpin) {
    updateLeadMessage('Spin hakkınız bulunmuyor. Davet göndererek ekstra hak kazanabilirsiniz.', 'error');
    return;
  }
  try {
    spinning = true;
    spinButton.disabled = true;
    updateLeadMessage('Çark dönüyor... Bol şans!', 'info');
    playSpinSound();
    const response = await fetch('/api/spin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId: currentUser.user.id })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Bir sorun oluştu' }));
      throw new Error(error.error || 'Spin işlemi başarısız');
    }
    const data = await response.json();
    await animateWheelToPrize(data.prize);
    resultText.textContent = `${data.prize.title} kazandınız! ${data.prize.description || ''}`.trim();
    resultBox.hidden = false;
    updateReferralSection(data.referralLink, currentUser.user.referralCode, true);
    currentUser.stats.spinCount = (currentUser.stats.spinCount || 0) + 1;
    currentUser.stats.bonusAvailable = data.bonus.available;
    currentUser.stats.bonusUsed = data.bonus.used;
    localStorage.setItem('adk-user', JSON.stringify(currentUser));
    const newState = resolveSpinState(currentUser.stats);
    updateSpinButton(newState);
    updateLeadMessage('Kazandığınız hediye yönetim paneline işlendi.', 'success');
  } catch (err) {
    updateLeadMessage(err.message, 'error');
  } finally {
    spinning = false;
    const state = resolveSpinState(currentUser?.stats);
    spinButton.disabled = !state.canSpin;
  }
}

spinButton?.addEventListener('click', handleSpin);

copyReferralBtn?.addEventListener('click', async () => {
  if (!referralLinkInput.value) return;
  try {
    await navigator.clipboard.writeText(referralLinkInput.value);
    copyReferralBtn.textContent = 'Kopyalandı';
    setTimeout(() => {
      copyReferralBtn.textContent = 'Kopyala';
    }, 2000);
  } catch (err) {
    console.error(err);
  }
});

leadForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(leadForm);
  const payload = Object.fromEntries(formData.entries());
  payload.referralCode = referralFromUrl || undefined;
  try {
    updateLeadMessage('Bilgileriniz kayıt ediliyor...', 'info');
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Kayıt başarısız' }));
      throw new Error(err.error || 'Kayıt başarısız');
    }
    const data = await res.json();
    const { user, stats, referralLink } = data;
    currentUser = { user, stats: { spinCount: stats.spins, bonusAvailable: stats.bonusSpinsAvailable, bonusUsed: stats.bonusSpinsUsed } };
    localStorage.setItem('adk-user', JSON.stringify(currentUser));
    referralLinkInput.value = referralLink;
    updateReferralSection(referralLink, user.referralCode, currentUser.stats.spinCount > 0);
    leadForm.fullName.value = user.fullName;
    leadForm.email.value = user.email || '';
    leadForm.phone.value = user.phone || '';
    leadForm.interestedLanguage.value = user.interestedLanguage || '';
    const spinState = resolveSpinState(currentUser.stats);
    updateSpinButton(spinState);
    resultBox.hidden = true;
    updateLeadMessage('Kayıt tamamlandı! Çarkı çevirebilirsiniz.', 'success');
  } catch (err) {
    updateLeadMessage(err.message, 'error');
  }
});

async function restoreUserFromStorage() {
  const stored = localStorage.getItem('adk-user');
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    if (!parsed?.user?.id) return;
    const res = await fetch(`/api/users/${parsed.user.id}`);
    if (!res.ok) throw new Error('Kullanıcı bilgisi alınamadı');
    const data = await res.json();
    currentUser = { user: data.user, stats: { spinCount: data.stats.spinCount, bonusAvailable: data.stats.bonusAvailable, bonusUsed: data.stats.bonusUsed } };
    localStorage.setItem('adk-user', JSON.stringify(currentUser));
    leadForm.fullName.value = data.user.fullName;
    if (data.user.email) leadForm.email.value = data.user.email;
    if (data.user.phone) leadForm.phone.value = data.user.phone;
    leadForm.interestedLanguage.value = data.user.interestedLanguage || '';
    updateReferralSection(data.referralLink, data.user.referralCode, data.stats.spinCount > 0);
    const spinState = resolveSpinState(currentUser.stats);
    updateSpinButton(spinState);
    updateLeadMessage('Tekrar hoş geldiniz! Spin durumunuz güncellendi.', 'info');
    if (data.stats.lastSpin) {
      resultBox.hidden = false;
      resultText.textContent = `${data.stats.lastSpin.prize_title || ''} kazanmıştınız.`;
    }
  } catch (err) {
    console.warn(err);
    localStorage.removeItem('adk-user');
  }
}

fetchPrizes();
restoreUserFromStorage();

if (referralFromUrl) {
  updateLeadMessage('Davet kodu uygulandı. Arkadaşını mutlu etmeye hazırsın!', 'info');
}
