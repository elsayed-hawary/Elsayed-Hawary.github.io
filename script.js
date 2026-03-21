// Модели данных
let currentUser = null;
let users = [];
let families = [];
let pendingRequests = [];
let tasks = [];
let shopping = [];
let expenses = [];
let events = [];
let schedules = [];
let notifications = [];
let settings = {
    currency: '₽',
    homeAddress: '',
    monthlyBudget: 0,
    taskReminders: true,
    eventReminders: true
};

let pendingRoleSelection = null;
let currentReportMonth = new Date();

// Загрузка из localStorage
function loadData() {
    const storedUsers = localStorage.getItem('family_users');
    const storedFamilies = localStorage.getItem('family_families');
    const storedRequests = localStorage.getItem('family_requests');
    const storedTasks = localStorage.getItem('family_tasks');
    const storedShopping = localStorage.getItem('family_shopping');
    const storedExpenses = localStorage.getItem('family_expenses');
    const storedEvents = localStorage.getItem('family_events');
    const storedSchedules = localStorage.getItem('family_schedules');
    const storedNotifications = localStorage.getItem('family_notifications');
    const storedSettings = localStorage.getItem('family_settings');
    
    users = storedUsers ? JSON.parse(storedUsers) : [];
    families = storedFamilies ? JSON.parse(storedFamilies) : [];
    pendingRequests = storedRequests ? JSON.parse(storedRequests) : [];
    tasks = storedTasks ? JSON.parse(storedTasks) : [];
    shopping = storedShopping ? JSON.parse(storedShopping) : [];
    expenses = storedExpenses ? JSON.parse(storedExpenses) : [];
    events = storedEvents ? JSON.parse(storedEvents) : [];
    schedules = storedSchedules ? JSON.parse(storedSchedules) : [];
    notifications = storedNotifications ? JSON.parse(storedNotifications) : [];
    if (storedSettings) settings = { ...settings, ...JSON.parse(storedSettings) };
}

function saveData() {
    localStorage.setItem('family_users', JSON.stringify(users));
    localStorage.setItem('family_families', JSON.stringify(families));
    localStorage.setItem('family_requests', JSON.stringify(pendingRequests));
    localStorage.setItem('family_tasks', JSON.stringify(tasks));
    localStorage.setItem('family_shopping', JSON.stringify(shopping));
    localStorage.setItem('family_expenses', JSON.stringify(expenses));
    localStorage.setItem('family_events', JSON.stringify(events));
    localStorage.setItem('family_schedules', JSON.stringify(schedules));
    localStorage.setItem('family_notifications', JSON.stringify(notifications));
    localStorage.setItem('family_settings', JSON.stringify(settings));
}

// Вспомогательные функции
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

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const monthNames = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'];
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
}

// Генерация уникального ID
function generateUniqueID(name) {
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const prefix = name.substring(0, 2).toUpperCase();
    return `FAM-${prefix}${random}`;
}

