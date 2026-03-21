from flask import Flask, send_from_directory, jsonify, request, session
from flask_cors import CORS
import json
import os
import uuid
from datetime import datetime
import hashlib

app = Flask(__name__, static_folder='static')
app.secret_key = 'family-app-secret-key-2024'
CORS(app)

# Директории
STATIC_DIR = 'static'
DATA_DIR = 'data'
USERS_FILE = os.path.join(DATA_DIR, 'users.json')
FAMILIES_FILE = os.path.join(DATA_DIR, 'families.json')
TASKS_FILE = os.path.join(DATA_DIR, 'tasks.json')
SHOPPING_FILE = os.path.join(DATA_DIR, 'shopping.json')
EXPENSES_FILE = os.path.join(DATA_DIR, 'expenses.json')
EVENTS_FILE = os.path.join(DATA_DIR, 'events.json')
SCHEDULES_FILE = os.path.join(DATA_DIR, 'schedules.json')
REQUESTS_FILE = os.path.join(DATA_DIR, 'requests.json')
SETTINGS_FILE = os.path.join(DATA_DIR, 'settings.json')

# Создание папок
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

# ============= ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =============

def load_json(file_path, default=None):
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return default if default else {}
    return default if default else {}

def save_json(file_path, data):
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def init_data_files():
    # Инициализация всех файлов данных
    if not os.path.exists(USERS_FILE):
        save_json(USERS_FILE, [])
    if not os.path.exists(FAMILIES_FILE):
        save_json(FAMILIES_FILE, [])
    if not os.path.exists(TASKS_FILE):
        save_json(TASKS_FILE, [])
    if not os.path.exists(SHOPPING_FILE):
        save_json(SHOPPING_FILE, [])
    if not os.path.exists(EXPENSES_FILE):
        save_json(EXPENSES_FILE, [])
    if not os.path.exists(EVENTS_FILE):
        save_json(EVENTS_FILE, [])
    if not os.path.exists(SCHEDULES_FILE):
        save_json(SCHEDULES_FILE, [])
    if not os.path.exists(REQUESTS_FILE):
        save_json(REQUESTS_FILE, [])
    if not os.path.exists(SETTINGS_FILE):
        save_json(SETTINGS_FILE, {"currency": "₽", "homeAddress": "", "monthlyBudget": 0})

def generate_unique_id(name):
    random_part = str(uuid.uuid4().hex[:6]).upper()
    prefix = name[:2].upper() if name else "US"
    return f"FAM-{prefix}{random_part}"

def generate_family_code():
    return f"FAMILY-{uuid.uuid4().hex[:6].upper()}"

# ============= СТРАНИЦЫ =============

