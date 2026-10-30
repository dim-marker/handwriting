import { db, ref, get, set, update } from './firebase-config.js';

const GITHUB_OWNER = "dim-marker"; 
const GITHUB_REPO = "handwriting";  
const GITHUB_PATH = "images";       

let currentUser = null;
let currentTask = null;
let currentTaskKey = null;
let timerInterval = null;
let secondsElapsed = 0;
let scale = 1; // Şəkil üçün Zoom dəyişəni

const loginCard = document.getElementById('login-card');
const workspaceCard = document.getElementById('workspace-card');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const submitBtn = document.getElementById('submit-btn');
const unreadableBtn = document.getElementById('unreadable-btn');
const approveBtn = document.getElementById('approve-btn');
const correctBtn = document.getElementById('correct-btn');

// Tablar arası keçid
window.switchAuthTab = function(tabName) {
  const loginForm = document.getElementById('form-login');
  const regForm = document.getElementById('form-register');
  const loginTabBtn = document.getElementById('tab-login-btn');
  const regTabBtn = document.getElementById('tab-reg-btn');

  if (tabName === 'login') {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    loginTabBtn.classList.add('active');
    regTabBtn.classList.remove('active');
  } else {
    regForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    regTabBtn.classList.add('active');
    loginTabBtn.classList.remove('active');
  }
}

// Giriş Məntiqi
loginBtn.addEventListener('click', async () => {
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value.trim();

  if (!u || !p) {
    alert('Lütfən istifadəçi adı və şifrəni daxil edin!');
    return;
  }

  const snapshot = await get(ref(db, 'users'));
  if (snapshot.exists()) {
    const users = snapshot.val();
    const foundKey = Object.keys(users).find(k => users[k].username === u && users[k].password === p);
    
    if (foundKey) {
      currentUser = { id: foundKey, ...users[foundKey] };
      document.getElementById('user-info').innerText = `${currentUser.fullName} (${currentUser.fin})`;
      loginCard.classList.add('hidden');
      workspaceCard.classList.remove('hidden');
      loadRandomTask();
    } else {
      document.getElementById('login-error').classList.remove('hidden');
    }
  } else {
    alert('Bazada heç bir istifadəçi tapılmadı!');
  }
});

// Qeydiyyat Məntiqi
document.getElementById('register-btn').addEventListener('click', async () => {
  const fullName = document.getElementById('reg-fullname').value.trim();
  const fin = document.getElementById('reg-fin').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value.trim();

  if (!fullName || !fin || !username || !password) {
    alert('Bütün qeydiyyat xanalarını doldurun!');
    return;
  }

  const usersRef = ref(db, 'users');
  const snapshot = await get(usersRef);
  let users = snapshot.exists() ? snapshot.val() : {};

  const exists = Object.values(users).some(user => user.username === username);
  if (exists) {
    alert('Bu istifadəçi adı artıq istifadədədir. Başqa ad seçin.');
    return;
  }

  const newUserId = 'user_' + Date.now();
  const newUserDat = {
    fullName: fullName,
    fin: fin,
    username: username,
    password: password,
    role: 'marker',
    completedCount: 0,
    totalTimeSpentSec: 0
  };

  await set(ref(db, `users/${newUserId}`), newUserDat);
  alert('Uğurla qeydiyyatdan keçdiniz! İndi giriş edə bilərsiniz.');
  window.switchAuthTab('login');
});

// Taymer funksiyası
function startTimer() {
  clearInterval(timerInterval);
  secondsElapsed = 0;
  timerInterval = setInterval(() => {
    secondsElapsed++;
    const m = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
    const s = String(secondsElapsed % 60).padStart(2, '0');
    const timerEl = document.getElementById('timer');
    if (timerEl) timerEl.innerText = `${m}:${s}`;
  }, 1000);
}

