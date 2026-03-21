from flask import Flask, send_from_directory, jsonify, request, session
from flask_cors import CORS
import json
import os
import uuid
from datetime import datetime, timedelta
import hashlib

app = Flask(__name__, static_folder='static')
app.secret_key = 'family-app-secret-key-2024-change-this'
app.permanent_session_lifetime = timedelta(days=30)  # جلسة لمدة 30 يوم
CORS(app, supports_credentials=True)

# إعدادات
STATIC_DIR = 'static'
DATA_DIR = 'data'

os.makedirs(DATA_DIR, exist_ok=True)

# مسارات الملفات
USERS_FILE = os.path.join(DATA_DIR, 'users.json')
FAMILIES_FILE = os.path.join(DATA_DIR, 'families.json')
TASKS_FILE = os.path.join(DATA_DIR, 'tasks.json')
SHOPPING_FILE = os.path.join(DATA_DIR, 'shopping.json')
EXPENSES_FILE = os.path.join(DATA_DIR, 'expenses.json')
EVENTS_FILE = os.path.join(DATA_DIR, 'events.json')
SCHEDULES_FILE = os.path.join(DATA_DIR, 'schedules.json')
REQUESTS_FILE = os.path.join(DATA_DIR, 'requests.json')
SETTINGS_FILE = os.path.join(DATA_DIR, 'settings.json')
PERMISSIONS_FILE = os.path.join(DATA_DIR, 'permissions.json')

# دوال مساعدة
def load_json(file_path, default=None):
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return default if default else []
    return default if default else []

def save_json(file_path, data):
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def init_data_files():
    if not os.path.exists(USERS_FILE): save_json(USERS_FILE, [])
    if not os.path.exists(FAMILIES_FILE): save_json(FAMILIES_FILE, [])
    if not os.path.exists(TASKS_FILE): save_json(TASKS_FILE, [])
    if not os.path.exists(SHOPPING_FILE): save_json(SHOPPING_FILE, [])
    if not os.path.exists(EXPENSES_FILE): save_json(EXPENSES_FILE, [])
    if not os.path.exists(EVENTS_FILE): save_json(EVENTS_FILE, [])
    if not os.path.exists(SCHEDULES_FILE): save_json(SCHEDULES_FILE, [])
    if not os.path.exists(REQUESTS_FILE): save_json(REQUESTS_FILE, [])
    if not os.path.exists(SETTINGS_FILE): save_json(SETTINGS_FILE, {"currency": "₽", "homeAddress": "", "monthlyBudget": 0})
    if not os.path.exists(PERMISSIONS_FILE): save_json(PERMISSIONS_FILE, {})

def generate_unique_id(name):
    random_part = str(uuid.uuid4().hex[:6]).upper()
    prefix = name[:2].upper() if name else "US"
    return f"FAM-{prefix}{random_part}"

def generate_family_code():
    return f"FAMILY-{uuid.uuid4().hex[:6].upper()}"

def is_family_head(user_id):
    """التحقق إذا كان المستخدم هو رب الأسرة"""
    users = load_json(USERS_FILE, [])
    user = next((u for u in users if u['uniqueId'] == user_id), None)
    if not user or not user.get('familyId'):
        return False
    families = load_json(FAMILIES_FILE, [])
    family = next((f for f in families if f['id'] == user['familyId']), None)
    return family and family.get('createdBy') == user_id

def get_user_permissions(user_id):
    """الحصول على صلاحيات المستخدم"""
    permissions = load_json(PERMISSIONS_FILE, {})
    return permissions.get(user_id, {
        'can_add_tasks': True,
        'can_complete_tasks': True,
        'can_add_shopping': True,
        'can_buy_shopping': True,
        'can_add_expenses': True,
        'can_view_expenses': True,
        'can_add_events': True,
        'can_edit_events': True,
        'can_add_schedule': True,
        'can_invite_members': False,
        'can_approve_requests': False,
        'can_manage_permissions': False
    })

