// ============= إعدادات API =============
const API_BASE = window.location.origin;

// ============= المتغيرات العامة =============
let currentUser = null;
let users = [];
let families = [];
let tasks = [];
let shopping = [];
let expenses = [];
let events = [];
let schedules = [];
let pendingRequests = [];
let notifications = [];
let selectedUserForPermissions = null;
let settings = {
    currency: '₽',
    homeAddress: '',
    monthlyBudget: 0,
    taskReminders: true,
    eventReminders: true,
    dailyReminders: true,
    rememberMe: true
};

let currentReportMonth = new Date();

// ============= دوال مساعدة =============
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const monthNames = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'];
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateShort(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

function formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
}

function calculateAge(birthDate) {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

function generateUniqueID(name) {
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const prefix = name.substring(0, 2).toUpperCase();
    return `FAM-${prefix}${random}`;
}

// ============= دوال API =============
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    };
    if (data) options.body = JSON.stringify(data);
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, message: 'Ошибка соединения' };
    }
}

// ============= دالة إنشاء العائلة للمستخدم الحالي =============
async function ensureUserHasFamily() {
    if (!currentUser) return false;
    
    // التحقق من وجود عائلة
    const family = getCurrentFamily();
    if (family) {
        console.log('✅ المستخدم لديه عائلة بالفعل:', family);
        return true;
    }
    
    console.log('🔄 المستخدم ليس لديه عائلة، جاري الإنشاء...');
    
    try {
        const result = await apiCall('/api/create_family_for_user', 'POST');
        if (result.success) {
            console.log('✅ تم إنشاء العائلة بنجاح:', result.family);
            // إعادة تحميل البيانات
            await loadAllData();
            return true;
        } else {
            console.error('❌ فشل إنشاء العائلة:', result.message);
            return false;
        }
    } catch (error) {
        console.error('❌ خطأ في إنشاء العائلة:', error);
        return false;
    }
}

// ============= دوال الإشعارات =============
function addNotification(title, message, type = 'info', relatedId = null, relatedType = null) {
    const notification = {
        id: Date.now(),
        title,
        message,
        type,
        relatedId,
        relatedType,
        date: new Date().toISOString(),
        read: false
    };
    notifications.unshift(notification);
    if (notifications.length > 100) notifications.pop();
    saveNotifications();
    updateNotificationBadge();
    
    if (Notification.permission === 'granted' && settings.taskReminders) {
        new Notification(title, { body: message, icon: '/favicon.ico' });
    }
    return notification;
}

function saveNotifications() {
    localStorage.setItem('family_notifications', JSON.stringify(notifications));
}

function loadNotifications() {
    const stored = localStorage.getItem('family_notifications');
    if (stored) notifications = JSON.parse(stored);
}

function updateNotificationBadge() {
    const unreadCount = notifications.filter(n => !n.read).length;
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        if (unreadCount > 0) {
            badge.style.display = 'flex';
            badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
        } else {
            badge.style.display = 'none';
        }
    }
}

function markNotificationAsRead(notificationId) {
    const notif = notifications.find(n => n.id === notificationId);
    if (notif) {
        notif.read = true;
        saveNotifications();
        updateNotificationBadge();
        renderNotifications();
    }
}

function markAllNotificationsAsRead() {
    notifications.forEach(n => n.read = true);
    saveNotifications();
    updateNotificationBadge();
    renderNotifications();
}

function renderNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container) return;
    
    const unreadNotifications = notifications.filter(n => !n.read);
    const readNotifications = notifications.filter(n => n.read).slice(0, 30);
    
    if (notifications.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color:#8e8e93;"><i class="fas fa-bell-slash" style="font-size: 32px; margin-bottom: 8px; display: block;"></i>Нет уведомлений</div>';
        return;
    }
    
    let html = '';
    
    if (unreadNotifications.length > 0) {
        html += `<div style="margin-bottom: 16px;"><strong>Новые (${unreadNotifications.length})</strong></div>`;
        html += unreadNotifications.map(notif => `
            <div class="notification-item ${notif.type} unread">
                <div class="notification-title">${escapeHtml(notif.title)}</div>
                <div class="notification-message">${escapeHtml(notif.message)}</div>
                <div class="notification-date">${formatDate(notif.date)}</div>
                <div class="notification-actions">
                    <button class="mark-read-btn" data-id="${notif.id}">✓ Прочитано</button>
                </div>
            </div>
        `).join('');
    }
    
    if (readNotifications.length > 0) {
        html += `<div style="margin: 16px 0 8px;"><strong>Ранее</strong></div>`;
        html += readNotifications.map(notif => `
            <div class="notification-item ${notif.type}">
                <div class="notification-title">${escapeHtml(notif.title)}</div>
                <div class="notification-message">${escapeHtml(notif.message)}</div>
                <div class="notification-date">${formatDate(notif.date)}</div>
            </div>
        `).join('');
    }
    
    container.innerHTML = html;
    
    document.querySelectorAll('.mark-read-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.dataset.id);
            markNotificationAsRead(id);
        });
    });
}

// ============= دوال التذكيرات =============
function checkEventReminders() {
    if (!settings.eventReminders) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    events.forEach(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
        
        if (event.reminderDays && daysDiff === event.reminderDays) {
            const existingNotif = notifications.find(n => n.relatedId === event.id && n.title.includes(event.reminderDays));
            if (!existingNotif) {
                addNotification(
                    `⏰ Напоминание: ${event.title}`,
                    `Событие "${event.title}" через ${event.reminderDays} дней!`,
                    'warning',
                    event.id,
                    'event'
                );
            }
        } else if (daysDiff === 1) {
            const existingNotif = notifications.find(n => n.relatedId === event.id && n.title.includes('завтра'));
            if (!existingNotif) {
                addNotification(
                    `⚠️ Событие завтра: ${event.title}`,
                    `Событие "${event.title}" состоится завтра!`,
                    'warning',
                    event.id,
                    'event'
                );
            }
        } else if (daysDiff === 0) {
            const existingNotif = notifications.find(n => n.relatedId === event.id && n.title.includes('сегодня'));
            if (!existingNotif) {
                addNotification(
                    `🎉 Сегодня: ${event.title}`,
                    `Событие "${event.title}" происходит сегодня!`,
                    'success',
                    event.id,
                    'event'
                );
            }
        }
    });
}

function checkDailyReminders() {
    if (!settings.dailyReminders) return;
    
    const lastCheck = localStorage.getItem('lastDailyCheck');
    const today = new Date().toDateString();
    
    if (lastCheck !== today) {
        localStorage.setItem('lastDailyCheck', today);
        
        const pendingTasks = tasks.filter(t => !t.completed && t.familyId === currentUser?.familyId);
        if (pendingTasks.length > 0) {
            addNotification('📋 Задачи на сегодня', `У вас ${pendingTasks.length} ${getTaskDeclension(pendingTasks.length)}`, 'info');
        }
        
        const pendingShopping = shopping.filter(s => !s.purchased && s.familyId === currentUser?.familyId);
        if (pendingShopping.length > 0) {
            addNotification('🛒 Список покупок', `${pendingShopping.length} ${getShoppingDeclension(pendingShopping.length)} ожидают покупки`, 'info');
        }
        
        if (settings.monthlyBudget > 0) {
            const monthlyExpenses = getCurrentMonthExpenses().reduce((sum, e) => sum + e.amount, 0);
            const remaining = settings.monthlyBudget - monthlyExpenses;
            if (remaining < settings.monthlyBudget * 0.2 && remaining > 0) {
                addNotification('💰 Бюджет', `Осталось ${remaining} ${settings.currency} до конца месяца`, 'warning');
            }
        }
    }
}

