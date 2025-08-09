/* script.js
   - LocalStorage user store
   - TopUp flow: modal -> order -> select method -> QR -> simulate confirm
   - Daily limit 50,000,000
*/

const LS_USERS = 'kamikz.users.v6';
const LS_CURRENT = 'kamikz.current.v6';
const DAILY_LIMIT = 50_000_000;
const TELEGRAM_BOT = 'https://t.me/cskz10_bot';
const WHATSAPP_ADMIN = 'https://wa.me/6285351952977';

const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2,10).toUpperCase();
const fmt = n => 'Rp ' + Number(n||0).toLocaleString('id-ID');

function loadUsers(){ try{ return JSON.parse(localStorage.getItem(LS_USERS) || '{}'); }catch(e){ return {}; } }
function saveUsers(u){ localStorage.setItem(LS_USERS, JSON.stringify(u||{})); }
function setCurrent(email){ localStorage.setItem(LS_CURRENT, email||''); }
function getCurrent(){ return localStorage.getItem(LS_CURRENT) || ''; }
function toast(msg, t=1400){ const el=document.createElement('div'); el.textContent=msg; Object.assign(el.style,{position:'fixed',right:'18px',bottom:'92px',background:'#111',color:'#fff',padding:'10px 12px',borderRadius:'10px',zIndex:99999}); document.body.appendChild(el); setTimeout(()=> el.style.opacity='0', t-200); setTimeout(()=> el.remove(), t); }

/* app state */
let users = loadUsers();
let current = getCurrent();
let me = current && users[current] ? users[current] : null;

/* seed admin */
(function seed(){
  if(!users['admin@dev.co']){
    users['admin@dev.co'] = {
      name:'admin', email:'admin@dev.co', role:'admin', photo:'', phone:'', phoneVerified:true,
      saldo:500000, history:[{id:uid(),dateISO:new Date().toISOString(),type:'topup',note:'Saldo awal (admin)',amount:500000}],
      security:{pin:'1234', a2f:false}
    };
    saveUsers(users);
  }
})();

/* modal */
const modalWrap = $('modalWrap'), modalContent = $('modalContent');
function showModal(html){
  modalContent.innerHTML = html;
  modalWrap.style.display = 'flex';
  modalWrap.setAttribute('aria-hidden','false');
}
function closeModal(){ modalWrap.style.display='none'; modalWrap.setAttribute('aria-hidden','true'); modalContent.innerHTML=''; }

/* initial UI bindings */
document.addEventListener('DOMContentLoaded', ()=> {
  users = loadUsers(); current = getCurrent();
  if(!current || !users[current]) askLogin();
  else renderApp();

  // handlers
  document.getElementById('btnTopUp').addEventListener('click', showTopUpModal);
  document.getElementById('qaTopUp').addEventListener('click', ()=> document.getElementById('btnTopUp').click());
  document.getElementById('qaTransfer').addEventListener('click', showTransferModal);
  document.getElementById('qaMutasi').addEventListener('click', openTransactions);
  document.getElementById('qaProfile').addEventListener('click', openProfile);
  document.getElementById('hdrAvatar').addEventListener('click', openProfile);
  document.getElementById('refreshBtn').addEventListener('click', ()=> { users = loadUsers(); me = users[current]; updateBalance(); toast('Saldo diperbarui'); });
});

/* ask login/register */
function askLogin(){
  showModal(`
    <h3>Masuk / Daftar</h3>
    <div class="form-row">
      <input id="inName" class="input" placeholder="Nama lengkap">
      <input id="inEmail" class="input" placeholder="Email (contoh: you@domain.com)">
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
      <button id="guestBtn" class="btn">Masuk Sebagai Tamu</button>
      <button id="okBtn" class="btn primary">Masuk / Daftar</button>
    </div>
  `);
  document.getElementById('okBtn').addEventListener('click', ()=>{
    const name = document.getElementById('inName').value.trim();
    const email = document.getElementById('inEmail').value.trim().toLowerCase();
    if(!name || !email) return alert('Nama & email wajib diisi');
    if(!users[email]) {
      users[email] = { name, email, role:(name.toLowerCase()==='admin' && email==='admin@dev.co') ? 'admin' : 'user', photo:'', phone:'', phoneVerified:false, saldo:0, history:[], security:{pin:'', a2f:false} };
      saveUsers(users);
    }
    current = email; setCurrent(email); me = users[email];
    closeModal(); renderApp(); toast('Selamat datang, '+me.name);
  });
  document.getElementById('guestBtn').addEventListener('click', ()=>{
    const email = 'guest@guest.local';
    if(!users[email]) users[email] = { name:'Tamu', email, role:'user', photo:'', phone:'', phoneVerified:false, saldo:0, history:[], security:{} };
    current = email; setCurrent(email); me = users[email];
    closeModal(); renderApp(); toast('Masuk sebagai Tamu');
  });
}