def update_user_permissions(user_id, permissions):
    """تحديث صلاحيات المستخدم"""
    perms = load_json(PERMISSIONS_FILE, {})
    perms[user_id] = permissions
    save_json(PERMISSIONS_FILE, perms)

# الصفحة الرئيسية
@app.route('/')
def index():
    return send_from_directory(STATIC_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(STATIC_DIR, filename)

# ============= API المصادقة =============
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    users = load_json(USERS_FILE, [])
    
    existing = next((u for u in users if u.get('uniqueId') == data.get('uniqueId')), None)
    if existing:
        return jsonify({'success': False, 'message': 'ID уже существует'})
    
    new_user = {
        'uniqueId': data.get('uniqueId'),
        'fullName': data.get('fullName'),
        'role': data.get('role'),
        'birthDate': data.get('birthDate'),
        'bio': data.get('bio'),
        'email': data.get('email'),
        'phone': data.get('phone'),
        'familyId': None,
        'createdAt': datetime.now().isoformat()
    }
    
    users.append(new_user)
    save_json(USERS_FILE, users)
    
    # إنشاء عائلة للمستخدم الجديد إذا كان أول مستخدم
    families = load_json(FAMILIES_FILE, [])
    if len(users) == 1:
        new_family = {
            'id': generate_family_code(),
            'name': f"Семья {new_user['fullName']}",
            'members': [new_user['uniqueId']],
            'createdBy': new_user['uniqueId'],
            'createdAt': datetime.now().isoformat()
        }
        families.append(new_family)
        save_json(FAMILIES_FILE, families)
        new_user['familyId'] = new_family['id']
        for i, u in enumerate(users):
            if u['uniqueId'] == new_user['uniqueId']:
                users[i]['familyId'] = new_family['id']
                break
        save_json(USERS_FILE, users)
        
        # تعيين صلاحيات كاملة لرب الأسرة
        update_user_permissions(new_user['uniqueId'], {
            'can_add_tasks': True,
            'can_complete_tasks': True,
            'can_add_shopping': True,
            'can_buy_shopping': True,
            'can_add_expenses': True,
            'can_view_expenses': True,
            'can_add_events': True,
            'can_edit_events': True,
            'can_add_schedule': True,
            'can_invite_members': True,
            'can_approve_requests': True,
            'can_manage_permissions': True
        })
    
    session.permanent = True
    session['user_id'] = new_user['uniqueId']
    return jsonify({'success': True, 'user': new_user})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user_id = data.get('userId')
    users = load_json(USERS_FILE, [])
    
    user = next((u for u in users if u['uniqueId'] == user_id), None)
    if user:
        session.permanent = True
        session['user_id'] = user['uniqueId']
        return jsonify({'success': True, 'user': user})
    
    return jsonify({'success': False, 'message': 'Неверный ID'})

@app.route('/api/login/social', methods=['POST'])
def social_login():
    data = request.json
    email = data.get('email')
    name = data.get('name')
    role = data.get('role', 'Пользователь')
    
    users = load_json(USERS_FILE, [])
    user = next((u for u in users if u.get('email') == email), None)
    
    if not user:
        new_id = generate_unique_id(name)
        user = {
            'uniqueId': new_id,
            'fullName': name,
            'role': role,
            'email': email,
            'phone': '',
            'familyId': None,
            'createdAt': datetime.now().isoformat()
        }
        users.append(user)
        save_json(USERS_FILE, users)
        
        families = load_json(FAMILIES_FILE, [])
        if len(users) == 1:
            new_family = {
                'id': generate_family_code(),
                'name': f"Семья {name}",
                'members': [new_id],
                'createdBy': new_id,
                'createdAt': datetime.now().isoformat()
            }
            families.append(new_family)
            save_json(FAMILIES_FILE, families)
            user['familyId'] = new_family['id']
            for i, u in enumerate(users):
                if u['uniqueId'] == new_id:
                    users[i]['familyId'] = new_family['id']
                    break
            save_json(USERS_FILE, users)
            
            # صلاحيات كاملة لرب الأسرة
            update_user_permissions(new_id, {
                'can_add_tasks': True, 'can_complete_tasks': True,
                'can_add_shopping': True, 'can_buy_shopping': True,
                'can_add_expenses': True, 'can_view_expenses': True,
                'can_add_events': True, 'can_edit_events': True,
                'can_add_schedule': True, 'can_invite_members': True,
                'can_approve_requests': True, 'can_manage_permissions': True
            })
    
    session.permanent = True
    session['user_id'] = user['uniqueId']
    return jsonify({'success': True, 'user': user})

@app.route('/api/current_user', methods=['GET'])
def get_current_user():
    if 'user_id' in session:
        users = load_json(USERS_FILE, [])
        user = next((u for u in users if u['uniqueId'] == session['user_id']), None)
        if user:
            permissions = get_user_permissions(user['uniqueId'])
            user['permissions'] = permissions
            user['isFamilyHead'] = is_family_head(user['uniqueId'])
            return jsonify({'success': True, 'user': user})
    return jsonify({'success': False, 'message': 'Не авторизован'})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'success': True})

