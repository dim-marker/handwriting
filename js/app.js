import { db, ref, get, update } from './firebase-config.js';

// GitHub hesab və repozitoriya məlumatlarınız (Öz adlarınızla əvəz edin)
const GITHUB_OWNER = "dim-marker"; 
const GITHUB_REPO = "handwriting";  
const GITHUB_PATH = "images";       

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

// 1. Giriş Məntiqi (Login)
loginBtn.addEventListener('click', async () => {
  const u = document.getElementById('username').value.trim();
  const p = document.getElementById('password').value.trim();

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

// 2. Vaxtölçən (Timer)
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

// 3. GitHub-dan Şəkilləri və Firebase-dən Tapşırıqları Yükləmək
async function loadRandomTask() {
  startTimer();
  document.getElementById('transcription-text').value = '';
  
  try {
    // GitHub qovluğundan şəkilləri çəkirik
    const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`);
    const files = await res.json();

    if (!Array.isArray(files)) {
      alert('GitHub qovluğu oxunmadı! Repozitoriya adlarını yoxlayın.');
      return;
    }

    const imageFiles = files.filter(f => f.type === 'file' && /\.(jpg|jpeg|png)$/i.test(f.name));

    if (imageFiles.length === 0) {
      alert('GitHub "images" qovluğunda heç bir şəkil tapılmadı!');
      return;
    }

    const snapshot = await get(ref(db, 'tasks'));
    const tasksData = snapshot.exists() ? snapshot.val() : {};

    // Aktiv və uyğun şəkillərin filtrlənməsi
    const eligibleImages = imageFiles.filter(img => {
      const taskKey = img.name.replace(/\./g, '_');
      const t = tasksData[taskKey];

      if (t && t.status === 'completed') return false;
      if (t && t.unreadable) return false; // Oxunmaz işarələnənləri ötür

      // İstifadəçi bu şəkildə əvvəlcədən iştirak edibsə keç
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

    // Təsadüfi şəkil seçimi
    const randomImage = eligibleImages[Math.floor(Math.random() * eligibleImages.length)];
    currentTaskKey = randomImage.name.replace(/\./g, '_');

    currentTask = tasksData[currentTaskKey] || {
      imageUrl: randomImage.download_url,
      status: 'pending',
      unreadable: false
    };

    document.getElementById('task-image').src = currentTask.imageUrl;

    // A, B (Yazma) yoxsa C, D (Yoxlama) rejimi
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
    alert('Şəkilləri yükləmək mümkün olmadı: ' + error.message);
  }
}

// 4. İşin Bazaya Yazılması və Statistika Yenilənməsi
async function saveWork(dataPayload) {
  const userUpdates = {
    [`users/${currentUser.id}/totalTimeSpentSec`]: (currentUser.totalTimeSpentSec || 0) + secondsElapsed,
    [`users/${currentUser.id}/completedCount`]: (currentUser.completedCount || 0) + 1
  };

  await update(ref(db), { ...dataPayload, ...userUpdates });
  loadRandomTask();
}

// A və B markerləri üçün mətni göndərmə düyməsi
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

// C və D markerlə
