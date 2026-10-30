import { db, ref, get, update, onValue } from './firebase-config.js';

const adminLoginCard = document.getElementById('admin-login-card');
const adminDashboard = document.getElementById('admin-dashboard');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminLogoutBtn = document.getElementById('admin-logout-btn');

// Admin Giriş Məntiqi
adminLoginBtn.addEventListener('click', async () => {
  const u = document.getElementById('admin-username').value.trim();
  const p = document.getElementById('admin-password').value.trim();

  if (!u || !p) {
    alert('İstifadəçi adı və şifrəni daxil edin!');
    return;
  }

  // Bazadan admin istifadəçisini yoxlayırıq (və ya xüsusi admin yoxlaması)
  const snapshot = await get(ref(db, 'users'));
  if (snapshot.exists()) {
    const users = snapshot.val();
    const foundKey = Object.keys(users).find(k => users[k].username === u && users[k].password === p && users[k].role === 'admin');

    if (foundKey || (u === 'admin' && p === 'admin123')) { // Ehtiyat olaraq standart admin dəstəyi
      adminLoginCard.classList.add('hidden');
      adminDashboard.classList.remove('hidden');
      initAdminPanel();
    } else {
      document.getElementById('admin-login-error').classList.remove('hidden');
    }
  } else {
    // Əgər bazada heç user yoxdursa standart admin ilə giriş
    if (u === 'admin' && p === 'admin123') {
      adminLoginCard.classList.add('hidden');
      adminDashboard.classList.remove('hidden');
      initAdminPanel();
    } else {
      document.getElementById('admin-login-error').classList.remove('hidden');
    }
  }
});

adminLogoutBtn.addEventListener('click', () => location.reload());

// Accordion açılıb-bağlanma funksiyası
window.toggleAccordion = function(id) {
  const content = document.getElementById(id);
  content.classList.toggle('hidden');
};

function initAdminPanel() {
  const statImages = document.getElementById('stat-images');
  const statTexts = document.getElementById('stat-texts');
  const statMarkers = document.getElementById('stat-markers');
  const statUnreadable = document.getElementById('stat-unreadable');

  const markersTableBody = document.getElementById('markers-table-body');
  const tasksTableBody = document.getElementById('tasks-table-body');
  const markersEditContainer = document.getElementById('markers-edit-container');

  onValue(ref(db), (snapshot) => {
    if (!snapshot.exists()) return;

    const data = snapshot.val();
    const users = data.users || {};
    const tasks = data.tasks || {};

    // Statistika
    const totalTasks = Object.keys(tasks).length;
    let totalVerifications = 0;
    let totalUnreadable = 0;

    Object.values(tasks).forEach(t => {
      if (t.verifications) totalVerifications += Object.keys(t.verifications).length;
      if (t.unreadable) totalUnreadable++;
    });

    const markerList = Object.entries(users).filter(([id, u]) => u.role === 'marker');

    if (statImages) statImages.innerText = totalTasks;
    if (statTexts) statTexts.innerText = totalVerifications;
    if (statMarkers) statMarkers.innerText = markerList.length;
    if (statUnreadable) statUnreadable.innerText = totalUnreadable;

    // Marker Redaktə Siyahısı (Accordion içində)
    if (markersEditContainer) {
      markersEditContainer.innerHTML = '';
      markerList.forEach(([mId, m]) => {
        const card = document.createElement('div');
        card.className = 'marker-edit-card';
        card.innerHTML = `
          <div class="marker-edit-grid">
            <div>
              <label style="font-size:12px">Ad və Soyad</label>
              <input type="text" id="edit-name-${mId}" value="${m.fullName || ''}">
            </div>
            <div>
              <label style="font-size:12px">FİN Kod</label>
              <input type="text" id="edit-fin-${mId}" value="${m.fin || ''}">
            </div>
            <div>
              <label style="font-size:12px">İstifadəçi Adı</label>
              <input type="text" id="edit-user-${mId}" value="${m.username || ''}">
            </div>
            <div>
              <label style="font-size:12px">Şifrə</label>
              <input type="text" id="edit-pass-${mId}" value="${m.password || ''}">
            </div>
          </div>
          <button class="save-marker-btn" onclick="updateMarker('${mId}')">Yadda saxla</button>
        `;
        markersEditContainer.appendChild(card);
      });
    }

    // Marker Performans Cədvəli
    if (markersTableBody) {
      markersTableBody.innerHTML = '';
      markerList.forEach(([mId, m]) => {
        const avgSec = m.completedCount ? Math.round(m.totalTimeSpentSec / m.completedCount) : 0;
        markersTableBody.innerHTML += `
          <tr>
            <td>${m.fullName} (${m.fin})</td>
            <td>${m.completedCount || 0}</td>
            <td>${m.totalTimeSpentSec || 0} san</td>
            <td><strong>${avgSec} san/iş</strong></td>
          </tr>`;
      });
    }

    // Tapşırıqlar Cədvəli
    if (tasksTableBody) {
      tasksTableBody.innerHTML = '';
      Object.keys(tasks).forEach(key => {
        const t = tasks[key];
        const textA = t.transcriptions?.A?.text || '<span style="color:#94a3b8">Yazılmayıb</span>';
        const textB = t.transcriptions?.B?.text || '<span style="color:#94a3b8">Yazılmayıb</span>';
        let statusText = t.status === 'completed' ? '✅ Təsdiqlənib' : (t.unreadable ? '⚠️ Oxunmaz' : '⏳ Gözləmədə');

        tasksTableBody.innerHTML += `
          <tr>
            <td><a href="${t.imageUrl}" target="_blank">Şəkilə bax</a></td>
            <td>${statusText}</td>
            <td>${textA}</td>
            <td>${textB}</td>
            <td>${t.verifications ? Object.keys(t.verifications).length : 0} / 2</td>
          </tr>`;
      });
    }
  });
}

// Marker məlumatlarını yeniləmək üçün qlobal funksiya
window.updateMarker = async function(mId) {
  const fullName = document.getElementById(`edit-name-${mId}`).value.trim();
  const fin = document.getElementById(`edit-fin-${mId}`).value.trim();
  const username = document.getElementById(`edit-user-${mId}`).value.trim();
  const password = document.getElementById(`edit-pass-${mId}`).value.trim();

  if (!fullName || !fin || !username || !password) {
    alert('Bütün sahələri doldurun!');
    return;
  }

  try {
    await update(ref(db, `users/${mId}`), {
      fullName,
      fin: fin.toUpperCase(),
      username,
      password
    });
    alert('Marker məlumatları uğurla yeniləndi!');
  } catch (error) {
    alert('Xəta baş verdi: ' + error.message);
  }
};
