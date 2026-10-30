import { db, ref, get, set, update } from './firebase-config.js';

const GITHUB_OWNER = "dim-marker"; 
const GITHUB_REPO = "handwriting";  
const GITHUB_PATH = "images";       

let currentUser = null;
let currentTask = null;
let currentTaskKey = null;
let timerInterval = null;
let secondsElapsed = 0;

const loginCard = document.getElementById('login-card');
const workspaceCard = document.getElementById('workspace-card');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const submitBtn = document.getElementById('submit-btn');
const unreadableBtn = document.getElementById('unreadable-btn');
const approveBtn = document.getElementById('approve-btn');
const correctBtn = document.getElementById('correct-btn');

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

function startTimer() {
  clearInterval(timerInterval);
  secondsElapsed = 0;
  timerInterval = setInterval(() => {
    secondsElapsed++;
    const m = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
    const s = String(secondsElapsed % 60).padStart(2, '0');
    document.getElementById('timer').innerText = `${m}:${s}`;
  }, 1000);
}

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

    const tCount = currentTask.transcriptions ? Object.keys(currentTask.transcriptions).length : 0;
    
    if (tCount < 2) {
      document.getElementById('task-mode-title').innerText = "Əl yazısını yığın (Yazma Rejimi - A/B)";
      document.getElementById('verification-actions').classList.add('hidden');
      submitBtn.classList.remove('hidden');
      unreadableBtn.classList.remove('hidden');
    } else {
      document.getElementById('task-mode-title').innerText = "Mətni yoxlayın və təsdiqləyin (Təsdiq Rejimi - C/D)";
      document.getElementById('transcription-text').value = currentTask.transcriptions.A?.text || '';
      document.getElementById('verification-actions').classList.remove('hidden');
      submitBtn.classList.add('hidden');
      unreadableBtn.classList.add('hidden');
    }

  } catch (error) {
    console.error("Xəta baş verdi:", error);
  }
}

async function saveWork(dataPayload) {
  const userUpdates = {
    [`users/${currentUser.id}/totalTimeSpentSec`]: (currentUser.totalTimeSpentSec || 0) + secondsElapsed,
    [`users/${currentUser.id}/completedCount`]: (currentUser.completedCount || 0) + 1
  };

  await update(ref(db), { ...dataPayload, ...userUpdates });
  loadRandomTask();
}

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

logoutBtn.addEventListener('click', () => location.reload());