// Şəkil Zoom Düymələri
document.getElementById('zoom-in')?.addEventListener('click', () => {
  scale += 0.25;
  document.getElementById('task-image').style.transform = `scale(${scale})`;
});

document.getElementById('zoom-out')?.addEventListener('click', () => {
  if (scale > 0.5) {
    scale -= 0.25;
    document.getElementById('task-image').style.transform = `scale(${scale})`;
  }
});

document.getElementById('zoom-reset')?.addEventListener('click', () => {
  scale = 1;
  document.getElementById('task-image').style.transform = `scale(${scale})`;
});

// Təsadüfi Tapşırıq Yükləmə (A/B və ya C/D rejimləri)
async function loadRandomTask() {
  startTimer();
  document.getElementById('transcription-text').value = '';
  
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`);
    const files = await res.json();

    if (!Array.isArray(files)) {
      alert('GitHub qovluğu oxunmadı!');
      return;
    }

    const imageFiles = files.filter(f => f.type === 'file' && /\.(jpg|jpeg|png)$/i.test(f.name));

    if (imageFiles.length === 0) {
      alert('GitHub "images" qovluğunda şəkil tapılmadı!');
      return;
    }

    const snapshot = await get(ref(db, 'tasks'));
    const tasksData = snapshot.exists() ? snapshot.val() : {};

    const eligibleImages = imageFiles.filter(img => {
      const taskKey = img.name.replace(/\./g, '_');
      const t = tasksData[taskKey];

      if (t && t.status === 'completed') return false;
      if (t && t.unreadable) return false;

      const userInvolved = 
        (t?.transcriptions?.A?.markerId === currentUser.id) ||
        (t?.transcriptions?.B?.markerId === currentUser.id) ||
        (t?.verifications?.C?.markerId === currentUser.id) ||
        (t?.verifications?.D?.markerId === currentUser.id);

      return !userInvolved;
    });

    if (eligibleImages.length === 0) {
      alert('Sizin üçün yeni aktiv şəkil qalmadı.');
      return;
    }

    const randomImage = eligibleImages[Math.floor(Math.random() * eligibleImages.length)];
    currentTaskKey = randomImage.name.replace(/\./g, '_');

    currentTask = tasksData[currentTaskKey] || {
      imageUrl: randomImage.download_url,
      status: 'pending',
      unreadable: false
    };

    document.getElementById('task-image').src = currentTask.imageUrl;
    
    // Şəkil dəyişəndə zoom-u sıfırlayırıq
    scale = 1;
    document.getElementById('task-image').style.transform = `scale(1)`;

    const tCount = currentTask.transcriptions ? Object.keys(currentTask.transcriptions).length : 0;
    
    const comparisonPanel = document.getElementById('comparison-panel');
    const verificationActions = document.getElementById('verification-actions');
    const textareaLabel = document.getElementById('textarea-label');

    if (tCount < 2) {
      // Yazma Rejimi (A və ya B)
      document.getElementById('task-mode-title').innerText = "Əl yazısını yığın (Yazma Rejimi - A/B)";
      if (comparisonPanel) comparisonPanel.classList.add('hidden');
      if (verificationActions) verificationActions.classList.add('hidden');
      submitBtn.classList.remove('hidden');
      unreadableBtn.classList.remove('hidden');
      if (textareaLabel) textareaLabel.innerText = "Mətn (Transkripsiya):";
    } else {
      // Təsdiq Rejimi (C və ya D) - Həm A, həm B mətnlərini göstəririk
      document.getElementById('task-mode-title').innerText = "Mətni yoxlayın və təsdiqləyin (Təsdiq Rejimi - C/D)";
      
      const textAView = document.getElementById('text-a-view');
      const textBView = document.getElementById('text-b-view');
      if (textAView) textAView.innerText = currentTask.transcriptions.A?.text || 'Yazılmayıb';
      if (textBView) textBView.innerText = currentTask.transcriptions.B?.text || 'Yazılmayıb';

      if (comparisonPanel) comparisonPanel.classList.remove('hidden');
      if (verificationActions) verificationActions.classList.remove('hidden');
      submitBtn.classList.add('hidden');
      unreadableBtn.classList.add('hidden');
      
      if (textareaLabel) textareaLabel.innerText = "Dəqiq / Düzəliş olunmuş mətn:";
      // İlkin olaraq A-nın mətnini yazırıq ki, istəsə üzərində düzəliş etsin
      document.getElementById('transcription-text').value = currentTask.transcriptions.A?.text || '';
    }

  } catch (error) {
    console.error("Xəta baş verdi:", error);
  }
}

// İşin Bazaya Yazılması
async function saveWork(dataPayload) {
  const userUpdates = {
    [`users/${currentUser.id}/totalTimeSpentSec`]: (currentUser.totalTimeSpentSec || 0) + secondsElapsed,
    [`users/${currentUser.id}/completedCount`]: (currentUser.completedCount || 0) + 1
  };

  await update(ref(db), { ...dataPayload, ...userUpdates });
  loadRandomTask();
}

// Transkripsiya Göndər (A və ya B)
submitBtn.addEventListener('click', () => {
  const text = document.getElementById('transcription-text').value.trim();
  if (!text) return alert('Lütfən mətni daxil edin!');

  const slot = (!currentTask.transcriptions || !currentTask.transcriptions.A) ? 'A' : 'B';
  const payload = {
    [`tasks/${currentTaskKey}/imageUrl`]: currentTask.imageUrl,
    [`tasks/${currentTaskKey}/status`]: 'verifying',
    [`tasks/${currentTaskKey}/transcriptions/${slot}`]: {
      markerId: currentUser.id,
      text: text,
      durationSec: secondsElapsed,
      timestamp: Date.now()
    }
  };

  saveWork(payload);
});

// Təsdiqlə (C və ya D - Düzgündür)
approveBtn.addEventListener('click', () => {
  const slot = (!currentTask.verifications || !currentTask.verifications.C) ? 'C' : 'D';
  const isCompleted = slot === 'D';

  const payload = {
    [`tasks/${currentTaskKey}/verifications/${slot}`]: {
      markerId: currentUser.id,
      approved: true,
      durationSec: secondsElapsed,
      timestamp: Date.now()
    },
    [`tasks/${currentTaskKey}/status`]: isCompleted ? 'completed' : 'verifying'
  };

  saveWork(payload);
});

// Düzəliş Et (C və ya D - Səhvdir, yenisini yazır)
correctBtn.addEventListener('click', () => {
  const updatedText = document.getElementById('transcription-text').value.trim();
  if (!updatedText) return alert('Düzəliş olunmuş mətni daxil edin!');

  const slot = (!currentTask.verifications || !currentTask.verifications.C) ? 'C' : 'D';
  const isCompleted = slot === 'D';

  const payload = {
    [`tasks/${currentTaskKey}/verifications/${slot}`]: {
      markerId: currentUser.id,
      approved: false,
      correctedText: updatedText,
      durationSec: secondsElapsed,
      timestamp: Date.now()
    },
    [`tasks/${currentTaskKey}/status`]: isCompleted ? 'completed' : 'verifying'
  };

  saveWork(payload);
});

// Oxunmaz İşarələ
unreadableBtn.addEventListener('click', () => {
  const payload = {
    [`tasks/${currentTaskKey}/imageUrl`]: currentTask.imageUrl,
    [`tasks/${currentTaskKey}/unreadable`]: true,
    [`tasks/${currentTaskKey}/unreadableFlaggedBy`]: currentUser.id,
    [`tasks/${currentTaskKey}/status`]: 'unreadable'
  };
  alert('Şəkil oxunmaz olaraq işarələndi.');
  saveWork(payload);
});

// Çıxış
logoutBtn.addEventListener('click', () => location.reload());
