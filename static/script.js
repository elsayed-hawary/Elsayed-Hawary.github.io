// API URLs
const API_BASE = window.location.origin;

// Глобальные переменные
let currentUser = null;
let users = [];
let families = [];
let tasks = [];
let shopping = [];
let expenses = [];
let events = [];
let schedules = [];
let pendingRequests = [];
let settings = {
    currency: '₽',
    homeAddress: '',
    monthlyBudget: 0,
    taskReminders: true,
    eventReminders: true
};

let currentReportMonth = new Date();

// ============= ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =============

async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, message: 'Ошибка соединения с сервером' };
    }
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

function generateUniqueID(name) {
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const prefix = name.substring(0, 2).toUpperCase();
    return `FAM-${prefix}${random}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function addNotification(title, message, type = 'info') {
    console.log(`[${type}] ${title}: ${message}`);
    // Можно добавить визуальное уведомление
}

// ============= ДАТА ПИКЕР =============

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

// ============= ЗАГРУЗКА ДАННЫХ =============

async function loadCurrentUser() {
    const result = await apiCall('/api/current_user');
    if (result.success && result.user) {
        currentUser = result.user;
        await loadAllData();
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
}

// ============= УПРАВЛЕНИЕ ЭКРАНАМИ =============

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

// ============= УПРАВЛЕНИЕ ВКЛАДКАМИ =============

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

// ============= ПОЛУЧЕНИЕ ТЕКУЩЕЙ СЕМЬИ =============

function getCurrentFamily() {
    if (!currentUser) return null;
    return families.find(f => f.members && f.members.includes(currentUser.uniqueId));
}

// ============= РАСХОДЫ =============

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

// ============= ОБНОВЛЕНИЕ СТАТИСТИКИ =============

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

// ============= РЕНДЕР СОБЫТИЙ =============

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
        btn.addEventListener('click', async (e) => {
            const eventId = parseInt(btn.dataset.id);
            const result = await apiCall(`/api/events/${eventId}`, 'DELETE');
            if (result.success) {
                await loadAllData();
                renderEvents();
            }
        });
    });
}

// ============= РЕНДЕР ЧЛЕНОВ СЕМЬИ =============

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

// ============= РЕНДЕР ЗАДАЧ =============

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
        btn.addEventListener('click', async (e) => {
            const taskId = parseInt(btn.dataset.id);
            const result = await apiCall(`/api/tasks/${taskId}`, 'PUT', { completed: true });
            if (result.success) {
                await loadAllData();
                renderTasks();
                updateStats();
                addNotification('Задача выполнена', `Задача "${result.task.title}" выполнена`, 'success');
            }
        });
    });
}

// ============= РЕНДЕР ПОКУПОК =============

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
        btn.addEventListener('click', async (e) => {
            const itemId = parseInt(btn.dataset.id);
            const result = await apiCall(`/api/shopping/${itemId}`, 'PUT', { purchased: true });
            if (result.success) {
                await loadAllData();
                renderShopping();
                updateStats();
                addNotification('Товар куплен', `Товар "${result.item.name}" куплен`, 'success');
            }
        });
    });
}

// ============= РЕНДЕР РАСХОДОВ =============

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

// ============= РЕНДЕР РАСПИСАНИЯ =============

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

// ============= РЕНДЕР ЗАЯВОК =============

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

// ============= ОБНОВЛЕНИЕ ПРОФИЛЯ =============

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

// ============= ОБНОВЛЕНИЕ ГЛАВНОЙ ПАНЕЛИ =============

function updateDashboard() {
    document.getElementById('dashboardUserName').innerHTML = currentUser.fullName.split(' ')[0];
    document.getElementById('dashboardUserRole').innerHTML = `Роль: ${currentUser.role}`;
    renderFamilyMembers();
    updateStats();
    renderEvents();
    renderPendingRequests();
}

// ============= НАСТРОЙКИ =============

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

async function saveSettings() {
    const newSettings = {
        currency: document.getElementById('currencySelect').value,
        homeAddress: document.getElementById('homeAddress').value,
        monthlyBudget: parseFloat(document.getElementById('monthlyBudget').value) || 0,
        taskReminders: document.getElementById('taskReminders').checked,
        eventReminders: document.getElementById('eventReminders').checked
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

// ============= ПРИГЛАШЕНИЕ =============

function shareInviteLink() {
    const family = getCurrentFamily();
    if (!family) {
        alert('Ошибка. Пожалуйста, создайте семью сначала.');
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

// ============= ОТЧЕТ =============

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

// ============= ОБРАБОТЧИКИ СОБЫТИЙ =============

// Регистрация
document.getElementById('submitRegisterBtn').addEventListener('click', async () => {
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
    
    const result = await apiCall('/api/register', 'POST', {
        uniqueId: newId,
        fullName,
        role,
        birthDate: birthDate || null,
        bio,
        email,
        phone,
        familyId: null
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

// Вход по ID
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

// Социальный вход
function socialLoginMock(provider) {
    const name = prompt('Введите ваше имя:', `Пользователь ${provider}`);
    if (!name) return;
    
    const role = prompt('Введите вашу роль (Отец, Мать, Сын, Дочь и т.д.):', 'Пользователь');
    
    apiCall('/api/login/social', 'POST', {
        provider: provider,
        email: `${provider.toLowerCase()}@example.com`,
        name: name,
        role: role || 'Пользователь'
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

// Присоединение к семье
document.getElementById('joinFamilyBtn').addEventListener('click', () => {
    if (!currentUser) {
        alert('Пожалуйста, войдите в систему');
        return;
    }
    document.getElementById('joinFamilyModal').style.display = 'flex';
});

document.getElementById('submitJoinRequest').addEventListener('click', async () => {
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
        
        const result = await apiCall('/api/requests', 'POST', {
            familyId: family.id,
            userId: currentUser.uniqueId,
            requestedRole: currentUser.role
        });
        
        if (result.success) {
            alert('Заявка отправлена успешно, ожидайте одобрения');
            document.getElementById('joinFamilyModal').style.display = 'none';
            document.getElementById('familyCodeInput').value = '';
            addNotification('Заявка отправлена', `Заявка на вступление в семью ${family.name} отправлена`, 'info');
            await loadAllData();
            renderPendingRequests();
        }
    } else {
        alert('Неверный код семьи');
    }
});

// Одобрение заявок
document.getElementById('approveRequest').addEventListener('click', async () => {
    const request = pendingRequests.find(r => r.id === window.currentRequestId);
    if (request) {
        const result = await apiCall(`/api/requests/${request.id}`, 'PUT', { status: 'approved' });
        if (result.success) {
            alert('Заявка одобрена');
            document.getElementById('approvalModal').style.display = 'none';
            await loadAllData();
            if (currentUser.uniqueId === request.userId) {
                currentUser.familyId = request.familyId;
                updateDashboard();
            }
            renderFamilyMembers();
            renderPendingRequests();
            updateScheduleMemberFilter();
            addNotification('Новый член семьи', `Пользователь присоединился к семье`, 'success');
        }
    }
});

document.getElementById('rejectRequest').addEventListener('click', async () => {
    const request = pendingRequests.find(r => r.id === window.currentRequestId);
    if (request) {
        const result = await apiCall(`/api/requests/${request.id}`, 'PUT', { status: 'rejected' });
        if (result.success) {
            document.getElementById('approvalModal').style.display = 'none';
            await loadAllData();
            renderPendingRequests();
            addNotification('Заявка отклонена', 'Заявка отклонена', 'warning');
        }
    }
});

// Пригласить члена семьи
document.getElementById('inviteMemberBtn').addEventListener('click', shareInviteLink);

// Уведомления
document.getElementById('notificationsBtn').addEventListener('click', () => {
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

document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const updatedUser = {
        ...currentUser,
        birthDate: document.getElementById('editBirthDate').value,
        bio: document.getElementById('editBio').value,
        email: document.getElementById('editEmail').value,
        phone: document.getElementById('editPhone').value
    };
    
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

document.getElementById('confirmAddEvent').addEventListener('click', async () => {
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
    
    const family = getCurrentFamily();
    const result = await apiCall('/api/events', 'POST', {
        title,
        date,
        personId: personId || null,
        color,
        familyId: family.id,
        createdBy: currentUser.uniqueId
    });
    
    if (result.success) {
        await loadAllData();
        renderEvents();
        document.getElementById('addEventModal').style.display = 'none';
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventDate').value = '';
        addNotification('Новое событие', `Добавлено событие: ${title}`, 'info');
    }
});

// Добавление расписания
document.getElementById('addScheduleBtn').addEventListener('click', () => {
    const family = getCurrentFamily();
    const familyMembers = users.filter(u => family.members && family.members.includes(u.uniqueId));
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
    
    if (!memberId || !title) {
        alert('Выберите человека и введите название');
        return;
    }
    
    const family = getCurrentFamily();
    const result = await apiCall('/api/schedules', 'POST', {
        memberId,
        title,
        day,
        time,
        location,
        familyId: family.id,
        createdBy: currentUser.uniqueId
    });
    
    if (result.success) {
        await loadAllData();
        renderSchedules();
        document.getElementById('addScheduleModal').style.display = 'none';
        document.getElementById('scheduleTitle').value = '';
        document.getElementById('scheduleLocation').value = '';
        addNotification('Новая запись', `Добавлена запись в расписание: ${title}`, 'info');
    }
});

// Добавление задачи
document.getElementById('addTaskBtn').addEventListener('click', () => {
    const family = getCurrentFamily();
    const members = users.filter(u => family.members && family.members.includes(u.uniqueId));
    const select = document.getElementById('taskAssignee');
    select.innerHTML = '<option value="">Выберите ответственного</option>' + 
        members.map(m => `<option value="${escapeHtml(m.fullName)}">${escapeHtml(m.fullName)} (${m.role})</option>`).join('');
    document.getElementById('addTaskModal').style.display = 'flex';
});

document.getElementById('confirmAddTask').addEventListener('click', async () => {
    const title = document.getElementById('taskTitle').value.trim();
    const assignee = document.getElementById('taskAssignee').value;
    if (!title) {
        alert('Введите название задачи');
        return;
    }
    
    const family = getCurrentFamily();
    const result = await apiCall('/api/tasks', 'POST', {
        title,
        assignee,
        familyId: family.id,
        createdBy: currentUser.uniqueId
    });
    
    if (result.success) {
        await loadAllData();
        renderTasks();
        updateStats();
        document.getElementById('addTaskModal').style.display = 'none';
        document.getElementById('taskTitle').value = '';
        addNotification('Новая задача', `Добавлена задача: ${title}`, 'info');
    }
});

// Добавление покупки
document.getElementById('addShoppingBtn').addEventListener('click', () => {
    document.getElementById('addShoppingModal').style.display = 'flex';
});

document.getElementById('confirmAddShopping').addEventListener('click', async () => {
    const name = document.getElementById('shoppingItem').value.trim();
    const price = parseFloat(document.getElementById('shoppingPrice').value);
    if (!name) {
        alert('Введите название товара');
        return;
    }
    
    const family = getCurrentFamily();
    const result = await apiCall('/api/shopping', 'POST', {
        name,
        price: price || 0,
        familyId: family.id,
        createdBy: currentUser.uniqueId
    });
    
    if (result.success) {
        await loadAllData();
        renderShopping();
        updateStats();
        document.getElementById('addShoppingModal').style.display = 'none';
        document.getElementById('shoppingItem').value = '';
        document.getElementById('shoppingPrice').value = '';
        addNotification('Новый товар', `Добавлен товар: ${name}`, 'info');
    }
});

// Добавление расхода
document.getElementById('addExpenseBtn').addEventListener('click', () => {
    document.getElementById('addExpenseModal').style.display = 'flex';
});

document.getElementById('confirmAddExpense').addEventListener('click', async () => {
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
    
    const family = getCurrentFamily();
    const result = await apiCall('/api/expenses', 'POST', {
        description,
        amount,
        category,
        familyId: family.id,
        createdBy: currentUser.uniqueId,
        date: new Date().toISOString()
    });
    
    if (result.success) {
        await loadAllData();
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
document.getElementById('logoutBtnMain').addEventListener('click', async () => {
    await apiCall('/api/logout', 'POST');
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
async function init() {
    const loggedIn = await loadCurrentUser();
    if (loggedIn) {
        showScreen('main');
        switchTab('home');
        updateDashboard();
        updateProfile();
        renderTasks();
        renderShopping();
        renderExpenses();
        renderSchedules();
    } else {
        showScreen('login');
    }
    setTimeout(() => initializeAllDatePickers(), 200);
}

init();