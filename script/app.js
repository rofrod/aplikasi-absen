// Dropdown toggle and selection script
document.addEventListener('DOMContentLoaded', function () {
  const kelasLabel = document.querySelector('.kelas');
  const kelasListEl = document.getElementById('kelas-list');
  const kelasWrapper = document.querySelector('.kelas-wrapper');

  // Render class list (ul > li) using default + custom classes
  function renderKelasList() {
    if (!kelasListEl) return;
    kelasListEl.innerHTML = '';

    // Default classes removed — only custom classes will be shown
    const defaultClasses = [];

    // helper to append an li
    function appendLi(cls, isCustom) {
      if (isClassHidden(cls.name)) return;
      const li = document.createElement('li');
      li.className = 'kelas-item';
      li.textContent = cls.name;
      if (cls.file) li.dataset.file = cls.file;
      li.dataset.custom = isCustom ? '1' : '0';
      li.tabIndex = 0;
      li.addEventListener('click', () => selectClass(cls.name, cls.file || null, !!isCustom, li));
      li.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          selectClass(cls.name, cls.file || null, !!isCustom, li);
        }
      });
      kelasListEl.appendChild(li);
    }

    defaultClasses.forEach(c => appendLi(c, false));

    const custom = loadCustomClasses();
    custom.forEach(c => appendLi(c, true));
  }

  // select class when clicking list item
  function selectClass(name, file, isCustom, liEl) {
    if (kelasLabel) kelasLabel.textContent = 'Kelas: ' + name;
    // clear active
    document.querySelectorAll('#kelas-list .kelas-item').forEach(n => n.classList.remove('active'));
    if (liEl) liEl.classList.add('active');

    currentClassEntry = { name: name, file: file || null, custom: !!isCustom };
    updateDeleteButtonState();

    // set currentClass for loadSiswa logic
    currentClass = file || name;
    if (file) loadSiswa(file).catch(err => console.error(err));
    else loadSiswa(name).catch(err => console.error(err));
  }

  // expose renderer so other functions can call it
  window.renderKelasList = renderKelasList;

  // initial render
  renderKelasList();

  // NEW: load awal tanpa filter
  loadSiswa().catch(err => console.error(err));

    // NEW: tombol tambah siswa
    const addBtn = document.getElementById('add-siswa-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        // pastikan ada kelas terpilih
        if (!currentClass) {
          alert('Pilih kelas terlebih dahulu.');
          return;
        }
        const nama = prompt('Masukkan nama siswa:');
        if (!nama) return;
        const trimmed = String(nama).trim();
        if (!trimmed) return;
        // cek duplikat pada currentList (case-insensitive)
        const already = currentList.some(it => String(it.nama || '').trim().toLowerCase() === trimmed.toLowerCase());
        if (already) {
          alert('Siswa dengan nama tersebut sudah ada di kelas ini.');
          return;
        }
        const siswa = { nama: trimmed, __local: true };
        // tambahkan ke currentList dan simpan lokal
        currentList.push(siswa);
        // simpan ke localStorage per kelas/file
        const key = getStorageKey(currentClass);
        saveLocalAdd(key, siswa);
        renderSiswa(currentList);
        // simpan status setelah penambahan
        if (typeof saveStatusMapForCurrent === 'function') saveStatusMapForCurrent();
      });
    }

    // NEW: render custom classes dari localStorage saat load
    renderCustomClasses();

    // after render, ensure delete button state (no class selected initially)
    updateDeleteButtonState();

    // NEW: tombol tambah kelas
    const addKelasBtn = document.getElementById('add-kelas-btn');
    if (addKelasBtn) {
      addKelasBtn.addEventListener('click', async function () {
        const nama = prompt('Masukkan nama kelas (contoh: XII-TKJ-4):');
        if (!nama) return;
        const file = prompt('Path file JSON untuk kelas ini (opsional). Contoh: data/12tkj4.json\nKosongkan jika tidak ada file.');
        const trimmedName = String(nama).trim();
        
        // tidak ada kelas default — hanya periksa duplikat pada kelas custom
        const existing = loadCustomClasses();
        if (existing.some(c => String(c.name || '').trim().toLowerCase() === trimmedName.toLowerCase())) {
          alert('Kelas dengan nama tersebut sudah ada.');
          return;
        }
        
        // cek duplikat di kelas custom
        // existing already validated above
        const entry = { name: trimmedName };
        let filePath = file && String(file).trim() ? String(file).trim() : null;

        // jika user tidak memberi file, buat file default berdasarkan nama kelas
        if (!filePath) {
          const suggested = filenameFromClass(trimmedName); // ex: data/xii-tkj-4.json
          try {
            // buat file JSON kosong (array) dan minta user simpan/konfirmasi lokasi
            await createAndSaveJson(suggested, JSON.stringify([], null, 2));
            // set path sesuai suggested (meskipun user bisa menyimpan di lokasi lain)
            filePath = suggested;
          } catch (err) {
            // jika gagal membuat otomatis, tetap gunakan suggested sebagai referensi
            console.warn('Tidak dapat membuat file otomatis, gunakan suggested path:', err);
            filePath = suggested;
            // masih lanjutkan — user diinstruksikan agar menyimpan file secara manual jika perlu
          }
        }

        if (filePath) entry.file = filePath;
        existing.push(entry);
        saveCustomClasses(existing);
        renderCustomClasses();
        // set label dan load siswa kelas baru
        if (kelasLabel) kelasLabel.textContent = 'Kelas: ' + trimmedName;
        // set currentClassEntry for the new class and enable delete button
        currentClassEntry = { name: trimmedName, file: entry.file || null, custom: true };
        updateDeleteButtonState();
        loadSiswa(entry.file ? entry.file : entry.name).catch(err => console.error(err));
      });
    }

    // NEW: tombol hapus kelas
    const deleteKelasBtn = document.getElementById('delete-kelas-btn');
    if (deleteKelasBtn) {
      deleteKelasBtn.addEventListener('click', async function () {
        if (!currentClassEntry) {
          alert('Pilih kelas terlebih dahulu.');
          return;
        }
        if (!confirm(`Hapus kelas "${currentClassEntry.name}" beserta data lokalnya? Tindakan ini tidak dapat dibatalkan.`)) {
          return;
        }

        // hapus entry dari custom classes atau tandai sebagai tersembunyi
        try {
          const list = loadCustomClasses();
          const remaining = list.filter(c => String(c.name || '').trim().toLowerCase() !== String(currentClassEntry.name || '').trim().toLowerCase());
          if (remaining.length < list.length) {
            // ada di custom classes, hapus dari sana
            saveCustomClasses(remaining);
          } else {
            // kemungkinan ini adalah kelas default, tandai sebagai tersembunyi
            hideClass(currentClassEntry.name);
          }
        } catch (e) {
          console.warn('Gagal menghapus kelas dari daftar custom', e);
        }

        // hapus semua localStorage terkait kelas ini (adds, deletes, status)
        try {
          const keyAdd = getStorageKey(currentClassEntry.file || currentClassEntry.name);
          const keyDel = getDeleteKey(currentClassEntry.file || currentClassEntry.name);
          const keyStatus = getStatusKeyFor(currentClassEntry);
          if (keyAdd) localStorage.removeItem(keyAdd);
          if (keyDel) localStorage.removeItem(keyDel);
          if (keyStatus) localStorage.removeItem(keyStatus);
        } catch (e) { console.warn('Gagal menghapus localStorage untuk kelas', e); }

        // Aplikasi tidak lagi menghapus file JSON secara otomatis dari
        // filesystem lokal. Jika Anda menyimpan file JSON kelas secara
        // manual di folder project, hapus file tersebut secara manual.

        // reset selection and UI
        currentClassEntry = null;
        currentClass = null;
        currentList = [];
        if (kelasLabel) kelasLabel.textContent = 'Kelas:';
        renderCustomClasses();
        renderSiswa([]);
        updateDeleteButtonState();
      });
    }

    // NEW: tombol unduh — hanya XLSX (opsi CSV dihilangkan)
    const downloadCsvBtn = document.getElementById('download-csv-btn');
    if (downloadCsvBtn) {
      downloadCsvBtn.addEventListener('click', function () {
        try {
          exportAttendanceXLSX();
        } catch (err) {
          console.error('Gagal mengekspor data', err);
          alert('Gagal mengekspor data. Lihat console untuk detail.');
        }
      });
    }
    // Tombol dan fitur File System Access telah dihapus.
});