@app.route('/api/check_session', methods=['GET'])
def check_session():
    if 'user_id' in session:
        return jsonify({'success': True, 'userId': session['user_id']})
    return jsonify({'success': False})

# ============= API إدارة المستخدمين والصلاحيات =============
@app.route('/api/users', methods=['GET'])
def get_users():
    users = load_json(USERS_FILE, [])
    family_id = request.args.get('familyId')
    if family_id:
        users = [u for u in users if u.get('familyId') == family_id]
    # إضافة الصلاحيات لكل مستخدم
    for u in users:
        u['permissions'] = get_user_permissions(u['uniqueId'])
        u['isFamilyHead'] = is_family_head(u['uniqueId'])
    return jsonify({'success': True, 'users': users})

@app.route('/api/users/<user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.json
    users = load_json(USERS_FILE, [])
    
    # التحقق من الصلاحيات
    if not is_family_head(session.get('user_id')):
        return jsonify({'success': False, 'message': 'Только глава семьи может редактировать'})
    
    for i, user in enumerate(users):
        if user['uniqueId'] == user_id:
            users[i].update(data)
            save_json(USERS_FILE, users)
            return jsonify({'success': True, 'user': users[i]})
    
    return jsonify({'success': False, 'message': 'Пользователь не найден'})

@app.route('/api/users/<user_id>/permissions', methods=['PUT'])
def update_user_permissions_api(user_id):
    """تحديث صلاحيات المستخدم (فقط لرب الأسرة)"""
    if not is_family_head(session.get('user_id')):
        return jsonify({'success': False, 'message': 'Только глава семьи может изменять права'})
    
    data = request.json
    update_user_permissions(user_id, data)
    return jsonify({'success': True, 'permissions': data})

# ============= API العائلات =============
@app.route('/api/families', methods=['GET'])
def get_families():
    families = load_json(FAMILIES_FILE, [])
    return jsonify({'success': True, 'families': families})

@app.route('/api/families/<family_id>', methods=['GET'])
def get_family(family_id):
    families = load_json(FAMILIES_FILE, [])
    family = next((f for f in families if f['id'] == family_id), None)
    return jsonify({'success': True, 'family': family})

@app.route('/api/families', methods=['POST'])
def create_family():
    data = request.json
    if not is_family_head(session.get('user_id')):
        return jsonify({'success': False, 'message': 'Только глава семьи может создавать'})
    
    families = load_json(FAMILIES_FILE, [])
    new_family = {
        'id': generate_family_code(),
        'name': data.get('name'),
        'members': data.get('members', []),
        'createdBy': data.get('createdBy'),
        'createdAt': datetime.now().isoformat()
    }
    families.append(new_family)
    save_json(FAMILIES_FILE, families)
    return jsonify({'success': True, 'family': new_family})

@app.route('/api/families/<family_id>/members', methods=['POST'])
def add_member(family_id):
    data = request.json
    user_id = data.get('userId')
    families = load_json(FAMILIES_FILE, [])
    
    for family in families:
        if family['id'] == family_id:
            if user_id not in family['members']:
                family['members'].append(user_id)
                save_json(FAMILIES_FILE, families)
                users = load_json(USERS_FILE, [])
                for user in users:
                    if user['uniqueId'] == user_id:
                        user['familyId'] = family_id
                save_json(USERS_FILE, users)
                return jsonify({'success': True, 'family': family})
    return jsonify({'success': False, 'message': 'Семья не найдена'})

# ============= API المهام مع التحقق من الصلاحيات =============
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    tasks = load_json(TASKS_FILE, [])
    family_id = request.args.get('familyId')
    if family_id:
        tasks = [t for t in tasks if t.get('familyId') == family_id]
    return jsonify({'success': True, 'tasks': tasks})

@app.route('/api/tasks', methods=['POST'])
def add_task():
    user_perms = get_user_permissions(session.get('user_id'))
    if not user_perms.get('can_add_tasks', True):
        return jsonify({'success': False, 'message': 'У вас нет прав на добавление задач'})
    
    data = request.json
    tasks = load_json(TASKS_FILE, [])
    new_task = {
        'id': len(tasks) + 1,
        'title': data.get('title'),
        'assignee': data.get('assignee'),
        'familyId': data.get('familyId'),
        'completed': False,
        'createdAt': datetime.now().isoformat(),
        'createdBy': data.get('createdBy')
    }
    tasks.append(new_task)
    save_json(TASKS_FILE, tasks)
    return jsonify({'success': True, 'task': new_task})

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    user_perms = get_user_permissions(session.get('user_id'))
    if not user_perms.get('can_complete_tasks', True):
        return jsonify({'success': False, 'message': 'У вас нет прав на изменение задач'})
    
    data = request.json
    tasks = load_json(TASKS_FILE, [])
    for task in tasks:
        if task['id'] == task_id:
            task.update(data)
            save_json(TASKS_FILE, tasks)
            return jsonify({'success': True, 'task': task})
    return jsonify({'success': False, 'message': 'Задача не найдена'})

# ============= API المشتريات مع التحقق من الصلاحيات =============
@app.route('/api/shopping', methods=['GET'])
def get_shopping():
    shopping = load_json(SHOPPING_FILE, [])
    family_id = request.args.get('familyId')
    if family_id:
        shopping = [s for s in shopping if s.get('familyId') == family_id]
    return jsonify({'success': True, 'shopping': shopping})

@app.route('/api/shopping', methods=['POST'])
def add_shopping():
    user_perms = get_user_permissions(session.get('user_id'))
    if not user_perms.get('can_add_shopping', True):
        return jsonify({'success': False, 'message': 'У вас нет прав на добавление покупок'})
    
    data = request.json
    shopping = load_json(SHOPPING_FILE, [])
    new_item = {
        'id': len(shopping) + 1,
        'name': data.get('name'),
        'price': data.get('price', 0),
        'familyId': data.get('familyId'),
        'purchased': False,
        'createdAt': datetime.now().isoformat(),
        'createdBy': data.get('createdBy')
    }
    shopping.append(new_item)
    save_json(SHOPPING_FILE, shopping)
    return jsonify({'success': True, 'item': new_item})

@app.route('/api/shopping/<int:item_id>', methods=['PUT'])
def update_shopping(item_id):
    user_perms = get_user_permissions(session.get('user_id'))
    if not user_perms.get('can_buy_shopping', True):
        return jsonify({'success': False, 'message': 'У вас нет прав на покупку товаров'})
    
    data = request.json
    shopping = load_json(SHOPPING_FILE, [])
    for item in shopping:
        if item['id'] == item_id:
            item.update(data)
            save_json(SHOPPING_FILE, shopping)
            return jsonify({'success': True, 'item': item})
    return jsonify({'success': False, 'message': 'Товар не найден'})

# ============= API المصاريف مع التحقق من الصلاحيات =============
@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    expenses = load_json(EXPENSES_FILE, [])
    family_id = request.args.get('familyId')
    if family_id:
        expenses = [e for e in expenses if e.get('familyId') == family_id]
    return jsonify({'success': True, 'expenses': expenses})

@app.route('/api/expenses', methods=['POST'])
def add_expense():
    user_perms = get_user_permissions(session.get('user_id'))
    if not user_perms.get('can_add_expenses', True):
        return jsonify({'success': False, 'message': 'У вас нет прав на добавление расходов'})
    
    data = request.json
    expenses = load_json(EXPENSES_FILE, [])
    new_expense = {
        'id': len(expenses) + 1,
        'description': data.get('description'),
        'amount': data.get('amount'),
        'category': data.get('category'),
        'familyId': data.get('familyId'),
        'date': data.get('date') or datetime.now().isoformat(),
        'createdBy': data.get('createdBy')
    }
    expenses.append(new_expense)
    save_json(EXPENSES_FILE, expenses)
    return jsonify({'success': True, 'expense': new_expense})

@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    user_perms = get_user_permissions(session.get('user_id'))
    if not user_perms.get('can_view_expenses', True):
        return jsonify({'success': False, 'message': 'У вас нет прав на удаление расходов'})
    
    expenses = load_json(EXPENSES_FILE, [])
    expenses = [e for e in expenses if e['id'] != expense_id]
    save_json(EXPENSES_FILE, expenses)
    return jsonify({'success': True})

# ============= API الأحداث مع التذكير =============
@app.route('/api/events', methods=['GET'])
def get_events():
    events = load_json(EVENTS_FILE, [])
    family_id = request.args.get('familyId')
    if family_id:
        events = [e for e in events if e.get('familyId') == family_id]
    return jsonify({'success': True, 'events': events})

@app.route('/api/events', methods=['POST'])
def add_event():
    user_perms = get_user_permissions(session.get('user_id'))
    if not user_perms.get('can_add_events', True):
        return jsonify({'success': False, 'message': 'У вас нет прав на добавление событий'})
    
    data = request.json
    events = load_json(EVENTS_FILE, [])
    
    # إضافة التذكير
    reminder_days = data.get('reminderDays', 5)
    reminder_date = None
    if reminder_days > 0 and data.get('date'):
        event_date = datetime.fromisoformat(data.get('date'))
        reminder_date = (event_date - timedelta(days=reminder_days)).isoformat()
    
    new_event = {
        'id': len(events) + 1,
        'title': data.get('title'),
        'date': data.get('date'),
        'personId': data.get('personId'),
        'color': data.get('color', '#667eea'),
        'reminderDays': reminder_days,
        'reminderDate': reminder_date,
        'familyId': data.get('familyId'),
        'createdBy': data.get('createdBy'),
        'createdAt': datetime.now().isoformat()
    }
    
    events.append(new_event)
    save_json(EVENTS_FILE, events)
    return jsonify({'success': True, 'event': new_event})

@app.route('/api/events/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    user_perms = get_user_permissions(session.get('user_id'))
    if not user_perms.get('can_edit_events', True):
        return jsonify({'success': False, 'message': 'У вас нет прав на удаление событий'})
    
    events = load_json(EVENTS_FILE, [])
    events = [e for e in events if e['id'] != event_id]
    save_json(EVENTS_FILE, events)
    return jsonify({'success': True})

# ============= API الجداول =============
@app.route('/api/schedules', methods=['GET'])
def get_schedules():
    schedules = load_json(SCHEDULES_FILE, [])
    family_id = request.args.get('familyId')
    if family_id:
        schedules = [s for s in schedules if s.get('familyId') == family_id]
    return jsonify({'success': True, 'schedules': schedules})

@app.route('/api/schedules', methods=['POST'])
def add_schedule():
    user_perms = get_user_permissions(session.get('user_id'))
    if not user_perms.get('can_add_schedule', True):
        return jsonify({'success': False, 'message': 'У вас нет прав на добавление расписания'})
    
    data = request.json
    schedules = load_json(SCHEDULES_FILE, [])
    new_schedule = {
        'id': len(schedules) + 1,
        'memberId': data.get('memberId'),
        'title': data.get('title'),
        'day': data.get('day'),
        'time': data.get('time'),
        'location': data.get('location'),
        'familyId': data.get('familyId'),
        'createdBy': data.get('createdBy'),
        'createdAt': datetime.now().isoformat()
    }
    schedules.append(new_schedule)
    save_json(SCHEDULES_FILE, schedules)
    return jsonify({'success': True, 'schedule': new_schedule})

@app.route('/api/schedules/<int:schedule_id>', methods=['DELETE'])
def delete_schedule(schedule_id):
    schedules = load_json(SCHEDULES_FILE, [])
    schedules = [s for s in schedules if s['id'] != schedule_id]
    save_json(SCHEDULES_FILE, schedules)
    return jsonify({'success': True})

# ============= API الطلبات =============
@app.route('/api/requests', methods=['GET'])
def get_requests():
    requests = load_json(REQUESTS_FILE, [])
    family_id = request.args.get('familyId')
    if family_id:
        requests = [r for r in requests if r.get('familyId') == family_id]
    return jsonify({'success': True, 'requests': requests})

@app.route('/api/requests', methods=['POST'])
def add_request():
    data = request.json
    requests = load_json(REQUESTS_FILE, [])
    new_request = {
        'id': len(requests) + 1,
        'familyId': data.get('familyId'),
        'userId': data.get('userId'),
        'requestedRole': data.get('requestedRole'),
        'status': 'pending',
        'createdAt': datetime.now().isoformat()
    }
    requests.append(new_request)
    save_json(REQUESTS_FILE, requests)
    return jsonify({'success': True, 'request': new_request})

@app.route('/api/requests/<int:request_id>', methods=['PUT'])
def update_request(request_id):
    # التحقق من صلاحيات الموافقة
    if not is_family_head(session.get('user_id')):
        return jsonify({'success': False, 'message': 'Только глава семьи может одобрять заявки'})
    
    data = request.json
    requests = load_json(REQUESTS_FILE, [])
    
    for req in requests:
        if req['id'] == request_id:
            req.update(data)
            save_json(REQUESTS_FILE, requests)
            
            if data.get('status') == 'approved':
                families = load_json(FAMILIES_FILE, [])
                for family in families:
                    if family['id'] == req['familyId']:
                        if req['userId'] not in family['members']:
                            family['members'].append(req['userId'])
                            save_json(FAMILIES_FILE, families)
                            users = load_json(USERS_FILE, [])
                            for user in users:
                                if user['uniqueId'] == req['userId']:
                                    user['familyId'] = family['id']
                            save_json(USERS_FILE, users)
                            
                            # تعيين صلاحيات افتراضية للعضو الجديد
                            update_user_permissions(req['userId'], {
                                'can_add_tasks': True,
                                'can_complete_tasks': True,
                                'can_add_shopping': True,
                                'can_buy_shopping': True,
                                'can_add_expenses': True,
                                'can_view_expenses': True,
                                'can_add_events': True,
                                'can_edit_events': False,
                                'can_add_schedule': True,
                                'can_invite_members': False,
                                'can_approve_requests': False,
                                'can_manage_permissions': False
                            })
            return jsonify({'success': True, 'request': req})
    
    return jsonify({'success': False, 'message': 'Заявка не найдена'})

# ============= API الإعدادات =============
@app.route('/api/settings', methods=['GET'])
def get_settings():
    settings = load_json(SETTINGS_FILE, {})
    return jsonify({'success': True, 'settings': settings})

@app.route('/api/settings', methods=['POST'])
def save_settings():
    data = request.json
    save_json(SETTINGS_FILE, data)
    return jsonify({'success': True, 'settings': data})

# ============= API التحقق من الجلسة =============
@app.route('/api/check_session', methods=['GET'])
def check_session():
    if 'user_id' in session:
        return jsonify({'success': True, 'userId': session['user_id']})
    return jsonify({'success': False})

# التشغيل
if __name__ == '__main__':
    init_data_files()
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 Сервер запущен на http://localhost:{port}")
    print(f"📁 Данные сохраняются в папке {DATA_DIR}")
    app.run(host='0.0.0.0', port=port, debug=False)