function getTaskDeclension(count) {
    if (count % 10 === 1 && count % 100 !== 11) return 'задача';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'задачи';
    return 'задач';
}

function getShoppingDeclension(count) {
    if (count % 10 === 1 && count % 100 !== 11) return 'товар';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'товара';
    return 'товаров';
}

// ============= دوال التاريخ =============
function triggerDatePicker(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        try {
            if (input.showPicker) input.showPicker();
            else input.focus();
        } catch(e) { input.focus(); }
    }
}

function initializeAllDatePickers() {
    document.querySelectorAll('.date-input').forEach(input => {
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        const wrapper = newInput.closest('.date-field');
        if (wrapper) {
            wrapper.addEventListener('click', (e) => {
                if (e.target !== wrapper.querySelector('.date-picker-trigger')) {
                    triggerDatePicker(newInput.id);
                }
            });
        }
        newInput.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerDatePicker(newInput.id);
        });
    });
}

// ============= إدارة الشاشات =============
const screens = {
    login: document.getElementById('loginScreen'),
    register: document.getElementById('registerScreen'),
    main: document.getElementById('mainAppScreen')
};

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
    setTimeout(() => initializeAllDatePickers(), 100);
}

// ============= إدارة التبويبات =============
function switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.querySelectorAll('.tab-item').forEach(item => item.classList.remove('active'));
    document.getElementById(`${tabId}Tab`).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    if (tabId === 'tasks') renderTasks();
    if (tabId === 'shopping') renderShopping();
    if (tabId === 'expenses') renderExpenses();
    if (tabId === 'schedule') { updateScheduleMemberFilter(); renderSchedules(); }
    if (tabId === 'profile') updateProfile();
}

// ============= دوال البيانات =============
function getCurrentFamily() {
    if (!currentUser) return null;
    return families.find(f => f.members && f.members.includes(currentUser.uniqueId));
}

function getCurrentMonthExpenses() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const family = getCurrentFamily();
    const familyExpenses = expenses.filter(e => e.familyId === (family?.id || currentUser?.familyId));
    return familyExpenses.filter(e => {
        const date = new Date(e.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
}

function getExpensesForMonth(year, month) {
    const family = getCurrentFamily();
    const familyExpenses = expenses.filter(e => e.familyId === (family?.id || currentUser?.familyId));
    return familyExpenses.filter(e => {
        const date = new Date(e.date);
        return date.getMonth() === month && date.getFullYear() === year;
    });
}

function isFamilyHead() {
    return currentUser && currentUser.isFamilyHead === true;
}

function hasPermission(permission) {
    return currentUser && currentUser.permissions && currentUser.permissions[permission] === true;
}

// ============= تحميل البيانات =============
async function loadCurrentUser() {
    const result = await apiCall('/api/current_user');
    if (result.success && result.user) {
        currentUser = result.user;
        await loadAllData();
        loadNotifications();
        return true;
    }
    return false;
}

async function loadAllData() {
    if (!currentUser) return;
    
    const usersResult = await apiCall('/api/users');
    if (usersResult.success) users = usersResult.users;
    
    const familiesResult = await apiCall('/api/families');
    if (familiesResult.success) families = familiesResult.families;
    
    const tasksResult = await apiCall(`/api/tasks?familyId=${currentUser.familyId || ''}`);
    if (tasksResult.success) tasks = tasksResult.tasks;
    
    const shoppingResult = await apiCall(`/api/shopping?familyId=${currentUser.familyId || ''}`);
    if (shoppingResult.success) shopping = shoppingResult.shopping;
    
    const expensesResult = await apiCall(`/api/expenses?familyId=${currentUser.familyId || ''}`);
    if (expensesResult.success) expenses = expensesResult.expenses;
    
    const eventsResult = await apiCall(`/api/events?familyId=${currentUser.familyId || ''}`);
    if (eventsResult.success) events = eventsResult.events;
    
    const schedulesResult = await apiCall(`/api/schedules?familyId=${currentUser.familyId || ''}`);
    if (schedulesResult.success) schedules = schedulesResult.schedules;
    
    const requestsResult = await apiCall(`/api/requests?familyId=${currentUser.familyId || ''}`);
    if (requestsResult.success) pendingRequests = requestsResult.requests;
    
    const settingsResult = await apiCall('/api/settings');
    if (settingsResult.success) settings = { ...settings, ...settingsResult.settings };
    
    checkEventReminders();
    checkDailyReminders();
    
    updateUIByPermissions();
}

function updateUIByPermissions() {
    const managePermissionsBtn = document.getElementById('managePermissionsBtn');
    if (managePermissionsBtn) {
        managePermissionsBtn.style.display = isFamilyHead() ? 'inline-block' : 'none';
    }
    
    const addTaskBtn = document.getElementById('addTaskBtn');
    if (addTaskBtn) addTaskBtn.style.display = hasPermission('can_add_tasks') ? 'flex' : 'none';
    
    const addShoppingBtn = document.getElementById('addShoppingBtn');
    if (addShoppingBtn) addShoppingBtn.style.display = hasPermission('can_add_shopping') ? 'flex' : 'none';
    
    const addExpenseBtn = document.getElementById('addExpenseBtn');
    if (addExpenseBtn) addExpenseBtn.style.display = hasPermission('can_add_expenses') ? 'flex' : 'none';
    
    const addEventBtn = document.getElementById('addEventBtn');
    if (addEventBtn) addEventBtn.style.display = hasPermission('can_add_events') ? 'flex' : 'none';
    
    const addScheduleBtn = document.getElementById('addScheduleBtn');
    if (addScheduleBtn) addScheduleBtn.style.display = hasPermission('can_add_schedule') ? 'flex' : 'none';
    
    const inviteMemberBtn = document.getElementById('inviteMemberBtn');
    if (inviteMemberBtn) inviteMemberBtn.style.display = hasPermission('can_invite_members') ? 'inline-block' : 'none';
}

// ============= تحديث الإحصائيات =============
function updateStats() {
    const family = getCurrentFamily();
    const familyTasks = tasks.filter(t => t.familyId === (family?.id || currentUser?.familyId) && !t.completed);
    const familyShopping = shopping.filter(s => s.familyId === (family?.id || currentUser?.familyId) && !s.purchased);
    const familyExpenses = expenses.filter(e => e.familyId === (family?.id || currentUser?.familyId));
    const totalExpenses = familyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const monthlyExpenses = getCurrentMonthExpenses().reduce((sum, e) => sum + e.amount, 0);
    
    document.getElementById('pendingTasksCount').innerText = familyTasks.length;
    document.getElementById('pendingShoppingCount').innerText = familyShopping.length;
    document.getElementById('totalExpenses').innerText = totalExpenses;
    document.getElementById('monthlyExpenses').innerText = monthlyExpenses;
}

// ============= عرض الأحداث =============
function getDaysRemaining(dateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(dateString);
    eventDate.setHours(0, 0, 0, 0);
    return Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
}

function renderEvents() {
    const family = getCurrentFamily();
    const familyEvents = events.filter(e => e.familyId === (family?.id || currentUser?.familyId));
    const sortedEvents = [...familyEvents].sort((a, b) => new Date(a.date) - new Date(b.date));
    const container = document.getElementById('eventsList');
    
    if (sortedEvents.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 20px; color:#8e8e93;"><i class="fas fa-calendar-day" style="font-size: 32px; margin-bottom: 8px; display: block;"></i>Нет добавленных событий</div>';
        return;
    }
    
    container.innerHTML = sortedEvents.map(event => {
        const eventDate = new Date(event.date);
        const day = eventDate.getDate();
        const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        const month = monthNames[eventDate.getMonth()];
        const person = event.personId ? users.find(u => u.uniqueId === event.personId) : null;
        const daysRemaining = getDaysRemaining(event.date);
        
        let reminderText = '';
        let reminderClass = '';
        if (daysRemaining === 0) {
            reminderText = '🎉 Сегодня!';
            reminderClass = 'event-reminder-badge';
        } else if (daysRemaining === 1) {
            reminderText = '⚠️ Завтра!';
            reminderClass = 'event-reminder-badge';
        } else if (daysRemaining > 1 && daysRemaining <= 5) {
            reminderText = `📅 Через ${daysRemaining} дн`;
            reminderClass = 'event-reminder-badge';
        }
        
        return `
            <div class="event-item" style="border-right-color: ${event.color || '#667eea'}">
                ${reminderText ? `<div class="${reminderClass}">${reminderText}</div>` : ''}
                <div class="event-date">
                    <div class="event-day">${day}</div>
                    <div class="event-month">${month}</div>
                </div>
                <div class="event-info">
                    <div class="event-title">${escapeHtml(event.title)}</div>
                    ${person ? `<div class="event-person"><i class="fas fa-user"></i> ${escapeHtml(person.fullName)} (${person.role})</div>` : ''}
                </div>
                <div class="event-actions">
                    ${hasPermission('can_edit_events') ? `<button class="delete-event" data-id="${event.id}"><i class="fas fa-trash-alt"></i></button>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.delete-event').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const eventId = parseInt(btn.dataset.id);
            const result = await apiCall(`/api/events/${eventId}`, 'DELETE');
            if (result.success) {
                await loadAllData();
                renderEvents();
                addNotification('Событие удалено', 'Событие успешно удалено', 'info');
            }
        });
    });
}

