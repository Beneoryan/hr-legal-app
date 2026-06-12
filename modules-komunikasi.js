'use strict';
// ── MEETING & INVITE — Per Akun Karyawan ──────────────────────
// Setiap meeting dikirim langsung ke inbox masing-masing user
// Dipisah berdasarkan user head (pembuat meeting)
// ══════════════════════════════════════════════════════════════

async function renderMeeting() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page-title"><span>📅 Meeting & Invite</span><div class="flex gap-8"><button class="btn btn-success btn-sm" onclick="startInstantMeeting()">🎥 Meeting Online Sekarang</button><button class="btn btn-primary btn-sm" onclick="modalMeetingCreate()">+ Buat Meeting</button></div></div>
    <div class="tabs">
      <div class="tab active" onclick="loadMeetingTab('saya')">📤 Meeting Saya (Dibuat)</div>
      <div class="tab" onclick="loadMeetingTab('semua')">📋 Semua Meeting</div>
      <div class="tab" onclick="loadMeetingTab('online')">🎥 Meeting Online</div>
    </div>
    <div id="meetingContent">Loading...</div>`;
  loadMeetingTab('saya');
}

async function loadMeetingTab(tab) {
  document.querySelectorAll('.tabs .tab').forEach((t, i) => {
    t.classList.toggle(
      'active',
      (tab === 'saya' && i === 0) || (tab === 'semua' && i === 1) || (tab === 'online' && i === 2)
    );
  });

  if (tab === 'online') {
    // Show online meetings
    const snap = await db.collection('hrd_online_meeting').get();
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    let html = '<div class="card">';
    if (!items.length)
      html +=
        '<div class="empty-state"><div class="icon">🎥</div><p>Belum ada meeting online. Klik "Meeting Online Sekarang" untuk memulai.</p></div>';
    else {
      html +=
        '<div class="table-wrap"><table><thead><tr><th>Judul</th><th>Pembuat</th><th>Tanggal</th><th>Peserta</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
      items.forEach((m) => {
        const isActive = m.status === 'active';
        const canManage = m.createdBy === currentUser.id || hasAccess(4);
        html += `<tr><td class="fw-700">${escHtml(m.judul || 'Meeting Online')}</td><td>${escHtml(m.createdByName || '-')}</td><td>${formatDateTime(m.createdAt)}</td><td>${(m.pesertaNames || []).length + 1} orang</td><td><span class="badge badge-${isActive ? 'success' : 'default'}">${isActive ? '🟢 Aktif' : 'Selesai'}</span></td><td><button class="btn btn-xs btn-info" onclick="viewOnlineMeeting('${m.id}')">👁️</button>${isActive ? ` <button class="btn btn-xs btn-success" onclick="joinOnlineMeeting('${m.roomId}')">🎥</button>` : ''}${canManage && isActive ? ` <button class="btn btn-xs btn-primary" onclick="editOnlineMeeting('${m.id}')">✏️</button> <button class="btn btn-xs btn-warning" onclick="modalNotulensiOnline('${m.id}')">📝</button> <button class="btn btn-xs btn-danger" onclick="hapusOnlineMeeting('${m.id}')">🗑️</button>` : ''}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';
    document.getElementById('meetingContent').innerHTML = html;
    return;
  }

  let snap;
  if (tab === 'saya') {
    snap = await db.collection('hrd_meeting').where('createdBy', '==', currentUser.id).get();
  } else {
    snap = await db.collection('hrd_meeting').get();
  }
  let html = '<div class="card">';
  if (snap.empty) {
    html += '<div class="empty-state"><div class="icon">📅</div><p>Belum ada meeting</p></div>';
  } else {
    html +=
      '<div class="table-wrap"><table><thead><tr><th>Judul</th><th>Tanggal</th><th>Waktu</th><th>Pembuat</th><th>Peserta</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
    snap.forEach((d) => {
      const p = d.data();
      const isSelesai = p.status === 'selesai' || p.status === 'dibatalkan';
      const canManage = p.createdBy === currentUser.id || hasAccess(4);
      const statusBadge =
        p.status === 'selesai'
          ? '<span class="badge badge-default">Selesai</span>'
          : p.status === 'dibatalkan'
            ? '<span class="badge badge-danger">Dibatalkan</span>'
            : p.status === 'berlangsung'
              ? '<span class="badge badge-success">Berlangsung</span>'
              : '<span class="badge badge-info">Terjadwal</span>';
      html += `<tr>
        <td class="fw-700">${escHtml(p.judul)}</td>
        <td>${formatDate(p.tanggal)}</td>
        <td>${p.waktu || '-'}</td>
        <td><span class="badge badge-primary">${escHtml(p.createdByName || '-')}</span></td>
        <td>${(p.pesertaIds || []).length} orang</td>
        <td>${statusBadge}</td>
        <td><button class="btn btn-xs btn-info" onclick="detailMeeting('${d.id}')">👁️</button>${isSelesai ? '' : ` <button class="btn btn-xs btn-warning" onclick="modalNotulensi('${d.id}')">📝</button>${p.onlineRoomId ? ` <button class="btn btn-xs btn-success" onclick="joinOnlineMeeting('${p.onlineRoomId}')">🎥</button>` : ''}${canManage ? ` <button class="btn btn-xs btn-primary" onclick="editMeeting('${d.id}')">✏️</button> <button class="btn btn-xs btn-danger" onclick="hapusMeeting('${d.id}')">🗑️</button>` : ''}`}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }
  html += '</div>';
  document.getElementById('meetingContent').innerHTML = html;
}

async function modalMeetingCreate() {
  // Load semua user aktif untuk dipilih sebagai peserta
  const users = await getAllUsers();
  // Group by department for filtering
  const depts = new Set();
  users.forEach((u) => {
    if (u.departemen) depts.add(u.departemen);
  });
  let deptOpts = '<option value="general">🌐 General (Lintas Divisi)</option>';
  [...depts].sort().forEach((d) => {
    deptOpts += `<option value="${escHtml(d)}">${escHtml(d)}</option>`;
  });

  let checkboxes = '';
  users.forEach((u) => {
    if (u.id !== currentUser.id) {
      checkboxes += `<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:.82rem;cursor:pointer" data-dept="${escHtml(u.departemen || 'Lainnya')}"><input type="checkbox" class="mtPeserta" value="${u.id}" data-nama="${escHtml(u.nama)}" data-dept="${escHtml(u.departemen || '')}"> ${escHtml(u.nama)} <span class="text-xs" style="color:#999">(${escHtml(u.departemen || '-')})</span></label>`;
    }
  });

  openModal(
    `<div class="modal-title">📅 Buat Meeting & Undang Peserta</div>
    <div class="form-group"><label>Judul Meeting</label><input class="form-control" id="mtJudul"></div>
    <div class="grid-3">
      <div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="mtTgl" value="${todayStr()}"></div>
      <div class="form-group"><label>Waktu</label><input class="form-control" type="time" id="mtWaktu"></div>
      <div class="form-group"><label>Durasi (menit)</label><input class="form-control" type="number" id="mtDurasi" value="60"></div>
    </div>
    <div class="form-group"><label>Lokasi / Link</label><input class="form-control" id="mtLokasi"></div>
    <div class="form-group"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="mtOnline"> 🎥 Sertakan Meeting Online (Video Call)</label><div class="text-xs" style="color:#666;margin-top:4px">Otomatis generate room video call. Peserta bisa join langsung dari undangan.</div></div>
    <div class="form-group"><label>Tipe Meeting</label><select class="form-control" id="mtTipeMeeting" onchange="filterMeetingPeserta()">${deptOpts}</select><div class="text-xs mt-4" style="color:#666">General = lintas divisi. Pilih divisi tertentu untuk meeting internal.</div></div>
    <div class="form-group"><label>Agenda</label><textarea class="form-control" id="mtAgenda"></textarea></div>
    <div class="form-group"><label>📤 Undang Peserta:</label>
      <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px 12px;margin-top:4px" id="mtPesertaContainer">
        ${checkboxes || '<p class="text-sm" style="color:#999">Tidak ada user lain</p>'}
      </div>
    </div>
    <button class="btn btn-primary" onclick="simpanMeeting()">📤 Simpan & Kirim Undangan</button>`,
    true
  );
}

function filterMeetingPeserta() {
  const tipe = document.getElementById('mtTipeMeeting')?.value || 'general';
  const container = document.getElementById('mtPesertaContainer');
  if (!container) return;
  const labels = container.querySelectorAll('label[data-dept]');
  labels.forEach((label) => {
    const dept = label.dataset.dept;
    const cb = label.querySelector('input[type="checkbox"]');
    if (tipe === 'general') {
      label.style.display = '';
    } else {
      if (dept === tipe) {
        label.style.display = '';
        if (cb) cb.checked = true;
      } else {
        label.style.display = 'none';
        if (cb) cb.checked = false;
      }
    }
  });
}

