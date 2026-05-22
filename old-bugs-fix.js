
(function(){
  function user(){
    try{return JSON.parse(localStorage.getItem('sp_user')||'{}')}catch(e){return{}}
  }
  function isReg(){const u=user(); return !!(u.role && u.role!=='guest')}
  function isAdmin(){const u=user(); return ['admin','owner'].includes(u.role)}
  function paidChat(){const u=user(); return isAdmin() || ['orders','pro','paid','paid_user'].includes(u.plan)}
  function name(){const u=user(); return u.displayName||u.name||'Пользователь'}

  function clearChatIdentity(){
    ['chatUser','chat_username','currentChatUser','chatAuthor'].forEach(k=>localStorage.removeItem(k));
    localStorage.setItem('chatUserName', name());
  }

  window.AppFix = {
    user,isReg,isAdmin,paidChat,name,clearChatIdentity,
    reset(){
      localStorage.removeItem('sp_user');
      ['chatUser','chat_username','currentChatUser','chatAuthor','chatUserName'].forEach(k=>localStorage.removeItem(k));
      alert('Профиль сброшен. Вы вошли как гость.');
      location.href='/';
    }
  };

  function refreshTop(){
    document.querySelectorAll('.user-status,[data-ux-account-card],#homeAuthPanel').forEach(card=>{
      card.style.cursor='pointer';
      const title=card.querySelector('h3,.home-auth-name,#homeAuthName');
      const desc=card.querySelector('p,.home-auth-meta,#homeAuthMeta');

      if(!isReg()){
        if(title) title.textContent='Гость';
        if(desc) desc.textContent='Войдите или зарегистрируйтесь';
        card.onclick=()=>location.href='/registration/';
      }else if(isAdmin()){
        if(title) title.textContent='Администратор';
        if(desc) desc.textContent='Открыть панель управления';
        card.onclick=()=>location.href='/admin/';
      }else{
        if(title) title.textContent='Бесплатный доступ';
        if(desc) desc.textContent='Открыть тарифы и возможности';
        card.onclick=()=>location.href='/subscription/';
      }
    });
  }

  function showChatPaywall(){
    document.body.innerHTML = `
      <div class="app">
        <header class="page-header">
          <button class="back-btn" onclick="location.href='/'">←</button>
          <div class="page-title">Закрытый чат</div>
          <div class="header-spacer"></div>
        </header>
        <main class="content">
          <section class="hero-card section-hero">
            <div class="section-hero-top">
              <div class="section-icon">🔒</div>
              <div>
                <div class="section-mini-title">доступ по тарифу</div>
                <h1 class="section-hero-title">Закрытый чат недоступен</h1>
              </div>
            </div>
            <p class="section-description">
              Чат доступен пользователям с тарифом «Заказы» или PRO. Подключите тариф, чтобы читать и писать сообщения.
            </p>
            <div class="card-actions">
              <button class="submit-button" onclick="location.href='/subscription/'">Открыть тарифы</button>
              <button class="reset-button" onclick="location.href='/'">На главную</button>
            </div>
          </section>
        </main>
      </div>`;
  }

  function protectChat(){
    const path = location.pathname.toLowerCase();
    const isChatPage = path.includes('chat') || path.includes('closed-chat');
    if(!isChatPage) return;

    clearChatIdentity();

    if(!paidChat()){
      showChatPaywall();
      return;
    }

    // Paid user/admin: keep existing chat page, only hide admin tools for normal paid users.
    setTimeout(()=>{
      const panels = [...document.querySelectorAll('div,section')].filter(el =>
        el.textContent && el.textContent.includes('Админ-панель')
      );
      panels.forEach(panel => {
        if(!isAdmin()) panel.style.display = 'none';
      });

      document.querySelectorAll('*').forEach(el=>{
        if(el.children.length===0 && el.textContent && el.textContent.includes('Арстан Бикимбаев')){
          el.textContent = el.textContent.replaceAll('Арстан Бикимбаев', name());
        }
      });
    }, 300);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    refreshTop();
    protectChat();
    clearChatIdentity();
  });

  const oldSet=localStorage.setItem.bind(localStorage);
  localStorage.setItem=function(k,v){
    oldSet(k,v);
    if(k==='sp_user') setTimeout(()=>{refreshTop();clearChatIdentity();},50);
  };
})();