// ============= عرض أعضاء العائلة =============
function renderFamilyMembers() {
    if (!currentUser) return;
    const family = getCurrentFamily();
    const container = document.getElementById('familyMembersList');
    
    if (!family) {
        container.innerHTML = '<div class="member-item"><p style="color:#8e8e93; padding: 12px;">Сначала создайте семью</p></div>';
        return;
    }
    
    const familyMembers = users.filter(u => family.members && family.members.includes(u.uniqueId));
    
    if (familyMembers.length === 0) {
        container.innerHTML = '<div class="member-item"><p style="color:#8e8e93; padding: 12px;">Нет членов семьи. Пригласите их!</p></div>';
        return;
    }
    
    const isHead = isFamilyHead();
    
    container.innerHTML = familyMembers.map(member => {
        const age = calculateAge(member.birthDate);
        const isCurrentUser = member.uniqueId === currentUser.uniqueId;
        const isMemberHead = member.isFamilyHead === true;
        
        return `
            <div class="member-item">
                <div class="member-avatar-small">
                    <i class="fas fa-user"></i>
                </div>
                <div class="member-details">
                    <h4>${escapeHtml(member.fullName)} ${isCurrentUser ? '(Вы)' : ''} ${isMemberHead ? '👑' : ''}</h4>
                    <p>${member.email || 'Нет email'} ${age ? ` • ${age} лет` : ''}</p>
                </div>
                <div class="member-badge">${member.role}</div>
                ${isHead && !isCurrentUser ? 
                    `<button class="small-btn permissions-btn" data-id="${member.uniqueId}" data-name="${escapeHtml(member.fullName)}" style="margin-left: 8px;">
                        <i class="fas fa-lock"></i>
                    </button>` : ''}
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.permissions-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = btn.dataset.id;
            const userName = btn.dataset.name;
            openPermissionsModal(userId, userName);
        });
    });
}

// ============= عرض المهام =============
function renderTasks() {
    const family = getCurrentFamily();
    const familyTasks = tasks.filter(t => t.familyId === (family?.id || currentUser?.familyId));
    const container = document.getElementById('tasksList');
    
    if (familyTasks.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color:#8e8e93;"><i class="fas fa-check-circle" style="font-size: 48px; margin-bottom: 12px; display: block;"></i>Нет задач</div>';
        return;
    }
    
    container.innerHTML = familyTasks.map(task => `
        <div class="task-item ${task.completed ? 'completed' : ''}">
            <div class="task-info">
                <div class="task-title">${escapeHtml(task.title)}</div>
                <div class="task-assignee"><i class="fas fa-user"></i> ${task.assignee || 'Не назначен'}</div>
            </div>
            ${!task.completed && hasPermission('can_complete_tasks') ? 
                `<button class="complete-btn" data-id="${task.id}">Выполнено</button>` : 
                (task.completed ? '<span style="color:#34c759;">✓ Выполнено</span>' : '')}
        </div>
    `).join('');
    
    document.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const taskId = parseInt(btn.dataset.id);
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                const result = await apiCall(`/api/tasks/${taskId}`, 'PUT', { completed: true });
                if (result.success) {
                    await loadAllData();
                    renderTasks();
                    updateStats();
                    addNotification('✅ Задача выполнена', `Задача "${task.title}" выполнена!`, 'success', task.id, 'task');
                }
            }
        });
    });
}

// ============= عرض المشتريات =============
function renderShopping() {
    const family = getCurrentFamily();
    const familyShopping = shopping.filter(s => s.familyId === (family?.id || currentUser?.familyId));
    const container = document.getElementById('shoppingList');
    
    if (familyShopping.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color:#8e8e93;"><i class="fas fa-basket-shopping" style="font-size: 48px; margin-bottom: 12px; display: block;"></i>Нет покупок</div>';
        return;
    }
    
    container.innerHTML = familyShopping.map(item => `
        <div class="shopping-item ${item.purchased ? 'completed' : ''}">
            <div class="shopping-info">
                <div class="shopping-name">${escapeHtml(item.name)}</div>
                <div class="shopping-price">${item.price ? item.price + ' ' + settings.currency : 'Цена не указана'}</div>
            </div>
            ${!item.purchased && hasPermission('can_buy_shopping') ? 
                `<button class="buy-btn" data-id="${item.id}">Куплено</button>` : 
                (item.purchased ? '<span style="color:#34c759;">✓ Куплено</span>' : '')}
        </div>
    `).join('');
    
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const itemId = parseInt(btn.dataset.id);
            const item = shopping.find(s => s.id === itemId);
            if (item) {
                const result = await apiCall(`/api/shopping/${itemId}`, 'PUT', { purchased: true });
                if (result.success) {
                    await loadAllData();
                    renderShopping();
                    updateStats();
                    addNotification('🛍️ Товар куплен', `Товар "${item.name}" куплен!`, 'success', item.id, 'shopping');
                }
            }
        });
    });
}

// ============= عرض المصاريف =============
function renderExpenses() {
    const family = getCurrentFamily();
    const familyExpenses = expenses.filter(e => e.familyId === (family?.id || currentUser?.familyId));
    const container = document.getElementById('expensesList');
    
    if (familyExpenses.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color:#8e8e93;"><i class="fas fa-receipt" style="font-size: 48px; margin-bottom: 12px; display: block;"></i>Нет расходов</div>';
        return;
    }
    
    container.innerHTML = familyExpenses.map(exp => `
        <div class="expense-item">
            <div class="expense-info">
                <div class="expense-desc">${escapeHtml(exp.description)}</div>
                <div class="expense-amount">${exp.amount} ${settings.currency} - ${exp.category}</div>
                <div class="expense-date">${formatDate(exp.date)}</div>
            </div>
            ${hasPermission('can_view_expenses') ? 
                `<button class="delete-expense" data-id="${exp.id}"><i class="fas fa-trash-alt"></i></button>` : ''}
        </div>
    `).join('');
    
    document.querySelectorAll('.delete-expense').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const expId = parseInt(btn.dataset.id);
            const result = await apiCall(`/api/expenses/${expId}`, 'DELETE');
            if (result.success) {
                await loadAllData();
                renderExpenses();
                updateStats();
                addNotification('Расход удален', 'Расход успешно удален', 'info');
            }
        });
    });
}

// ============= عرض الجداول =============
function renderSchedules() {
    const family = getCurrentFamily();
    const memberFilter = document.getElementById('scheduleMemberFilter').value;
    let familySchedules = schedules.filter(s => s.familyId === (family?.id || currentUser?.familyId));
    
    if (memberFilter !== 'all') {
        familySchedules = familySchedules.filter(s => s.memberId === memberFilter);
    }
    
    const daysOrder = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    const sortedSchedules = [...familySchedules].sort((a, b) => daysOrder.indexOf(a.day) - daysOrder.indexOf(b.day));
    const container = document.getElementById('scheduleList');
    
    if (sortedSchedules.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color:#8e8e93;"><i class="fas fa-calendar-week" style="font-size: 48px; margin-bottom: 12px; display: block;"></i>Нет записей в расписании</div>';
        return;
    }
    
    container.innerHTML = sortedSchedules.map(schedule => {
        const member = users.find(u => u.uniqueId === schedule.memberId);
        return `
            <div class="schedule-item">
                <div class="schedule-day">
                    <div class="schedule-day-name">${schedule.day}</div>
                    <div class="schedule-time">${schedule.time}</div>
                </div>
                <div class="schedule-info">
                    <div class="schedule-title">${escapeHtml(schedule.title)}</div>
                    <div class="schedule-location"><i class="fas fa-location-dot"></i> ${schedule.location || 'Место не указано'}</div>
                    <div class="schedule-member">${member?.fullName || 'Неизвестно'} (${member?.role || ''})</div>
                </div>
                <button class="delete-schedule" data-id="${schedule.id}"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.delete-schedule').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const scheduleId = parseInt(btn.dataset.id);
            const result = await apiCall(`/api/schedules/${scheduleId}`, 'DELETE');
            if (result.success) {
                await loadAllData();
                renderSchedules();
                addNotification('Расписание обновлено', 'Запись удалена из расписания', 'info');
            }
        });
    });
}