async function simpanMeeting() {
  const judul = document.getElementById('mtJudul').value;
  if (!judul) return toast('Judul wajib', 'warning');

  // Collect selected peserta
  const checkboxes = document.querySelectorAll('.mtPeserta:checked');
  const pesertaIds = [];
  const pesertaNames = [];
  checkboxes.forEach((cb) => {
    pesertaIds.push(cb.value);
    pesertaNames.push(cb.dataset.nama);
  });

  // Generate online meeting room if checked
  const isOnline = document.getElementById('mtOnline')?.checked;
  const roomId = isOnline ? 'ijef-' + generateId() : '';

  const data = {
    judul,
    tanggal: document.getElementById('mtTgl').value,
    waktu: document.getElementById('mtWaktu').value,
    durasi: Number(document.getElementById('mtDurasi').value) || 60,
    lokasi: document.getElementById('mtLokasi').value || (isOnline ? 'Online (Video Call)' : ''),
    agenda: document.getElementById('mtAgenda').value,
    pesertaIds,
    pesertaNames,
    rsvp: {},
    notulensi: '',
    status: 'terjadwal',
    onlineRoomId: roomId,
    isOnline: isOnline || false,
    tipeMeeting: document.getElementById('mtTipeMeeting')?.value || 'general',
    targetDepartemen:
      document.getElementById('mtTipeMeeting')?.value === 'general'
        ? 'all'
        : document.getElementById('mtTipeMeeting')?.value || 'all',
    createdBy: currentUser.id,
    createdByName: currentUser.nama,
    createdAt: new Date().toISOString(),
  };

  const docRef = await db.collection('hrd_meeting').add(data);

  // Kirim undangan ke inbox masing-masing peserta
  if (pesertaIds.length > 0) {
    const onlineInfo = isOnline ? ` 🎥 Video Call tersedia — Join dari undangan.` : '';
    await sendNotificationBulk(
      pesertaIds,
      '📅 Undangan Meeting' + (isOnline ? ' (Online)' : ''),
      `${currentUser.nama} mengundang Anda ke meeting "${judul}" pada ${formatDate(data.tanggal)} ${data.waktu}${onlineInfo}`,
      'inbox'
    );
    // Simpan invite per user di collection terpisah
    const batch = db.batch();
    pesertaIds.forEach((uid) => {
      const ref = db.collection('hrd_meeting_invites').doc();
      batch.set(ref, {
        meetingId: docRef.id,
        targetUser: uid,
        fromUser: currentUser.id,
        fromName: currentUser.nama,
        judul: data.judul,
        tanggal: data.tanggal,
        waktu: data.waktu,
        lokasi: data.lokasi,
        onlineRoomId: roomId,
        isOnline: isOnline || false,
        rsvpStatus: 'pending',
        read: false,
        createdAt: new Date().toISOString(),
      });
    });
    await batch.commit();
  }

  closeModalDirect();
  toast(`Meeting dibuat & undangan terkirim ke ${pesertaIds.length} orang`, 'success');
  renderMeeting();
}

function detailMeeting(id) {
  db.collection('hrd_meeting')
    .doc(id)
    .get()
    .then((d) => {
      const p = d.data();
      const isSelesai = p.status === 'selesai' || p.status === 'dibatalkan';
      let rsvpHtml = '';
      (p.pesertaNames || []).forEach((name, i) => {
        const uid = (p.pesertaIds || [])[i];
        const status = (p.rsvp || {})[uid] || 'pending';
        rsvpHtml += `<div style="padding:4px 0;font-size:.82rem;display:flex;align-items:center;gap:8px">
        <span class="badge badge-${status === 'hadir' ? 'success' : status === 'tidak' ? 'danger' : 'warning'}">${status}</span>
        <span>${escHtml(name)}</span>
      </div>`;
      });
      openModal(
        `<div class="modal-title">📅 ${escHtml(p.judul)}</div>
      <div class="grid-2 mb-16">
        <div><b>Tanggal:</b> ${formatDate(p.tanggal)}</div>
        <div><b>Waktu:</b> ${p.waktu} (${p.durasi} menit)</div>
        <div><b>Lokasi:</b> ${escHtml(p.lokasi || '-')}</div>
        <div><b>Pembuat:</b> ${escHtml(p.createdByName)}</div>
        <div><b>Status:</b> <span class="badge badge-${isSelesai ? 'default' : 'info'}">${escHtml(p.status || 'terjadwal')}</span></div>
      </div>
      <div class="mb-16"><b>Agenda:</b><div class="text-sm mt-8">${escHtml(p.agenda || '-')}</div></div>
      <div class="mb-16"><b>RSVP Peserta:</b>${rsvpHtml || '<p class="text-sm" style="color:#999">Belum ada peserta</p>'}</div>
      ${isSelesai ? '<div class="mb-16"><span class="badge badge-default">Meeting telah selesai</span></div>' : p.onlineRoomId ? `<div class="mb-16"><button class="btn btn-success btn-sm" onclick="joinOnlineMeeting('${p.onlineRoomId}')">🎥 Join Video Call</button></div>` : ''}
      ${p.notulensi ? `<div><b>Notulensi:</b><div class="text-sm mt-8" style="white-space:pre-wrap">${escHtml(p.notulensi)}</div></div>` : ''}`,
        true
      );
    });
}

async function editMeeting(id) {
  const d = await db.collection('hrd_meeting').doc(id).get();
  const p = d.data();
  openModal(
    `<div class="modal-title">✏️ Edit Meeting</div>
    <div class="form-group"><label>Judul</label><input class="form-control" id="emJudul" value="${escHtml(p.judul || '')}"></div>
    <div class="grid-3">
      <div class="form-group"><label>Tanggal</label><input class="form-control" type="date" id="emTgl" value="${p.tanggal || ''}"></div>
      <div class="form-group"><label>Waktu</label><input class="form-control" type="time" id="emWaktu" value="${p.waktu || ''}"></div>
      <div class="form-group"><label>Durasi (menit)</label><input class="form-control" type="number" id="emDurasi" value="${p.durasi || 60}"></div>
    </div>
    <div class="form-group"><label>Lokasi</label><input class="form-control" id="emLokasi" value="${escHtml(p.lokasi || '')}"></div>
    <div class="form-group"><label>Agenda</label><textarea class="form-control" id="emAgenda" style="min-height:100px">${escHtml(p.agenda || '')}</textarea></div>
    <div class="form-group"><label>Status</label><select class="form-control" id="emStatus"><option value="terjadwal" ${p.status === 'terjadwal' ? 'selected' : ''}>Terjadwal</option><option value="berlangsung" ${p.status === 'berlangsung' ? 'selected' : ''}>Berlangsung</option><option value="selesai" ${p.status === 'selesai' ? 'selected' : ''}>Selesai</option><option value="dibatalkan" ${p.status === 'dibatalkan' ? 'selected' : ''}>Dibatalkan</option></select></div>
    <button class="btn btn-primary" onclick="simpanEditMeeting('${id}')">💾 Simpan</button>`,
    true
  );
}

async function simpanEditMeeting(id) {
  const data = {
    judul: document.getElementById('emJudul').value,
    tanggal: document.getElementById('emTgl').value,
    waktu: document.getElementById('emWaktu').value,
    durasi: Number(document.getElementById('emDurasi').value) || 60,
    lokasi: document.getElementById('emLokasi').value,
    agenda: document.getElementById('emAgenda').value,
    status: document.getElementById('emStatus').value,
    updatedAt: new Date().toISOString(),
  };
  if (!data.judul) return toast('Judul wajib', 'warning');
  await db.collection('hrd_meeting').doc(id).update(data);
  // If status changed to selesai, mark related invites
  if (data.status === 'selesai') {
    try {
      const invSnap = await db.collection('hrd_meeting_invites').where('meetingId', '==', id).get();
      const batch = db.batch();
      invSnap.forEach((d) => batch.update(d.ref, { meetingClosed: true }));
      if (!invSnap.empty) await batch.commit();
    } catch (e) {
      /* non-critical */
    }
  }
  closeModalDirect();
  toast('Meeting diupdate', 'success');
  renderMeeting();
}

async function hapusMeeting(id) {
  if (!confirm('Hapus/akhiri meeting ini?')) return;
  await db.collection('hrd_meeting').doc(id).delete();
  toast('Meeting dihapus', 'success');
  renderMeeting();
}

function modalNotulensi(id) {
  db.collection('hrd_meeting')
    .doc(id)
    .get()
    .then((d) => {
      const p = d.data();
      openModal(`<div class="modal-title">📝 Notulensi: ${escHtml(p.judul)}</div>
      <div class="form-group"><label>Notulensi</label><textarea class="form-control" id="notulIsi" style="min-height:200px">${escHtml(p.notulensi || '')}</textarea></div>
      <button class="btn btn-primary" onclick="simpanNotulensi('${id}')">Simpan</button>`);
    });
}
async function simpanNotulensi(id) {
  await db
    .collection('hrd_meeting')
    .doc(id)
    .update({ notulensi: document.getElementById('notulIsi').value, status: 'selesai' });
  // Mark related invites as meetingClosed
  try {
    const invSnap = await db.collection('hrd_meeting_invites').where('meetingId', '==', id).get();
    const batch = db.batch();
    invSnap.forEach((d) => batch.update(d.ref, { meetingClosed: true }));
    if (!invSnap.empty) await batch.commit();
  } catch (e) {
    /* non-critical */
  }
  closeModalDirect();
  toast('Notulensi disimpan', 'success');
  renderMeeting();
}

// ══════════════════════════════════════════════════════════════
// ── MEETING ONLINE — Jitsi Meet Integration ───────────────────
// ══════════════════════════════════════════════════════════════

