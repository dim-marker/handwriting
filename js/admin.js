import { db, ref, onValue } from './firebase-config.js';

const statImages = document.getElementById('stat-images');
const statTexts = document.getElementById('stat-texts');
const statMarkers = document.getElementById('stat-markers');
const statUnreadable = document.getElementById('stat-unreadable');

const markersTableBody = document.getElementById('markers-table-body');
const tasksTableBody = document.getElementById('tasks-table-body');

// Real-vaxt izləmə (onValue)
onValue(ref(db), (snapshot) => {
  if (!snapshot.exists()) return;

  const data = snapshot.val();
  const users = data.users || {};
  const tasks = data.tasks || {};

  // 1. Ümumi Statistikalar
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

  // 2. Marker Cədvəli
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

  // 3. Tapşırıqlar Cədvəli
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