function generateFamilyCode() {
    return 'FAMILY-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Добавление уведомления
function addNotification(title, message, type = 'info') {
    const notification = {
        id: Date.now(),
        title,
        message,
        type,
        date: new Date().toISOString(),
        read: false
    };
    notifications.unshift(notification);
    if (notifications.length > 50) notifications.pop();
    saveData();
}

// Функции для работы с датами
function triggerDatePicker(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        try {
            if (input.showPicker) {
                input.showPicker();
            } else {
                input.focus();
                input.click();
            }
        } catch(e) {
            input.focus();
        }
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

// Управление экранами
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

// Управление вкладками
function switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.querySelectorAll('.tab-item').forEach(item => item.classList.remove('active'));
    document.getElementById(`${tabId}Tab`).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    if (tabId === 'tasks') renderTasks();
    if (tabId === 'shopping') renderShopping();
    if (tabId === 'expenses') renderExpenses();
    if (tabId === 'schedule') {
        updateScheduleMemberFilter();
        renderSchedules();
    }
    if (tabId === 'profile') updateProfile();
}

// Получение текущей семьи
function getCurrentFamily() {
    if (!currentUser) return null;
    return families.find(f => f.members && f.members.includes(currentUser.uniqueId));
}

// Создание семьи если её нет
function ensureFamily() {
    if (!currentUser) return null;
    let family = families.find(f => f.members && f.members.includes(currentUser.uniqueId));
    
    if (!family) {
        const newFamily = {
            id: generateFamilyCode(),
            name: `Семья ${currentUser.fullName}`,
            members: [currentUser.uniqueId],
            createdBy: currentUser.uniqueId,
            createdAt: new Date().toISOString()
        };
        families.push(newFamily);
        currentUser.familyId = newFamily.id;
        saveData();
        return newFamily;
    }
    return family;
}

// Расходы текущего месяца
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

// Обновление статистики
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

// Рендер событий
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
        
        return `
            <div class="event-item" style="border-right-color: ${event.color || '#667eea'}">
                <div class="event-date">
                    <div class="event-day">${day}</div>
                    <div class="event-month">${month}</div>
                </div>
                <div class="event-info">
                    <div class="event-title">${escapeHtml(event.title)}</div>
                    ${person ? `<div class="event-person"><i class="fas fa-user"></i> ${escapeHtml(person.fullName)} (${person.role})</div>` : ''}
                </div>
                <div class="event-actions">
                    <button class="delete-event" data-id="${event.id}"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.delete-event').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const eventId = parseInt(btn.dataset.id);
            events = events.filter(e => e.id !== eventId);
            saveData();
            renderEvents();
        });
    });
}

// Рендер членов семьи
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
    
    container.innerHTML = familyMembers.map(member => {
        const age = calculateAge(member.birthDate);
        return `
            <div class="member-item">
                <div class="member-avatar-small">
                    <i class="fas fa-user"></i>
                </div>
                <div class="member-details">
                    <h4>${escapeHtml(member.fullName)} ${member.uniqueId === currentUser.uniqueId ? '(Вы)' : ''}</h4>
                    <p>${member.email || 'Нет email'} ${age ? ` • ${age} лет` : ''}</p>
                </div>
                <div class="member-badge">${member.role}</div>
            </div>
        `;
    }).join('');
}

// Рендер задач
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
            ${!task.completed ? `<button class="complete-btn" data-id="${task.id}">Выполнено</button>` : '<span style="color:#34c759;">✓ Выполнено</span>'}
        </div>
    `).join('');
    
    document.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const taskId = parseInt(btn.dataset.id);
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                task.completed = true;
                saveData();
                renderTasks();
                updateStats();
                addNotification('Задача выполнена', `Задача "${task.title}" выполнена`, 'success');
            }
        });
    });
}

// Рендер покупок
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
            ${!item.purchased ? `<button class="buy-btn" data-id="${item.id}">Куплено</button>` : '<span style="color:#34c759;">✓ Куплено</span>'}
        </div>
    `).join('');
    
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemId = parseInt(btn.dataset.id);
            const item = shopping.find(s => s.id === itemId);
            if (item) {
                item.purchased = true;
                saveData();
                renderShopping();
                updateStats();
                addNotification('Товар куплен', `Товар "${item.name}" куплен`, 'success');
            }
        });
    });
}

// Рендер расходов
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
            <button class="delete-expense" data-id="${exp.id}"><i class="fas fa-trash-alt"></i></button>
        </div>
    `).join('');
    
    document.querySelectorAll('.delete-expense').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const expId = parseInt(btn.dataset.id);
            expenses = expenses.filter(e => e.id !== expId);
            saveData();
            renderExpenses();
            updateStats();
            addNotification('Расход удален', 'Расход успешно удален', 'info');
        });
    });
}