function updateScheduleMemberFilter() {
    const family = getCurrentFamily();
    const select = document.getElementById('scheduleMemberFilter');
    if (!family) return;
    const familyMembers = users.filter(u => family.members && family.members.includes(u.uniqueId));
    select.innerHTML = '<option value="all">Все члены семьи</option>' + 
        familyMembers.map(m => `<option value="${m.uniqueId}">${escapeHtml(m.fullName)} (${m.role})</option>`).join('');
    select.addEventListener('change', () => renderSchedules());
}

// ============= عرض طلبات الانضمام =============
function renderPendingRequests() {
    const family = getCurrentFamily();
    if (!family) return;
    const familyRequests = pendingRequests.filter(r => r.familyId === family.id && r.status === 'pending');
    const section = document.getElementById('pendingApprovalsSection');
    const container = document.getElementById('pendingRequestsList');
    
    if (familyRequests.length > 0 && hasPermission('can_approve_requests')) {
        section.style.display = 'block';
        container.innerHTML = familyRequests.map(req => {
            const requester = users.find(u => u.uniqueId === req.userId);
            return `
                <div class="member-item" style="justify-content: space-between;">
                    <div class="member-details">
                        <h4>${requester?.fullName || req.userId}</h4>
                        <p>Хочет присоединиться к семье</p>
                    </div>
                    <button class="small-btn approve-request" data-id="${req.id}">Рассмотреть</button>
                </div>
            `;
        }).join('');
        
        document.querySelectorAll('.approve-request').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reqId = parseInt(btn.dataset.id);
                const request = pendingRequests.find(r => r.id === reqId);
                if (request) {
                    const requester = users.find(u => u.uniqueId === request.userId);
                    document.getElementById('approvalDetails').innerHTML = `
                        <p style="margin-bottom: 12px;"><strong>${requester?.fullName}</strong> хочет присоединиться к вашей семье</p>
                        <p>Роль: ${request.requestedRole}</p>
                    `;
                    window.currentRequestId = reqId;
                    document.getElementById('approvalModal').style.display = 'flex';
                }
            });
        });
    } else {
        section.style.display = 'none';
    }
}

// ============= تحديث الملف الشخصي =============
function updateProfile() {
    if (!currentUser) return;
    document.getElementById('profileName').innerText = currentUser.fullName;
    document.getElementById('profileRole').innerText = currentUser.role;
    document.getElementById('profileId').innerText = currentUser.uniqueId;
    document.getElementById('profileEmail').innerText = currentUser.email || 'Не указан';
    document.getElementById('profilePhone').innerText = currentUser.phone || 'Не указан';
    
    const age = calculateAge(currentUser.birthDate);
    if (age) {
        document.getElementById('profileAge').innerHTML = `<i class="fas fa-cake-candles"></i> Возраст: ${age} лет`;
    } else {
        document.getElementById('profileAge').innerHTML = '';
    }
    
    const bioElement = document.getElementById('profileBio');
    if (currentUser.bio) {
        bioElement.innerHTML = `<i class="fas fa-quote-right"></i> ${escapeHtml(currentUser.bio)}`;
        bioElement.style.display = 'block';
    } else {
        bioElement.style.display = 'none';
    }
    
    if (currentUser.birthDate) {
        document.getElementById('profileBirthDate').innerHTML = `Дата рождения: ${formatDate(currentUser.birthDate)}`;
    } else {
        document.getElementById('profileBirthDate').innerHTML = 'Дата рождения: не указана';
    }
}

