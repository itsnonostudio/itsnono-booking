/**
 * admin-auth.js — 後台：密碼登入 + 修改密碼（前端）
 *
 * 初始密碼是 12345（設定在 Admin.gs 的 DEFAULT_PASSWORD）。
 * 用預設密碼登入後，會先被帶到「修改密碼」畫面，改完才能使用後台。
 * 請不要把預設密碼顯示在登入頁上。
 *
 * 用法：
 *   <div id="auth-root"></div>
 *   <script src="admin-auth.js"></script>
 *   <script>
 *     showAuth(document.getElementById('auth-root'), () => {
 *       // 登入成功：顯示後台、載入資料
 *       adminCall('getAll').then(console.log);
 *     });
 *   </script>
 *
 * 後台設定頁的「修改密碼」按鈕：
 *   showChangePassword(document.getElementById('modal-root'), () => alert('已更新'));
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbxWraGT9ew4NYdD_AZmBt6kBwkdRzJSDJFQ8CNugw_mYEeURSwPWS9luBgIahrzeI6q/exec';

let session = sessionStorage.getItem('adminSession') || '';
let authRoot = null;
let authDone = null;

/* ---------- API ---------- */

// 用 text/plain 可避免 CORS preflight，GAS 才收得到
async function rawApi(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  return res.json();
}

function saveSession(token) {
  session = token;
  sessionStorage.setItem('adminSession', token);
}

function clearSession() {
  session = '';
  sessionStorage.removeItem('adminSession');
}

/**
 * 呼叫後台 API。session 過期時會自動回到登入畫面。
 * 用法：const data = await adminCall('getAll', { fromDate: '2026-10-01' });
 */
async function adminCall(action, data = {}) {
  const r = await rawApi({ action, session, ...data });

  if (!r.ok && (r.code === 'SESSION_EXPIRED' || r.code === 'MUST_CHANGE')) {
    clearSession();
    if (authRoot) showAuth(authRoot, authDone);
    throw new Error(r.error || '登入已過期，請重新登入');
  }

  if (!r.ok) throw new Error(r.error || '操作失敗');

  return r;
}

async function adminLogout() {
  try {
    await rawApi({ action: 'logout', session });
  } catch (e) {}

  clearSession();
  if (authRoot) showAuth(authRoot, authDone);
}

/* ---------- 畫面樣式 ---------- */

const UI = {
  wrap: 'max-width:360px;margin:40px auto;padding:24px;background:#FDFBF7;' +
    'border:1px solid #D7C4B7;border-radius:12px;font-family:sans-serif;color:#4A3E3D',
  input: 'width:100%;box-sizing:border-box;padding:10px;margin:6px 0 14px;' +
    'border:1px solid #D7C4B7;border-radius:8px;font-size:16px',
  btn: 'width:100%;padding:12px;border:0;border-radius:8px;background:#6C594B;' +
    'color:#FDFBF7;font-size:16px;cursor:pointer',
  err: 'color:#B3261E;font-size:14px;min-height:20px;margin-bottom:8px',
  hint: 'font-size:12px;margin:-8px 0 14px;color:#7A6B64'
};

/* ---------- 登入 ---------- */

/**
 * 顯示登入畫面；已有有效 session 時直接呼叫 onSuccess。
 */
async function showAuth(root, onSuccess) {
  authRoot = root;
  authDone = onSuccess;

  if (session) {
    try {
      const me = await rawApi({ action: 'whoami', session });

      if (me.ok && !me.mustChange) {
        onSuccess && onSuccess();
        return;
      }
    } catch (e) {}

    clearSession();
  }

  renderLogin(root, onSuccess);
}

