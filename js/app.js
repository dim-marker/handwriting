import { db, ref, get, update } from './firebase-config.js';

let currentUser = null;
let currentTask = null;
let currentTaskKey = null;
let timerInterval = null;
let secondsElapsed = 0;

// DOM Elementləri
const loginCard = document.getElementById('login-card');
const workspaceCard = document.getElementById('workspace-card');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const submitBtn = document.getElementById('submit-btn');
const unreadableBtn = document.getElementById('unreadable-btn');
const approveBtn = document.getElementById('approve-btn');
const correctBtn = document.getElementById('correct-btn');

loginBtn.addEventListener('click', async () => {
  const u = document.getElementById('username').value;
  const p = document.getElementById('password').value;

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
  }
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
  
  const snapshot = await get(ref(db, 'tasks'));
  if (!snapshot.exists()) {
    alert('Bazada heç bir tapşırıq yoxdur!');
    return;
  }

  const tasks = snapshot.val();
  // Statusu 'completed' olmayan istənilən tapşırığı seçirik
  const eligibleKeys = Object.keys(tasks).filter(key => {
    const t = tasks[key];
    return t.status !== 'completed';
  });

  if (eligibleKeys.length === 0) {
    alert('Aktiv tapşırıq qalmadı.');
    return;
  }

  // Təsadüfi tapşırıq seçimi
  currentTaskKey = eligibleKeys[Math.floor(Math.random() * eligibleKeys.length)];
  currentTask = tasks[currentTaskKey];

  document.getElementById('task-image').src = currentTask.imageUrl;

  // Rejimin müəyyənləşdirilməsi
  const tCount = currentTask.transcriptions ? Object.keys(currentTask.transcriptions).length : 0;
  
  if (tCount < 2) {
    // A və B marker rejimi: Şəkildən yazı yığmaq
    document.getElementById('task-mode-title').innerText = "Əl yazısını yığın (Yazma Rejimi)";
    document.getElementById('verification-actions').classList.add('hidden');
    submitBtn.classList.remove('hidden');
  } else {
    // C və D marker rejimi: Yoxlama / Təsdiqləmə
    document.getElementById('task-mode-title').innerText = "Mətni yoxlayın və təsdiqləyin";
    document.getElementById('transcription-text').value = currentTask.transcriptions.A?.text || '';
    document.getElementById('verification-actions').classList.remove('hidden');
    submitBtn.classList.add('hidden');
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
  const isCompleted = slot === 'D'; // D də təsdiqlədisə tapşırıq tamamlanır

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
  const slot = (!currentTask.verifications || !currentTask.verifications.C) ? 'C' : 'D';

  const payload = {
    [`tasks/${currentTaskKey}/verifications/${slot}`]: {
      markerId: currentUser.id,
      approved: false,
      correctedText: updatedText,
      durationSec: secondsElapsed,
      timestamp: Date.now()
    }
  };

  saveWork(payload);
});

unreadableBtn.addEventListener('click', () => {
  const payload = {
    [`tasks/${currentTaskKey}/unreadable`]: true,
    [`tasks/${currentTaskKey}/unreadableFlaggedBy`]: currentUser.id
  };
  alert('Şəkil oxunmaz olaraq işarələndi və başqa markerə ötürüldü.');
  saveWork(payload);
});

logoutBtn.addEventListener('click', () => location.reload());
