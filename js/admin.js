import { db, ref, set, push, onValue } from './firebase-config.js';

// DOM Elementləri - Statistika
const statImages = document.getElementById('stat-images');
const statTexts = document.getElementById('stat-texts');
const statMarkers = document.getElementById('stat-markers');
const statUnreadable = document.getElementById('stat-unreadable');

// DOM Elementləri - Cədvəllər
const markersTableBody = document.getElementById('markers-table-body');
const tasksTableBody = document.getElementById('tasks-table-body');

// DOM Elementləri - Qeydiyyat forması
const registerBtn = document.getElementById('register-marker-btn');
const successMsg = document.getElementById('reg-success-msg');

// 1. Real-vaxt rejimində Firebase-dən məlumatların oxunması və statistika
onValue(ref(db), (snapshot) => {
  if (!snapshot.exists()) return;

  const data = snapshot.val();
  const users = data.users || {};
  const tasks = data.tasks || {};

  // Ümumi Statistikalar
  const totalTasks = Object.keys(tasks).length;
  let totalVerifications = 0;
  let totalUnreadable = 0;

  Object.values(tasks).forEach(t => {
    if (t.verifications) totalVerifications += Object.keys(t.verifications).length;
    if (t.unreadable) totalUnreadable++;
  });

  const markerList = Object.values(users).filter(u => u.role === 'marker');

  statImages.innerText = totalTasks;
  statTexts.innerText = totalVerifications;
  statMarkers.innerText = markerList.length;
  statUnreadable.innerText = totalUnreadable;

  // Marker Performans Cədvəli
  markersTableBody.innerHTML = '';
  markerList.forEach(m => {
    const avgSec = m.completedCount ? Math.round(m.totalTimeSpentSec / m.completedCount) : 0;
    
    const row = `<tr>
      <td>${m.fullName} (${m.fin})</td>
      <td>${m.completedCount || 0}</td>
      <td>${m.totalTimeSpentSec || 0} san</td>
      <td><strong>${avgSec} san/iş</strong></td>
    </tr>`;
    markersTableBody.innerHTML += row;
  });

  // Tapşırıqlar Cədvəli
  tasksTableBody.innerHTML = '';
  Object.keys(tasks).forEach(key => {
    const t = tasks[key];
    const textA = t.transcriptions?.A?.text || '-';
    const statusText = t.status === 'completed' ? '✅ Təsdiqlənib' : '⏳ Gözləmədə';
    
    const row = `<tr>
      <td><a href="${t.imageUrl}" target="_blank">Şəkilə bax</a></td>
      <td>${statusText}</td>
      <td>${textA}</td>
      <td>${t.verifications ? Object.keys(t.verifications).length : 0} / 2</td>
      <td>${t.unreadable ? '⚠️ Oxunmaz' : 'Normal'}</td>
    </tr>`;
    tasksTableBody.innerHTML += row;
  });
});

// 2. Yeni Marker Qeydiyyatı Məntiqi
if (registerBtn) {
  registerBtn.addEventListener('click', async () => {
    const name = document.getElementById('reg-name').value.trim();
    const surname = document.getElementById('reg-surname').value.trim();
    const patronymic = document.getElementById('reg-patronymic').value.trim();
    const fin = document.getElementById('reg-fin').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();

    if (!name || !surname || !fin || !username || !password) {
      alert('Lütfən bütün əsas sahələri doldurun!');
      return;
    }

    // Firebase-də yeni marker düyünü yaradırıq
    const newUserRef = push(ref(db, 'users'));
    
    const markerData = {
      fullName: `${surname} ${name} ${patronymic}`,
      fin: fin.toUpperCase(),
      username: username,
      password: password,
      role: 'marker',
      totalTimeSpentSec: 0,
      completedCount: 0
    };

    try {
      await set(newUserRef, markerData);
      successMsg.classList.remove('hidden');
      
      // Formu təmizləyirik
      document.getElementById('reg-name').value = '';
      document.getElementById('reg-surname').value = '';
      document.getElementById('reg-patronymic').value = '';
      document.getElementById('reg-fin').value = '';
      document.getElementById('reg-username').value = '';
      document.getElementById('reg-password').value = '';

      setTimeout(() => successMsg.classList.add('hidden'), 4000);
    } catch (error) {
      alert('Xəta baş verdi: ' + error.message);
    }
  });
}