// ============= تحديث لوحة التحكم =============
function updateDashboard() {
    document.getElementById('dashboardUserName').innerHTML = currentUser.fullName.split(' ')[0];
    document.getElementById('dashboardUserRole').innerHTML = `Роль: ${currentUser.role}`;
    if (isFamilyHead()) {
        document.getElementById('dashboardUserBadge').innerHTML = '👑 Глава семьи';
        document.getElementById('dashboardUserBadge').style.display = 'inline-block';
    } else {
        document.getElementById('dashboardUserBadge').style.display = 'none';
    }
    renderFamilyMembers();
    updateStats();
    renderEvents();
    renderPendingRequests();
}

// ============= دوال إدارة الصلاحيات =============
async function openPermissionsModal(userId, userName) {
    const user = users.find(u => u.uniqueId === userId);
    if (!user) return;
    
    selectedUserForPermissions = userId;
    document.getElementById('permissionsUserInfo').innerHTML = `
        <div style="text-align:center; margin-bottom: 16px;">
            <strong>${escapeHtml(userName)}</strong>
            <p style="font-size: 12px; color:#8e8e93;">${user.role}</p>
        </div>
    `;
    
    const perms = user.permissions || {
        can_add_tasks: true, can_complete_tasks: true,
        can_add_shopping: true, can_buy_shopping: true,
        can_add_expenses: true, can_view_expenses: true,
        can_add_events: true, can_edit_events: false,
        can_add_schedule: true, can_invite_members: false,
        can_approve_requests: false, can_manage_permissions: false
    };
    
    document.getElementById('perm_tasks_add').checked = perms.can_add_tasks;
    document.getElementById('perm_tasks_complete').checked = perms.can_complete_tasks;
    document.getElementById('perm_shopping_add').checked = perms.can_add_shopping;
    document.getElementById('perm_shopping_buy').checked = perms.can_buy_shopping;
    document.getElementById('perm_expenses_add').checked = perms.can_add_expenses;
    document.getElementById('perm_expenses_view').checked = perms.can_view_expenses;
    document.getElementById('perm_events_add').checked = perms.can_add_events;
    document.getElementById('perm_events_edit').checked = perms.can_edit_events;
    document.getElementById('perm_schedule_add').checked = perms.can_add_schedule;
    document.getElementById('perm_invite').checked = perms.can_invite_members;
    document.getElementById('perm_approve').checked = perms.can_approve_requests;
    
    document.getElementById('permissionsModal').style.display = 'flex';
}

async function saveUserPermissions() {
    if (!selectedUserForPermissions) return;
    
    const permissions = {
        can_add_tasks: document.getElementById('perm_tasks_add').checked,
        can_complete_tasks: document.getElementById('perm_tasks_complete').checked,
        can_add_shopping: document.getElementById('perm_shopping_add').checked,
        can_buy_shopping: document.getElementById('perm_shopping_buy').checked,
        can_add_expenses: document.getElementById('perm_expenses_add').checked,
        can_view_expenses: document.getElementById('perm_expenses_view').checked,
        can_add_events: document.getElementById('perm_events_add').checked,
        can_edit_events: document.getElementById('perm_events_edit').checked,
        can_add_schedule: document.getElementById('perm_schedule_add').checked,
        can_invite_members: document.getElementById('perm_invite').checked,
        can_approve_requests: document.getElementById('perm_approve').checked,
        can_manage_permissions: false
    };
    
    const result = await apiCall(`/api/users/${selectedUserForPermissions}/permissions`, 'PUT', permissions);
    if (result.success) {
        addNotification('Права обновлены', 'Права доступа пользователя обновлены', 'success');
        await loadAllData();
        renderFamilyMembers();
        document.getElementById('permissionsModal').style.display = 'none';
    } else {
        alert(result.message || 'Ошибка при сохранении прав');
    }
}

// ============= دوال إصلاح العائلة =============
async function fixFamilyAndShowMembers() {
    console.log("🔄 جاري إصلاح العائلة...");
    
    const fixResult = await apiCall('/api/fix_family', 'POST');
    if (fixResult.success) {
        console.log("✅ تم إصلاح العائلة:", fixResult.families);
    }
    
    await loadAllData();
    updateDashboard();
    renderFamilyMembers();
    renderPendingRequests();
    
    console.log("✅ تم تحديث قائمة أفراد العائلة");
}

let fixed = false;
async function autoFixFamily() {
    if (!fixed && currentUser) {
        fixed = true;
        await fixFamilyAndShowMembers();
    }
}

// ============= دوال الانضمام إلى مجموعة =============
function openJoinGroupModal() {
    document.getElementById('inviteCode').value = '';
    document.getElementById('joinUserName').value = '';
    document.getElementById('joinUserRole').value = 'Сын';
    document.getElementById('joinUserEmail').value = '';
    document.getElementById('joinUserPhone').value = '';
    document.getElementById('joinGroupModal').style.display = 'flex';
}

async function sendJoinRequest() {
    const inviteCode = document.getElementById('inviteCode').value.trim();
    const userName = document.getElementById('joinUserName').value.trim();
    const userRole = document.getElementById('joinUserRole').value;
    const userEmail = document.getElementById('joinUserEmail').value.trim();
    const userPhone = document.getElementById('joinUserPhone').value.trim();
    
    if (!inviteCode) { alert('Пожалуйста, введите код приглашения'); return; }
    if (!userName) { alert('Пожалуйста, введите ваше имя'); return; }
    
    const familiesResult = await apiCall('/api/families');
    if (!familiesResult.success) { alert('Ошибка при поиске семьи'); return; }
    
    const family = familiesResult.families.find(f => f.id === inviteCode);
    if (!family) { alert('Неверный код приглашения'); return; }
    
    if (currentUser && family.members.includes(currentUser.uniqueId)) {
        alert('Вы уже являетесь членом этой семьи');
        document.getElementById('joinGroupModal').style.display = 'none';
        return;
    }
    
    if (currentUser) {
        const updatedUser = { ...currentUser, fullName: userName, role: userRole, email: userEmail || currentUser.email, phone: userPhone || currentUser.phone };
        const updateResult = await apiCall(`/api/users/${currentUser.uniqueId}`, 'PUT', updatedUser);
        if (updateResult.success) currentUser = updateResult.user;
        
        const requestResult = await apiCall('/api/requests', 'POST', {
            familyId: family.id, userId: currentUser.uniqueId, requestedRole: userRole
        });
        
        if (requestResult.success) {
            alert(`Заявка на вступление в семью "${family.name}" отправлена!`);
            document.getElementById('joinGroupModal').style.display = 'none';
            addNotification('Заявка отправлена', `Заявка на вступление в семью "${family.name}" отправлена`, 'info');
        }
    } else {
        const newId = generateUniqueID(userName);
        const registerResult = await apiCall('/api/register', 'POST', {
            uniqueId: newId, fullName: userName, role: userRole, email: userEmail, phone: userPhone, familyId: null
        });
        
        if (registerResult.success) {
            currentUser = registerResult.user;
            const requestResult = await apiCall('/api/requests', 'POST', {
                familyId: family.id, userId: currentUser.uniqueId, requestedRole: userRole
            });
            
            if (requestResult.success) {
                alert(`Аккаунт создан! Заявка на вступление в семью "${family.name}" отправлена!`);
                document.getElementById('joinGroupModal').style.display = 'none';
                await loadAllData();
                showScreen('main');
                switchTab('home');
                updateDashboard();
                updateProfile();
                renderTasks();
                renderShopping();
                renderExpenses();
                renderSchedules();
                addNotification('Добро пожаловать!', `Аккаунт создан. Заявка отправлена`, 'success');
            }
        }
    }
}

