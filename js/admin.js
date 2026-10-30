import { db, ref, get, update, onValue } from './firebase-config.js';

const adminLoginCard = document.getElementById('admin-login-card');
const adminDashboard = document.getElementById('admin-dashboard');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminLogoutBtn = document.getElementById('admin-logout-btn');

let allMarkersData = [];

// Admin Giriş Məntiqi
adminLoginBtn.addEventListener('click', async () => {
  const u = document.getElementById('admin-username').value.trim();
  const p = document.getElementById('admin-password').value.trim();

  if (!u || !p) {
    alert('İstifadəçi adı və şifrəni daxil edin!');
    return;
  }

  const snapshot = await get(ref(db, 'users'));
  if (snapshot.exists()) {
    const users = snapshot.val();
    const foundKey = Object.keys(users).find(k => users[k].username === u && users[k].password === p && users[k].role === 'admin');

    if (foundKey || (u === 'admin' && p === 'admin123')) {
      adminLoginCard.classList.add('hidden');
      adminDashboard.classList.remove('hidden');
      initAdminPanel();
    } else {
      document.getElementById('admin-login-error').classList.remove('hidden');
    }
  } else {
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

// Accordion açılıb-bağlanma
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
    allMarkersData = markerList; // Axtarış üçün massivi yeniləyirik

    if (statImages) statImages.innerText = totalTasks;
    if (statTexts) statTexts.innerText = totalVerifications;
    if (statMarkers) statMarkers.innerText = markerList.length;
    if (statUnreadable) statUnreadable.innerText = totalUnreadable;

    // Cədvəli ilkin olaraq doldururuq
    renderMarkersTable(markerList);

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

  // Axtarış inputuna birbaşa listener əlavə edirik (HTML-də onkeyup yazmağa ehtiyac qalmır)
  const searchInput = document.getElementById('marker-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const filtered = allMarkersData.filter(([mId, m]) => {
        const fullName = (m.fullName || '').toLowerCase();
        const fin = (m.fin || '').toLowerCase();
        const username = (m.username || '').toLowerCase();
        return fullName.includes(query) || fin.includes(query) || username.includes(query);
      });
      renderMarkersTable(filtered);
    });
  }
}

// Cədvəli çəkən funksiya
function renderMarkersTable(list) {
  const tbody = document.getElementById('markers-edit-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b;">Marker tapılmadı</td></tr>`;
    return;
  }

  list.forEach(([mId, m]) => {
    tbody.innerHTML += `
      <tr>
        <td><input type="text" id="edit-name-${mId}" value="${m.fullName || ''}"></td>
        <td><input type="text" id="edit-fin-${mId}" value="${m.fin || ''}"></td>
        <td><input type="text" id="edit-user-${mId}" value="${m.username || ''}"></td>
        <td><input type="text" id="edit-pass-${mId}" value="${m.password || ''}"></td>
        <td><button class="save-marker-btn" onclick="updateMarker('${mId}')">Yadda saxla</button></td>
      </tr>`;
  });
}

// Marker məlumatlarını yeniləmək (Qlobal edirik)
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