async function startInstantMeeting() {
  const users = await getAllUsers();
  let checkboxes = '';
  users.forEach((u) => {
    if (u.id !== currentUser.id)
      checkboxes += `<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:.82rem;cursor:pointer"><input type="checkbox" class="omPeserta" value="${u.id}" data-nama="${escHtml(u.nama)}"> ${escHtml(u.nama)} <span class="text-xs" style="color:#999">(${escHtml(u.departemen || '-')})</span></label>`;
  });
  openModal(
    `<div class="modal-title">🎥 Mulai Meeting Online Sekarang</div>
    <p class="text-sm mb-16" style="color:#666">Buat room video call dan undang peserta. Peserta akan menerima notifikasi & bisa join langsung dari aplikasi.</p>
    <div class="form-group"><label>Judul Meeting</label><input class="form-control" id="omJudul" placeholder="Contoh: Rapat Mingguan"></div>
    <div class="form-group"><label>📤 Undang Peserta:</label>
      <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px 12px;margin-top:4px">
        <label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:.82rem;cursor:pointer;color:var(--primary);font-weight:700"><input type="checkbox" id="omSelectAll" onchange="document.querySelectorAll('.omPeserta').forEach(c=>c.checked=this.checked)"> Pilih Semua</label>
        <hr style="margin:4px 0;border:none;border-top:1px solid var(--border)">
        ${checkboxes}
      </div>
    </div>
    <div class="flex gap-8 mt-16">
      <button class="btn btn-success" onclick="createAndJoinMeeting()" style="flex:1;padding:14px;font-size:1rem">🎥 Mulai Video Call</button>
      <button class="btn btn-info" onclick="createAndJoinMeeting('audio')" style="padding:14px">🎤 Voice Only</button>
    </div>`,
    true
  );
}

async function createAndJoinMeeting(mode) {
  const judul = document.getElementById('omJudul').value || 'Meeting Online';
  const roomId = 'ijef-' + generateId();
  // Collect peserta
  const checkboxes = document.querySelectorAll('.omPeserta:checked');
  const pesertaIds = [],
    pesertaNames = [];
  checkboxes.forEach((cb) => {
    pesertaIds.push(cb.value);
    pesertaNames.push(cb.dataset.nama);
  });

  // Save to Firestore
  await db.collection('hrd_online_meeting').add({
    judul,
    roomId,
    createdBy: currentUser.id,
    createdByName: currentUser.nama,
    pesertaIds,
    pesertaNames,
    mode: mode || 'video',
    status: 'active',
    createdAt: new Date().toISOString(),
  });

  // Send invite notifications to all peserta
  if (pesertaIds.length > 0) {
    await sendNotificationBulk(
      pesertaIds,
      '🎥 Meeting Online Dimulai',
      `${currentUser.nama} mengundang Anda ke meeting online "${judul}". Klik untuk join sekarang!`,
      'meeting'
    );
    // Save invite per user
    const batch = db.batch();
    pesertaIds.forEach((uid) => {
      batch.set(db.collection('hrd_meeting_invites').doc(), {
        meetingId: roomId,
        targetUser: uid,
        fromUser: currentUser.id,
        fromName: currentUser.nama,
        meetingTitle: judul,
        judul: `🎥 ${judul}`,
        tanggal: todayStr(),
        waktu: new Date().toTimeString().slice(0, 5),
        lokasi: 'Online Video Call',
        onlineRoomId: roomId,
        isOnline: true,
        status: 'pending',
        read: false,
        createdAt: new Date().toISOString(),
      });
    });
    await batch.commit();
  }

  closeModalDirect();
  toast(`Meeting online dimulai! ${pesertaIds.length} undangan terkirim.`, 'success');
  // Join the meeting
  joinOnlineMeeting(roomId, mode);
}

async function joinOnlineMeeting(roomId, mode) {
  // Check if the online meeting has ended or hasn't started yet
  try {
    const meetSnap = await db
      .collection('hrd_online_meeting')
      .where('roomId', '==', roomId)
      .limit(1)
      .get();
    if (!meetSnap.empty) {
      const meetData = meetSnap.docs[0].data();
      if (meetData.status === 'ended') {
        toast('Meeting ini sudah berakhir', 'warning');
        return;
      }
    }
    // Also check scheduled meeting time (15 min before rule)
    const meetRegSnap = await db
      .collection('hrd_meeting')
      .where('onlineRoomId', '==', roomId)
      .limit(1)
      .get();
    if (!meetRegSnap.empty) {
      const meetReg = meetRegSnap.docs[0].data();
      if (meetReg.tanggal && meetReg.waktu && meetReg.status === 'terjadwal') {
        const meetTime = new Date(`${meetReg.tanggal}T${meetReg.waktu}`);
        const now = new Date();
        const diffMin = (meetTime - now) / 60000;
        if (diffMin > 15) {
          const jamMulai = meetReg.waktu || '-';
          toast(
            `Meeting belum bisa diakses. Link aktif 15 menit sebelum jadwal (${formatDate(meetReg.tanggal)} ${jamMulai})`,
            'warning'
          );
          return;
        }
      }
    }
  } catch (e) {
    /* proceed if check fails */
  }
  const jitsiDomain = 'meet.jit.si';
  const displayName = encodeURIComponent(currentUser.nama);
  let url = `https://${jitsiDomain}/${roomId}#userInfo.displayName=%22${displayName}%22`;
  if (mode === 'audio') url += `&config.startWithVideoMuted=true`;

  // Open in modal (embedded) or new tab based on device
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.open(url, '_blank');
    toast('Meeting dibuka di tab baru', 'info');
  } else {
    // Store URL globally so buttons can access it
    window._currentMeetingUrl = url;
    window._currentMeetingRoom = roomId;
    openModal(
      `<div class="modal-title">🎥 Meeting Online</div>
      <div style="margin-bottom:8px" class="flex gap-8">
        <button class="btn btn-sm btn-info" onclick="window.open(window._currentMeetingUrl,'_blank');closeModalDirect();">↗️ Buka di Tab Baru</button>
        <button class="btn btn-sm btn-outline" onclick="copyMeetingLink(window._currentMeetingRoom)">📋 Salin Link</button>
        <button class="btn btn-sm btn-warning" onclick="shareMeetingWA(window._currentMeetingRoom,'Meeting')">💬 Share WA</button>
      </div>
      <div style="border-radius:12px;overflow:hidden;border:2px solid var(--primary)">
        <iframe src="${url}" style="width:100%;height:500px;border:none" allow="camera;microphone;display-capture;autoplay;clipboard-write"></iframe>
      </div>
      <div class="text-xs mt-8" style="color:#999">💡 Tips: Klik "↗️ Buka di Tab Baru" untuk pengalaman full-screen. Fitur: Video Call, Voice Call, Screen Share, Chat.</div>`,
      true
    );
  }
}

function copyMeetingLink(roomId) {
  const url = `https://meet.jit.si/${roomId}`;
  navigator.clipboard
    .writeText(url)
    .then(() => toast('Link meeting disalin!', 'success'))
    .catch(() => {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      toast('Link disalin', 'success');
    });
}