async function showInviteCode() {
    const family = getCurrentFamily();
    if (!family) { alert('У вас нет семьи. Сначала создайте семью.'); return; }
    if (!hasPermission('can_invite_members')) {
        alert('У вас нет прав для приглашения участников');
        return;
    }
    
    document.getElementById('familyInviteCodeDisplay').innerText = family.id;
    document.getElementById('inviteCodeModal').style.display = 'flex';
}

function copyInviteCode() {
    const code = document.getElementById('familyInviteCodeDisplay').innerText;
    navigator.clipboard.writeText(code);
    alert('Код скопирован: ' + code);
}

function shareInviteCode() {
    const code = document.getElementById('familyInviteCodeDisplay').innerText;
    if (navigator.share) {
        navigator.share({ title: 'Присоединяйтесь к моей семье!', text: `Код приглашения: ${code}` });
    } else {
        copyInviteCode();
    }
}

// ============= إعدادات التطبيق =============
function loadSettingsToModal() {
    document.getElementById('currencySelect').value = settings.currency;
    document.getElementById('homeAddress').value = settings.homeAddress || '';
    document.getElementById('monthlyBudget').value = settings.monthlyBudget || '';
    document.getElementById('taskReminders').checked = settings.taskReminders;
    document.getElementById('eventReminders').checked = settings.eventReminders;
    document.getElementById('dailyReminders').checked = settings.dailyReminders;
    document.getElementById('rememberMe').checked = settings.rememberMe !== false;
    
    if (settings.monthlyBudget > 0) {
        const monthlyExpenses = getCurrentMonthExpenses().reduce((sum, e) => sum + e.amount, 0);
        const remaining = settings.monthlyBudget - monthlyExpenses;
        const status = remaining >= 0 ? `Остаток: ${remaining} ${settings.currency}` : `Превышение бюджета на ${Math.abs(remaining)} ${settings.currency}`;
        document.getElementById('budgetStatus').innerText = status;
        document.getElementById('budgetStatus').style.color = remaining >= 0 ? '#34c759' : '#ff3b30';
    } else {
        document.getElementById('budgetStatus').innerText = '';
    }
}

async function saveSettings() {
    const newSettings = {
        currency: document.getElementById('currencySelect').value,
        homeAddress: document.getElementById('homeAddress').value,
        monthlyBudget: parseFloat(document.getElementById('monthlyBudget').value) || 0,
        taskReminders: document.getElementById('taskReminders').checked,
        eventReminders: document.getElementById('eventReminders').checked,
        dailyReminders: document.getElementById('dailyReminders').checked,
        rememberMe: document.getElementById('rememberMe').checked
    };
    
    const result = await apiCall('/api/settings', 'POST', newSettings);
    if (result.success) {
        settings = newSettings;
        updateStats();
        addNotification('Настройки сохранены', 'Настройки приложения обновлены', 'success');
        alert('Настройки сохранены');
        document.getElementById('settingsModal').style.display = 'none';
    }
}

// ============= التقرير الشهري =============
function showMonthlyReport() {
    const year = currentReportMonth.getFullYear();
    const month = currentReportMonth.getMonth();
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    document.getElementById('reportMonthYear').innerText = `${monthNames[month]} ${year}`;
    
    const monthExpenses = getExpensesForMonth(year, month);
    const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const remaining = settings.monthlyBudget - total;
    
    document.getElementById('reportTotal').innerHTML = `${total} ${settings.currency}`;
    document.getElementById('reportRemaining').innerHTML = `${remaining} ${settings.currency}`;
    
    const categories = {};
    monthExpenses.forEach(e => { categories[e.category] = (categories[e.category] || 0) + e.amount; });
    
    const categoriesHtml = Object.entries(categories).map(([cat, amount]) => `
        <div class="category-item"><span>${cat}</span><strong>${amount} ${settings.currency}</strong></div>
    `).join('');
    document.getElementById('reportCategories').innerHTML = categoriesHtml || '<p style="text-align:center; color:#8e8e93;">Нет расходов в этом месяце</p>';
    
    const transactionsHtml = monthExpenses.map(e => `
        <div class="transaction-item"><span>${escapeHtml(e.description)}</span><span>${e.amount} ${settings.currency}</span></div>
    `).join('');
    document.getElementById('reportTransactions').innerHTML = transactionsHtml || '<p style="text-align:center; color:#8e8e93;">Нет транзакций</p>';
    
    document.getElementById('monthlyReportModal').style.display = 'flex';
}

// ============= طلب الإشعارات =============
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}

// ============= معالجو الأحداث =============
document.addEventListener('DOMContentLoaded', () => {
    requestNotificationPermission();
    initializeAllDatePickers();
});

// تسجيل
document.getElementById('submitRegisterBtn').addEventListener('click', async () => {
    const fullName = document.getElementById('regFullName').value.trim();
    const role = document.getElementById('regRole').value;
    const birthDate = document.getElementById('regBirthDate').value;
    const bio = document.getElementById('regBio').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    
    if (!fullName) { alert('Пожалуйста, введите полное имя'); return; }
    
    const newId = generateUniqueID(fullName);
    const result = await apiCall('/api/register', 'POST', {
        uniqueId: newId, fullName, role, birthDate: birthDate || null, bio, email, phone, familyId: null
    });
    
    if (result.success) {
        currentUser = result.user;
        document.getElementById('generatedUniqueIdText').innerText = newId;
        document.getElementById('uniqueIdModal').style.display = 'flex';
        await loadAllData();
        showScreen('main');
        switchTab('home');
        updateDashboard();
        updateProfile();
        renderTasks();
        renderShopping();
        renderExpenses();
        renderSchedules();
        addNotification('Добро пожаловать!', `Добро пожаловать в приложение Моя Семья, ${fullName}!`, 'success');
    } else {
        alert(result.message || 'Ошибка регистрации');
    }
});

// تسجيل الدخول
document.getElementById('loginWithIdBtn').addEventListener('click', async () => {
    const enteredId = document.getElementById('loginUniqueId').value.trim();
    const result = await apiCall('/api/login', 'POST', { userId: enteredId });
    
    if (result.success) {
        currentUser = result.user;
        await loadAllData();
        showScreen('main');
        switchTab('home');
        updateDashboard();
        updateProfile();
        renderTasks();
        renderShopping();
        renderExpenses();
        renderSchedules();
        addNotification('Вход выполнен', `С возвращением, ${currentUser.fullName}!`, 'info');
    } else {
        alert('Неверный ID');
    }
});

