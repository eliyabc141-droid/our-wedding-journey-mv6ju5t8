// Couple Wedding App Logic
(function () {
  'use strict';

  // --- IndexedDB for Memories Photos ---
  const DB_NAME = 'WeddingAppDB';
  const DB_VERSION = 1;
  const STORE_MEMORIES = 'memories';

  let dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_MEMORIES)) {
        db.createObjectStore(STORE_MEMORIES, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  async function idbGetAllMemories() {
    try {
      const db = await dbPromise;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MEMORIES, 'readonly');
        const store = tx.objectStore(STORE_MEMORIES);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IDB fallback to localStorage', err);
      return JSON.parse(localStorage.getItem('wedding_memories_fallback') || '[]');
    }
  }

  async function idbSaveMemory(memory) {
    try {
      const db = await dbPromise;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MEMORIES, 'readwrite');
        const store = tx.objectStore(STORE_MEMORIES);
        const req = store.put(memory);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Saving to fallback', err);
      const list = JSON.parse(localStorage.getItem('wedding_memories_fallback') || '[]');
      const idx = list.findIndex(m => m.id === memory.id);
      if (idx >= 0) list[idx] = memory; else list.push(memory);
      localStorage.setItem('wedding_memories_fallback', JSON.stringify(list));
    }
  }

  async function idbDeleteMemory(id) {
    try {
      const db = await dbPromise;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MEMORIES, 'readwrite');
        const store = tx.objectStore(STORE_MEMORIES);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      let list = JSON.parse(localStorage.getItem('wedding_memories_fallback') || '[]');
      list = list.filter(m => m.id !== id);
      localStorage.setItem('wedding_memories_fallback', JSON.stringify(list));
    }
  }

  // --- PASSCODE / AUTHENTICATION LOGIC ---
  const DEFAULT_PASSCODE = '1234';

  function getPasscode() {
    return localStorage.getItem('wedding_passcode') || DEFAULT_PASSCODE;
  }

  function setPasscode(newCode) {
    localStorage.setItem('wedding_passcode', newCode);
  }

  function checkAuthentication() {
    const isAuth = sessionStorage.getItem('wedding_authenticated') === 'true';
    if (isAuth) {
      loginOverlay.classList.add('hidden');
    } else {
      loginOverlay.classList.remove('hidden');
      setTimeout(() => {
        if (passcodeInput) passcodeInput.focus();
      }, 150);
    }
  }

  function setupPasscodeGate() {
    checkAuthentication();

    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const entered = passcodeInput.value.trim();
      const correct = getPasscode();

      if (entered === correct) {
        sessionStorage.setItem('wedding_authenticated', 'true');
        loginOverlay.classList.add('hidden');
        loginErrorMsg.classList.add('hidden');
        passcodeInput.value = '';
        showToast('ברוכים הבאים! ✨');
      } else {
        loginErrorMsg.classList.remove('hidden');
        const card = document.querySelector('.login-card');
        if (card) {
          card.classList.remove('shake');
          void card.offsetWidth; // force reflow
          card.classList.add('shake');
        }
      }
    });

    if (togglePassVisibilityBtn) {
      togglePassVisibilityBtn.addEventListener('click', () => {
        const isPass = passcodeInput.type === 'password';
        passcodeInput.type = isPass ? 'text' : 'password';
        togglePassVisibilityBtn.querySelector('i').className = isPass ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
      });
    }

    if (lockAppBtn) {
      lockAppBtn.addEventListener('click', () => {
        sessionStorage.removeItem('wedding_authenticated');
        checkAuthentication();
        showToast('האפליקציה ננעלה 🔒');
      });
    }
  }

  // --- DATA RESET LOGIC ---
  async function resetAllData() {
    if (!confirm('האם אתם בטוחים לחלוטין שברצונכם לאפס את כל נתוני האתר?\nפעולה זו תמחק את כל האירועים, הזכרונות, ההודעות וההגדרות ולא ניתן לבטלה!')) {
      return;
    }

    try {
      const db = await dbPromise;
      if (db) db.close();
    } catch (e) {
      console.warn('IDB close warning:', e);
    }

    const deleteReq = indexedDB.deleteDatabase(DB_NAME);
    const finishReset = () => {
      localStorage.clear();
      sessionStorage.clear();
      alert('כל נתוני האתר אופסו בהצלחה!');
      location.reload();
    };

    deleteReq.onsuccess = finishReset;
    deleteReq.onerror = finishReset;
    deleteReq.onblocked = finishReset;
  }

  // --- Default Couple Settings ---
  const defaultSettings = {
    groom: 'עומר',
    bride: 'נועה',
    weddingDate: getFutureDateString(120),
    weddingTime: '19:30',
    venue: 'אולמי האחוזה, מודיעין'
  };

  function getFutureDateString(daysAhead) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  }

  let settings = Object.assign({}, defaultSettings, JSON.parse(localStorage.getItem('wedding_settings') || '{}'));

  // Default romantic quotes
  const quotes = [
    '״מים רבים לא יוכלו לכבות את האהבה ונהרות לא ישטפוה״',
    '״מצאתי את שאהבה נפשי, אחזתיו ולא ארפנו״',
    '״ואהבת עולם אהבתיך, על כן משכתיך חסד״',
    '״טובים השניים מן האחד... כי אם ייפלו האחד יקים את חברו״',
    '״כל ששון וכל שמחה, קול חתן וקול כלה״',
    '״בכל יום אני בוחר/ת בך מחדש לעוד הרפתקה של חיים שלמים״',
    '״הלב שלי ידע מהרגע הראשון שזה לתמיד״'
  ];

  // Default Events
  const defaultEvents = [
    {
      id: 'ev-1',
      title: 'טעימות של התפריט באולם',
      date: getRelativeDate(14),
      time: '19:00',
      category: 'tastings',
      location: 'אולמי האחוזה',
      notes: 'להביא את ההורים של שני הצדדים!'
    },
    {
      id: 'ev-2',
      title: 'מדידה שנייה לשמלת כלה',
      date: getRelativeDate(25),
      time: '14:30',
      category: 'fittings',
      location: 'סטודיו דיזנגוף, תל אביב',
      notes: 'לקחת את הנעליים כדי למדוד אורך מכפלת'
    },
    {
      id: 'ev-3',
      title: 'פגישת מוזיקה עם הדיג\'יי',
      date: getRelativeDate(40),
      time: '20:00',
      category: 'vendors',
      location: 'זום / סטודיו',
      notes: 'להכין רשימת שיר חופה, שיר כניסה ושיר שבירת כוס'
    },
    {
      id: 'ev-4',
      title: 'מסיבת רווקים & רווקות',
      date: getRelativeDate(95),
      time: '16:00',
      category: 'party',
      location: 'וילה בצפון',
      notes: 'בגדי ים, מצב רוח ואלכוהול משובח'
    }
  ];

  function getRelativeDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  let events = JSON.parse(localStorage.getItem('wedding_events') || JSON.stringify(defaultEvents));

  // Default Chat Messages
  const defaultChat = [
    {
      id: 'c-1',
      sender: 'groom',
      text: 'חיים שלי, דיברתי עם הצלם והוא סגור על התאריך שלנו! 📸',
      time: '10:14',
      hearts: 2
    },
    {
      id: 'c-2',
      sender: 'bride',
      text: 'איזה מושלם אתה!! בדיוק סיימתי לבחור את הפרחים לחופה 🌸❤️',
      time: '10:18',
      hearts: 3
    },
    {
      id: 'c-3',
      sender: 'groom',
      text: 'לא מאמין שעוד מעט נרקוד שם יחד. אוהב אותך עד אין סוף! 💍✨',
      time: '10:20',
      hearts: 5
    }
  ];

  let chatMessages = JSON.parse(localStorage.getItem('wedding_chat') || JSON.stringify(defaultChat));

  // Seed memory initial
  async function seedInitialMemoriesIfEmpty() {
    const existing = await idbGetAllMemories();
    if (existing.length === 0) {
      const sampleSvg = createSampleSvgPhoto();
      await idbSaveMemory({
        id: 'mem-1',
        title: 'הרגע שאמרת לי כן! 💍',
        date: getRelativeDate(-60),
        story: 'בשקיעה על המצוק, עם הבריזה של הים והלב שדפק במאתיים קמ״ש. אחד הימים המרגשים ביקום!',
        image: sampleSvg
      });
      renderMemories();
    }
  }

  function createSampleSvgPhoto() {
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff7e5f"/>
          <stop offset="60%" stop-color="#feb47b"/>
          <stop offset="100%" stop-color="#ffeccc"/>
        </linearGradient>
      </defs>
      <rect width="600" height="400" fill="url(#sky)"/>
      <circle cx="300" cy="220" r="70" fill="#fff5eb" opacity="0.85"/>
      <path d="M0 320 Q 200 280, 400 330 T 600 310 L 600 400 L 0 400 Z" fill="#2d1b2d" opacity="0.8"/>
      <path d="M0 350 Q 300 320, 600 360 L 600 400 L 0 400 Z" fill="#170c17"/>
      <circle cx="280" cy="265" r="9" fill="#170c17"/>
      <path d="M272 278 Q 280 274, 288 278 L 290 320 L 270 320 Z" fill="#170c17"/>
      <circle cx="302" cy="268" r="8.5" fill="#170c17"/>
      <path d="M294 280 Q 302 275, 310 280 L 316 320 L 292 320 Z" fill="#170c17"/>
      <text x="300" y="140" font-size="44" text-anchor="middle" fill="#ffffff" opacity="0.95">💍❤️</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  }

  // DOM Elements
  const loginOverlay = document.getElementById('loginOverlay');
  const loginForm = document.getElementById('loginForm');
  const passcodeInput = document.getElementById('passcodeInput');
  const togglePassVisibilityBtn = document.getElementById('togglePassVisibilityBtn');
  const loginErrorMsg = document.getElementById('loginErrorMsg');
  const lockAppBtn = document.getElementById('lockAppBtn');

  const coupleNamesDisplay = document.getElementById('coupleNamesDisplay');
  const weddingDateDisplay = document.getElementById('weddingDateDisplay');
  const cdDays = document.getElementById('cdDays');
  const cdHours = document.getElementById('cdHours');
  const cdMinutes = document.getElementById('cdMinutes');
  const cdSeconds = document.getElementById('cdSeconds');
  const weddingPassedNotice = document.getElementById('weddingPassedNotice');
  const confettiBtn = document.getElementById('confettiBtn');
  const dailyLoveQuote = document.getElementById('dailyLoveQuote');
  const newQuoteBtn = document.getElementById('newQuoteBtn');
  const nextEventText = document.getElementById('nextEventText');
  const memoriesCountText = document.getElementById('memoriesCountText');
  const loveBurstBtn = document.getElementById('loveBurstBtn');
  const eventsBadge = document.getElementById('eventsBadge');
  const memoriesBadge = document.getElementById('memoriesBadge');

  const navBtns = document.querySelectorAll('.nav-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  const eventsContainer = document.getElementById('eventsContainer');
  const openAddEventBtn = document.getElementById('openAddEventBtn');
  const eventModal = document.getElementById('eventModal');
  const eventForm = document.getElementById('eventForm');
  const eventModalTitle = document.getElementById('eventModalTitle');
  const filterChips = document.querySelectorAll('.chip');
  let currentEventFilter = 'all';

  const memoriesGrid = document.getElementById('memoriesGrid');
  const openAddMemoryBtn = document.getElementById('openAddMemoryBtn');
  const memoryModal = document.getElementById('memoryModal');
  const memoryForm = document.getElementById('memoryForm');
  const memoryImageInput = document.getElementById('memoryImageInput');
  const imagePreview = document.getElementById('imagePreview');
  const previewPlaceholder = document.getElementById('previewPlaceholder');
  const viewMemoryModal = document.getElementById('viewMemoryModal');
  const viewMemoryImg = document.getElementById('viewMemoryImg');
  const viewMemoryTitle = document.getElementById('viewMemoryTitle');
  const viewMemoryDate = document.getElementById('viewMemoryDate');
  const viewMemoryStory = document.getElementById('viewMemoryStory');
  const deleteMemoryBtn = document.getElementById('deleteMemoryBtn');
  let activeViewingMemoryId = null;
  let stagedMemoryBase64 = null;

  const currentSenderSelect = document.getElementById('currentSenderSelect');
  const chatMessagesContainer = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const quickEmojiBtns = document.querySelectorAll('.quick-emoji-btn');

  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const settingsForm = document.getElementById('settingsForm');
  const groomNameInput = document.getElementById('groomNameInput');
  const brideNameInput = document.getElementById('brideNameInput');
  const weddingDateInput = document.getElementById('weddingDateInput');
  const weddingTimeInput = document.getElementById('weddingTimeInput');
  const venueNameInput = document.getElementById('venueNameInput');
  const settingsPasscodeInput = document.getElementById('settingsPasscodeInput');
  const resetDataBtn = document.getElementById('resetDataBtn');

  const toastNotification = document.getElementById('toastNotification');

  // INITIALIZATION
  function init() {
    setupPasscodeGate();
    updateHeaderInfo();
    setupCountdown();
    setupQuote();
    renderEvents();
    renderMemories();
    renderChat();
    setupNav();
    setupModals();
    seedInitialMemoriesIfEmpty();
  }

  // NAVIGATION
  function setupNav() {
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        navBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const activePanel = document.getElementById(targetTab);
        if (activePanel) activePanel.classList.add('active');

        if (targetTab === 'tab-chat') {
          setTimeout(scrollChatToBottom, 100);
        }
      });
    });
  }

  // TOAST HELPER
  let toastTimer = null;
  function showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    toastNotification.textContent = msg;
    toastNotification.classList.remove('hidden');
    toastTimer = setTimeout(() => {
      toastNotification.classList.add('hidden');
    }, 3000);
  }

  // HEADER & SETTINGS
  function updateHeaderInfo() {
    coupleNamesDisplay.textContent = `${settings.groom} & ${settings.bride}`;
    const d = new Date(settings.weddingDate + 'T' + (settings.weddingTime || '19:30'));
    const formattedDate = !isNaN(d) ? d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) : settings.weddingDate;
    weddingDateDisplay.textContent = `${formattedDate} • ${settings.venue || 'האולם שלנו'}`;

    if (currentSenderSelect) {
      currentSenderSelect.options[0].textContent = `${settings.groom} (החתן)`;
      currentSenderSelect.options[1].textContent = `${settings.bride} (הכלה)`;
    }
  }

  openSettingsBtn.addEventListener('click', () => {
    groomNameInput.value = settings.groom;
    brideNameInput.value = settings.bride;
    weddingDateInput.value = settings.weddingDate;
    weddingTimeInput.value = settings.weddingTime || '19:30';
    venueNameInput.value = settings.venue || '';
    settingsPasscodeInput.value = getPasscode();
    settingsModal.classList.remove('hidden');
  });

  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    settings.groom = groomNameInput.value.trim() || 'החתן';
    settings.bride = brideNameInput.value.trim() || 'הכלה';
    settings.weddingDate = weddingDateInput.value;
    settings.weddingTime = weddingTimeInput.value || '19:30';
    settings.venue = venueNameInput.value.trim();

    const newPass = settingsPasscodeInput.value.trim();
    if (newPass) {
      setPasscode(newPass);
    }

    localStorage.setItem('wedding_settings', JSON.stringify(settings));
    updateHeaderInfo();
    updateCountdown();
    settingsModal.classList.add('hidden');
    showToast('ההגדרות והסיסמה עודכנו בהצלחה! 💖');
  });

  if (resetDataBtn) {
    resetDataBtn.addEventListener('click', resetAllData);
  }

  // COUNTDOWN TIMER
  let countdownInterval = null;

  function updateCountdown() {
    const targetString = `${settings.weddingDate}T${settings.weddingTime || '19:30'}:00`;
    const targetDate = new Date(targetString).getTime();
    const now = new Date().getTime();
    const diff = targetDate - now;

    if (isNaN(targetDate) || diff <= 0) {
      cdDays.textContent = '00';
      cdHours.textContent = '00';
      cdMinutes.textContent = '00';
      cdSeconds.textContent = '00';
      weddingPassedNotice.classList.remove('hidden');
      return;
    }

    weddingPassedNotice.classList.add('hidden');

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    cdDays.textContent = String(days).padStart(2, '0');
    cdHours.textContent = String(hours).padStart(2, '0');
    cdMinutes.textContent = String(minutes).padStart(2, '0');
    cdSeconds.textContent = String(seconds).padStart(2, '0');
  }

  function setupCountdown() {
    updateCountdown();
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateCountdown, 1000);

    if (confettiBtn) {
      confettiBtn.addEventListener('click', fireConfetti);
    }

    if (loveBurstBtn) {
      loveBurstBtn.addEventListener('click', () => {
        fireConfetti();
        showToast(`נשלח גל של אהבה ל${settings.bride} ול${settings.groom}! 🥰❤️`);
      });
    }
  }

  function fireConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#c59b51', '#ff758c', '#ffd700', '#ff9a9e']
      });
    }
  }

  // ROMANTIC QUOTES
  function setupQuote() {
    setRandomQuote();
    newQuoteBtn.addEventListener('click', setRandomQuote);
  }

  function setRandomQuote() {
    const randomIdx = Math.floor(Math.random() * quotes.length);
    dailyLoveQuote.textContent = quotes[randomIdx];
  }

  // EVENTS / CALENDAR LOGIC
  function renderEvents() {
    const sorted = [...events].sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')));

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let filtered = sorted;
    if (currentEventFilter === 'upcoming') {
      filtered = sorted.filter(ev => ev.date >= todayStr);
    } else if (currentEventFilter !== 'all') {
      filtered = sorted.filter(ev => ev.category === currentEventFilter);
    }

    eventsBadge.textContent = sorted.filter(ev => ev.date >= todayStr).length;

    const nextEvent = sorted.find(ev => ev.date >= todayStr);
    if (nextEvent) {
      const d = new Date(nextEvent.date);
      const dayName = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
      nextEventText.textContent = `${nextEvent.title} (${dayName})`;
    } else {
      nextEventText.textContent = 'כל האירועים עברו או שלא נוספו אירועים';
    }

    if (filtered.length === 0) {
      eventsContainer.innerHTML = `
        <div class="empty-state">
          <i class="fa-regular fa-calendar-xmark"></i>
          <h3>אין אירועים להצגה</h3>
          <p>לחצו על "הוספת אירוע" כדי לרשום פגישה, טעימות או מסיבה!</p>
        </div>
      `;
      return;
    }

    const categoryNames = {
      tastings: '🍽️ טעימות ואולם',
      fittings: '👗 שמלה וחליפה',
      vendors: '📸 צלם וספקים',
      party: '🎉 מסיבות',
      general: '📝 כללי'
    };

    eventsContainer.innerHTML = filtered.map(ev => {
      const evDate = new Date(ev.date + 'T12:00:00');
      const day = evDate.getDate();
      const monthName = evDate.toLocaleDateString('he-IL', { month: 'short' });
      const isPast = ev.date < todayStr;

      return `
        <div class="event-card ${isPast ? 'past-event' : ''}" data-id="${ev.id}">
          <div class="event-main">
            <div class="event-date-badge">
              <span class="badge-day">${day}</span>
              <span class="badge-month">${monthName}</span>
            </div>
            <div class="event-content">
              <div class="event-title-row">
                <span class="event-title">${escapeHtml(ev.title)}</span>
                <span class="category-tag">${categoryNames[ev.category] || 'כללי'}</span>
                ${isPast ? '<span class="category-tag" style="background:#e0dedb;">עבר</span>' : ''}
              </div>
              <div class="event-meta">
                ${ev.time ? `<span><i class="fa-regular fa-clock"></i> ${escapeHtml(ev.time)}</span>` : ''}
                ${ev.location ? `<span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(ev.location)}</span>` : ''}
              </div>
              ${ev.notes ? `<div class="event-notes">${escapeHtml(ev.notes)}</div>` : ''}
            </div>
          </div>
          <div class="event-actions">
            <button class="icon-action-btn edit-event-btn" data-id="${ev.id}" title="ערוך"><i class="fa-regular fa-pen-to-square"></i></button>
            <button class="icon-action-btn delete-btn delete-event-btn" data-id="${ev.id}" title="מחק"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        </div>
      `;
    }).join('');

    eventsContainer.querySelectorAll('.delete-event-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (confirm('האם למחוק אירוע זה מיומן החתונה?')) {
          events = events.filter(item => item.id !== id);
          localStorage.setItem('wedding_events', JSON.stringify(events));
          renderEvents();
          showToast('האירוע הוסר מהיומן.');
        }
      });
    });

    eventsContainer.querySelectorAll('.edit-event-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const item = events.find(ev => ev.id === id);
        if (item) openEventEdit(item);
      });
    });
  }

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentEventFilter = chip.getAttribute('data-filter');
      renderEvents();
    });
  });

  openAddEventBtn.addEventListener('click', () => {
    eventForm.reset();
    document.getElementById('eventId').value = '';
    eventModalTitle.textContent = 'הוספת אירוע או פגישה';
    document.getElementById('eventDate').value = new Date().toISOString().split('T')[0];
    eventModal.classList.remove('hidden');
  });

  function openEventEdit(item) {
    document.getElementById('eventId').value = item.id;
    document.getElementById('eventTitle').value = item.title;
    document.getElementById('eventDate').value = item.date;
    document.getElementById('eventTime').value = item.time || '';
    document.getElementById('eventCategory').value = item.category || 'general';
    document.getElementById('eventLocation').value = item.location || '';
    document.getElementById('eventNotes').value = item.notes || '';
    eventModalTitle.textContent = 'עריכת אירוע';
    eventModal.classList.remove('hidden');
  }

  eventForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('eventId').value || ('ev-' + Date.now());
    const newEvent = {
      id,
      title: document.getElementById('eventTitle').value.trim(),
      date: document.getElementById('eventDate').value,
      time: document.getElementById('eventTime').value,
      category: document.getElementById('eventCategory').value,
      location: document.getElementById('eventLocation').value.trim(),
      notes: document.getElementById('eventNotes').value.trim()
    };

    const existingIdx = events.findIndex(ev => ev.id === id);
    if (existingIdx >= 0) {
      events[existingIdx] = newEvent;
      showToast('האירוע עודכן בהצלחה! 📅');
    } else {
      events.push(newEvent);
      showToast('האירוע נוסף ליומן! 🥂');
    }

    localStorage.setItem('wedding_events', JSON.stringify(events));
    eventModal.classList.add('hidden');
    renderEvents();
  });

  // MEMORIES / GALLERY LOGIC
  async function renderMemories() {
    const list = await idbGetAllMemories();
    memoriesBadge.textContent = list.length;
    memoriesCountText.textContent = `${list.length} תמונות`;

    list.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (list.length === 0) {
      memoriesGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i class="fa-regular fa-images"></i>
          <h3>עדיין לא הוספתם זכרונות</h3>
          <p>לחצו על "הוספת זיכרון" כדי להעלות תמונות מרגשות!</p>
        </div>
      `;
      return;
    }

    memoriesGrid.innerHTML = list.map(mem => {
      const d = new Date(mem.date + 'T12:00:00');
      const formattedDate = !isNaN(d) ? d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) : mem.date;

      return `
        <div class="memory-card" data-id="${mem.id}">
          <div class="memory-photo-wrap">
            <img src="${mem.image}" alt="${escapeHtml(mem.title)}" loading="lazy">
          </div>
          <div class="memory-info">
            <span class="memory-date"><i class="fa-solid fa-calendar-day"></i> ${formattedDate}</span>
            <strong class="memory-card-title">${escapeHtml(mem.title)}</strong>
            ${mem.story ? `<p class="memory-snippet">${escapeHtml(mem.story)}</p>` : ''}
          </div>
        </div>
      `;
    }).join('');

    memoriesGrid.querySelectorAll('.memory-card').forEach(card => {
      card.addEventListener('click', async () => {
        const id = card.getAttribute('data-id');
        const memory = list.find(m => m.id === id);
        if (memory) openMemoryLightbox(memory);
      });
    });
  }

  function openMemoryLightbox(mem) {
    activeViewingMemoryId = mem.id;
    viewMemoryImg.src = mem.image;
    viewMemoryTitle.textContent = mem.title;
    const d = new Date(mem.date + 'T12:00:00');
    viewMemoryDate.textContent = !isNaN(d) ? d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) : mem.date;
    viewMemoryStory.textContent = mem.story || '';
    viewMemoryModal.classList.remove('hidden');
  }

  deleteMemoryBtn.addEventListener('click', async () => {
    if (!activeViewingMemoryId) return;
    if (confirm('האם אתם בטוחים שברצונכם למחוק את הזיכרון הזה?')) {
      await idbDeleteMemory(activeViewingMemoryId);
      viewMemoryModal.classList.add('hidden');
      renderMemories();
      showToast('הזיכרון נמחק.');
    }
  });

  openAddMemoryBtn.addEventListener('click', () => {
    memoryForm.reset();
    stagedMemoryBase64 = null;
    imagePreview.classList.add('hidden');
    imagePreview.src = '';
    previewPlaceholder.classList.remove('hidden');
    document.getElementById('memoryDate').value = new Date().toISOString().split('T')[0];
    memoryModal.classList.remove('hidden');
  });

  memoryImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        stagedMemoryBase64 = canvas.toDataURL('image/jpeg', 0.85);
        imagePreview.src = stagedMemoryBase64;
        imagePreview.classList.remove('hidden');
        previewPlaceholder.classList.add('hidden');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  memoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!stagedMemoryBase64) {
      alert('נא לבחור תמונה מהמכשיר.');
      return;
    }

    const title = document.getElementById('memoryTitle').value.trim();
    const date = document.getElementById('memoryDate').value;
    const story = document.getElementById('memoryStory').value.trim();

    const newMemory = {
      id: 'mem-' + Date.now(),
      title,
      date,
      story,
      image: stagedMemoryBase64
    };

    const submitBtn = document.getElementById('saveMemorySubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'שומר...';

    await idbSaveMemory(newMemory);

    submitBtn.disabled = false;
    submitBtn.textContent = 'שמור זיכרון';
    memoryModal.classList.add('hidden');
    renderMemories();
    showToast('הזיכרון נוסף לאלבום האהבה שלכם! 📸💖');
  });

  // CHAT LOGIC
  function renderChat() {
    const myCurrentSender = currentSenderSelect.value;

    chatMessagesContainer.innerHTML = chatMessages.map((msg, idx) => {
      const isMine = msg.sender === myCurrentSender;
      const senderName = msg.sender === 'groom' ? settings.groom : settings.bride;
      const bubbleClass = isMine ? 'mine' : 'other';

      return `
        <div class="chat-bubble ${bubbleClass}" data-idx="${idx}">
          <span class="bubble-author">${senderName}</span>
          <div class="bubble-content">${escapeHtml(msg.text)}</div>
          <div class="bubble-footer">
            <span class="bubble-time">${msg.time}</span>
            <button class="bubble-react-btn" data-idx="${idx}" title="שלח לב">
              <i class="fa-solid fa-heart"></i>
            </button>
            ${msg.hearts > 0 ? `<span class="bubble-hearts">❤️ ${msg.hearts}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    chatMessagesContainer.querySelectorAll('.bubble-react-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (chatMessages[idx]) {
          chatMessages[idx].hearts = (chatMessages[idx].hearts || 0) + 1;
          localStorage.setItem('wedding_chat', JSON.stringify(chatMessages));
          renderChat();
          fireMiniConfetti();
        }
      });
    });

    scrollChatToBottom();
  }

  function scrollChatToBottom() {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }

  function fireMiniConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 25,
        spread: 40,
        origin: { y: 0.8 },
        colors: ['#ff6584', '#ffd700']
      });
    }
  }

  currentSenderSelect.addEventListener('change', () => {
    renderChat();
    showToast(`עברת למצב כתיבה בתור: ${currentSenderSelect.value === 'groom' ? settings.groom : settings.bride}`);
  });

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    postChatMessage(text);
    chatInput.value = '';
  });

  quickEmojiBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const emojiText = btn.getAttribute('data-emoji');
      postChatMessage(emojiText);
    });
  });

  function postChatMessage(text) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

    const newMsg = {
      id: 'c-' + Date.now(),
      sender: currentSenderSelect.value,
      text,
      time: timeStr,
      hearts: 0
    };

    chatMessages.push(newMsg);
    localStorage.setItem('wedding_chat', JSON.stringify(chatMessages));
    renderChat();
  }

  // MODAL CONTROLS
  function setupModals() {
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
      });
    });

    [eventModal, memoryModal, viewMemoryModal, settingsModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run on start
  init();
})();