function shareMeetingWA(roomId, judul) {
  const url = `https://meet.jit.si/${roomId}`;
  const text = `🎥 *Meeting Online — ${decodeURIComponent(judul)}*\n\nJoin sekarang:\n${url}\n\n— IJEF Corp HRD`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

async function endOnlineMeeting(id) {
  if (!confirm('Akhiri meeting online ini?')) return;
  const meetDoc = await db.collection('hrd_online_meeting').doc(id).get();
  const meetData = meetDoc.data();
  await db
    .collection('hrd_online_meeting')
    .doc(id)
    .update({ status: 'ended', endedAt: new Date().toISOString() });
  // Propagate meetingClosed to related invite records
  if (meetData && meetData.roomId) {
    try {
      const invSnap = await db
        .collection('hrd_meeting_invites')
        .where('meetingId', '==', meetData.roomId)
        .get();
      const batch = db.batch();
      invSnap.forEach((d) => batch.update(d.ref, { meetingClosed: true }));
      if (!invSnap.empty) await batch.commit();
    } catch (e) {
      /* non-critical */
    }
  }
  toast('Meeting diakhiri', 'success');
  loadMeetingTab('online');
}

async function viewOnlineMeeting(id) {
  const d = await db.collection('hrd_online_meeting').doc(id).get();
  const p = d.data();
  const pesertaList =
    (p.pesertaNames || [])
      .map((n) => `<span class="badge badge-primary" style="margin:2px">${escHtml(n)}</span>`)
      .join(' ') || '<span class="text-sm" style="color:#999">-</span>';
  openModal(
    `<div class="modal-title">🎥 Detail Meeting Online</div>
    <div class="grid-2 mb-16" style="font-size:.85rem">
      <div><b>Judul:</b> ${escHtml(p.judul || 'Meeting Online')}</div>
      <div><b>Pembuat:</b> ${escHtml(p.createdByName || '-')}</div>
      <div><b>Tanggal:</b> ${formatDateTime(p.createdAt)}</div>
      <div><b>Mode:</b> ${p.mode === 'audio' ? '🎤 Voice Only' : '🎥 Video Call'}</div>
      <div><b>Status:</b> <span class="badge badge-${p.status === 'active' ? 'success' : 'default'}">${p.status === 'active' ? 'Aktif' : 'Selesai'}</span></div>
      <div><b>Room ID:</b> <span class="text-xs">${escHtml(p.roomId || '-')}</span></div>
    </div>
    <div class="mb-16"><b>Peserta:</b><div class="mt-8">${pesertaList}</div></div>
    ${p.notulensi ? `<div class="mb-16"><b>📝 Notulensi:</b><div class="mt-8" style="background:#f8f9ff;padding:12px;border-radius:8px;font-size:.85rem;white-space:pre-wrap">${escHtml(p.notulensi)}</div></div>` : ''}
    <div class="flex gap-8">
      <button class="btn btn-success btn-sm" onclick="joinOnlineMeeting('${p.roomId}')">🎥 Join Meeting</button>
      <button class="btn btn-warning btn-sm" onclick="closeModalDirect();modalNotulensiOnline('${id}')">📝 Notulensi</button>
      <button class="btn btn-info btn-sm" onclick="closeModalDirect();generateNotulensiAI('${id}')">🤖 Generate Notulensi AI</button>
    </div>`,
    true
  );
}

async function editOnlineMeeting(id) {
  const d = await db.collection('hrd_online_meeting').doc(id).get();
  const p = d.data();
  openModal(`<div class="modal-title">✏️ Edit Meeting Online</div>
    <div class="form-group"><label>Judul</label><input class="form-control" id="eomJudul" value="${escHtml(p.judul || '')}"></div>
    <div class="form-group"><label>Status</label><select class="form-control" id="eomStatus"><option value="active" ${p.status === 'active' ? 'selected' : ''}>Aktif</option><option value="ended" ${p.status === 'ended' ? 'selected' : ''}>Selesai</option></select></div>
    <div class="form-group"><label>Notulensi</label><textarea class="form-control" id="eomNotulensi" style="min-height:120px">${escHtml(p.notulensi || '')}</textarea></div>
    <button class="btn btn-primary" onclick="simpanEditOnlineMeeting('${id}')">💾 Simpan</button>`);
}

async function simpanEditOnlineMeeting(id) {
  await db
    .collection('hrd_online_meeting')
    .doc(id)
    .update({
      judul: document.getElementById('eomJudul').value,
      status: document.getElementById('eomStatus').value,
      notulensi: document.getElementById('eomNotulensi').value,
      updatedAt: new Date().toISOString(),
    });
  closeModalDirect();
  toast('Meeting diupdate', 'success');
  loadMeetingTab('online');
}

async function hapusOnlineMeeting(id) {
  if (!confirm('Hapus meeting online ini?')) return;
  await db.collection('hrd_online_meeting').doc(id).delete();
  toast('Meeting dihapus', 'success');
  loadMeetingTab('online');
}

function modalNotulensiOnline(id) {
  db.collection('hrd_online_meeting')
    .doc(id)
    .get()
    .then((d) => {
      const p = d.data();
      openModal(`<div class="modal-title">📝 Notulensi Meeting Online: ${escHtml(p.judul || '')}</div>
      <div class="form-group"><label>Notulensi</label><textarea class="form-control" id="notulOnlineIsi" style="min-height:200px">${escHtml(p.notulensi || '')}</textarea></div>
      <div class="flex gap-8">
        <button class="btn btn-primary" onclick="simpanNotulensiOnline('${id}')">💾 Simpan</button>
        <button class="btn btn-info" onclick="generateNotulensiAI('${id}')">🤖 Generate dengan AI</button>
      </div>`);
    });
}

async function simpanNotulensiOnline(id) {
  await db
    .collection('hrd_online_meeting')
    .doc(id)
    .update({
      notulensi: document.getElementById('notulOnlineIsi').value,
      updatedAt: new Date().toISOString(),
    });
  closeModalDirect();
  toast('Notulensi disimpan', 'success');
  loadMeetingTab('online');
}

// ── GENERATE NOTULENSI DENGAN AI ──────────────────────────────
async function generateNotulensiAI(meetingId) {
  const d = await db.collection('hrd_online_meeting').doc(meetingId).get();
  const p = d.data();

  // Build context from meeting data
  const peserta = (p.pesertaNames || []).join(', ') || 'Tidak ada data peserta';
  const tanggal = formatDateTime(p.createdAt);
  const durasi = p.endedAt
    ? Math.round((new Date(p.endedAt) - new Date(p.createdAt)) / 60000) + ' menit'
    : 'Belum selesai';

  openModal(
    `<div class="modal-title">🤖 Generate Notulensi AI</div>
    <p class="text-sm mb-16" style="color:#666">AI akan membuat template notulensi berdasarkan data meeting. Anda bisa edit hasilnya sebelum menyimpan.</p>
    <div style="background:#f8f9ff;padding:12px;border-radius:8px;margin-bottom:16px;font-size:.82rem">
      <div><b>Meeting:</b> ${escHtml(p.judul || 'Meeting Online')}</div>
      <div><b>Tanggal:</b> ${tanggal}</div>
      <div><b>Durasi:</b> ${durasi}</div>
      <div><b>Peserta:</b> ${escHtml(peserta)}</div>
    </div>
    <div class="form-group"><label>Topik/Agenda yang dibahas (opsional, untuk hasil lebih akurat)</label><textarea class="form-control" id="aiTopik" placeholder="Contoh: Evaluasi kinerja Q1, rencana rekrutmen, budget training..." style="min-height:80px"></textarea></div>
    <div class="form-group"><label>Keputusan/Hasil Meeting (opsional)</label><textarea class="form-control" id="aiKeputusan" placeholder="Contoh: Disetujui budget 50jt untuk training, deadline rekrutmen 2 minggu..." style="min-height:80px"></textarea></div>
    <button class="btn btn-primary" onclick="doGenerateNotulensi('${meetingId}')">🤖 Generate Notulensi</button>`,
    true
  );
}

async function doGenerateNotulensi(meetingId) {
  const d = await db.collection('hrd_online_meeting').doc(meetingId).get();
  const p = d.data();
  const topik = document.getElementById('aiTopik')?.value || '';
  const keputusan = document.getElementById('aiKeputusan')?.value || '';

  const peserta = (p.pesertaNames || []).join(', ');
  const tanggal = formatDateTime(p.createdAt);
  const durasi = p.endedAt
    ? Math.round((new Date(p.endedAt) - new Date(p.createdAt)) / 60000) + ' menit'
    : '-';
  const pembuat = p.createdByName || currentUser.nama;

  // Generate structured notulensi
  let notulensi = `═══════════════════════════════════════════
NOTULENSI MEETING
═══════════════════════════════════════════

📋 INFORMASI MEETING
─────────────────────────────────────────
Judul       : ${p.judul || 'Meeting Online'}
Tanggal     : ${tanggal}
Durasi      : ${durasi}
Mode        : ${p.mode === 'audio' ? 'Voice Call' : 'Video Call'}
Pemimpin    : ${pembuat}
Peserta     : ${peserta || '-'}

📌 AGENDA / TOPIK PEMBAHASAN
─────────────────────────────────────────
${
  topik
    ? topik
        .split('\n')
        .map((t, i) => `${i + 1}. ${t}`)
        .join('\n')
    : '(Belum diisi — silakan lengkapi)'
}

💡 PEMBAHASAN
─────────────────────────────────────────
${
  topik
    ? topik
        .split('\n')
        .map((t) => `• ${t}\n  → Dibahas oleh tim. `)
        .join('\n')
    : '(Silakan lengkapi detail pembahasan)'
}

✅ KEPUTUSAN / HASIL
─────────────────────────────────────────
${
  keputusan
    ? keputusan
        .split('\n')
        .map((k, i) => `${i + 1}. ${k}`)
        .join('\n')
    : '(Belum diisi — silakan lengkapi)'
}

📋 ACTION ITEMS
─────────────────────────────────────────
${
  keputusan
    ? keputusan
        .split('\n')
        .map((k, i) => `${i + 1}. [ ] ${k} — PIC: (tentukan) — Deadline: (tentukan)`)
        .join('\n')
    : '1. [ ] (Action item) — PIC: - — Deadline: -'
}

📅 MEETING BERIKUTNYA
─────────────────────────────────────────
Tanggal     : (tentukan)
Agenda      : (tentukan)

─────────────────────────────────────────
Dibuat oleh : ${currentUser.nama}
Tanggal     : ${formatDateTime(new Date().toISOString())}
═══════════════════════════════════════════`;

  // Save to Firestore
  await db
    .collection('hrd_online_meeting')
    .doc(meetingId)
    .update({ notulensi, updatedAt: new Date().toISOString() });

  // Show result for editing
  closeModalDirect();
  openModal(
    `<div class="modal-title">📝 Notulensi Generated — Edit & Simpan</div>
    <div class="badge badge-success mb-16">✅ Notulensi berhasil di-generate!</div>
    <div class="form-group"><textarea class="form-control" id="notulOnlineIsi" style="min-height:400px;font-family:monospace;font-size:.78rem">${escHtml(notulensi)}</textarea></div>
    <div class="flex gap-8">
      <button class="btn btn-primary" onclick="simpanNotulensiOnline('${meetingId}')">💾 Simpan Perubahan</button>
      <button class="btn btn-outline" onclick="cetakNotulensi()">🖨️ Cetak</button>
    </div>`,
    true
  );
}

function cetakNotulensi() {
  const content = document.getElementById('notulOnlineIsi')?.value || '';
  const win = window.open('', '_blank');
  win.document.write(
    '<html><head><title>Notulensi Meeting</title><style>body{font-family:monospace;padding:30px;font-size:12px;white-space:pre-wrap;line-height:1.6}</style></head><body>'
  );
  win.document.write(content.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  win.document.write('</body></html>');
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ══════════════════════════════════════════════════════════════
// ── INBOX — Undangan Meeting masuk per akun user ──────────────
// Setiap user punya inbox sendiri, terpisah per user head
// ══════════════════════════════════════════════════════════════

async function renderInbox() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>📥 Inbox Saya</span></div><div class="card" id="inboxList">Loading...</div>`;

  // Real-time listener untuk inbox user ini
  const unsub = db
    .collection('hrd_meeting_invites')
    .where('targetUser', '==', currentUser.id)
    .onSnapshot((snap) => {
      let html = '';
      if (snap.empty) {
        html =
          '<div class="empty-state"><div class="icon">📥</div><p>Inbox kosong — belum ada undangan meeting</p></div>';
      } else {
        snap.forEach((d) => {
          const p = d.data();
          const isUnread = !p.read;
          const rsvpBadge =
            p.rsvpStatus === 'hadir'
              ? 'badge-success'
              : p.rsvpStatus === 'tidak'
                ? 'badge-danger'
                : 'badge-warning';
          html += `<div class="inbox-item ${isUnread ? 'unread' : ''}" onclick="openInviteDetail('${d.id}')">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div class="inbox-from">📅 ${escHtml(p.judul)}</div>
                <div class="inbox-subject">Dari: <b>${escHtml(p.fromName)}</b> — ${formatDate(p.tanggal)} ${p.waktu || ''}</div>
              </div>
              <div style="text-align:right">
                <span class="badge ${rsvpBadge}">${p.rsvpStatus}</span>
                <div class="inbox-time">${formatDateTime(p.createdAt)}</div>
              </div>
            </div>
          </div>`;
        });
      }
      const el = document.getElementById('inboxList');
      if (el) el.innerHTML = html;
    });
  unsubscribers.push(unsub);
}

async function openInviteDetail(inviteId) {
  const invDoc = await db.collection('hrd_meeting_invites').doc(inviteId).get();
  const inv = invDoc.data();

  // Mark as read
  if (!inv.read) await db.collection('hrd_meeting_invites').doc(inviteId).update({ read: true });

  // Get full meeting data
  let meetingData = null;
  if (inv.meetingId) {
    const mDoc = await db.collection('hrd_meeting').doc(inv.meetingId).get();
    if (mDoc.exists) meetingData = mDoc.data();
  }

  // Check if meeting join is available (15 min rule for scheduled meetings)
  let joinAvailable = true;
  let timeMessage = '';
  if (inv.tanggal && inv.waktu && !inv.meetingClosed) {
    const meetTime = new Date(`${inv.tanggal}T${inv.waktu}`);
    const now = new Date();
    const diffMin = (meetTime - now) / 60000;
    if (diffMin > 15) {
      joinAvailable = false;
      timeMessage = `<div style="background:#fff3e0;padding:10px;border-radius:6px;margin-bottom:12px;font-size:.82rem;border-left:3px solid #ff9800">⏰ Link meeting aktif <b>15 menit sebelum jadwal</b>. Jadwal: <b>${formatDate(inv.tanggal)} ${inv.waktu}</b></div>`;
    }
  }

  openModal(
    `<div class="modal-title">📅 Undangan Meeting</div>
    <div class="thread-header" style="border-radius:8px;margin-bottom:16px">
      <div class="fw-700" style="font-size:1rem">${escHtml(inv.judul)}</div>
      <div class="text-sm mt-8">Dari: <b>${escHtml(inv.fromName)}</b></div>
      <div class="text-sm">Tanggal: <b>${formatDate(inv.tanggal)}</b> — Waktu: <b>${inv.waktu || '-'}</b></div>
      <div class="text-sm">Lokasi: ${escHtml(inv.lokasi || '-')}</div>
    </div>
    ${timeMessage}
    ${meetingData ? `<div class="mb-16"><b>Agenda:</b><div class="text-sm mt-8" style="background:#f8f9ff;padding:12px;border-radius:6px">${escHtml(meetingData.agenda || 'Tidak ada agenda')}</div></div>` : ''}
    <div class="mb-16"><b>Status RSVP Anda:</b> <span class="badge badge-${inv.rsvpStatus === 'hadir' ? 'success' : inv.rsvpStatus === 'tidak' ? 'danger' : 'warning'}">${inv.rsvpStatus}</span></div>
    ${inv.isOnline && inv.onlineRoomId ? `<div class="mb-16">${joinAvailable ? `<button class="btn btn-success" onclick="joinOnlineMeeting('${inv.onlineRoomId}')">🎥 Join Video Call</button>` : `<button class="btn btn-sm" style="background:#ccc;color:#666;cursor:not-allowed" disabled>🔒 Link belum aktif</button>`}</div>` : ''}
    <div class="flex gap-8">
      <button class="btn btn-success" onclick="rsvpInvite('${inviteId}','${inv.meetingId}','hadir')">✅ Hadir</button>
      <button class="btn btn-danger" onclick="rsvpInvite('${inviteId}','${inv.meetingId}','tidak')">❌ Tidak Hadir</button>
    </div>`,
    true
  );
}

async function rsvpInvite(inviteId, meetingId, status) {
  // Update invite
  await db.collection('hrd_meeting_invites').doc(inviteId).update({ rsvpStatus: status });

  // Update meeting RSVP map
  if (meetingId) {
    const mRef = db.collection('hrd_meeting').doc(meetingId);
    const mDoc = await mRef.get();
    if (mDoc.exists) {
      const rsvp = mDoc.data().rsvp || {};
      rsvp[currentUser.id] = status;
      await mRef.update({ rsvp });
    }
  }

  // Notify meeting creator
  const invDoc = await db.collection('hrd_meeting_invites').doc(inviteId).get();
  const inv = invDoc.data();
  await sendNotification(
    inv.fromUser,
    '📅 RSVP Meeting',
    `${currentUser.nama} ${status === 'hadir' ? 'akan hadir' : 'tidak hadir'} di meeting "${inv.judul}"`,
    'meeting'
  );

  closeModalDirect();
  toast(`RSVP: ${status}`, 'success');
}

// ══════════════════════════════════════════════════════════════
// ── OBROLAN — Per User Head (Thread terpisah per pengirim) ────
// Chat diarahkan langsung ke akun masing-masing karyawan
// Setiap percakapan dipisah berdasarkan siapa yang memulai (head)
// ══════════════════════════════════════════════════════════════

async function renderChat() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page-title"><span>💬 Obrolan</span><div class="flex gap-8"><button class="btn btn-primary btn-sm" onclick="modalNewChat()">+ Chat</button><button class="btn btn-info btn-sm" onclick="modalGroupChat()">👥 Group</button><button class="btn btn-danger btn-sm" onclick="hapusSemuaChat()">🗑️</button></div></div>
    <div class="chat-layout">
      <div class="card chat-sidebar-panel" id="chatSidebarPanel">
        <div class="card-title mb-8">📤 Percakapan</div>
        <div id="chatThreadList" style="max-height:calc(100vh - 250px);overflow-y:auto">Loading...</div>
      </div>
      <div class="card chat-main-panel" id="chatArea" style="display:none">
        <div style="padding:8px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
          <button class="btn btn-xs btn-outline chat-back-btn" onclick="showChatList()" style="display:none">← Kembali</button>
          <span class="fw-700 text-sm" id="chatPartnerName">Pilih percakapan</span>
        </div>
        <div class="empty-state"><div class="icon">💬</div><p>Pilih percakapan atau mulai obrolan baru</p></div>
      </div>
    </div>`;
  // Add responsive chat layout styles
  const style = document.createElement('style');
  style.id = 'chatLayoutStyle';
  style.textContent = `.chat-layout{display:grid;grid-template-columns:300px 1fr;gap:16px;min-height:500px}
    .chat-back-btn{display:none!important}
    @media(max-width:768px){
      .chat-layout{grid-template-columns:1fr;gap:0}
      .chat-main-panel{display:none}
      .chat-layout.chat-open .chat-sidebar-panel{display:none}
      .chat-layout.chat-open .chat-main-panel{display:block!important}
      .chat-layout.chat-open .chat-back-btn{display:inline-flex!important}
    }`;
  if (!document.getElementById('chatLayoutStyle')) document.head.appendChild(style);
  loadChatThreads();
}

function showChatList() {
  document.querySelector('.chat-layout')?.classList.remove('chat-open');
  const area = document.getElementById('chatArea');
  if (area) area.style.display = 'none';
  const panel = document.getElementById('chatSidebarPanel');
  if (panel) panel.style.display = 'block';
}

async function hapusSemuaChat() {
  if (!confirm('Hapus semua percakapan Anda? Ini tidak bisa dibatalkan.')) return;
  const snap = await db
    .collection('hrd_chat_threads')
    .where('participants', 'array-contains', currentUser.id)
    .get();
  const batch = db.batch();
  for (const d of snap.docs) {
    const msgSnap = await db.collection('hrd_chat_messages').where('threadId', '==', d.id).get();
    msgSnap.forEach((m) => batch.delete(m.ref));
    batch.delete(d.ref);
  }
  await batch.commit();
  toast('Semua chat dihapus', 'success');
  loadChatThreads();
}
async function hapusChatThread(threadId) {
  if (!confirm('Hapus percakapan ini?')) return;
  const msgSnap = await db.collection('hrd_chat_messages').where('threadId', '==', threadId).get();
  const batch = db.batch();
  msgSnap.forEach((m) => batch.delete(m.ref));
  batch.delete(db.collection('hrd_chat_threads').doc(threadId));
  await batch.commit();
  toast('Percakapan dihapus', 'success');
  loadChatThreads();
  showChatList();
}

async function loadChatThreads() {
  // Load semua thread dimana user ini terlibat
  const [sentSnap, recvSnap, groupSnap] = await Promise.all([
    db.collection('hrd_chat_threads').where('fromUser', '==', currentUser.id).get(),
    db.collection('hrd_chat_threads').where('toUser', '==', currentUser.id).get(),
    db.collection('hrd_chat_threads').where('participants', 'array-contains', currentUser.id).get(),
  ]);

  const threads = new Map();
  sentSnap.forEach((d) => threads.set(d.id, { id: d.id, ...d.data() }));
  recvSnap.forEach((d) => threads.set(d.id, { id: d.id, ...d.data() }));
  groupSnap.forEach((d) => threads.set(d.id, { id: d.id, ...d.data() }));

  // Sort by lastMessageAt
  const sorted = [...threads.values()].sort((a, b) =>
    (b.lastMessageAt || '').localeCompare(a.lastMessageAt || '')
  );

  let html = '';
  if (!sorted.length) {
    html =
      '<p class="text-sm" style="color:#999;padding:12px">Belum ada percakapan. Klik "+ Mulai Obrolan" untuk chat.</p>';
  } else {
    sorted.forEach((t) => {
      const isGroup = t.isGroup || false;
      const otherName = isGroup
        ? `👥 Group ${t.groupName || ''}`
        : t.fromUser === currentUser.id
          ? t.toName
          : t.fromName;
      const unread = !isGroup && t.fromUser !== currentUser.id && t.unreadBy === currentUser.id;
      html += `<div class="inbox-item ${unread ? 'unread' : ''}" style="position:relative">
        <div onclick="openChatThread('${t.id}')" style="cursor:pointer">
          <div class="inbox-from">${isGroup ? '👥' : '💬'} ${escHtml(otherName)}</div>
          <div class="inbox-subject text-xs">${escHtml((t.lastMessage || '').substring(0, 50))}</div>
          <div class="inbox-time">${formatDateTime(t.lastMessageAt)}</div>
        </div>
        <button class="btn btn-xs btn-danger" onclick="hapusChatThread('${t.id}')" style="position:absolute;top:8px;right:8px" title="Hapus">🗑️</button>
      </div>`;
    });
  }
  document.getElementById('chatThreadList').innerHTML = html;
}

async function modalNewChat() {
  const users = await getAllUsers();
  let options = '';
  users.forEach((u) => {
    if (u.id !== currentUser.id) {
      options += `<option value="${u.id}" data-nama="${escHtml(u.nama)}">${escHtml(u.nama)} (${escHtml(u.departemen || '-')})</option>`;
    }
  });
  openModal(`<div class="modal-title">💬 Mulai Obrolan Baru</div>
    <div class="form-group"><label>Pilih Karyawan</label><select class="form-control" id="newChatUser">${options}</select></div>
    <div class="form-group"><label>Pesan Pertama</label><textarea class="form-control" id="newChatMsg" placeholder="Ketik pesan..."></textarea></div>
    <button class="btn btn-primary" onclick="startNewChat()">📤 Kirim</button>`);
}

async function startNewChat() {
  const sel = document.getElementById('newChatUser');
  const toUser = sel.value;
  const toName = sel.options[sel.selectedIndex]?.dataset?.nama || '';
  const msg = document.getElementById('newChatMsg').value.trim();
  if (!toUser || !msg) return toast('Pilih user dan tulis pesan', 'warning');

  // Check if thread already exists between these two users
  const existingSnap = await db
    .collection('hrd_chat_threads')
    .where('participants', 'array-contains', currentUser.id)
    .get();

  let threadId = null;
  existingSnap.forEach((d) => {
    const data = d.data();
    if (data.participants && data.participants.includes(toUser)) {
      threadId = d.id;
    }
  });

  if (!threadId) {
    // Create new thread
    const threadRef = await db.collection('hrd_chat_threads').add({
      fromUser: currentUser.id,
      fromName: currentUser.nama,
      toUser: toUser,
      toName: toName,
      participants: [currentUser.id, toUser],
      lastMessage: msg,
      lastMessageAt: new Date().toISOString(),
      unreadBy: toUser,
      createdAt: new Date().toISOString(),
    });
    threadId = threadRef.id;
  }

  // Add message
  await db.collection('hrd_chat_messages').add({
    threadId,
    senderId: currentUser.id,
    senderName: currentUser.nama,
    message: msg,
    createdAt: new Date().toISOString(),
  });

  // Update thread
  await db.collection('hrd_chat_threads').doc(threadId).update({
    lastMessage: msg,
    lastMessageAt: new Date().toISOString(),
    unreadBy: toUser,
  });

  // Notify target user
  await sendNotification(
    toUser,
    '💬 Pesan Baru',
    `${currentUser.nama}: ${msg.substring(0, 80)}`,
    'chat'
  );

  closeModalDirect();
  toast('Pesan terkirim', 'success');
  loadChatThreads();
  openChatThread(threadId);
}

async function modalGroupChat() {
  const kSnap = await db.collection('hrd_karyawan').where('status', '==', 'aktif').get();
  const depts = new Set();
  kSnap.forEach((d) => depts.add(d.data().departemen || ''));
  let deptOpts = '<option value="admin">🔧 Admin (Komplain & Kendala Sistem)</option>';
  depts.forEach((d) => {
    if (d) deptOpts += `<option value="${escHtml(d)}">🏢 ${escHtml(d)}</option>`;
  });
  openModal(`<div class="modal-title">👥 Buat / Masuk Group Chat</div>
    <div style="background:#e3f2fd;border-radius:8px;padding:10px;margin-bottom:14px;font-size:.82rem;border-left:4px solid var(--info)">Buat room group chat per departemen. Semua anggota departemen otomatis tergabung dan bisa chat bersama dalam satu room.</div>
    <div class="form-group"><label>Pilih Group</label><select class="form-control" id="grpDept">${deptOpts}</select></div>
    <div class="form-group"><label>Pesan Pertama (opsional)</label><textarea class="form-control" id="grpMsg" placeholder="Ketik pesan..."></textarea></div>
    <button class="btn btn-primary" onclick="sendGroupChat()">👥 Buat / Masuk Group</button>`);
}
async function sendGroupChat() {
  const dept = document.getElementById('grpDept').value;
  const msg = document.getElementById('grpMsg').value.trim();
  const label = dept === 'admin' ? 'Admin' : dept;
  // Find existing group room (single-field query + client-side filter to avoid composite index)
  const existingSnap = await db.collection('hrd_chat_threads').where('isGroup', '==', true).get();
  let threadId = null;
  let matchDoc = null;
  existingSnap.forEach((d) => {
    if (d.data().groupName === label) matchDoc = d;
  });
  if (matchDoc) {
    threadId = matchDoc.id;
    // Add current user to participants if not already
    const threadData = matchDoc.data();
    if (!threadData.participants?.includes(currentUser.id)) {
      const updatedMembers = [...threadData.participants, currentUser.id];
      await db
        .collection('hrd_chat_threads')
        .doc(threadId)
        .update({ participants: updatedMembers });
    }
  } else {
    // Create new group room — collect all user IDs from that department
    let members = [currentUser.id];
    const usersSnap = await db.collection('hrd_users').where('status', '==', 'aktif').get();
    if (dept === 'admin') {
      usersSnap.forEach((d) => {
        if (d.data().role === 'admin' && !members.includes(d.id)) members.push(d.id);
      });
    } else {
      usersSnap.forEach((d) => {
        const u = d.data();
        if ((u.departemen || '').toLowerCase() === dept.toLowerCase() && !members.includes(d.id))
          members.push(d.id);
      });
    }
    const ref = await db.collection('hrd_chat_threads').add({
      isGroup: true,
      groupName: label,
      participants: members,
      fromUser: currentUser.id,
      fromName: currentUser.nama,
      toUser: 'group',
      toName: `👥 Group ${label}`,
      lastMessage: msg || 'Group dibuat',
      lastMessageAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    threadId = ref.id;
  }
  // Send message if provided
  if (msg) {
    await db.collection('hrd_chat_messages').add({
      threadId,
      senderId: currentUser.id,
      senderName: currentUser.nama,
      message: msg,
      createdAt: new Date().toISOString(),
    });
    await db
      .collection('hrd_chat_threads')
      .doc(threadId)
      .update({ lastMessage: msg, lastMessageAt: new Date().toISOString() });
  }
  closeModalDirect();
  toast(`Group ${label} siap!`, 'success');
  loadChatThreads();
  openChatThread(threadId);
}

function openChatThread(threadId) {
  // Show chat area (mobile: switch view)
  const layout = document.querySelector('.chat-layout');
  if (layout) layout.classList.add('chat-open');
  const area = document.getElementById('chatArea');
  area.style.display = 'block';

  // Get partner name
  db.collection('hrd_chat_threads')
    .doc(threadId)
    .get()
    .then((d) => {
      const data = d.data();
      const partnerName = data.fromUser === currentUser.id ? data.toName : data.fromName;
      const nameEl = document.getElementById('chatPartnerName');
      if (nameEl) nameEl.textContent = partnerName || 'Chat';
    });

  area.innerHTML = `
    <div style="padding:8px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
      <button class="btn btn-xs btn-outline chat-back-btn" onclick="showChatList()">← Kembali</button>
      <span class="fw-700 text-sm" id="chatPartnerName">...</span>
      <button class="btn btn-xs btn-danger" onclick="hapusChatThread('${threadId}')" style="margin-left:auto" title="Hapus">🗑️</button>
    </div>
    <div class="chat-container">
      <div class="chat-messages" id="chatMsgs"></div>
      <div class="chat-input">
        <input class="form-control" id="chatInput" placeholder="Ketik pesan..." onkeydown="if(event.key==='Enter')kirimChatMsg('${threadId}')">
        <button class="btn btn-primary" onclick="kirimChatMsg('${threadId}')">➤</button>
      </div>
    </div>`;

  // Update partner name
  db.collection('hrd_chat_threads')
    .doc(threadId)
    .get()
    .then((d) => {
      const data = d.data();
      const partnerName = data.fromUser === currentUser.id ? data.toName : data.fromName;
      const nameEl = document.getElementById('chatPartnerName');
      if (nameEl) nameEl.textContent = '💬 ' + partnerName;
      if (data && data.unreadBy === currentUser.id) {
        db.collection('hrd_chat_threads').doc(threadId).update({ unreadBy: '' });
      }
    });

  // Real-time messages
  const unsub = db
    .collection('hrd_chat_messages')
    .where('threadId', '==', threadId)
    .onSnapshot((snap) => {
      const messages = [];
      snap.forEach((d) => messages.push({ id: d.id, ...d.data() }));
      messages.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      let html = '';
      messages.forEach((p) => {
        const isMine = p.senderId === currentUser.id;
        const time = p.createdAt
          ? new Date(p.createdAt).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';
        const senderLabel = isMine
          ? ''
          : `<div class="msg-sender" style="font-size:.7rem;font-weight:700;color:var(--primary);margin-bottom:2px;padding-left:2px">${escHtml(p.senderName || '?')}</div>`;
        html += `<div class="chat-msg${isMine ? ' mine' : ''}">
          <div class="msg-avatar" title="${escHtml(p.senderName || '')}">${(p.senderName || '?').charAt(0)}</div>
          <div class="msg-content">
            ${senderLabel}
            <div class="msg-body">${escHtml(p.message)}</div>
            <div class="msg-time">${time}</div>
          </div>
        </div>`;
      });
      const msgs = document.getElementById('chatMsgs');
      if (msgs) {
        msgs.innerHTML =
          html ||
          '<div class="text-center text-sm" style="color:#999;padding:40px">Belum ada pesan. Mulai obrolan!</div>';
        msgs.scrollTop = msgs.scrollHeight;
      }
    });
  unsubscribers.push(unsub);
}

async function kirimChatMsg(threadId) {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  await db.collection('hrd_chat_messages').add({
    threadId,
    senderId: currentUser.id,
    senderName: currentUser.nama,
    message: msg,
    createdAt: new Date().toISOString(),
  });

  // Get thread to find the other user
  const tDoc = await db.collection('hrd_chat_threads').doc(threadId).get();
  const tData = tDoc.data();
  const otherUser = tData.fromUser === currentUser.id ? tData.toUser : tData.fromUser;

  await db.collection('hrd_chat_threads').doc(threadId).update({
    lastMessage: msg,
    lastMessageAt: new Date().toISOString(),
    unreadBy: otherUser,
  });

  // Notify
  await sendNotification(
    otherUser,
    '💬 Pesan Baru',
    `${currentUser.nama}: ${msg.substring(0, 80)}`,
    'chat'
  );
}

// ── BROADCAST ─────────────────────────────────────────────────
async function renderBroadcast() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>📡 Broadcast</span><button class="btn btn-primary btn-sm" onclick="modalBroadcast()">+ Kirim</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Pesan</th><th>Target</th><th>Pengirim</th><th>Tanggal</th><th>Aksi</th></tr></thead><tbody id="tblBroadcast"></tbody></table></div></div>`;
  const snap = await db.collection('hrd_broadcast').get();
  const allItems = [];
  snap.forEach((d) => allItems.push({ id: d.id, ...d.data() }));
  // Only admin (level 6) and head (level 4+) sees all; others filtered by their department/targetIds
  let items = allItems;
  if (!hasAccess(4)) {
    const myDept = (currentUser.departemen || '').toLowerCase().trim();
    const myId = currentUser.id || '';
    const myNama = (currentUser.nama || '').toLowerCase().trim();
    items = allItems.filter((p) => {
      // New broadcasts with targetType field
      if (p.targetType) {
        if (p.targetType === 'all') return true;
        if (p.targetType === 'personal') return (p.targetIds || []).includes(myId);
        if (p.targetType === 'departemen') {
          const bcDept = (p.targetDepartemen || '').toLowerCase().trim();
          return bcDept === myDept || (p.targetIds || []).includes(myId);
        }
      }
      // Legacy broadcasts (no targetType) — infer from targetLabel
      const label = (p.targetLabel || '').toLowerCase();
      if (label === 'semua' || label.includes('general') || !label) return true;
      if (label.includes('divisi')) {
        // e.g. "Divisi OFFICE" → extract dept name
        const deptName = label.replace('divisi', '').trim();
        return deptName === myDept;
      }
      // Personal target (targetLabel = person name) → check if it matches current user or targetIds
      if (p.targetIds && p.targetIds.length > 0) return p.targetIds.includes(myId);
      if (label === myNama) return true;
      return false;
    });
  }
  items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  let h = '';
  if (!items.length) h = '<tr><td colspan="5" class="text-center">Belum ada</td></tr>';
  else
    items.forEach((p) => {
      h += `<tr style="cursor:pointer" onclick="viewBroadcast('${p.id}')"><td>${escHtml((p.pesan || '').substring(0, 60))}${(p.pesan || '').length > 60 ? '...' : ''}</td><td><span class="badge badge-info">${escHtml(p.targetLabel || 'Semua')}</span></td><td>${escHtml(p.pengirim || '-')}</td><td>${formatDateTime(p.createdAt)}</td><td><button class="btn btn-xs btn-info" onclick="event.stopPropagation();viewBroadcast('${p.id}')">👁️</button> <button class="btn btn-xs btn-danger" onclick="event.stopPropagation();hapusDoc('hrd_broadcast','${p.id}','broadcast')">🗑️</button></td></tr>`;
    });
  document.getElementById('tblBroadcast').innerHTML = h;
}
function viewBroadcast(id) {
  db.collection('hrd_broadcast')
    .doc(id)
    .get()
    .then((d) => {
      const p = d.data();
      openModal(
        `<div class="modal-title">📡 Detail Broadcast</div><div style="background:#f8f9ff;padding:12px;border-radius:8px;margin-bottom:16px;font-size:.82rem"><div><b>Pengirim:</b> ${escHtml(p.pengirim || '-')}</div><div><b>Target:</b> ${escHtml(p.targetLabel || 'Semua')}</div><div><b>Tanggal:</b> ${formatDateTime(p.createdAt)}</div></div><div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:16px;font-size:.9rem;line-height:1.7;white-space:pre-wrap">${escHtml(p.pesan || '')}</div>`
      );
    });
}
async function modalBroadcast() {
  const users = await getAllUsers();
  let opts = '<option value="all">📢 Semua Karyawan</option>';
  const depts = new Set();
  users.forEach((u) => depts.add(u.departemen || ''));
  depts.forEach((d) => {
    if (d) opts += `<option value="dept:${d}">🏢 Divisi ${d}</option>`;
  });
  users.forEach((u) => {
    opts += `<option value="user:${u.id}">👤 ${escHtml(u.nama)}</option>`;
  });
  openModal(
    `<div class="modal-title">📡 Kirim Broadcast</div><div class="form-group"><label>Target</label><select class="form-control" id="bcTarget">${opts}</select></div><div class="form-group"><label>Pesan</label><textarea class="form-control" id="bcPesan" style="min-height:120px"></textarea></div><button class="btn btn-primary" onclick="kirimBroadcast()">📡 Kirim</button>`
  );
}
async function kirimBroadcast() {
  const target = document.getElementById('bcTarget').value;
  const pesan = document.getElementById('bcPesan').value;
  if (!pesan) return toast('Pesan wajib', 'warning');
  const users = await getAllUsers();
  let targetIds = [];
  let targetLabel = 'Semua';
  let targetType = 'all';
  let targetDepartemen = '';
  if (target === 'all') {
    targetIds = users.map((u) => u.id);
    targetLabel = 'Semua (General)';
    targetType = 'all';
  } else if (target.startsWith('dept:')) {
    const dept = target.replace('dept:', '');
    targetIds = users.filter((u) => u.departemen === dept).map((u) => u.id);
    targetLabel = 'Divisi ' + dept;
    targetType = 'departemen';
    targetDepartemen = dept;
  } else if (target.startsWith('user:')) {
    targetIds = [target.replace('user:', '')];
    const targetUser = users.find((u) => u.id === targetIds[0]);
    targetLabel = targetUser?.nama || 'User';
    targetType = 'personal';
    targetDepartemen = targetUser?.departemen || '';
  }
  await db.collection('hrd_broadcast').add({
    pesan,
    targetLabel,
    targetType,
    targetDepartemen,
    targetIds,
    pengirim: currentUser.nama,
    pengirimDept: currentUser.departemen || '',
    createdAt: new Date().toISOString(),
  });
  await sendNotificationBulk(
    targetIds,
    '📡 Broadcast',
    `${currentUser.nama}: ${pesan.substring(0, 100)}`,
    'notifikasi'
  );
  closeModalDirect();
  toast(`Broadcast terkirim ke ${targetIds.length} orang`, 'success');
  renderBroadcast();
}

