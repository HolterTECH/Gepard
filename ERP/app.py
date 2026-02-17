import logging
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import sqlite3
import hashlib
import os
from functools import wraps
from datetime import datetime

# Настройка логирования
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.urandom(24)

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Декоратор для проверки авторизации
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Инициализация базы данных
def init_db():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    # Таблица пользователей
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT UNIQUE NOT NULL,
                  email TEXT UNIQUE NOT NULL,
                  password TEXT NOT NULL)''')
    
    # Таблица проектов
    c.execute('''CREATE TABLE IF NOT EXISTS projects
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER NOT NULL,
                  name TEXT NOT NULL,
                  description TEXT,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  status TEXT DEFAULT 'active',
                  FOREIGN KEY (user_id) REFERENCES users (id))''')
    
    # Таблица задач проекта
    c.execute('''CREATE TABLE IF NOT EXISTS tasks
                (id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                parent_id INTEGER,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'planned',
                priority TEXT DEFAULT 'medium',
                assignee_id INTEGER,
                planned_start_date DATE,
                actual_start_date DATE,
                due_date DATE,
                actual_end_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects (id),
                FOREIGN KEY (parent_id) REFERENCES tasks (id),
                FOREIGN KEY (assignee_id) REFERENCES users (id))''')
    
    # Таблица связей между задачами (для графа)
    c.execute('''CREATE TABLE IF NOT EXISTS task_links
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  source_task_id INTEGER NOT NULL,
                  target_task_id INTEGER NOT NULL,
                  link_type TEXT DEFAULT 'depends_on',
                  FOREIGN KEY (source_task_id) REFERENCES tasks (id),
                  FOREIGN KEY (target_task_id) REFERENCES tasks (id))''')
    
    # Таблица совещаний
    c.execute('''CREATE TABLE IF NOT EXISTS meetings
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  project_id INTEGER NOT NULL,
                  title TEXT NOT NULL,
                  description TEXT,
                  meeting_date DATETIME NOT NULL,
                  duration INTEGER,
                  location TEXT,
                  created_by INTEGER,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (project_id) REFERENCES projects (id),
                  FOREIGN KEY (created_by) REFERENCES users (id))''')
    
    # Таблица предложений
    c.execute('''CREATE TABLE IF NOT EXISTS proposals
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  project_id INTEGER NOT NULL,
                  user_id INTEGER NOT NULL,
                  title TEXT NOT NULL,
                  description TEXT,
                  status TEXT DEFAULT 'new',
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (project_id) REFERENCES projects (id),
                  FOREIGN KEY (user_id) REFERENCES users (id))''')
    
    # Таблица должностей (для автодополнения)
    c.execute('''CREATE TABLE IF NOT EXISTS roles
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT UNIQUE NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    # Добавляем начальные должности
    initial_roles = [
        ('Project Manager',),
        ('Lead Developer',),
        ('Frontend Developer',),
        ('Backend Developer',),
        ('UI/UX Designer',),
        ('QA Engineer',),
        ('DevOps Engineer',),
        ('Business Analyst',),
        ('Product Owner',),
        ('Technical Writer',)
    ]
    c.executemany("INSERT OR IGNORE INTO roles (name) VALUES (?)", initial_roles)
    
    # Таблица команды проекта
    c.execute('''CREATE TABLE IF NOT EXISTS project_team
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  project_id INTEGER NOT NULL,
                  user_id INTEGER,
                  name TEXT NOT NULL,
                  role TEXT DEFAULT 'member',
                  email TEXT,
                  phone TEXT,
                  status TEXT DEFAULT 'active',
                  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (project_id) REFERENCES projects (id),
                  FOREIGN KEY (user_id) REFERENCES users (id))''')
    
    # Таблица реестра вопросов
    c.execute('''CREATE TABLE IF NOT EXISTS question_registry
                (id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                topic TEXT NOT NULL,
                description TEXT,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'pending',  -- pending, scheduled, resolved, unresolved
                created_by INTEGER,
                resolution TEXT,
                meeting_id INTEGER,
                FOREIGN KEY (project_id) REFERENCES projects (id),
                FOREIGN KEY (created_by) REFERENCES users (id),
                FOREIGN KEY (meeting_id) REFERENCES meetings (id))''')

    # Таблица участников совещания
    c.execute('''CREATE TABLE IF NOT EXISTS meeting_participants
                (id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id INTEGER NOT NULL,
                team_member_id INTEGER NOT NULL,
                attended BOOLEAN DEFAULT 0,
                FOREIGN KEY (meeting_id) REFERENCES meetings (id),
                FOREIGN KEY (team_member_id) REFERENCES project_team (id))''')

    # Таблица вопросов совещания
    c.execute('''CREATE TABLE IF NOT EXISTS meeting_questions
                (id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                discussed BOOLEAN DEFAULT 0,
                resolution_notes TEXT,
                FOREIGN KEY (meeting_id) REFERENCES meetings (id),
                FOREIGN KEY (question_id) REFERENCES question_registry (id))''')

    conn.commit()
    conn.close()

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('main'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username')
        password = hashlib.sha256(data.get('password').encode()).hexdigest()
        
        conn = sqlite3.connect('users.db')
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE username=? AND password=?", (username, password))
        user = c.fetchone()
        conn.close()
        
        if user:
            session['user_id'] = user[0]
            session['username'] = user[1]
            return jsonify({'success': True, 'redirect': url_for('main')})
        else:
            return jsonify({'success': False, 'message': 'Неверное имя пользователя или пароль'})
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = hashlib.sha256(data.get('password').encode()).hexdigest()
        
        conn = sqlite3.connect('users.db')
        c = conn.cursor()
        try:
            c.execute("INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
                     (username, email, password))
            conn.commit()
            conn.close()
            return jsonify({'success': True, 'redirect': url_for('login')})
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({'success': False, 'message': 'Пользователь с таким именем или email уже существует'})
    
    return render_template('register.html')

@app.route('/main')
@login_required
def main():
    return render_template('main.html', username=session.get('username'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/profile')
@login_required
def profile():
    return render_template('profile.html', username=session.get('username'))

# Маршруты для проектов
@app.route('/projects')
@login_required
def projects():
    return render_template('projects.html', username=session.get('username'))

# API для получения проектов пользователя
@app.route('/api/projects', methods=['GET'])
@login_required
def get_projects():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT id, name, description, created_at, status FROM projects WHERE user_id=? ORDER BY created_at DESC", 
              (session['user_id'],))
    projects = c.fetchall()
    conn.close()
    
    projects_list = []
    for project in projects:
        projects_list.append({
            'id': project[0],
            'name': project[1],
            'description': project[2],
            'created_at': project[3],
            'status': project[4]
        })
    
    return jsonify(projects_list)

# API для создания нового проекта
@app.route('/api/projects', methods=['POST'])
@login_required
def create_project():
    data = request.get_json()
    name = data.get('name')
    description = data.get('description', '')
    
    if not name:
        return jsonify({'success': False, 'message': 'Название проекта обязательно'}), 400
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    # Создаем проект
    c.execute("INSERT INTO projects (user_id, name, description) VALUES (?, ?, ?)",
              (session['user_id'], name, description))
    project_id = c.lastrowid
    
    # Получаем данные пользователя
    c.execute("SELECT username, email FROM users WHERE id=?", (session['user_id'],))
    user = c.fetchone()
    
    # Добавляем создателя в команду проекта
    from datetime import datetime
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    c.execute('''INSERT INTO project_team 
                 (project_id, user_id, name, role, email, status, joined_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)''',
              (project_id, session['user_id'], user[0], 'Project Manager', user[1], 'active', now))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True, 
        'message': 'Проект создан',
        'project': {
            'id': project_id,
            'name': name,
            'description': description,
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'status': 'active'
        }
    })