function renderLogin(root, onSuccess) {
  root.innerHTML =
    '<div style="' + UI.wrap + '">' +
    '<h3 style="margin-top:0">後台登入</h3>' +
    '<label>密碼</label>' +
    '<input id="l-pw" type="password" style="' + UI.input + '" autocomplete="current-password">' +
    '<div id="l-err" style="' + UI.err + '"></div>' +
    '<button id="l-go" style="' + UI.btn + '">登入</button>' +
    '</div>';

  const err = root.querySelector('#l-err');
  const btn = root.querySelector('#l-go');
  const pwInput = root.querySelector('#l-pw');

  const go = async () => {
    err.textContent = '';
    btn.disabled = true;

    try {
      const typed = pwInput.value;
      const r = await rawApi({ action: 'login', pw: typed });

      if (!r.ok) throw new Error(r.error || '登入失敗');

      saveSession(r.session);

      if (r.mustChange) {
        // 還在用預設密碼：必須先修改
        renderForcedChange(root, onSuccess, typed, r.requireSetupCode);
        return;
      }

      root.innerHTML = '';
      onSuccess && onSuccess();
    } catch (e) {
      err.textContent = e.message;
      btn.disabled = false;
    }
  };

  btn.onclick = go;
  pwInput.onkeydown = (ev) => { if (ev.key === 'Enter') go(); };
}

/* ---------- 第一次登入：強制修改預設密碼 ---------- */

function renderForcedChange(root, onSuccess, oldPassword, requireSetupCode) {
  root.innerHTML =
    '<div style="' + UI.wrap + '">' +
    '<h3 style="margin-top:0">請先修改密碼</h3>' +
    '<p style="font-size:14px">你正在使用預設密碼，請設定一組新的後台密碼。</p>' +
    (requireSetupCode
      ? '<label>設定碼</label>' +
        '<input id="c-code" style="' + UI.input + '" autocomplete="off">' +
        '<div style="' + UI.hint + '">請到你的試算表「後台設定」分頁，複製 B1 儲存格的設定碼</div>'
      : '') +
    '<label>新密碼（至少 8 個字元）</label>' +
    '<input id="c-new" type="password" style="' + UI.input + '" autocomplete="new-password">' +
    '<label>確認新密碼</label>' +
    '<input id="c-new2" type="password" style="' + UI.input + '" autocomplete="new-password">' +
    '<div id="c-err" style="' + UI.err + '"></div>' +
    '<button id="c-save" style="' + UI.btn + '">儲存</button>' +
    '</div>';

  const err = root.querySelector('#c-err');
  const btn = root.querySelector('#c-save');

  btn.onclick = async () => {
    err.textContent = '';
    btn.disabled = true;

    try {
      const r = await rawApi({
        action: 'changePassword',
        session,
        oldPassword,
        setupCode: requireSetupCode ? root.querySelector('#c-code').value : '',
        newPassword: root.querySelector('#c-new').value,
        confirm: root.querySelector('#c-new2').value
      });

      if (!r.ok) throw new Error(r.error || '修改失敗');

      saveSession(r.session);
      root.innerHTML = '';
      onSuccess && onSuccess();
    } catch (e) {
      err.textContent = e.message;
      btn.disabled = false;
    }
  };
}

/* ---------- 登入後：修改密碼（放在後台設定頁） ---------- */

function showChangePassword(root, onDone) {
  root.innerHTML =
    '<div style="' + UI.wrap + '">' +
    '<h3 style="margin-top:0">修改密碼</h3>' +
    '<label>目前的密碼</label>' +
    '<input id="m-old" type="password" style="' + UI.input + '" autocomplete="current-password">' +
    '<label>新密碼（至少 8 個字元）</label>' +
    '<input id="m-new" type="password" style="' + UI.input + '" autocomplete="new-password">' +
    '<label>確認新密碼</label>' +
    '<input id="m-new2" type="password" style="' + UI.input + '" autocomplete="new-password">' +
    '<div id="m-err" style="' + UI.err + '"></div>' +
    '<button id="m-save" style="' + UI.btn + '">儲存</button>' +
    '</div>';

  const err = root.querySelector('#m-err');
  const btn = root.querySelector('#m-save');

  btn.onclick = async () => {
    err.textContent = '';
    btn.disabled = true;

    try {
      const r = await adminCall('changePassword', {
        oldPassword: root.querySelector('#m-old').value,
        newPassword: root.querySelector('#m-new').value,
        confirm: root.querySelector('#m-new2').value
      });

      saveSession(r.session); // 新密碼會讓舊 session 失效，換成新的
      root.innerHTML = '';
      onDone && onDone();
    } catch (e) {
      err.textContent = e.message;
      btn.disabled = false;
    }
  };
}