// تسجيل الدخول الاجتماعي
function socialLoginMock(provider) {
    const name = prompt('Введите ваше имя:', `Пользователь ${provider}`);
    if (!name) return;
    const role = prompt('Введите вашу роль (Отец, Мать, Сын, Дочь и т.д.):', 'Пользователь');
    
    apiCall('/api/login/social', 'POST', {
        provider, email: `${provider.toLowerCase()}@example.com`, name, role: role || 'Пользователь'
    }).then(async (result) => {
        if (result.success) {
            currentUser = result.user;
            await loadAllData();
            showScreen('main');
            switchTab('home');
            updateDashboard();
            updateProfile();
            renderTasks();
            renderShopping();
            renderExpenses();
            renderSchedules();
            addNotification('Добро пожаловать!', `Добро пожаловать в приложение Моя Семья, ${currentUser.fullName}!`, 'success');
        }
    });
}

document.getElementById('socialApple').addEventListener('click', () => socialLoginMock('Apple'));
document.getElementById('socialGoogle').addEventListener('click', () => socialLoginMock('Google'));

// أزرار الانضمام
document.getElementById('openJoinGroupBtn').addEventListener('click', openJoinGroupModal);
document.getElementById('confirmJoinGroupBtn').addEventListener('click', sendJoinRequest);
document.getElementById('showInviteCodeBtn').addEventListener('click', showInviteCode);
document.getElementById('copyInviteCodeBtn').addEventListener('click', copyInviteCode);
document.getElementById('shareInviteCodeBtn').addEventListener('click', shareInviteCode);

// أزرار إدارة الصلاحيات
document.getElementById('managePermissionsBtn')?.addEventListener('click', () => {
    if (isFamilyHead()) {
        openPermissionsModal(currentUser.uniqueId, currentUser.fullName);
    }
});
document.getElementById('savePermissionsBtn')?.addEventListener('click', saveUserPermissions);

// أزرار المودالات
document.querySelectorAll('.close-modal, .closeJoinGroup, .closeInviteCode, .closePermissions, .closeEvent, .closeEditProfile, .closeNotifications, .closeSettings, .closeSchedule, .closeTask, .closeShopping, .closeExpense, .closeApproval, .closeReport, .closeUnique').forEach(el => {
    el.addEventListener('click', () => { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); });
});

// زر الإشعارات
document.getElementById('notificationsBtn').addEventListener('click', () => {
    renderNotifications();
    document.getElementById('notificationsModal').style.display = 'flex';
});
document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
    markAllNotificationsAsRead();
});

// زر الإعدادات
document.getElementById('settingsBtn').addEventListener('click', () => {
    loadSettingsToModal();
    document.getElementById('settingsModal').style.display = 'flex';
});
document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

// زر التقرير
document.getElementById('monthlyReportBtn').addEventListener('click', showMonthlyReport);
document.getElementById('prevMonth').addEventListener('click', () => { currentReportMonth.setMonth(currentReportMonth.getMonth() - 1); showMonthlyReport(); });
document.getElementById('nextMonth').addEventListener('click', () => { currentReportMonth.setMonth(currentReportMonth.getMonth() + 1); showMonthlyReport(); });

// زر الخروج
document.getElementById('logoutBtnMain').addEventListener('click', async () => {
    await apiCall('/api/logout', 'POST');
    currentUser = null;
    showScreen('login');
});

// التنقل بين الشاشات
document.getElementById('backFromRegister').addEventListener('click', () => showScreen('login'));
document.getElementById('goToRegisterBtn').addEventListener('click', () => showScreen('register'));

// نسخ ID
document.getElementById('copyIdBtn').addEventListener('click', () => {
    const idText = document.getElementById('generatedUniqueIdText').innerText;
    navigator.clipboard.writeText(idText);
    alert('ID скопирован');
});

// ============= أزرار الإضافة =============
document.getElementById('addTaskBtn').addEventListener('click', () => {
    if (!hasPermission('can_add_tasks')) { alert('У вас нет прав на добавление задач'); return; }
    const family = getCurrentFamily();
    const members = users.filter(u => family?.members?.includes(u.uniqueId));
    const select = document.getElementById('taskAssignee');
    select.innerHTML = '<option value="">Выберите ответственного</option>' + members.map(m => `<option value="${escapeHtml(m.fullName)}">${escapeHtml(m.fullName)} (${m.role})</option>`).join('');
    document.getElementById('addTaskModal').style.display = 'flex';
});

document.getElementById('confirmAddTask').addEventListener('click', async () => {
    const title = document.getElementById('taskTitle').value.trim();
    const assignee = document.getElementById('taskAssignee').value;
    if (!title) { alert('Введите название задачи'); return; }
    const family = getCurrentFamily();
    const result = await apiCall('/api/tasks', 'POST', { title, assignee, familyId: family.id, createdBy: currentUser.uniqueId });
    if (result.success) {
        await loadAllData();
        renderTasks();
        updateStats();
        document.getElementById('addTaskModal').style.display = 'none';
        document.getElementById('taskTitle').value = '';
        addNotification('📋 Новая задача', `Добавлена задача: ${title}`, 'info', result.task.id, 'task');
    }
});

document.getElementById('addShoppingBtn').addEventListener('click', () => {
    if (!hasPermission('can_add_shopping')) { alert('У вас нет прав на добавление покупок'); return; }
    document.getElementById('addShoppingModal').style.display = 'flex';
});

document.getElementById('confirmAddShopping').addEventListener('click', async () => {
    const name = document.getElementById('shoppingItem').value.trim();
    const price = parseFloat(document.getElementById('shoppingPrice').value);
    if (!name) { alert('Введите название товара'); return; }
    const family = getCurrentFamily();
    const result = await apiCall('/api/shopping', 'POST', { name, price: price || 0, familyId: family.id, createdBy: currentUser.uniqueId });
    if (result.success) {
        await loadAllData();
        renderShopping();
        updateStats();
        document.getElementById('addShoppingModal').style.display = 'none';
        document.getElementById('shoppingItem').value = '';
        document.getElementById('shoppingPrice').value = '';
        addNotification('🛒 Новый товар', `Добавлен товар: ${name}`, 'info', result.item.id, 'shopping');
    }
});

document.getElementById('addExpenseBtn').addEventListener('click', () => {
    if (!hasPermission('can_add_expenses')) { alert('У вас нет прав на добавление расходов'); return; }
    document.getElementById('addExpenseModal').style.display = 'flex';
});