# API для удаления проекта
@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
@login_required
def delete_project(project_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("DELETE FROM projects WHERE id=? AND user_id=?", (project_id, session['user_id']))
    deleted = c.rowcount > 0
    conn.commit()
    conn.close()
    
    if deleted:
        return jsonify({'success': True, 'message': 'Проект удален'})
    else:
        return jsonify({'success': False, 'message': 'Проект не найден'}), 404

# API для обновления проекта
@app.route('/api/projects/<int:project_id>', methods=['PUT'])
@login_required
def update_project(project_id):
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')
    status = data.get('status')
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    update_fields = []
    params = []
    if name:
        update_fields.append("name=?")
        params.append(name)
    if description is not None:
        update_fields.append("description=?")
        params.append(description)
    if status:
        update_fields.append("status=?")
        params.append(status)
    
    if update_fields:
        query = f"UPDATE projects SET {', '.join(update_fields)} WHERE id=? AND user_id=?"
        params.extend([project_id, session['user_id']])
        c.execute(query, params)
        updated = c.rowcount > 0
        conn.commit()
    else:
        updated = False
    
    conn.close()
    
    if updated:
        return jsonify({'success': True, 'message': 'Проект обновлен'})
    else:
        return jsonify({'success': False, 'message': 'Проект не найден'}), 404

# Маршруты для страниц проекта
@app.route('/project/<int:project_id>')
@login_required
def project_redirect(project_id):
    return redirect(url_for('project_section', project_id=project_id, section='home'))

@app.route('/project/<int:project_id>/<section>')
@login_required
def project_section(project_id, section):
    # Проверяем, что проект принадлежит пользователю
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT * FROM projects WHERE id=? AND user_id=?", (project_id, session['user_id']))
    project = c.fetchone()
    conn.close()
    
    if not project:
        return redirect(url_for('projects'))
    
    # Определяем, какой шаблон загружать
    templates = {
        'home': 'project/home.html',
        'tasks': 'project/tasks.html',
        'calendar': 'project/calendar.html',
        'meetings': 'project/meetings.html',
        'proposals': 'project/proposals.html',
        'team': 'project/team.html',
        'knowledge': 'project/knowledge.html'
    }
    
    template = templates.get(section, 'project/home.html')
    
    return render_template(template, 
                         username=session.get('username'),
                         project_id=project_id,
                         active_section=section)

# API для получения данных проекта
@app.route('/api/project/<int:project_id>', methods=['GET'])
@login_required
def get_project_data(project_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    c.execute("SELECT id, name, description, created_at, status FROM projects WHERE id=? AND user_id=?", 
              (project_id, session['user_id']))
    project = c.fetchone()
    
    if not project:
        conn.close()
        return jsonify({'error': 'Project not found'}), 404
    
    project_data = {
        'id': project[0],
        'name': project[1],
        'description': project[2],
        'created_at': project[3],
        'status': project[4]
    }
    
    conn.close()
    return jsonify(project_data)

# API для задач проекта
@app.route('/api/project/<int:project_id>/tasks', methods=['GET'])
@login_required
def get_project_tasks(project_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    c.execute('''SELECT t.id, t.title, t.description, t.status, t.priority, 
                        t.due_date, t.created_at, u.username as assignee
                 FROM tasks t
                 LEFT JOIN users u ON t.assignee_id = u.id
                 WHERE t.project_id=?
                 ORDER BY t.created_at DESC''', (project_id,))
    tasks = c.fetchall()
    
    tasks_list = []
    for task in tasks:
        tasks_list.append({
            'id': task[0],
            'title': task[1],
            'description': task[2],
            'status': task[3],
            'priority': task[4],
            'due_date': task[5],
            'created_at': task[6],
            'assignee': task[7]
        })
    
    conn.close()
    return jsonify(tasks_list)

# API для создания задачи
@app.route('/api/project/<int:project_id>/tasks', methods=['POST'])
@login_required
def create_task(project_id):
    data = request.get_json()
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    c.execute('''INSERT INTO tasks (project_id, title, description, status, priority, due_date)
                 VALUES (?, ?, ?, ?, ?, ?)''',
              (project_id, data.get('title'), data.get('description'), 
               data.get('status', 'todo'), data.get('priority', 'medium'),
               data.get('due_date')))
    
    task_id = c.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'task_id': task_id})

# API для обновления задачи
@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
@login_required
def update_task(task_id):
    data = request.get_json()
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    update_fields = []
    params = []
    
    if 'title' in data:
        update_fields.append("title=?")
        params.append(data['title'])
    if 'description' in data:
        update_fields.append("description=?")
        params.append(data['description'])
    if 'status' in data:
        update_fields.append("status=?")
        params.append(data['status'])
    if 'priority' in data:
        update_fields.append("priority=?")
        params.append(data['priority'])
    if 'due_date' in data:
        update_fields.append("due_date=?")
        params.append(data['due_date'])
    
    if update_fields:
        query = f"UPDATE tasks SET {', '.join(update_fields)} WHERE id=?"
        params.append(task_id)
        c.execute(query, params)
        conn.commit()
    
    conn.close()
    return jsonify({'success': True})

# API для удаления задачи
@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@login_required
def delete_task(task_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("DELETE FROM tasks WHERE id=?", (task_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# API для команды проекта
@app.route('/api/project/<int:project_id>/team', methods=['GET'])
@login_required
def get_project_team(project_id):
    logger.debug(f"Getting team for project: {project_id}")
    try:
        conn = sqlite3.connect('users.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Получаем информацию о проекте
        c.execute("SELECT user_id FROM projects WHERE id=?", (project_id,))
        project = c.fetchone()
        
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        creator_id = project['user_id']
        
        # Проверяем, есть ли создатель в команде
        c.execute("SELECT id FROM project_team WHERE project_id=? AND user_id=?", 
                 (project_id, creator_id))
        creator_in_team = c.fetchone()
        
        # Если создателя нет в команде, добавляем его
        if not creator_in_team and creator_id == session['user_id']:
            logger.info(f"Adding creator (user_id: {creator_id}) to project team")
            
            # Получаем данные пользователя
            c.execute("SELECT username, email FROM users WHERE id=?", (creator_id,))
            user = c.fetchone()
            
            if user:
                from datetime import datetime
                now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                
                c.execute('''INSERT INTO project_team 
                           (project_id, user_id, name, role, email, status, joined_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?)''',
                        (project_id, creator_id, user['username'], 'Project Manager', 
                         user['email'], 'active', now))
                conn.commit()
                logger.info("Creator added to team")
        
        # Получаем всех участников команды
        c.execute('''SELECT id, name, role, email, phone, status, joined_at,
                           CASE WHEN user_id = ? THEN 1 ELSE 0 END as is_creator
                     FROM project_team 
                     WHERE project_id=? 
                     ORDER BY 
                         is_creator DESC,
                         CASE 
                             WHEN role = 'Project Manager' THEN 1
                             WHEN role LIKE '%Lead%' THEN 2
                             ELSE 3
                         END, name''', (session['user_id'], project_id))
        
        team = c.fetchall()
        logger.debug(f"Found {len(team)} members for project {project_id}")
        
        team_list = []
        for member in team:
            member_dict = {
                'id': member[0],
                'name': member[1],
                'role': member[2],
                'email': member[3],
                'phone': member[4],
                'status': member[5],
                'joined_at': member[6],
                'is_creator': bool(member[7])  # Добавляем флаг, что это создатель
            }
            team_list.append(member_dict)
        
        conn.close()
        return jsonify(team_list)
        
    except Exception as e:
        logger.error(f"Error in get_project_team: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# API для получения всех должностей (для автодополнения)
@app.route('/api/roles', methods=['GET'])
@login_required
def get_roles():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT name FROM roles ORDER BY name")
    roles = [row[0] for row in c.fetchall()]
    conn.close()
    return jsonify(roles)

# API для добавления участника команды
@app.route('/api/project/<int:project_id>/team', methods=['POST'])
@login_required
def add_team_member(project_id):
    logger.debug(f"Adding team member to project: {project_id}")
    try:
        data = request.get_json()
        logger.debug(f"Received data: {data}")
        
        name = data.get('name')
        role = data.get('role')
        email = data.get('email')
        phone = data.get('phone')
        
        if not name or not role:
            return jsonify({'success': False, 'message': 'Имя и должность обязательны'}), 400
        
        conn = sqlite3.connect('users.db')
        c = conn.cursor()
        
        # Проверяем структуру таблицы и создаем если нужно
        c.execute("PRAGMA table_info(project_team)")
        columns = c.fetchall()
        column_names = [col[1] for col in columns]
        
        if 'name' not in column_names:
            # Таблица с неправильной структурой, пересоздаем
            logger.warning("Table has wrong structure, recreating...")
            c.execute("DROP TABLE IF EXISTS project_team")
            c.execute('''CREATE TABLE project_team
                        (id INTEGER PRIMARY KEY AUTOINCREMENT,
                         project_id INTEGER NOT NULL,
                         user_id INTEGER,
                         name TEXT NOT NULL,
                         role TEXT NOT NULL,
                         email TEXT,
                         phone TEXT,
                         status TEXT DEFAULT 'active',
                         joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                         FOREIGN KEY (project_id) REFERENCES projects (id),
                         FOREIGN KEY (user_id) REFERENCES users (id))''')
            conn.commit()
        
        # Добавляем новую должность в справочник, если её там нет
        try:
            c.execute("INSERT OR IGNORE INTO roles (name) VALUES (?)", (role,))
        except:
            # Если таблицы roles нет, создаем её
            c.execute('''CREATE TABLE IF NOT EXISTS roles
                        (id INTEGER PRIMARY KEY AUTOINCREMENT,
                         name TEXT UNIQUE NOT NULL,
                         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
            c.execute("INSERT OR IGNORE INTO roles (name) VALUES (?)", (role,))
        
        # Добавляем участника
        from datetime import datetime
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        c.execute('''INSERT INTO project_team 
                     (project_id, user_id, name, role, email, phone, status, joined_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                  (project_id, None, name, role, email, phone, 'active', now))
        
        member_id = c.lastrowid
        logger.debug(f"Member added with ID: {member_id}")
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True, 
            'message': 'Участник добавлен',
            'member_id': member_id
        })
        
    except Exception as e:
        logger.error(f"Error in add_team_member: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# API для обновления участника команды
@app.route('/api/team/<int:member_id>', methods=['PUT'])
@login_required
def update_team_member(member_id):
    data = request.get_json()
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    update_fields = []
    params = []
    
    if 'name' in data:
        update_fields.append("name=?")
        params.append(data['name'])
    if 'role' in data:
        update_fields.append("role=?")
        params.append(data['role'])
        # Добавляем должность в справочник
        c.execute("INSERT OR IGNORE INTO roles (name) VALUES (?)", (data['role'],))
    if 'email' in data:
        update_fields.append("email=?")
        params.append(data['email'])
    if 'phone' in data:
        update_fields.append("phone=?")
        params.append(data['phone'])
    if 'status' in data:
        update_fields.append("status=?")
        params.append(data['status'])
    
    if update_fields:
        query = f"UPDATE project_team SET {', '.join(update_fields)} WHERE id=?"
        params.append(member_id)
        c.execute(query, params)
        conn.commit()
        updated = c.rowcount > 0
    else:
        updated = False
    
    conn.close()
    
    if updated:
        return jsonify({'success': True, 'message': 'Участник обновлен'})
    else:
        return jsonify({'success': False, 'message': 'Участник не найден'}), 404

# API для удаления участника команды
@app.route('/api/team/<int:member_id>', methods=['DELETE'])
@login_required
def delete_team_member(member_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("DELETE FROM project_team WHERE id=?", (member_id,))
    deleted = c.rowcount > 0
    conn.commit()
    conn.close()
    
    if deleted:
        return jsonify({'success': True, 'message': 'Участник удален'})
    else:
        return jsonify({'success': False, 'message': 'Участник не найден'}), 404

# API для связей между задачами
@app.route('/api/task-links', methods=['POST'])
@login_required
def create_task_link():
    data = request.get_json()
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    c.execute('''INSERT INTO task_links (source_task_id, target_task_id, link_type)
                 VALUES (?, ?, ?)''',
              (data.get('source_task_id'), data.get('target_task_id'), data.get('link_type', 'depends_on')))
    
    link_id = c.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'link_id': link_id})

@app.route('/api/project/<int:project_id>/task-links', methods=['GET'])
@login_required
def get_task_links(project_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    c.execute('''SELECT tl.id, tl.source_task_id, tl.target_task_id, tl.link_type
                 FROM task_links tl
                 JOIN tasks t ON tl.source_task_id = t.id
                 WHERE t.project_id = ?''', (project_id,))
    
    links = c.fetchall()
    conn.close()
    
    links_list = []
    for link in links:
        links_list.append({
            'id': link[0],
            'source_task_id': link[1],
            'target_task_id': link[2],
            'link_type': link[3]
        })
    
    return jsonify(links_list)

# API для реестра вопросов
@app.route('/api/project/<int:project_id>/questions', methods=['GET'])
@login_required
def get_questions(project_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    c.execute('''SELECT q.*, u.username as creator_name, 
                        m.title as meeting_title
                 FROM question_registry q
                 LEFT JOIN users u ON q.created_by = u.id
                 LEFT JOIN meetings m ON q.meeting_id = m.id
                 WHERE q.project_id=?
                 ORDER BY q.created_date DESC''', (project_id,))
    
    questions = c.fetchall()
    # Получаем названия колонок
    columns = [description[0] for description in c.description]
    
    questions_list = []
    for question in questions:
        question_dict = dict(zip(columns, question))
        questions_list.append(question_dict)
    
    conn.close()
    return jsonify(questions_list)

@app.route('/api/project/<int:project_id>/questions', methods=['POST'])
@login_required
def create_question(project_id):
    data = request.get_json()
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    c.execute('''INSERT INTO question_registry 
                 (project_id, topic, description, status, created_by, meeting_id)
                 VALUES (?, ?, ?, ?, ?, ?)''',
              (project_id, data.get('topic'), data.get('description'),
               data.get('status', 'pending'), session['user_id'],
               data.get('meeting_id')))
    
    question_id = c.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'question_id': question_id})

@app.route('/api/questions/<int:question_id>', methods=['PUT'])
@login_required
def update_question(question_id):
    data = request.get_json()
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    update_fields = []
    params = []
    
    if 'topic' in data:
        update_fields.append("topic=?")
        params.append(data['topic'])
    if 'description' in data:
        update_fields.append("description=?")
        params.append(data['description'])
    if 'status' in data:
        update_fields.append("status=?")
        params.append(data['status'])
    if 'resolution' in data:
        update_fields.append("resolution=?")
        params.append(data['resolution'])
    if 'meeting_id' in data:
        update_fields.append("meeting_id=?")
        params.append(data['meeting_id'])
    
    if update_fields:
        query = f"UPDATE question_registry SET {', '.join(update_fields)} WHERE id=?"
        params.append(question_id)
        c.execute(query, params)
        conn.commit()
    
    conn.close()
    return jsonify({'success': True})

@app.route('/api/questions/<int:question_id>', methods=['DELETE'])
@login_required
def delete_question(question_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("DELETE FROM question_registry WHERE id=?", (question_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# API для совещаний
@app.route('/api/project/<int:project_id>/meetings', methods=['GET'])
@login_required
def get_meetings(project_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    c.execute('''SELECT m.*, u.username as creator_name,
                        COUNT(DISTINCT mp.id) as participants_count,
                        COUNT(DISTINCT mq.id) as questions_count
                 FROM meetings m
                 LEFT JOIN users u ON m.created_by = u.id
                 LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
                 LEFT JOIN meeting_questions mq ON m.id = mq.meeting_id
                 WHERE m.project_id=?
                 GROUP BY m.id
                 ORDER BY m.meeting_date DESC''', (project_id,))
    
    meetings = c.fetchall()
    columns = [description[0] for description in c.description]
    
    meetings_list = []
    for meeting in meetings:
        meeting_dict = dict(zip(columns, meeting))
        meetings_list.append(meeting_dict)
    
    conn.close()
    return jsonify(meetings_list)

@app.route('/api/project/<int:project_id>/meetings', methods=['POST'])
@login_required
def create_meeting(project_id):
    data = request.get_json()
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    c.execute('''INSERT INTO meetings 
                 (project_id, title, description, meeting_date, duration, location, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)''',
              (project_id, data.get('title'), data.get('description'),
               data.get('meeting_date'), data.get('duration'),
               data.get('location'), session['user_id']))
    
    meeting_id = c.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'meeting_id': meeting_id})

@app.route('/api/meetings/<int:meeting_id>', methods=['PUT'])
@login_required
def update_meeting(meeting_id):
    data = request.get_json()
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    update_fields = []
    params = []
    
    if 'title' in data:
        update_fields.append("title=?")
        params.append(data['title'])
    if 'description' in data:
        update_fields.append("description=?")
        params.append(data['description'])
    if 'meeting_date' in data:
        update_fields.append("meeting_date=?")
        params.append(data['meeting_date'])
    if 'duration' in data:
        update_fields.append("duration=?")
        params.append(data['duration'])
    if 'location' in data:
        update_fields.append("location=?")
        params.append(data['location'])
    
    if update_fields:
        query = f"UPDATE meetings SET {', '.join(update_fields)} WHERE id=?"
        params.append(meeting_id)
        c.execute(query, params)
        conn.commit()
    
    conn.close()
    return jsonify({'success': True})

@app.route('/api/meetings/<int:meeting_id>', methods=['DELETE'])
@login_required
def delete_meeting(meeting_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("DELETE FROM meetings WHERE id=?", (meeting_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# API для участников совещания
@app.route('/api/meetings/<int:meeting_id>/participants', methods=['GET'])
@login_required
def get_meeting_participants(meeting_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    c.execute('''SELECT mp.*, pt.name, pt.role, pt.email
                 FROM meeting_participants mp
                 JOIN project_team pt ON mp.team_member_id = pt.id
                 WHERE mp.meeting_id=?
                 ORDER BY pt.name''', (meeting_id,))
    
    participants = c.fetchall()
    columns = [description[0] for description in c.description]
    
    participants_list = []
    for participant in participants:
        participant_dict = dict(zip(columns, participant))
        participants_list.append(participant_dict)
    
    conn.close()
    return jsonify(participants_list)

@app.route('/api/meetings/<int:meeting_id>/participants', methods=['POST'])
@login_required
def add_meeting_participant(meeting_id):
    data = request.get_json()
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    c.execute('''INSERT INTO meeting_participants (meeting_id, team_member_id, attended)
                 VALUES (?, ?, ?)''',
              (meeting_id, data.get('team_member_id'), data.get('attended', 0)))
    
    participant_id = c.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'participant_id': participant_id})

@app.route('/api/meeting-participants/<int:participant_id>', methods=['PUT'])
@login_required
def update_meeting_participant(participant_id):
    data = request.get_json()
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    if 'attended' in data:
        c.execute("UPDATE meeting_participants SET attended=? WHERE id=?",
                 (data['attended'], participant_id))
        conn.commit()
    
    conn.close()
    return jsonify({'success': True})

@app.route('/api/meeting-participants/<int:participant_id>', methods=['DELETE'])
@login_required
def delete_meeting_participant(participant_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("DELETE FROM meeting_participants WHERE id=?", (participant_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# API для вопросов совещания
@app.route('/api/meetings/<int:meeting_id>/questions', methods=['GET'])
@login_required
def get_meeting_questions(meeting_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    c.execute('''SELECT mq.*, qr.topic, qr.description, qr.status,
                        u.username as created_by_name
                 FROM meeting_questions mq
                 JOIN question_registry qr ON mq.question_id = qr.id
                 LEFT JOIN users u ON qr.created_by = u.id
                 WHERE mq.meeting_id=?
                 ORDER BY mq.id''', (meeting_id,))
    
    questions = c.fetchall()
    columns = [description[0] for description in c.description]
    
    questions_list = []
    for question in questions:
        question_dict = dict(zip(columns, question))
        questions_list.append(question_dict)
    
    conn.close()
    return jsonify(questions_list)

@app.route('/api/meetings/<int:meeting_id>/questions', methods=['POST'])
@login_required
def add_meeting_question(meeting_id):
    data = request.get_json()
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    # Если вопрос новый, сначала создаем его в реестре
    if data.get('is_new'):
        c.execute('''INSERT INTO question_registry 
                     (project_id, topic, description, status, created_by, meeting_id)
                     VALUES (?, ?, ?, ?, ?, ?)''',
                  (data.get('project_id'), data.get('topic'), data.get('description'),
                   'scheduled', session['user_id'], meeting_id))
        question_id = c.lastrowid
    else:
        question_id = data.get('question_id')
        # Обновляем статус вопроса в реестре
        c.execute("UPDATE question_registry SET status='scheduled', meeting_id=? WHERE id=?",
                 (meeting_id, question_id))
    
    # Добавляем вопрос в совещание
    c.execute('''INSERT INTO meeting_questions (meeting_id, question_id, discussed, resolution_notes)
                 VALUES (?, ?, ?, ?)''',
              (meeting_id, question_id, data.get('discussed', 0), data.get('resolution_notes')))
    
    meeting_question_id = c.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'meeting_question_id': meeting_question_id})

@app.route('/api/meeting-questions/<int:meeting_question_id>', methods=['PUT'])
@login_required
def update_meeting_question(meeting_question_id):
    data = request.get_json()
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    update_fields = []
    params = []
    
    if 'discussed' in data:
        update_fields.append("discussed=?")
        params.append(data['discussed'])
    if 'resolution_notes' in data:
        update_fields.append("resolution_notes=?")
        params.append(data['resolution_notes'])
    
    if update_fields:
        query = f"UPDATE meeting_questions SET {', '.join(update_fields)} WHERE id=?"
        params.append(meeting_question_id)
        c.execute(query, params)
        
        # Получаем question_id для обновления статуса в реестре
        if 'discussed' in data or 'resolution_notes' in data:
            c.execute("SELECT question_id FROM meeting_questions WHERE id=?", (meeting_question_id,))
            question_id = c.fetchone()[0]
            
            # Обновляем статус вопроса в реестре на основе обсуждения
            if data.get('discussed') == 1:
                if data.get('resolution_notes'):
                    new_status = 'resolved'
                else:
                    new_status = 'unresolved'
                c.execute("UPDATE question_registry SET status=? WHERE id=?", (new_status, question_id))
            
            if data.get('resolution_notes'):
                c.execute("UPDATE question_registry SET resolution=? WHERE id=?", 
                         (data['resolution_notes'], question_id))
        
        conn.commit()
    
    conn.close()
    return jsonify({'success': True})

@app.route('/api/meeting-questions/<int:meeting_question_id>', methods=['DELETE'])
@login_required
def delete_meeting_question(meeting_question_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    # Получаем question_id
    c.execute("SELECT question_id FROM meeting_questions WHERE id=?", (meeting_question_id,))
    question_id = c.fetchone()
    
    if question_id:
        # Обновляем статус вопроса в реестре обратно на pending
        c.execute("UPDATE question_registry SET status='pending', meeting_id=NULL WHERE id=?", 
                 (question_id[0],))
    
    c.execute("DELETE FROM meeting_questions WHERE id=?", (meeting_question_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

if __name__ == '__main__':
    init_db()
    app.run(debug=True)