// ── NOTIFIKASI ────────────────────────────────────────────────
async function renderNotifikasi() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>🔔 Notifikasi</span><div class="flex gap-8"><button class="btn btn-sm btn-danger" onclick="hapusSemuaNotif()">🗑️ Hapus Semua</button></div></div><div class="card" id="notifList">Loading...</div>`;
  try {
    const [snap1, snap2] = await Promise.all([
      db.collection('hrd_notifikasi').where('targetUser', '==', currentUser.id).get(),
      db.collection('hrd_notifikasi').where('targetUser', '==', currentUser.role).get(),
    ]);
    const allNotifs = [];
    const seen = new Set();
    snap1.forEach((d) => {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        allNotifs.push({ id: d.id, ...d.data() });
      }
    });
    snap2.forEach((d) => {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        allNotifs.push({ id: d.id, ...d.data() });
      }
    });
    allNotifs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    let h = '';
    if (!allNotifs.length)
      h = '<div class="empty-state"><div class="icon">🔔</div><p>Tidak ada notifikasi</p></div>';
    else
      allNotifs.slice(0, 50).forEach((p) => {
        const linkPage = p.link || detectNotifLink(p.title);
        h += `<div style="padding:12px;border-bottom:1px solid var(--border);${p.read ? 'opacity:.6' : 'background:#f0f4ff;border-left:3px solid var(--primary)'}"><div class="flex" style="justify-content:space-between;align-items:flex-start"><div style="flex:1;cursor:pointer" onclick="openNotif('${p.id}','${linkPage}')"><div class="fw-700 text-sm">${escHtml(p.title)}</div><div class="text-sm mt-4">${escHtml(p.message)}</div><div class="text-xs mt-4" style="color:#999">${formatDateTime(p.createdAt)}</div></div><div class="flex gap-4" style="flex-shrink:0">${!p.read ? `<button class="btn btn-xs btn-outline" onclick="markRead('${p.id}')" title="Tandai Dibaca">✅</button>` : ''}<button class="btn btn-xs btn-danger" onclick="hapusNotif('${p.id}')" title="Hapus">🗑️</button></div></div></div>`;
      });
    document.getElementById('notifList').innerHTML = h;
  } catch (e) {
    document.getElementById('notifList').innerHTML =
      '<div class="empty-state"><div class="icon">🔔</div><p>Tidak ada notifikasi</p></div>';
  }
}
async function markRead(id) {
  await db.collection('hrd_notifikasi').doc(id).update({ read: true });
  renderNotifikasi();
}
async function hapusNotif(id) {
  await db.collection('hrd_notifikasi').doc(id).delete();
  toast('Notifikasi dihapus', 'success');
  renderNotifikasi();
}
async function hapusSemuaNotif() {
  if (!confirm('Hapus semua notifikasi?')) return;
  const [s1, s2] = await Promise.all([
    db.collection('hrd_notifikasi').where('targetUser', '==', currentUser.id).get(),
    db.collection('hrd_notifikasi').where('targetUser', '==', currentUser.role).get(),
  ]);
  const batch = db.batch();
  const seen = new Set();
  s1.forEach((d) => {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      batch.delete(d.ref);
    }
  });
  s2.forEach((d) => {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      batch.delete(d.ref);
    }
  });
  await batch.commit();
  toast('Semua notifikasi dihapus', 'success');
  renderNotifikasi();
}

async function openNotif(id, link) {
  await db.collection('hrd_notifikasi').doc(id).update({ read: true });
  if (link && link !== '') navigateTo(link);
  else renderNotifikasi();
}
function detectNotifLink(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('meeting') || t.includes('undangan')) return 'meeting';
  if (t.includes('broadcast')) return 'broadcast';
  if (t.includes('pengumuman')) return 'pengumuman';
  if (t.includes('cuti') || t.includes('izin')) return 'cuti';
  if (t.includes('approval')) return 'approval-center';
  if (t.includes('gaji') || t.includes('slip')) return 'penggajian';
  if (t.includes('reimbursement')) return 'reimbursement';
  if (t.includes('kandidat') || t.includes('rekrutmen')) return 'kandidat';
  if (t.includes('disc')) return 'disc-test';
  return '';
}
async function markAllRead() {
  const [s1, s2] = await Promise.all([
    db.collection('hrd_notifikasi').where('targetUser', '==', currentUser.id).get(),
    db.collection('hrd_notifikasi').where('targetUser', '==', currentUser.role).get(),
  ]);
  const batch = db.batch();
  s1.forEach((d) => {
    if (d.data().read === false) batch.update(d.ref, { read: true });
  });
  s2.forEach((d) => {
    if (d.data().read === false) batch.update(d.ref, { read: true });
  });
  await batch.commit();
  toast('Semua dibaca', 'success');
  renderNotifikasi();
}

// ── PENGUMUMAN ────────────────────────────────────────────────
async function renderPengumuman() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-title"><span>📢 Pengumuman</span>${hasAccess(3) ? '<button class="btn btn-primary btn-sm" onclick="modalPengumuman()">+ Tambah</button>' : ''}</div><div id="pengumumanList">Loading...</div>`;
  try {
    const snap = await db.collection('hrd_pengumuman').get();
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    let h = '';
    if (!items.length)
      h = '<div class="empty-state"><div class="icon">📢</div><p>Belum ada</p></div>';
    else
      items.forEach((p) => {
        h += `<div class="card" style="cursor:pointer" onclick="viewPengumuman('${p.id}')"><div class="card-header"><div class="card-title">${escHtml(p.judul)}</div><div style="display:flex;gap:8px;align-items:center"><div class="text-xs" style="color:#999">${formatDateTime(p.createdAt)}</div>${hasAccess(3) ? `<button class="btn btn-xs btn-danger" onclick="event.stopPropagation();hapusDoc('hrd_pengumuman','${p.id}','pengumuman')">🗑️</button>` : ''}</div></div><div class="text-sm" style="color:var(--text-light)">${escHtml((p.isi || '').substring(0, 100))}${(p.isi || '').length > 100 ? '...' : ''}</div></div>`;
      });
    document.getElementById('pengumumanList').innerHTML = h;
  } catch (e) {
    document.getElementById('pengumumanList').innerHTML =
      '<div class="empty-state"><div class="icon">📢</div><p>Belum ada pengumuman</p></div>';
  }
}
function viewPengumuman(id) {
  db.collection('hrd_pengumuman')
    .doc(id)
    .get()
    .then((d) => {
      const p = d.data();
      openModal(
        `<div class="modal-title">📢 ${escHtml(p.judul || '')}</div><div style="font-size:.78rem;color:#999;margin-bottom:16px">${formatDateTime(p.createdAt)} — Oleh: ${escHtml(p.dibuatOleh || '-')}</div><div style="font-size:.9rem;line-height:1.8;white-space:pre-wrap">${escHtml(p.isi || '')}</div>`
      );
    });
}
function modalPengumuman() {
  openModal(
    `<div class="modal-title">Tambah Pengumuman</div><div class="form-group"><label>Judul</label><input class="form-control" id="pgJudul"></div><div class="form-group"><label>Isi</label><textarea class="form-control" id="pgIsi" style="min-height:150px"></textarea></div><button class="btn btn-primary" onclick="simpanPengumuman()">Publikasikan</button>`
  );
}
async function simpanPengumuman() {
  const data = {
    judul: document.getElementById('pgJudul').value,
    isi: document.getElementById('pgIsi').value,
    dibuatOleh: currentUser.nama,
    createdAt: new Date().toISOString(),
  };
  if (!data.judul) return toast('Judul wajib', 'warning');
  await db.collection('hrd_pengumuman').add(data);
  const users = await getAllUsers();
  await sendNotificationBulk(
    users.map((u) => u.id),
    '📢 Pengumuman',
    data.judul
  );
  closeModalDirect();
  toast('Dipublikasikan', 'success');
  renderPengumuman();
}