document.getElementById('confirmAddExpense').addEventListener('click', async () => {
    const description = document.getElementById('expenseDesc').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const category = document.getElementById('expenseCategory').value;
    if (!description) { alert('Введите описание расхода'); return; }
    if (!amount || amount <= 0) { alert('Введите корректную сумму'); return; }
    const family = getCurrentFamily();
    const result = await apiCall('/api/expenses', 'POST', { description, amount, category, familyId: family.id, createdBy: currentUser.uniqueId, date: new Date().toISOString() });
    if (result.success) {
        await loadAllData();
        renderExpenses();
        updateStats();
        document.getElementById('addExpenseModal').style.display = 'none';
        document.getElementById('expenseDesc').value = '';
        document.getElementById('expenseAmount').value = '';
        addNotification('💰 Новый расход', `Добавлен расход: ${description} - ${amount} ${settings.currency}`, 'info', result.expense.id, 'expense');
        if (settings.monthlyBudget > 0) {
            const monthlyTotal = getCurrentMonthExpenses().reduce((sum, e) => sum + e.amount, 0);
            if (monthlyTotal > settings.monthlyBudget) {
                addNotification('⚠️ Предупреждение о бюджете', `Превышение месячного бюджета на ${monthlyTotal - settings.monthlyBudget} ${settings.currency}`, 'warning');
            }
        }
    }
});

document.getElementById('addEventBtn').addEventListener('click', () => {
    if (!hasPermission('can_add_events')) { alert('У вас нет прав на добавление событий'); return; }
    const family = getCurrentFamily();
    const familyMembers = users.filter(u => family?.members?.includes(u.uniqueId));
    const select = document.getElementById('eventPerson');
    select.innerHTML = '<option value="">Выберите человека</option>' + familyMembers.map(m => `<option value="${m.uniqueId}">${escapeHtml(m.fullName)} (${m.role})</option>`).join('');
    document.getElementById('addEventModal').style.display = 'flex';
    setTimeout(() => initializeAllDatePickers(), 100);
});

document.getElementById('confirmAddEvent').addEventListener('click', async () => {
    const title = document.getElementById('eventTitle').value.trim();
    const date = document.getElementById('eventDate').value;
    const reminderDays = parseInt(document.getElementById('eventReminderDays').value);
    const personId = document.getElementById('eventPerson').value;
    const color = document.getElementById('eventColor').value;
    if (!title) { alert('Введите название события'); return; }
    if (!date) { alert('Выберите дату события'); return; }
    const family = getCurrentFamily();
    const result = await apiCall('/api/events', 'POST', { 
        title, date, reminderDays, personId: personId || null, color, 
        familyId: family.id, createdBy: currentUser.uniqueId 
    });
    if (result.success) {
        await loadAllData();
        renderEvents();
        document.getElementById('addEventModal').style.display = 'none';
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventDate').value = '';
        addNotification('📅 Новое событие', `Добавлено событие: ${title}`, 'info', result.event.id, 'event');
        checkEventReminders();
    }
});

document.getElementById('addScheduleBtn').addEventListener('click', () => {
    if (!hasPermission('can_add_schedule')) { alert('У вас нет прав на добавление расписания'); return; }
    const family = getCurrentFamily();
    const familyMembers = users.filter(u => family?.members?.includes(u.uniqueId));
    const select = document.getElementById('scheduleMember');
    select.innerHTML = familyMembers.map(m => `<option value="${m.uniqueId}">${escapeHtml(m.fullName)} (${m.role})</option>`).join('');
    document.getElementById('addScheduleModal').style.display = 'flex';
});

document.getElementById('confirmAddSchedule').addEventListener('click', async () => {
    const memberId = document.getElementById('scheduleMember').value;
    const title = document.getElementById('scheduleTitle').value.trim();
    const day = document.getElementById('scheduleDay').value;
    const time = document.getElementById('scheduleTime').value;
    const location = document.getElementById('scheduleLocation').value.trim();
    if (!memberId || !title) { alert('Выберите человека и введите название'); return; }
    const family = getCurrentFamily();
    const result = await apiCall('/api/schedules', 'POST', { memberId, title, day, time, location, familyId: family.id, createdBy: currentUser.uniqueId });
    if (result.success) {
        await loadAllData();
        renderSchedules();
        document.getElementById('addScheduleModal').style.display = 'none';
        document.getElementById('scheduleTitle').value = '';
        document.getElementById('scheduleLocation').value = '';
        addNotification('📅 Новая запись', `Добавлена запись в расписание: ${title}`, 'info', result.schedule.id, 'schedule');
    }
});

document.getElementById('editProfileBtn').addEventListener('click', () => {
    document.getElementById('editBirthDate').value = formatDateForInput(currentUser.birthDate);
    document.getElementById('editBio').value = currentUser.bio || '';
    document.getElementById('editEmail').value = currentUser.email || '';
    document.getElementById('editPhone').value = currentUser.phone || '';
    document.getElementById('editProfileModal').style.display = 'flex';
    setTimeout(() => initializeAllDatePickers(), 100);
});

document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const updatedUser = { ...currentUser, birthDate: document.getElementById('editBirthDate').value, bio: document.getElementById('editBio').value, email: document.getElementById('editEmail').value, phone: document.getElementById('editPhone').value };
    const result = await apiCall(`/api/users/${currentUser.uniqueId}`, 'PUT', updatedUser);
    if (result.success) {
        currentUser = result.user;
        await loadAllData();
        updateProfile();
        document.getElementById('editProfileModal').style.display = 'none';
        addNotification('Профиль обновлен', 'Ваша информация обновлена успешно', 'success');
        alert('Изменения сохранены');
    }
});

document.getElementById('approveRequest').addEventListener('click', async () => {
    const request = pendingRequests.find(r => r.id === window.currentRequestId);
    if (request) {
        const result = await apiCall(`/api/requests/${request.id}`, 'PUT', { status: 'approved' });
        if (result.success) {
            alert('Заявка одобрена');
            document.getElementById('approvalModal').style.display = 'none';
            await loadAllData();
            renderFamilyMembers();
            renderPendingRequests();
            updateScheduleMemberFilter();
            addNotification('👨‍👩‍👧 Новый член семьи', `Пользователь присоединился к семье`, 'success');
        }
    }
});

document.getElementById('rejectRequest').addEventListener('click', async () => {
    const request = pendingRequests.find(r => r.id === window.currentRequestId);
    if (request) {
        await apiCall(`/api/requests/${request.id}`, 'PUT', { status: 'rejected' });
        document.getElementById('approvalModal').style.display = 'none';
        await loadAllData();
        renderPendingRequests();
        addNotification('Заявка отклонена', 'Заявка отклонена', 'warning');
    }
});

document.getElementById('inviteMemberBtn').addEventListener('click', showInviteCode);

// التبويبات
document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => { switchTab(tab.dataset.tab); });
});

// ============= دالة إنشاء العائلة عند التحميل =============
async function init() {
    const loggedIn = await loadCurrentUser();
    if (loggedIn) {
        // التأكد من وجود عائلة
        const hasFamily = await ensureUserHasFamily();
        if (!hasFamily) {
            console.log('⚠️ لا توجد عائلة، محاولة مرة أخرى...');
            setTimeout(async () => {
                await ensureUserHasFamily();
                await loadAllData();
                updateDashboard();
            }, 1000);
        }
        
        showScreen('main');
        switchTab('home');
        updateDashboard();
        updateProfile();
        renderTasks();
        renderShopping();
        renderExpenses();
        renderSchedules();
        setTimeout(autoFixFamily, 1000);
    } else {
        showScreen('login');
    }
    setTimeout(() => initializeAllDatePickers(), 200);
    setInterval(() => { checkEventReminders(); checkDailyReminders(); }, 3600000);
}

init();