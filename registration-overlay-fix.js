
// === REGISTRATION OVERLAY FIX ===
(function(){
  function closeStuckOverlays(){
    document.querySelectorAll('.modal-overlay,.home-auth-modal,#homeAuthModal,#subscriptionModal,#uxLoader,.ux-loader').forEach(el=>{
      el.classList.remove('open');
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
    });

    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';

    // If some full-screen dark overlay was injected without known class
    document.querySelectorAll('body > div').forEach(el=>{
      const st = getComputedStyle(el);
      const isFullscreen = (st.position === 'fixed' || st.position === 'absolute') &&
        (el.offsetWidth >= window.innerWidth * 0.95) &&
        (el.offsetHeight >= window.innerHeight * 0.95);

      if(isFullscreen && (st.backgroundColor.includes('rgba') || st.backgroundColor.includes('rgb')) && el.id !== 'root'){
        if(el.textContent.trim().length < 20 && !el.querySelector('input,button,.app')){
          el.style.display = 'none';
        }
      }
    });
  }

  function readUser(){
    try { return JSON.parse(localStorage.getItem('sp_user') || '{}'); }
    catch(e){ return {}; }
  }

  function refreshMainStatus(){
    const u = readUser();
    const cards = document.querySelectorAll('.user-status,[data-ux-account-card],#homeAuthPanel');

    cards.forEach(card=>{
      const title = card.querySelector('h3,.home-auth-name,#homeAuthName');
      const desc = card.querySelector('p,.home-auth-meta,#homeAuthMeta');
      card.style.cursor = 'pointer';

      if(u && u.role && u.role !== 'guest'){
        if(['admin','owner'].includes(u.role)){
          if(title) title.textContent = 'Администратор';
          if(desc) desc.textContent = 'Открыть панель управления';
          card.onclick = () => location.href = '/admin/';
        } else {
          if(title) title.textContent = 'Бесплатный доступ';
          if(desc) desc.textContent = 'Открыть тарифы и возможности';
          card.onclick = () => location.href = '/subscription/';
        }
      } else {
        if(title) title.textContent = 'Гость';
        if(desc) desc.textContent = 'Войдите или зарегистрируйтесь';
        card.onclick = () => location.href = '/registration/';
      }
    });
  }

  document.addEventListener('DOMContentLoaded',()=>{
    closeStuckOverlays();
    refreshMainStatus();
    setTimeout(closeStuckOverlays, 100);
    setTimeout(closeStuckOverlays, 500);
  });

  window.addEventListener('pageshow',()=>{
    closeStuckOverlays();
    refreshMainStatus();
  });
})();