@app.route('/')
def index():
    return send_from_directory(STATIC_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(STATIC_DIR, filename)

# ============= API АВТОРИЗАЦИИ =============

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    users = load_json(USERS_FILE, [])
    
    # Проверка существующего пользователя
    existing = next((u for u in users if u['uniqueId'] == data.get('uniqueId')), None)
    if existing:
        return jsonify({'success': False, 'message': 'ID уже существует'})
    
    # Создание нового пользователя
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
    
    # Создание семьи для первого пользователя
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
        # Обновление пользователя
        for i, u in enumerate(users):
            if u['uniqueId'] == new_user['uniqueId']:
                users[i]['familyId'] = new_family['id']
                break
        save_json(USERS_FILE, users)
    
    session['user_id'] = new_user['uniqueId']
    return jsonify({'success': True, 'user': new_user})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user_id = data.get('userId')
    users = load_json(USERS_FILE, [])
    
    user = next((u for u in users if u['uniqueId'] == user_id), None)
    if user:
        session['user_id'] = user['uniqueId']
        return jsonify({'success': True, 'user': user})
    
    return jsonify({'success': False, 'message': 'Неверный ID'})

@app.route('/api/login/social', methods=['POST'])
def social_login():
    data = request.json
    provider = data.get('provider')
    email = data.get('email')
    name = data.get('name')
    role = data.get('role', 'Пользователь')
    
    users = load_json(USERS_FILE, [])
    
    # Проверка существующего пользователя
    user = next((u for u in users if u.get('email') == email), None)
    
    if not user:
        # Создание нового пользователя
        new_id = generate_unique_id(name)
        new_user = {
            'uniqueId': new_id,
            'fullName': name,
            'role': role,
            'birthDate': '',
            'bio': '',
            'email': email,
            'phone': '',
            'familyId': None,
            'socialProvider': provider,
            'createdAt': datetime.now().isoformat()
        }
        users.append(new_user)
        save_json(USERS_FILE, users)
        
        # Создание семьи
        families = load_json(FAMILIES_FILE, [])
        new_family = {
            'id': generate_family_code(),
            'name': f"Семья {name}",
            'members': [new_id],
            'createdBy': new_id,
            'createdAt': datetime.now().isoformat()
        }
        families.append(new_family)
        save_json(FAMILIES_FILE, families)
        new_user['familyId'] = new_family['id']
        
        for i, u in enumerate(users):
            if u['uniqueId'] == new_id:
                users[i]['familyId'] = new_family['id']
                break
        save_json(USERS_FILE, users)
        user = new_user
    
    session['user_id'] = user['uniqueId']
    return jsonify({'success': True, 'user': user})

@app.route('/api/current_user', methods=['GET'])
def get_current_user():
    if 'user_id' in session:
        users = load_json(USERS_FILE, [])
        user = next((u for u in users if u['uniqueId'] == session['user_id']), None)
        if user:
            return jsonify({'success': True, 'user': user})
    return jsonify({'success': False, 'message': 'Не авторизован'})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'success': True})

# ============= API ПОЛЬЗОВАТЕЛЕЙ =============

@app.route('/api/users', methods=['GET'])
def get_users():
    users = load_json(USERS_FILE, [])
    return jsonify({'success': True, 'users': users})