// helper untuk aman menampilkan teks
    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // render function terpisah
    function renderSiswa(list) {
      const tbody = document.getElementById('siswa-tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      // muat status yang tersimpan untuk kelas saat ini
      const savedStatus = (typeof loadStatusMapForCurrent === 'function') ? loadStatusMapForCurrent() : {};

      list.forEach((s, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${i + 1}</td>
          <td>${escapeHtml(s.nama || '')}</td>
          <td style="text-align:center"><input type="checkbox" data-status="hadir" name="status-${i}"></td>
          <td style="text-align:center"><input type="checkbox" data-status="sakit" name="status-${i}"></td>
          <td style="text-align:center"><input type="checkbox" data-status="izin"  name="status-${i}"></td>
          <td><input type="text" class="alasan" name="alasan-${i}" placeholder="Alasan..." disabled></td>
          <!-- NEW: tombol hapus per baris -->
          <td style="text-align:center"><button class="delete-siswa" data-nama="${escapeHtml(s.nama || '')}">Hapus</button></td>
        `;
        tbody.appendChild(tr);
        // terapkan status tersimpan jika ada
        try {
          const key = String(s.nama || '').trim().toLowerCase();
          const entry = savedStatus && savedStatus[key];
          if (entry) {
            const row = tbody.lastElementChild;
            if (row) {
              const h = row.querySelector('input[data-status="hadir"]');
              const sk = row.querySelector('input[data-status="sakit"]');
              const iz = row.querySelector('input[data-status="izin"]');
              const alasan = row.querySelector('input.alasan');
              if (h) h.checked = entry.status === 'hadir';
              if (sk) sk.checked = entry.status === 'sakit';
              if (iz) iz.checked = entry.status === 'izin';
              if (alasan) {
                alasan.value = entry.alasan || '';
                alasan.disabled = !(entry.status === 'izin');
              }
            }
          }
        } catch (e) { /* ignore */ }
      });
      // update totals setiap kali render selesai
      if (typeof updateTotals === 'function') updateTotals();
    }

    // flag agar delegasi hanya dipasang sekali
    let delegationSetup = false;

    // NEW: state dan helper untuk penambahan siswa lokal
let currentClass = null; // bisa berupa path file atau nama kelas
let currentList = [];    // list yang sedang ditampilkan
    // currentClassEntry menyimpan informasi kelas yang dipilih (nama, file, custom)
    let currentClassEntry = null;

function slugifyForKey(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[^\w\-]/g, '');
}

function getStorageKey(fileOrClass) {
  if (!fileOrClass) return null;
  // jika nampak seperti path/file gunakan itu langsung, else gunakan kelas slug
  if (typeof fileOrClass === 'string' && (/\.json$/i.test(fileOrClass) || fileOrClass.includes('/'))) {
    return 'siswa:add:file:' + slugifyForKey(fileOrClass);
  }
  return 'siswa:add:kelas:' + slugifyForKey(fileOrClass);
}

function saveLocalAdd(key, siswa) {
  if (!key) return;
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    const nama = String(siswa.nama || '').trim();
    const exists = arr.some(x => String(x.nama || '').trim().toLowerCase() === nama.toLowerCase());
    if (!exists) {
      arr.push(siswa);
      localStorage.setItem(key, JSON.stringify(arr));
    } else {
      // jika duplikat, jangan simpan lagi
      console.warn('Tidak menambahkan siswa duplikat di localAdds:', nama);
    }
  } catch (e) {
    console.warn('Gagal menyimpan local add', e);
  }
}

function loadLocalAdds(key) {
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// NEW: storage helper untuk deletion
    function getDeleteKey(fileOrClass) {
      if (!fileOrClass) return null;
      if (typeof fileOrClass === 'string' && (/\.json$/i.test(fileOrClass) || fileOrClass.includes('/'))) {
        return 'siswa:del:file:' + slugifyForKey(fileOrClass);
      }
      return 'siswa:del:kelas:' + slugifyForKey(fileOrClass);
    }

    function saveLocalDelete(key, name) {
      if (!key || !name) return;
      try {
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        // simpan nama secara lowercase untuk konsistensi
        const val = String(name).trim();
        if (!arr.some(x => String(x).trim().toLowerCase() === val.toLowerCase())) {
          arr.push(val);
          localStorage.setItem(key, JSON.stringify(arr));
        }
      } catch (e) { console.warn('Gagal menyimpan delete', e); }
    }

    function loadLocalDeletes(key) {
      if (!key) return [];
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    }

// loadSiswa menerima optional parameter: jika parameter diakhiri .json atau mengandung '/' dianggap path file
    async function loadSiswa(fileOrClass) {
      let data = null;
      let list = [];

      // set currentClass pada awal pemanggilan
      currentClass = fileOrClass || null;

      // Jika diberikan path file (mengandung .json atau slash), coba fetch langsung
      const looksLikeFile = typeof fileOrClass === 'string' && (/\.json$/i.test(fileOrClass) || fileOrClass.includes('/'));
      if (looksLikeFile) {
        try {
          const res = await fetch(fileOrClass);
          if (!res.ok) {
            console.error('Gagal memuat file:', fileOrClass, res.status);
          } else {
            data = await res.json();
            if (Array.isArray(data)) list = data;
            else if (Array.isArray(data.siswa)) list = data.siswa;
          }
        } catch (err) {
          console.error('Error fetch file', fileOrClass, err);
        }
      } else {
        // fallback ke perilaku lama: coba fetch ./data/siswa.json dan filter atau mapping
        try {
          const res = await fetch('./data/siswa.json');
          if (!res.ok) {
            console.warn('siswa.json tidak ditemukan atau error:', res.status);
            data = null;
          } else {
            data = await res.json();
          }
        } catch (err) {
          console.warn('Gagal fetch siswa.json:', err);
          data = null;
        }

        if (data) {
          if (!Array.isArray(data) && typeof data === 'object') {
            if (fileOrClass && data[fileOrClass]) {
              list = data[fileOrClass];
            } else if (!fileOrClass) {
              Object.keys(data).forEach(k => {
                if (Array.isArray(data[k])) list = list.concat(data[k]);
              });
            }
          } else if (Array.isArray(data)) {
            if (fileOrClass) {
              list = data.filter(s => s && s.kelas && typeof s.kelas === 'string' && s.kelas.trim().toLowerCase() === String(fileOrClass).trim().toLowerCase());
            } else {
              list = data;
            }
          }
        }

        // fallback: jika masih kosong dan ada kelas, coba file per-kelas dengan slug
        if ((list.length === 0 || !data) && fileOrClass) {
          const slug = String(fileOrClass).trim().toLowerCase().replace(/\s+/g, '').replace(/[^\w\-]/g, '');
          try {
            const res2 = await fetch(`./data/${slug}.json`);
            if (res2.ok) {
              const d2 = await res2.json();
              if (Array.isArray(d2)) list = d2;
              else if (Array.isArray(d2[fileOrClass])) list = d2[fileOrClass];
            }
          } catch (err) {
            // ignore
          }
        }
      }

      // NEW: gabungkan data lokal (penambahan) jika ada, dengan normalisasi
      const key = getStorageKey(currentClass || (fileOrClass || 'all'));
      if (key) {
        const localAdds = loadLocalAdds(key);
        if (Array.isArray(localAdds) && localAdds.length) {
          localAdds.forEach(l => {
            const nameL = String(l.nama || '').trim().toLowerCase();
            if (!nameL) return;
            const exists = list.some(item => String(item.nama || '').trim().toLowerCase() === nameL);
            if (!exists) {
              const entry = Object.assign({ __local: true }, l);
              list.push(entry);
            }
          });
        }
      }

      // NEW: filter siswa yang sudah dihapus untuk kelas/file ini
      const delKey = getDeleteKey(currentClass || (fileOrClass || 'all'));
      if (delKey) {
        const delList = loadLocalDeletes(delKey).map(x => String(x).trim().toLowerCase());
        if (delList.length) {
          list = list.filter(item => !delList.includes(String(item.nama || '').trim().toLowerCase()));
        }
      }

      if (!Array.isArray(list)) list = [];
      // simpan currentList untuk operasi tambah selanjutnya
      currentList = list.slice();

      renderSiswa(list);

      // pasang delegasi change sekali saja (tambah juga handler klik hapus)
      if (!delegationSetup) {
        const tbody = document.getElementById('siswa-tbody');
        if (tbody) {
          tbody.addEventListener('change', (ev) => {
            const t = ev.target;
            // handle checkbox status changes and alasan input changes
            if (t.matches('input[type="checkbox"][data-status]')) {
              const row = t.closest('tr');
              const checks = row.querySelectorAll('input[type="checkbox"][data-status]');
              if (t.checked) {
                checks.forEach(cb => { if (cb !== t) cb.checked = false; });
              }
              const alasan = row.querySelector('input.alasan');
              const active = row.querySelector('input[type="checkbox"][data-status]:checked');
              if (active && (active.dataset.status === 'izin')) {
                if (alasan) {
                  alasan.disabled = false;
                  // don't focus when loading from storage to avoid UI jump
                  alasan.focus();
                }
              } else {
                if (alasan) {
                  alasan.value = '';
                  alasan.disabled = true;
                }
              }
            } else if (t.matches('input.alasan')) {
              // alasan changed — nothing special beyond saving
            } else {
              return;
            }
            // update totals and persist statuses
            if (typeof updateTotals === 'function') updateTotals();
            if (typeof saveStatusMapForCurrent === 'function') saveStatusMapForCurrent();
          });

          // NEW: delegasi klik untuk tombol hapus
          tbody.addEventListener('click', (ev) => {
            const t = ev.target;
            if (!t.matches('button.delete-siswa')) return;
            const row = t.closest('tr');
            const namaCell = row ? row.querySelector('td:nth-child(2)') : null;
            const nama = namaCell ? namaCell.textContent.trim() : t.dataset.nama || '';
            if (!nama) return;
            if (!confirm(`Hapus siswa "${nama}" dari daftar?`)) return;

            // hapus dari currentList
            currentList = currentList.filter(it => String(it.nama || '').trim().toLowerCase() !== nama.toLowerCase());

            // jika siswa adalah localAdds, hapus dari localAdds; jika bukan, catat di localDeletes
            const addKey = getStorageKey(currentClass);
            const localAdds = loadLocalAdds(addKey);
            const isLocalAdd = Array.isArray(localAdds) && localAdds.some(x => String(x.nama || '').trim().toLowerCase() === nama.toLowerCase());
            if (isLocalAdd) {
              // hapus entri dari localAdds
              try {
                const remaining = localAdds.filter(x => String(x.nama || '').trim().toLowerCase() !== nama.toLowerCase());
                localStorage.setItem(addKey, JSON.stringify(remaining));
              } catch (e) { console.warn('Gagal hapus localAdd', e); }
            } else {
              // simpan ke localDeletes
              const delKey2 = getDeleteKey(currentClass);
              saveLocalDelete(delKey2, nama);
            }

            // render ulang
            renderSiswa(currentList);
            // simpan status setelah penghapusan
            if (typeof saveStatusMapForCurrent === 'function') saveStatusMapForCurrent();
          });

          delegationSetup = true;
        }
      }
    }

    // panggil loadSiswa awal tanpa filter (atau bisa diubah untuk memuat kelas default)
    // loadSiswa('data/12tkj1.json').catch(err => console.error(err));

// function untuk menghitung dan menampilkan totals hadir/sakit/alpha
function updateTotals() {
  const tbody = document.getElementById('siswa-tbody');
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr'));
  let hadir = 0, sakit = 0, izin = 0;
  rows.forEach(row => {
    const h = row.querySelector('input[data-status="hadir"]');
    const s = row.querySelector('input[data-status="sakit"]');
    const iz = row.querySelector('input[data-status="izin"]');
    if (h && h.checked) hadir++;
    if (s && s.checked) sakit++;
    if (iz && iz.checked) izin++;
  });
  const total = rows.length;
  const alpha = Math.max(0, total - (hadir + sakit + izin));
  const elH = document.getElementById('total-hadir');
  const elS = document.getElementById('total-sakit');
  const elA = document.getElementById('total-alpha');
  if (elH) elH.textContent = String(hadir);
  if (elS) elS.textContent = String(sakit);
  if (elA) elA.textContent = String(alpha);
}

// NEW: helper untuk menyimpan/memuat kelas custom
function loadCustomClasses() {
  try {
    const raw = localStorage.getItem('kelas:custom');
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveCustomClasses(arr) {
  try {
    localStorage.setItem('kelas:custom', JSON.stringify(arr || []));
  } catch (e) { console.warn('Gagal menyimpan kelas custom', e); }
}

function renderCustomClasses() {
  // Re-render the kelas list (default + custom)
  if (typeof window.renderKelasList === 'function') {
    window.renderKelasList();
  }
}

// NEW helpers: buat filename dari nama kelas dan simpan/unduh JSON
function filenameFromClass(name) {
  const slug = String(name || '').trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]/g, '');
  return `data/${slug}.json`;
}

async function createAndSaveJson(suggestedFilename, content) {
  // coba gunakan File System Access API save picker
  if (window.showSaveFilePicker) {
    try {
      const opts = {
        suggestedName: suggestedFilename.split('/').pop(),
        types: [{
          description: 'JSON file',
          accept: { 'application/json': ['.json'] }
        }]
      };
      const handle = await window.showSaveFilePicker(opts);
      const writable = await handle.createWritable();
      await writable.write(new Blob([content], { type: 'application/json' }));
      await writable.close();
      alert('File berhasil disimpan.');
      return;
    } catch (err) {
      console.warn('showSaveFilePicker gagal/ditolak:', err);
    }
  }

  // fallback: buat link download blob untuk disimpan user
  try {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedFilename.split('/').pop();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    alert('File diunduh (simpan manual ke folder project jika ingin aplikasi membacanya).');
    return;
  } catch (err) {
    throw err;
  }
}

// Note: File System Access (directory handle) support removed to avoid direct
// filesystem operations. File creation/download will use the save picker or
// download fallback.

// --- Attendance status persistence helpers ---
function getStatusKeyForCurrent() {
  const base = currentClass || 'all';
  return 'siswa:status:' + slugifyForKey(base);
}

function saveStatusMapForCurrent() {
  try {
    const tbody = document.getElementById('siswa-tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const map = {};
    rows.forEach(row => {
      const nameCell = row.querySelector('td:nth-child(2)');
      if (!nameCell) return;
      const name = String(nameCell.textContent || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      const h = row.querySelector('input[data-status="hadir"]');
      const s = row.querySelector('input[data-status="sakit"]');
      const iz = row.querySelector('input[data-status="izin"]');
      const alasan = row.querySelector('input.alasan');
      let status = '';
      if (h && h.checked) status = 'hadir';
      else if (s && s.checked) status = 'sakit';
      else if (iz && iz.checked) status = 'izin';
      map[key] = { status: status, alasan: (alasan ? (alasan.value || '') : '') };
    });
    const skey = getStatusKeyForCurrent();
    localStorage.setItem(skey, JSON.stringify(map));
  } catch (e) { console.warn('Gagal menyimpan status ke localStorage', e); }
}

function loadStatusMapForCurrent() {
  try {
    const skey = getStatusKeyForCurrent();
    const raw = localStorage.getItem(skey);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

// NEW helper: compute status key for an arbitrary class entry (not necessarily current)
function getStatusKeyFor(entry) {
  const base = (entry && (entry.file || entry.name)) || 'all';
  return 'siswa:status:' + slugifyForKey(base);
}

// NEW helper: enable/disable delete button depending on selection
function updateDeleteButtonState() {
  const btn = document.getElementById('delete-kelas-btn');
  if (!btn) return;
  if (currentClassEntry && currentClassEntry.custom) {
    btn.disabled = false;
  } else {
    btn.disabled = true;
  }
}

// File System Access helpers removed. The app now relies on browser save
// picker and download fallback for creating JSON files. Physical file
// deletion from a chosen folder is no longer attempted by the app.

// NEW: Helpers untuk mengelola kelas yang tidak dihapus
function getHiddenClasses() {
  try {
    const raw = localStorage.getItem('kelas:hidden');
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveHiddenClasses(arr) {
  try {
    localStorage.setItem('kelas:hidden', JSON.stringify(arr || []));
  } catch (e) { console.warn('Gagal menyimpan kelas tersembunyi', e); }
}

function isClassHidden(name) {
  const hidden = getHiddenClasses();
  return hidden.some(c => String(c || '').trim().toLowerCase() === String(name || '').trim().toLowerCase());
}

function hideClass(name) {
  const hidden = getHiddenClasses();
  if (!isClassHidden(name)) {
    hidden.push(String(name).trim());
    saveHiddenClasses(hidden);
  }
}

function showClass(name) {
  const hidden = getHiddenClasses();
  const filtered = hidden.filter(c => String(c || '').trim().toLowerCase() !== String(name || '').trim().toLowerCase());
  saveHiddenClasses(filtered);
}

// Export current attendance table to CSV (Excel can open CSV)
function exportAttendanceCSV() {
  const tbody = document.getElementById('siswa-tbody');
  if (!tbody) {
    alert('Tidak ada data siswa untuk diekspor.');
    return;
  }
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (rows.length === 0) {
    alert('Tidak ada data siswa untuk diekspor.');
    return;
  }

  // Build CSV lines (include Alasan column)
  const lines = [];
  // header
  lines.push(['Nama', 'Jenis Kehadiran', 'Alasan'].join(','));

  let hadir = 0, sakit = 0, izin = 0, alpha = 0;

  rows.forEach(row => {
    const nameCell = row.querySelector('td:nth-child(2)');
    const nama = nameCell ? String(nameCell.textContent || '').trim() : '';
    const h = row.querySelector('input[data-status="hadir"]');
    const s = row.querySelector('input[data-status="sakit"]');
    const iz = row.querySelector('input[data-status="izin"]');
    const alasanEl = row.querySelector('input.alasan');
    const alasanVal = alasanEl ? String(alasanEl.value || '').trim() : '';
    let status = 'alpha';
    if (h && h.checked) { status = 'hadir'; hadir++; }
    else if (s && s.checked) { status = 'sakit'; sakit++; }
    else if (iz && iz.checked) { status = 'izin'; izin++; }
    else { alpha++; }

    // escape values that may contain commas/quotes
    const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
    lines.push([esc(nama), esc(status), esc(status === 'izin' ? alasanVal : '')].join(','));
  });

  // blank line then totals
  lines.push('');
  lines.push(['Totals', 'Hadir', 'Sakit', 'Izin', 'Alpha'].join(','));
  lines.push(['', hadir, sakit, izin, alpha].join(','));

  const csvContent = lines.join('\n');

  // file name based on class selection
  const kelasName = (currentClassEntry && currentClassEntry.name) ? String(currentClassEntry.name).replace(/\s+/g, '_') : 'kelas';
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const filename = `absensi_${kelasName}_${y}${m}${d}.csv`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Export attendance as XLSX using SheetJS
function exportAttendanceXLSX() {
  if (typeof XLSX === 'undefined') {
    alert('Library XLSX tidak tersedia. Pastikan koneksi internet aktif untuk memuat dependensi.');
    return;
  }
  const tbody = document.getElementById('siswa-tbody');
  if (!tbody) {
    alert('Tidak ada data siswa untuk diekspor.');
    return;
  }
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (rows.length === 0) {
    alert('Tidak ada data siswa untuk diekspor.');
    return;
  }

  // Build array of arrays for sheet
  const aoa = [];
  aoa.push(['Nama', 'Jenis Kehadiran', 'Alasan']);

  let hadir = 0, sakit = 0, izin = 0, alpha = 0;

  rows.forEach(row => {
    const nameCell = row.querySelector('td:nth-child(2)');
    const nama = nameCell ? String(nameCell.textContent || '').trim() : '';
    const h = row.querySelector('input[data-status="hadir"]');
    const s = row.querySelector('input[data-status="sakit"]');
    const iz = row.querySelector('input[data-status="izin"]');
    const alasanEl = row.querySelector('input.alasan');
    const alasanVal = alasanEl ? String(alasanEl.value || '').trim() : '';
    let status = 'alpha';
    if (h && h.checked) { status = 'hadir'; hadir++; }
    else if (s && s.checked) { status = 'sakit'; sakit++; }
    else if (iz && iz.checked) { status = 'izin'; izin++; }
    else { alpha++; }

    aoa.push([nama, status, status === 'izin' ? alasanVal : '']);
  });

  // blank row then totals
  aoa.push([]);
  aoa.push(['Totals', 'Hadir', 'Sakit', 'Izin', 'Alpha']);
  aoa.push(['', hadir, sakit, izin, alpha]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Absensi');

  const kelasName = (currentClassEntry && currentClassEntry.name) ? String(currentClassEntry.name).replace(/\s+/g, '_') : 'kelas';
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const filename = `absensi_${kelasName}_${y}${m}${d}.xlsx`;

  try {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Gagal membuat XLSX', err);
    alert('Gagal membuat file XLSX. Periksa console untuk detail.');
  }
}