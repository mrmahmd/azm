(function () {
  'use strict';

  const form = document.getElementById('reset-form');
  const status = document.getElementById('reset-status');
  const token = new URLSearchParams(location.hash.slice(1)).get('recovery');
  if (location.hash) history.replaceState(null, '', location.pathname);
  if (!token || !/^[a-z0-9_-]{30,256}$/i.test(token)) {
    status.textContent = 'رابط الاستعادة غير صالح. اطلب رابطًا جديدًا من الدعم الفني.';
    return;
  }
  const config = window.AZM_CONFIG;
  const auth = window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'azm-password-recovery' }
  }).auth;
  let verified = false;
  form.hidden = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const password = document.getElementById('reset-pass').value;
    if (password.length < 8 || !/\d/.test(password)) {
      status.textContent = 'راجع شروط كلمة المرور.';
      return;
    }
    if (password !== document.getElementById('reset-repeat').value) {
      status.textContent = 'كلمتا المرور غير متطابقتين.';
      return;
    }
    const submit = form.querySelector('button');
    submit.disabled = true;
    status.textContent = 'جاري حفظ كلمة المرور…';
    try {
      if (!verified) {
        const { data, error } = await auth.verifyOtp({ token_hash: token, type: 'recovery' });
        if (error || !data.session) {
          form.hidden = true;
          status.textContent = 'رابط الاستعادة منتهي أو مستخدم. اطلب رابطًا جديدًا من الدعم الفني.';
          return;
        }
        verified = true;
      }
      const { error } = await auth.updateUser({ password });
      if (error) throw error;
      form.reset();
      form.hidden = true;
      status.classList.remove('form-error');
      status.textContent = 'تم حفظ كلمة المرور. سجّل دخولك بكلمة المرور الجديدة.';
      await auth.signOut({ scope: 'global' }).catch(() => {});
    } catch {
      status.textContent = 'تعذّر حفظ كلمة المرور. حاول مرة أخرى أو تواصل مع الدعم الفني.';
    } finally {
      submit.disabled = false;
    }
  });
})();