// Рендер расписания
function renderSchedules() {
    const family = getCurrentFamily();
    const memberFilter = document.getElementById('scheduleMemberFilter').value;
    let familySchedules = schedules.filter(s => s.familyId === (family?.id || currentUser?.familyId));
    
    if (memberFilter !== 'all') {
        familySchedules = familySchedules.filter(s => s.memberId === memberFilter);
    }
    
    const daysOrder = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    const sortedSchedules = [...familySchedules].sort((a, b) => {
        return daysOrder.indexOf(a.day) - daysOrder.indexOf(b.day);
    });
    
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
        btn.addEventListener('click', (e) => {
            const scheduleId = parseInt(btn.dataset.id);
            schedules = schedules.filter(s => s.id !== scheduleId);
            saveData();
            renderSchedules();
            addNotification('Расписание обновлено', 'Запись удалена из расписания', 'info');
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

// Рендер заявок
function renderPendingRequests() {
    const family = getCurrentFamily();
    if (!family) return;
    const familyRequests = pendingRequests.filter(r => r.familyId === family.id && r.status === 'pending');
    const section = document.getElementById('pendingApprovalsSection');
    const container = document.getElementById('pendingRequestsList');
    
    if (familyRequests.length > 0 && (currentUser.role === 'Отец' || currentUser.role === 'Мать' || currentUser.role === 'Муж')) {
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
                    document.getElementById('approvalDetails').innerHTML = `
                        <p style="margin-bottom: 12px;"><strong>${users.find(u => u.uniqueId === request.userId)?.fullName}</strong> хочет присоединиться к вашей семье</p>
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

// Рендер уведомлений
function renderNotifications() {
    const container = document.getElementById('notificationsList');
    const unreadNotifications = notifications.filter(n => !n.read);
    
    if (unreadNotifications.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color:#8e8e93;"><i class="fas fa-bell-slash" style="font-size: 32px; margin-bottom: 8px; display: block;"></i>Нет новых уведомлений</div>';
        return;
    }
    
    container.innerHTML = unreadNotifications.map(notif => `
        <div class="notification-item">
            <div class="notification-title">${escapeHtml(notif.title)}</div>
            <div class="notification-message" style="font-size: 13px; color:#8e8e93; margin: 4px 0;">${escapeHtml(notif.message)}</div>
            <div class="notification-date">${formatDate(notif.date)}</div>
        </div>
    `).join('');
}

// Обновление профиля
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

// Обновление главной панели
function updateDashboard() {
    document.getElementById('dashboardUserName').innerHTML = currentUser.fullName.split(' ')[0];
    document.getElementById('dashboardUserRole').innerHTML = `Роль: ${currentUser.role}`;
    renderFamilyMembers();
    updateStats();
    renderEvents();
    renderPendingRequests();
}

// Загрузка настроек в модальное окно
function loadSettingsToModal() {
    document.getElementById('currencySelect').value = settings.currency;
    document.getElementById('homeAddress').value = settings.homeAddress || '';
    document.getElementById('monthlyBudget').value = settings.monthlyBudget || '';
    document.getElementById('taskReminders').checked = settings.taskReminders;
    document.getElementById('eventReminders').checked = settings.eventReminders;
    
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

// Сохранение настроек
function saveSettings() {
    settings.currency = document.getElementById('currencySelect').value;
    settings.homeAddress = document.getElementById('homeAddress').value;
    settings.monthlyBudget = parseFloat(document.getElementById('monthlyBudget').value) || 0;
    settings.taskReminders = document.getElementById('taskReminders').checked;
    settings.eventReminders = document.getElementById('eventReminders').checked;
    saveData();
    updateStats();
    addNotification('Настройки сохранены', 'Настройки приложения обновлены', 'success');
    alert('Настройки сохранены');
    document.getElementById('settingsModal').style.display = 'none';
}

// Поделиться ссылкой-приглашением
function shareInviteLink() {
    const family = ensureFamily();
    if (!family) {
        alert('Ошибка. Пожалуйста, попробуйте снова.');
        return;
    }
    
    const inviteCode = family.id;
    
    if (navigator.share) {
        navigator.share({
            title: 'Присоединяйтесь к моей семье в приложении Моя Семья',
            text: `Используйте этот код для присоединения к моей семье: ${inviteCode}`,
        }).catch(() => {
            copyToClipboard(inviteCode);
        });
    } else {
        copyToClipboard(inviteCode);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert('Код приглашения скопирован: ' + text);
}

// Ежемесячный отчет
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
    monthExpenses.forEach(e => {
        categories[e.category] = (categories[e.category] || 0) + e.amount;
    });
    
    const categoriesHtml = Object.entries(categories).map(([cat, amount]) => `
        <div class="category-item">
            <span>${cat}</span>
            <strong>${amount} ${settings.currency}</strong>
        </div>
    `).join('');
    document.getElementById('reportCategories').innerHTML = categoriesHtml || '<p style="text-align:center; color:#8e8e93;">Нет расходов в этом месяце</p>';
    
    const transactionsHtml = monthExpenses.map(e => `
        <div class="transaction-item">
            <span>${escapeHtml(e.description)}</span>
            <span>${e.amount} ${settings.currency}</span>
        </div>
    `).join('');
    document.getElementById('reportTransactions').innerHTML = transactionsHtml || '<p style="text-align:center; color:#8e8e93;">Нет транзакций</p>';
    
    document.getElementById('monthlyReportModal').style.display = 'flex';
}

// Экранирование HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============= ОБРАБОТЧИКИ СОБЫТИЙ =============

// Регистрация
document.getElementById('submitRegisterBtn').addEventListener('click', () => {
    const fullName = document.getElementById('regFullName').value.trim();
    const role = document.getElementById('regRole').value;
    const birthDate = document.getElementById('regBirthDate').value;
    const bio = document.getElementById('regBio').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    
    if (!fullName) {
        alert('Пожалуйста, введите полное имя');
        return;
    }
    
    const newId = generateUniqueID(fullName);
    const newUser = {
        uniqueId: newId,
        fullName,
        role,
        birthDate: birthDate || null,
        bio,
        email,
        phone,
        familyId: null
    };
    
    users.push(newUser);
    saveData();
    currentUser = newUser;
    
    const newFamily = {
        id: generateFamilyCode(),
        name: `Семья ${fullName}`,
        members: [newId],
        createdBy: newId,
        createdAt: new Date().toISOString()
    };
    families.push(newFamily);
    currentUser.familyId = newFamily.id;
    saveData();
    
    document.getElementById('generatedUniqueIdText').innerText = newId;
    document.getElementById('uniqueIdModal').style.display = 'flex';
    showScreen('main');
    switchTab('home');
    updateDashboard();
    updateProfile();
    renderTasks();
    renderShopping();
    renderExpenses();
    renderSchedules();
    addNotification('Добро пожаловать!', `Добро пожаловать в приложение Моя Семья, ${fullName}!`, 'success');
});

// Вход по ID
document.getElementById('loginWithIdBtn').addEventListener('click', () => {
    const enteredId = document.getElementById('loginUniqueId').value.trim();
    const user = users.find(u => u.uniqueId === enteredId);
    if (user) {
        currentUser = user;
        showScreen('main');
        switchTab('home');
        updateDashboard();
        updateProfile();
        renderTasks();
        renderShopping();
        renderExpenses();
        renderSchedules();
        addNotification('Вход выполнен', `С возвращением, ${user.fullName}!`, 'info');
    } else {
        alert('Неверный ID');
    }
});

// Социальный вход
function socialLoginMock(provider) {
    pendingRoleSelection = { provider, fullName: `Пользователь ${provider}`, email: `${provider}@example.com`, phone: '000000000' };
    document.getElementById('roleSelectionModal').style.display = 'flex';
}

document.getElementById('socialApple').addEventListener('click', () => socialLoginMock('Apple'));
document.getElementById('socialGoogle').addEventListener('click', () => socialLoginMock('Google'));

document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const role = btn.dataset.role;
        if (pendingRoleSelection) {
            const newId = generateUniqueID(pendingRoleSelection.fullName);
            const newUser = {
                uniqueId: newId,
                fullName: pendingRoleSelection.fullName,
                role: role,
                email: pendingRoleSelection.email,
                phone: pendingRoleSelection.phone,
                familyId: null
            };
            users.push(newUser);
            saveData();
            currentUser = newUser;
            
            const newFamily = {
                id: generateFamilyCode(),
                name: `Семья ${newUser.fullName}`,
                members: [newId],
                createdBy: newId,
                createdAt: new Date().toISOString()
            };
            families.push(newFamily);
            currentUser.familyId = newFamily.id;
            saveData();
            
            document.getElementById('generatedUniqueIdText').innerText = newId;
            document.getElementById('uniqueIdModal').style.display = 'flex';
            document.getElementById('roleSelectionModal').style.display = 'none';
            showScreen('main');
            switchTab('home');
            updateDashboard();
            updateProfile();
            renderTasks();
            renderShopping();
            renderExpenses();
            renderSchedules();
            pendingRoleSelection = null;
            addNotification('Добро пожаловать!', `Добро пожаловать в приложение Моя Семья, ${newUser.fullName}!`, 'success');
        }
    });
});

// Присоединение к семье
document.getElementById('joinFamilyBtn').addEventListener('click', () => {
    if (!currentUser) {
        alert('Пожалуйста, войдите в систему');
        return;
    }
    document.getElementById('joinFamilyModal').style.display = 'flex';
});

document.getElementById('submitJoinRequest').addEventListener('click', () => {
    const familyCode = document.getElementById('familyCodeInput').value.trim();
    const family = families.find(f => f.id === familyCode);
    if (family) {
        if (family.members && family.members.includes(currentUser.uniqueId)) {
            alert('Вы уже являетесь членом этой семьи');
            document.getElementById('joinFamilyModal').style.display = 'none';
            return;
        }
        const existingRequest = pendingRequests.find(r => r.userId === currentUser.uniqueId && r.familyId === family.id);
        if (existingRequest) {
            alert('У вас уже есть ожидающая заявка');
            return;
        }
        const newRequest = {
            id: Date.now(),
            familyId: family.id,
            userId: currentUser.uniqueId,
            requestedRole: currentUser.role,
            status: 'pending'
        };
        pendingRequests.push(newRequest);
        saveData();
        alert('Заявка отправлена успешно, ожидайте одобрения');
        document.getElementById('joinFamilyModal').style.display = 'none';
        document.getElementById('familyCodeInput').value = '';
        addNotification('Заявка отправлена', `Заявка на вступление в семью ${family.name} отправлена`, 'info');
    } else {
        alert('Неверный код семьи');
    }
});

// Одобрение/отклонение заявок
document.getElementById('approveRequest').addEventListener('click', () => {
    const request = pendingRequests.find(r => r.id === window.currentRequestId);
    if (request) {
        const family = families.find(f => f.id === request.familyId);
        if (family) {
            if (!family.members) family.members = [];
            family.members.push(request.userId);
            const user = users.find(u => u.uniqueId === request.userId);
            if (user) user.familyId = family.id;
            pendingRequests = pendingRequests.filter(r => r.id !== window.currentRequestId);
            saveData();
            alert('Заявка одобрена');
            document.getElementById('approvalModal').style.display = 'none';
            if (currentUser.uniqueId === request.userId) {
                currentUser.familyId = family.id;
                updateDashboard();
            }
            renderFamilyMembers();
            renderPendingRequests();
            updateScheduleMemberFilter();
            addNotification('Новый член семьи', `${user?.fullName} присоединился к семье`, 'success');
        }
    }
});

document.getElementById('rejectRequest').addEventListener('click', () => {
    const request = pendingRequests.find(r => r.id === window.currentRequestId);
    if (request) {
        const requester = users.find(u => u.uniqueId === request.userId);
        pendingRequests = pendingRequests.filter(r => r.id !== window.currentRequestId);
        saveData();
        document.getElementById('approvalModal').style.display = 'none';
        renderPendingRequests();
        addNotification('Заявка отклонена', `Заявка ${requester?.fullName} отклонена`, 'warning');
    }
});

// Пригласить члена семьи
document.getElementById('inviteMemberBtn').addEventListener('click', shareInviteLink);

// Уведомления
document.getElementById('notificationsBtn').addEventListener('click', () => {
    renderNotifications();
    document.getElementById('notificationsModal').style.display = 'flex';
});

// Редактирование профиля
document.getElementById('editProfileBtn').addEventListener('click', () => {
    document.getElementById('editBirthDate').value = formatDateForInput(currentUser.birthDate);
    document.getElementById('editBio').value = currentUser.bio || '';
    document.getElementById('editEmail').value = currentUser.email || '';
    document.getElementById('editPhone').value = currentUser.phone || '';
    document.getElementById('editProfileModal').style.display = 'flex';
    setTimeout(() => initializeAllDatePickers(), 100);
});

document.getElementById('saveProfileBtn').addEventListener('click', () => {
    currentUser.birthDate = document.getElementById('editBirthDate').value;
    currentUser.bio = document.getElementById('editBio').value;
    currentUser.email = document.getElementById('editEmail').value;
    currentUser.phone = document.getElementById('editPhone').value;
    
    const userIndex = users.findIndex(u => u.uniqueId === currentUser.uniqueId);
    if (userIndex !== -1) users[userIndex] = currentUser;
    saveData();
    updateProfile();
    document.getElementById('editProfileModal').style.display = 'none';
    addNotification('Профиль обновлен', 'Ваша информация обновлена успешно', 'success');
    alert('Изменения сохранены');
});

// Добавление события
document.getElementById('addEventBtn').addEventListener('click', () => {
    const family = getCurrentFamily();
    if (!family) {
        alert('Сначала создайте семью');
        return;
    }
    const familyMembers = users.filter(u => family.members && family.members.includes(u.uniqueId));
    const select = document.getElementById('eventPerson');
    select.innerHTML = '<option value="">Выберите человека</option>' + 
        familyMembers.map(m => `<option value="${m.uniqueId}">${escapeHtml(m.fullName)} (${m.role})</option>`).join('');
    
    const eventDateInput = document.getElementById('eventDate');
    if (eventDateInput) eventDateInput.value = '';
    
    document.getElementById('addEventModal').style.display = 'flex';
    setTimeout(() => initializeAllDatePickers(), 100);
});

document.getElementById('confirmAddEvent').addEventListener('click', () => {
    const title = document.getElementById('eventTitle').value.trim();
    const date = document.getElementById('eventDate').value;
    const personId = document.getElementById('eventPerson').value;
    const color = document.getElementById('eventColor').value;
    
    if (!title) {
        alert('Введите название события');
        return;
    }
    
    if (!date) {
        alert('Выберите дату события');
        return;
    }
    
    const family = ensureFamily();
    events.push({
        id: Date.now(),
        title,
        date,
        personId: personId || null,
        color,
        familyId: family.id,
        createdBy: currentUser.uniqueId,
        createdAt: new Date().toISOString()
    });
    saveData();
    renderEvents();
    document.getElementById('addEventModal').style.display = 'none';
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDate').value = '';
    addNotification('Новое событие', `Добавлено событие: ${title}`, 'info');
});

// Добавление расписания
document.getElementById('addScheduleBtn').addEventListener('click', () => {
    const family = ensureFamily();
    const familyMembers = users.filter(u => family.members && family.members.includes(u.uniqueId));
    const select = document.getElementById('scheduleMember');
    select.innerHTML = familyMembers.map(m => `<option value="${m.uniqueId}">${escapeHtml(m.fullName)} (${m.role})</option>`).join('');
    document.getElementById('addScheduleModal').style.display = 'flex';
});

document.getElementById('confirmAddSchedule').addEventListener('click', () => {
    const memberId = document.getElementById('scheduleMember').value;
    const title = document.getElementById('scheduleTitle').value.trim();
    const day = document.getElementById('scheduleDay').value;
    const time = document.getElementById('scheduleTime').value;
    const location = document.getElementById('scheduleLocation').value.trim();
    
    if (!memberId || !title) {
        alert('Выберите человека и введите название');
        return;
    }
    
    const family = ensureFamily();
    schedules.push({
        id: Date.now(),
        memberId,
        title,
        day,
        time,
        location,
        familyId: family.id,
        createdBy: currentUser.uniqueId,
        createdAt: new Date().toISOString()
    });
    saveData();
    renderSchedules();
    document.getElementById('addScheduleModal').style.display = 'none';
    document.getElementById('scheduleTitle').value = '';
    document.getElementById('scheduleLocation').value = '';
    addNotification('Новая запись', `Добавлена запись в расписание: ${title}`, 'info');
});

// Добавление задачи
document.getElementById('addTaskBtn').addEventListener('click', () => {
    const family = ensureFamily();
    const members = users.filter(u => family.members && family.members.includes(u.uniqueId));
    const select = document.getElementById('taskAssignee');
    select.innerHTML = '<option value="">Выберите ответственного</option>' + 
        members.map(m => `<option value="${escapeHtml(m.fullName)}">${escapeHtml(m.fullName)} (${m.role})</option>`).join('');
    document.getElementById('addTaskModal').style.display = 'flex';
});

document.getElementById('confirmAddTask').addEventListener('click', () => {
    const title = document.getElementById('taskTitle').value.trim();
    const assignee = document.getElementById('taskAssignee').value;
    if (!title) {
        alert('Введите название задачи');
        return;
    }
    const family = ensureFamily();
    tasks.push({
        id: Date.now(),
        title,
        assignee,
        familyId: family.id,
        completed: false,
        createdAt: new Date().toISOString()
    });
    saveData();
    renderTasks();
    updateStats();
    document.getElementById('addTaskModal').style.display = 'none';
    document.getElementById('taskTitle').value = '';
    addNotification('Новая задача', `Добавлена задача: ${title}`, 'info');
});

// Добавление покупки
document.getElementById('addShoppingBtn').addEventListener('click', () => {
    document.getElementById('addShoppingModal').style.display = 'flex';
});

document.getElementById('confirmAddShopping').addEventListener('click', () => {
    const name = document.getElementById('shoppingItem').value.trim();
    const price = parseFloat(document.getElementById('shoppingPrice').value);
    if (!name) {
        alert('Введите название товара');
        return;
    }
    const family = ensureFamily();
    shopping.push({
        id: Date.now(),
        name,
        price: price || 0,
        familyId: family.id,
        purchased: false,
        createdAt: new Date().toISOString()
    });
    saveData();
    renderShopping();
    updateStats();
    document.getElementById('addShoppingModal').style.display = 'none';
    document.getElementById('shoppingItem').value = '';
    document.getElementById('shoppingPrice').value = '';
    addNotification('Новый товар', `Добавлен товар: ${name}`, 'info');
});

// Добавление расхода
document.getElementById('addExpenseBtn').addEventListener('click', () => {
    document.getElementById('addExpenseModal').style.display = 'flex';
});

document.getElementById('confirmAddExpense').addEventListener('click', () => {
    const description = document.getElementById('expenseDesc').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const category = document.getElementById('expenseCategory').value;
    if (!description) {
        alert('Введите описание расхода');
        return;
    }
    if (!amount || amount <= 0) {
        alert('Введите корректную сумму');
        return;
    }
    const family = ensureFamily();
    expenses.push({
        id: Date.now(),
        description,
        amount,
        category,
        familyId: family.id,
        date: new Date().toISOString()
    });
    saveData();
    renderExpenses();
    updateStats();
    document.getElementById('addExpenseModal').style.display = 'none';
    document.getElementById('expenseDesc').value = '';
    document.getElementById('expenseAmount').value = '';
    addNotification('Новый расход', `Добавлен расход: ${description} - ${amount} ${settings.currency}`, 'info');
    
    if (settings.monthlyBudget > 0) {
        const monthlyTotal = getCurrentMonthExpenses().reduce((sum, e) => sum + e.amount, 0);
        if (monthlyTotal > settings.monthlyBudget) {
            addNotification('Предупреждение о бюджете', `Превышение месячного бюджета на ${monthlyTotal - settings.monthlyBudget} ${settings.currency}`, 'warning');
        }
    }
});

// Настройки
document.getElementById('settingsBtn').addEventListener('click', () => {
    loadSettingsToModal();
    document.getElementById('settingsModal').style.display = 'flex';
});

document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

// Ежемесячный отчет
document.getElementById('monthlyReportBtn').addEventListener('click', showMonthlyReport);
document.getElementById('prevMonth').addEventListener('click', () => {
    currentReportMonth.setMonth(currentReportMonth.getMonth() - 1);
    showMonthlyReport();
});
document.getElementById('nextMonth').addEventListener('click', () => {
    currentReportMonth.setMonth(currentReportMonth.getMonth() + 1);
    showMonthlyReport();
});

// Переключение вкладок
document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        switchTab(tabId);
    });
});

// Выход
document.getElementById('logoutBtnMain').addEventListener('click', () => {
    currentUser = null;
    showScreen('login');
});

// Навигация
document.getElementById('backFromRegister').addEventListener('click', () => showScreen('login'));
document.getElementById('goToRegisterBtn').addEventListener('click', () => showScreen('register'));

// Копирование ID
document.getElementById('copyIdBtn').addEventListener('click', () => {
    const idText = document.getElementById('generatedUniqueIdText').innerText;
    navigator.clipboard.writeText(idText);
    alert('ID скопирован');
});

// Закрытие модальных окон
document.querySelectorAll('.close-modal, .closeTask, .closeShopping, .closeExpense, .closeEvent, .closeSchedule, .closeInvite, .closeJoin, .closeApproval, .closeUnique, .closeSettings, .closeReport, .closeNotifications, .closeEditProfile').forEach(el => {
    el.addEventListener('click', () => {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    });
});

// Инициализация
loadData();
showScreen('login');
setTimeout(() => initializeAllDatePickers(), 200);