@app.route('/api/users/<user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.json
    users = load_json(USERS_FILE, [])
    
    for i, user in enumerate(users):
        if user['uniqueId'] == user_id:
            users[i].update(data)
            save_json(USERS_FILE, users)
            return jsonify({'success': True, 'user': users[i]})
    
    return jsonify({'success': False, 'message': 'Пользователь не найден'})

# ============= API СЕМЕЙ =============

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
    
    # Обновление пользователя
    users = load_json(USERS_FILE, [])
    for user in users:
        if user['uniqueId'] in new_family['members']:
            user['familyId'] = new_family['id']
    save_json(USERS_FILE, users)
    
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
                
                # Обновление пользователя
                users = load_json(USERS_FILE, [])
                for user in users:
                    if user['uniqueId'] == user_id:
                        user['familyId'] = family_id
                save_json(USERS_FILE, users)
                
                return jsonify({'success': True, 'family': family})
            else:
                return jsonify({'success': False, 'message': 'Уже в семье'})
    
    return jsonify({'success': False, 'message': 'Семья не найдена'})

# ============= API ЗАДАЧ =============

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    tasks = load_json(TASKS_FILE, [])
    family_id = request.args.get('familyId')
    
    if family_id:
        tasks = [t for t in tasks if t.get('familyId') == family_id]
    
    return jsonify({'success': True, 'tasks': tasks})

@app.route('/api/tasks', methods=['POST'])
def create_task():
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
    data = request.json
    tasks = load_json(TASKS_FILE, [])
    
    for task in tasks:
        if task['id'] == task_id:
            task.update(data)
            save_json(TASKS_FILE, tasks)
            return jsonify({'success': True, 'task': task})
    
    return jsonify({'success': False, 'message': 'Задача не найдена'})

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    tasks = load_json(TASKS_FILE, [])
    tasks = [t for t in tasks if t['id'] != task_id]
    save_json(TASKS_FILE, tasks)
    return jsonify({'success': True})

# ============= API ПОКУПОК =============

@app.route('/api/shopping', methods=['GET'])
def get_shopping():
    shopping = load_json(SHOPPING_FILE, [])
    family_id = request.args.get('familyId')
    
    if family_id:
        shopping = [s for s in shopping if s.get('familyId') == family_id]
    
    return jsonify({'success': True, 'shopping': shopping})

@app.route('/api/shopping', methods=['POST'])
def create_shopping():
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
    data = request.json
    shopping = load_json(SHOPPING_FILE, [])
    
    for item in shopping:
        if item['id'] == item_id:
            item.update(data)
            save_json(SHOPPING_FILE, shopping)
            return jsonify({'success': True, 'item': item})
    
    return jsonify({'success': False, 'message': 'Товар не найден'})

# ============= API РАСХОДОВ =============

@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    expenses = load_json(EXPENSES_FILE, [])
    family_id = request.args.get('familyId')
    
    if family_id:
        expenses = [e for e in expenses if e.get('familyId') == family_id]
    
    return jsonify({'success': True, 'expenses': expenses})

@app.route('/api/expenses', methods=['POST'])
def create_expense():
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
    expenses = load_json(EXPENSES_FILE, [])
    expenses = [e for e in expenses if e['id'] != expense_id]
    save_json(EXPENSES_FILE, expenses)
    return jsonify({'success': True})

# ============= API СОБЫТИЙ =============

@app.route('/api/events', methods=['GET'])
def get_events():
    events = load_json(EVENTS_FILE, [])
    family_id = request.args.get('familyId')
    
    if family_id:
        events = [e for e in events if e.get('familyId') == family_id]
    
    return jsonify({'success': True, 'events': events})

@app.route('/api/events', methods=['POST'])
def create_event():
    data = request.json
    events = load_json(EVENTS_FILE, [])
    
    new_event = {
        'id': len(events) + 1,
        'title': data.get('title'),
        'date': data.get('date'),
        'personId': data.get('personId'),
        'color': data.get('color', '#667eea'),
        'familyId': data.get('familyId'),
        'createdBy': data.get('createdBy'),
        'createdAt': datetime.now().isoformat()
    }
    
    events.append(new_event)
    save_json(EVENTS_FILE, events)
    
    return jsonify({'success': True, 'event': new_event})

@app.route('/api/events/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    events = load_json(EVENTS_FILE, [])
    events = [e for e in events if e['id'] != event_id]
    save_json(EVENTS_FILE, events)
    return jsonify({'success': True})

# ============= API РАСПИСАНИЯ =============

@app.route('/api/schedules', methods=['GET'])
def get_schedules():
    schedules = load_json(SCHEDULES_FILE, [])
    family_id = request.args.get('familyId')
    
    if family_id:
        schedules = [s for s in schedules if s.get('familyId') == family_id]
    
    return jsonify({'success': True, 'schedules': schedules})

@app.route('/api/schedules', methods=['POST'])
def create_schedule():
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

# ============= API ЗАЯВОК =============

@app.route('/api/requests', methods=['GET'])
def get_requests():
    requests = load_json(REQUESTS_FILE, [])
    family_id = request.args.get('familyId')
    
    if family_id:
        requests = [r for r in requests if r.get('familyId') == family_id]
    
    return jsonify({'success': True, 'requests': requests})

@app.route('/api/requests', methods=['POST'])
def create_request():
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
    data = request.json
    requests = load_json(REQUESTS_FILE, [])
    
    for req in requests:
        if req['id'] == request_id:
            req.update(data)
            save_json(REQUESTS_FILE, requests)
            
            # Если заявка одобрена, добавляем пользователя в семью
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
            
            return jsonify({'success': True, 'request': req})
    
    return jsonify({'success': False, 'message': 'Заявка не найдена'})

# ============= API НАСТРОЕК =============

@app.route('/api/settings', methods=['GET'])
def get_settings():
    settings = load_json(SETTINGS_FILE, {})
    return jsonify({'success': True, 'settings': settings})

@app.route('/api/settings', methods=['POST'])
def update_settings():
    data = request.json
    save_json(SETTINGS_FILE, data)
    return jsonify({'success': True, 'settings': data})

# ============= ЗАПУСК =============

if __name__ == '__main__':
    init_data_files()
    print("🚀 Сервер запущен на http://localhost:5000")
    print("📁 Данные сохраняются в папке data/")
    app.run(debug=True, host='0.0.0.0', port=5000)