/* render main app */
function renderApp(){
  users = loadUsers(); me = users[current];
  if(!me) return askLogin();
  $('greet').textContent = `Hai, ${me.name.split(' ')[0] || me.name}`;
  $('trxCount').textContent = `${(me.history||[]).length} Trx`;
  $('saldoMain').textContent = fmt(me.saldo);
  $('balance').textContent = fmt(me.saldo);
  $('hdrAvatar').src = me.photo && me.photo.startsWith('data:') ? me.photo : genAvatar(me.name);
  renderRecent();
}

/* small avatar */
function genAvatar(name){
  const initials = (name||'U').split(' ').map(s=>s[0]||'').slice(0,2).join('').toUpperCase() || 'U';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect rx='20' width='100%' height='100%' fill='#eef9f7'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' font-size='72' fill='#0ea5a4' font-family='Inter, sans-serif' font-weight='700'>${initials}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/* recent list */
function renderRecent(){
  const list = (me.history||[]).slice().reverse().slice(0,10);
  const out = document.getElementById('recentList'); out.innerHTML = '';
  if(!list.length) { out.innerHTML = '<div class="empty">Belum ada transaksi</div>'; return; }
  list.forEach(it=>{
    const el = document.createElement('div'); el.className='recent-row';
    el.innerHTML = `<div><div style="font-weight:700">${it.note||it.type}</div><div class="small-muted">${new Date(it.dateISO).toLocaleString()}</div></div><div style="font-weight:800">${fmt(it.amount)}</div>`;
    out.appendChild(el);
  });
}

/* TopUp modal (first screen) — match photo1 */
function showTopUpModal(){
  if(!me) { askLogin(); return; }
  showModal(`
    <h3>Topup Saldo Algastaku</h3>
    <div class="small-muted">Saldo Anda saat ini</div>
    <div style="font-weight:800;font-size:20px;margin-top:4px">${fmt(me.saldo)}</div>

    <div class="form-row">
      <label class="small-muted">Jumlah Topup</label>
      <input id="topInput" class="input" placeholder="Masukkan jumlah topup (tanpa titik)">
      <div class="small-muted" style="margin-top:6px">Input Nominal Cepat</div>
      <div class="chips" id="topChips">
        <div class="chip" data-val="1000">Rp1.000</div>
        <div class="chip" data-val="5000">Rp5.000</div>
        <div class="chip" data-val="10000">Rp10.000</div>
        <div class="chip" data-val="20000">Rp20.000</div>
        <div class="chip" data-val="50000">Rp50.000</div>
        <div class="chip" data-val="100000">Rp100.000</div>
        <div class="chip" data-val="150000">Rp150.000</div>
        <div class="chip" data-val="200000">Rp200.000</div>
        <div class="chip" data-val="500000">Rp500.000</div>
        <div class="chip" data-val="1000000">Rp1.000.000</div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <button id="topCancel" class="btn">Batal</button>
        <button id="topProceed" class="btn primary">Topup Saldo Algastaku</button>
      </div>
    </div>
  `);

  // chip handlers
  document.querySelectorAll('#topChips .chip').forEach(c=>{
    c.addEventListener('click', ()=> {
      const val = Number(c.dataset.val);
      document.getElementById('topInput').value = val;
    });
  });

  document.getElementById('topCancel').addEventListener('click', closeModal);
  document.getElementById('topProceed').addEventListener('click', ()=>{
    const v = Number(document.getElementById('topInput').value);
    if(!v || v <= 0) return alert('Masukkan nominal yang valid.');
    const today = new Date().toISOString().slice(0,10);
    const todayTotal = (me.history||[]).reduce((s,h)=> (h.dateISO||'').slice(0,10)===today ? s + (h.amount||0) : s, 0);
    if(todayTotal + v > DAILY_LIMIT) return alert('Melebihi limit harian: ' + fmt(DAILY_LIMIT));
    // proceed to order detail
    createTopupOrder(v);
  });
}

/* create order and show detail screen (photo2) */
function createTopupOrder(amount){
  const orderId = 'TP' + Date.now().toString().slice(-8);
  // generate unique code small (0..999) e.g. for bank-like flow
  const unique = Math.floor(Math.random()*900 + 100); // 100..999
  const adminFee = 19; // example
  const totalReceived = amount + unique;
  const totalToPay = amount + adminFee + unique;
  const order = {
    id: orderId,
    amount,
    unique,
    adminFee,
    totalToPay,
    totalReceived,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  // store temporary order in current user's session
  me.pendingOrder = order;
  users[current] = me; saveUsers(users);
  // show order detail modal
  showOrderDetail(order);
}

/* order detail UI (choose method) */
function showOrderDetail(order){
  showModal(`
    <h3>Algastaku Digital</h3>
    <div class="order-card">
      <div><strong>ID Topup</strong><div class="small-muted" style="float:right">${order.id}</div></div>
      <div style="margin-top:8px"><strong>Jumlah Topup</strong><div style="float:right">${fmt(order.amount)}</div></div>
      <div style="margin-top:8px"><strong>Kode Unik</strong><div style="float:right">${fmt(order.unique)}</div></div>
      <div style="margin-top:8px"><strong>Total Diterima</strong><div style="float:right;font-weight:800">${fmt(order.totalReceived)}</div></div>
    </div>

    <div class="small-muted">Pilih Metode Pembayaran</div>
    <div class="pay-method" data-method="qris"><div class="meta"><strong>QRIS</strong><div class="small-muted">Real-time 24 Jam</div></div><div>→</div></div>
    <div class="pay-method" data-method="ewallet"><div class="meta"><strong>E-Wallet</strong><div class="small-muted">OVO / DANA / GoPay</div></div><div>→</div></div>
    <div class="pay-method" data-method="retail"><div class="meta"><strong>Retail</strong><div class="small-muted">Alfamart / Indomaret</div></div><div>→</div></div>

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button id="orderClose" class="btn">Tutup</button>
    </div>
  `);

  document.getElementById('orderClose').addEventListener('click', ()=> { delete me.pendingOrder; users[current]=me; saveUsers(users); closeModal(); });

  document.querySelectorAll('.pay-method').forEach(el=>{
    el.addEventListener('click', ()=> {
      const method = el.dataset.method;
      if(method === 'qris') showQRPage(order);
      else alert('Method ' + method + ' (simulasi) — QRIS dipilih untuk demo.');
    });
  });
}

/* QR Page (photo3) */
function showQRPage(order){
  // generate dummy QR (svg)
  const qrSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='100%' height='100%' fill='#fff'/><rect x='10' y='10' width='80' height='80' fill='#000'/><rect x='310' y='10' width='80' height='80' fill='#000'/><rect x='10' y='310' width='80' height='80' fill='#000'/><g transform='translate(120,80)'><rect x='0' y='0' width='8' height='8' fill='#000'/><rect x='16' y='0' width='8' height='8' fill='#000'/><rect x='0' y='16' width='8' height='8' fill='#000'/><rect x='32' y='0' width='8' height='8' fill='#000'/><rect x='48' y='16' width='8' height='8' fill='#000'/></g></svg>`;
  const qdata = 'data:image/svg+xml;utf8,' + encodeURIComponent(qrSvg);
  const expire = new Date(Date.now() + 15*60*1000); // 15 mins
  showModal(`
    <h3>Algastaku Digital</h3>
    <div class="order-card">
      <div><strong>Total Bayar</strong><div style="float:right;font-weight:800">${fmt(order.totalToPay)}</div></div>
      <div style="margin-top:8px"><strong>Detail Transaksi</strong>
        <div class="small-muted" style="margin-top:6px">Pelanggan: <strong>${me.name}</strong></div>
        <div class="small-muted" style="margin-top:2px">Jumlah: <strong>${fmt(order.totalReceived)}</strong></div>
        <div class="small-muted" style="margin-top:2px">Biaya Admin: <strong style="color:#d00">${fmt(order.adminFee)}</strong></div>
      </div>
    </div>

    <div class="small-muted">QRIS</div>
    <div class="qr-box">
      <img src="${qdata}" alt="qris" style="width:260px;height:260px;object-fit:cover;border-radius:6px"/>
      <div style="margin-top:8px;font-weight:800">${fmt(order.totalToPay)}</div>
      <div class="small-muted" style="margin-top:8px">Bayar sebelum: <strong>${expire.toLocaleString()}</strong></div>
    </div>

    <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
      <button id="btnCancelOrder" class="btn danger">Batalkan</button>
      <button id="btnCheckStatus" class="btn primary">Cek Status</button>
      <button id="btnSimulatePay" class="btn">Simulasikan Bayar</button>
    </div>
  `);

  // handlers
  document.getElementById('btnCancelOrder').addEventListener('click', ()=>{
    delete me.pendingOrder; users[current]=me; saveUsers(users); closeModal(); toast('Order dibatalkan');
  });
  document.getElementById('btnCheckStatus').addEventListener('click', ()=>{
    // check order status (if still pending)
    if(me.pendingOrder && me.pendingOrder.status === 'paid'){
      alert('Pembayaran telah lunas. Saldo ditambahkan.');
    } else alert('Status: Belum dibayar.');
  });
  document.getElementById('btnSimulatePay').addEventListener('click', ()=>{
    // simulate success -> mark order paid and add to history & saldo
    if(!me.pendingOrder) return alert('Order tidak ditemukan.');
    me.pendingOrder.status = 'paid';
    me.history = me.history || [];
    me.history.push({ id: uid(), dateISO: new Date().toISOString(), type: 'topup', note: 'Topup QRIS (Simulasi) ' + me.pendingOrder.id, amount: me.pendingOrder.totalReceived });
    me.saldo = Number(me.saldo || 0) + Number(me.pendingOrder.totalReceived);
    // remove pendingOrder, persist
    delete me.pendingOrder;
    users[current] = me; saveUsers(users);
    renderApp(); closeModal(); toast('Pembayaran berhasil, saldo ditambahkan');
  });
}

/* Transfer modal (simple) */
function showTransferModal(){
  if(!me) { askLogin(); return; }
  showModal(`
    <h3>Transfer Saldo</h3>
    <div class="form-row">
      <input id="tTo" class="input" placeholder="Email penerima">
      <input id="tAmt" class="input" type="number" placeholder="Nominal">
      <input id="tNote" class="input" placeholder="Catatan (opsional)">
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
        <button id="tCancel" class="btn">Batal</button>
        <button id="tSend" class="btn primary">Kirim</button>
      </div>
    </div>
  `);
  document.getElementById('tCancel').addEventListener('click', closeModal);
  document.getElementById('tSend').addEventListener('click', ()=>{
    const to = document.getElementById('tTo').value.trim().toLowerCase();
    const amt = Number(document.getElementById('tAmt').value);
    const note = document.getElementById('tNote').value.trim();
    if(!to || !amt || amt <= 0) return alert('Isi penerima & nominal');
    if(!users[to]) return alert('Penerima tidak ditemukan.');
    if(Number(me.saldo) < amt) return alert('Saldo tidak cukup.');
    // simple transfer w/o PIN for demo (could require PIN)
    me.saldo = Number(me.saldo) - amt;
    me.history = me.history || [];
    me.history.push({ id: uid(), dateISO: new Date().toISOString(), type:'transfer-out', note: note || `Transfer ke ${to}`, amount: -amt });

    users[to].saldo = Number(users[to].saldo || 0) + amt;
    users[to].history = users[to].history || [];
    users[to].history.push({ id: uid(), dateISO: new Date().toISOString(), type:'transfer-in', note: note || `Transfer dari ${me.email}`, amount: amt });

    users[current] = me; saveUsers(users);
    renderApp(); closeModal(); toast('Transfer berhasil');
  });
}

/* open transactions */
function openTransactions(){
  if(!me) { askLogin(); return; }
  showModal(`
    <h3>Transaksi Saya</h3>
    <div style="max-height:60vh;overflow:auto;margin-top:8px">
      <div id="transactionsList"></div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:10px">
      <button id="closeTx" class="btn primary">Tutup</button>
    </div>
  `);
  const listEl = document.getElementById('transactionsList'); listEl.innerHTML = '';
  const list = (me.history||[]).slice().reverse();
  if(!list.length) listEl.innerHTML = '<div class="empty">Belum ada transaksi</div>';
  else {
    list.forEach(it=>{
      const el = document.createElement('div'); el.className='recent-row';
      el.innerHTML = `<div><div style="font-weight:700">${it.note||it.type}</div><div class="small-muted">${new Date(it.dateISO).toLocaleString()}</div></div><div style="font-weight:800">${fmt(it.amount)}</div>`;
      listEl.appendChild(el);
    });
  }
  document.getElementById('closeTx').addEventListener('click', closeModal);
}

/* profile */
function openProfile(){
  if(!me) { askLogin(); return; }
  showModal(`
    <h3>Profil</h3>
    <div style="text-align:center">
      <img id="pfPic" src="${me.photo && me.photo.startsWith('data:') ? me.photo : genAvatar(me.name)}" style="width:110px;height:110px;border-radius:999px;object-fit:cover"/>
      <div style="font-weight:800;margin-top:8px">${me.name}</div>
      <div class="small-muted">${me.email}</div>
    </div>
    <div class="form-row" style="margin-top:12px">
      <label class="small-muted">Ubah Foto</label>
      <input id="pfFile" type="file" accept="image/*" class="input">
      <label class="small-muted">Nama</label>
      <input id="pfName" class="input" value="${me.name}">
      <label class="small-muted">Nomor Telepon</label>
      <div style="display:flex;gap:8px">
        <input id="pfPhone" class="input" value="${me.phone||''}" placeholder="62...">
        <button id="sendOtp" class="btn">Kirim OTP</button>
      </div>
      <div id="otpArea"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
        <button id="pfCancel" class="btn">Batal</button>
        <button id="pfSave" class="btn primary">Simpan</button>
      </div>
    </div>
  `);

  const pfFile = document.getElementById('pfFile'), pfPic = document.getElementById('pfPic');
  pfFile.addEventListener('change', e=>{
    const f = e.target.files && e.target.files[0]; if(!f) return;
    const reader = new FileReader(); reader.onload = ev => pfPic.src = ev.target.result; reader.readAsDataURL(f);
  });

  document.getElementById('pfCancel').addEventListener('click', closeModal);
  document.getElementById('pfSave').addEventListener('click', ()=>{
    const newName = document.getElementById('pfName').value.trim();
    const newPhone = document.getElementById('pfPhone').value.trim();
    if(!newName) return alert('Nama tidak boleh kosong');
    me.name = newName;
    const pic = pfPic.src && pfPic.src.startsWith('data:') ? pfPic.src : me.photo;
    me.photo = pic;
    if(newPhone && newPhone !== me.phone) me.phoneVerified = false;
    me.phone = newPhone;
    users[current] = me; saveUsers(users);
    renderApp(); closeModal(); toast('Profil disimpan');
  });

  document.getElementById('sendOtp').addEventListener('click', ()=>{
    const phone = document.getElementById('pfPhone').value.trim();
    if(!/^\d{6,15}$/.test(phone)) return alert('Masukkan nomor yang valid (6-15 digit tanpa +).');
    const code = String(Math.floor(100000 + Math.random()*900000));
    me.otpPending = { code, phone, expires: Date.now() + 3*60*1000 };
    users[current] = me; saveUsers(users);
    renderOtpArea(true);
    toast('OTP dikirim (simulasi). Kode tampil di UI untuk demo.');
  });

  function renderOtpArea(reveal=false){
    const area = document.getElementById('otpArea');
    area.innerHTML = `<div class="small-muted" style="margin-top:8px">${me.phoneVerified ? 'Nomor terverifikasi ✅' : 'Belum terverifikasi'}</div>
      <div class="form-row" style="margin-top:6px"><input id="otpIn" class="input" placeholder="Masukkan OTP"><div style="display:flex;gap:8px;justify-content:flex-end"><button id="verifyOtp" class="btn primary">Verifikasi</button></div></div>
      <div class="small-muted">${reveal && me.otpPending ? '[DEBUG] OTP: ' + me.otpPending.code : ''}</div>`;
    document.getElementById('verifyOtp').addEventListener('click', ()=>{
      const v = document.getElementById('otpIn').value.trim();
      if(!me.otpPending || Date.now() > me.otpPending.expires) return alert('OTP kadaluarsa. Kirim ulang.');
      if(v === me.otpPending.code && document.getElementById('pfPhone').value.trim() === me.otpPending.phone){
        me.phone = me.otpPending.phone; me.phoneVerified = true; delete me.otpPending;
        users[current] = me; saveUsers(users);
        toast('Nomor terverifikasi');
        openProfile();
      } else alert('OTP salah atau nomor berbeda.');
    });
  }
  if(me.otpPending) renderOtpArea(true);
}

/* helpers */
function updateBalance(){ $('saldoMain').textContent = fmt(me.saldo); $('balance').textContent = fmt(me.saldo); }
function genAvatar(name){ const initials = (name||'U').split(' ').map(s=>s[0]||'').slice(0,2).join('').toUpperCase()||'U'; return 'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect rx='20' width='100%' height='100%' fill='#eef9f7'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' font-size='72' fill='#0ea5a4' font-family='Inter, sans-serif' font-weight='700'>${initials}</text></svg>`); }

/* click outside modal to close */
modalWrap.addEventListener('click', e => { if(e.target === modalWrap) closeModal(); });

/* utility to expose for console testing */
window._kamikz = { users, saveUsers, loadUsers, setCurrent, getCurrent };
