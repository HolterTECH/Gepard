document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const sidebar = document.querySelector('.project-sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    const projectName = document.getElementById('projectName');
    const createdDate = document.getElementById('createdDate');
    const createTaskBtn = document.getElementById('createTaskBtn');
    const taskModal = document.getElementById('taskModal');
    const closeTaskModal = document.getElementById('closeTaskModal');
    const cancelTaskBtn = document.getElementById('cancelTaskBtn');
    const createTaskForm = document.getElementById('createTaskForm');
    const viewToggles = document.querySelectorAll('.toggle-btn');
    const taskViews = document.querySelectorAll('.tasks-view');

    // Загрузка данных проекта
    loadProjectData();
    loadTasks();

    // Тоггл сайдбара с сохранением состояния
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            this.textContent = sidebar.classList.contains('collapsed') ? '⟩' : '⟨';
            
            // Сохраняем состояние в localStorage
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        });

        // Восстанавливаем состояние сайдбара
        const collapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (collapsed) {
            sidebar.classList.add('collapsed');
            sidebarToggle.textContent = '⟩';
        }
    }

    // Навигация по разделам (для одностраничного режима, если используется)
    if (navItems.length > 0 && sections.length > 0) {
        navItems.forEach(item => {
            item.addEventListener('click', function(e) {
                // Проверяем, является ли ссылка внешней (с полным путем)
                const href = this.getAttribute('href');
                if (href && (href.startsWith('/') || href.includes('://'))) {
                    // Это полноценная навигация, не обрабатываем
                    return;
                }
                
                e.preventDefault();
                
                // Убираем активный класс у всех пунктов
                navItems.forEach(nav => nav.classList.remove('active'));
                // Добавляем активный класс текущему пункту
                this.classList.add('active');
                
                // Показываем соответствующий раздел
                const sectionId = this.dataset.section + '-section';
                sections.forEach(section => {
                    section.classList.remove('active');
                    if (section.id === sectionId) {
                        section.classList.add('active');
                    }
                });

                // Обновляем URL без перезагрузки страницы (если нужно)
                const url = new URL(window.location);
                url.searchParams.set('section', this.dataset.section);
                window.history.pushState({}, '', url);
            });
        });

        // Проверяем, есть ли секция в URL при загрузке
        const urlParams = new URLSearchParams(window.location.search);
        const sectionParam = urlParams.get('section');
        if (sectionParam) {
            const activeNav = document.querySelector(`.nav-item[data-section="${sectionParam}"]`);
            if (activeNav) {
                activeNav.click();
            }
        }
    }

    // Переключение видов задач
    if (viewToggles.length > 0) {
        viewToggles.forEach(toggle => {
            toggle.addEventListener('click', function() {
                const view = this.dataset.view;
                
                // Обновляем кнопки
                viewToggles.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                // Обновляем вид
                taskViews.forEach(taskView => {
                    taskView.classList.remove('active');
                    if (taskView.id === view + '-view') {
                        taskView.classList.add('active');
                    }
                });

                // Сохраняем выбранный вид в localStorage
                localStorage.setItem('tasksView', view);
            });
        });

        // Восстанавливаем выбранный вид задач
        const savedView = localStorage.getItem('tasksView');
        if (savedView) {
            const savedToggle = document.querySelector(`.toggle-btn[data-view="${savedView}"]`);
            if (savedToggle) {
                savedToggle.click();
            }
        }
    }

    // Модальное окно создания задачи
    if (createTaskBtn) {
        createTaskBtn.addEventListener('click', function() {
            taskModal.classList.add('show');
            document.getElementById('taskTitle').focus();
        });
    }

    function closeTaskModal_() {
        taskModal.classList.remove('show');
        createTaskForm.reset();
    }

    if (closeTaskModal) closeTaskModal.addEventListener('click', closeTaskModal_);
    if (cancelTaskBtn) cancelTaskBtn.addEventListener('click', closeTaskModal_);

    window.addEventListener('click', function(e) {
        if (e.target === taskModal) {
            closeTaskModal_();
        }
    });

    // Закрытие по клавише Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (taskModal && taskModal.classList.contains('show')) {
                closeTaskModal_();
            }
        }
    });

    // Создание задачи
    if (createTaskForm) {
        createTaskForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const taskData = {
                title: document.getElementById('taskTitle').value,
                description: document.getElementById('taskDescription').value,
                priority: document.getElementById('taskPriority').value,
                due_date: document.getElementById('taskDueDate').value || null,
                status: 'todo'
            };

            // Показываем индикатор загрузки
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Создание...';
            submitBtn.disabled = true;

            try {
                const response = await fetch(`/api/project/${window.projectId}/tasks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(taskData)
                });

                const data = await response.json();

                if (data.success) {
                    closeTaskModal_();
                    await loadTasks(); // Перезагружаем задачи
                    showNotification('Задача создана', 'success');
                } else {
                    showNotification(data.message || 'Ошибка при создании задачи', 'error');
                }
            } catch (error) {
                console.error('Error creating task:', error);
                showNotification('Ошибка при создании задачи', 'error');
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Загрузка данных проекта
    async function loadProjectData() {
        try {
            const response = await fetch(`/api/project/${window.projectId}`);
            const project = await response.json();
            
            if (projectName) {
                projectName.textContent = project.name;
            }
            
            if (createdDate && project.created_at) {
                createdDate.textContent = 'Создан: ' + formatDate(project.created_at);
            }

            // Обновляем заголовок страницы
            document.title = `${project.name} | Project Tracker`;
        } catch (error) {
            console.error('Error loading project:', error);
            showNotification('Ошибка загрузки данных проекта', 'error');
        }
    }

    // Загрузка задач
    async function loadTasks() {
        // Показываем индикатор загрузки
        const tasksList = document.getElementById('tasksList');
        if (tasksList) {
            tasksList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Загрузка задач...</p></div>';
        }

        try {
            const response = await fetch(`/api/project/${window.projectId}/tasks`);
            const tasks = await response.json();
            
            renderTasksList(tasks);
            renderKanban(tasks);
            renderTaskGraph(tasks);
        } catch (error) {
            console.error('Error loading tasks:', error);
            if (tasksList) {
                tasksList.innerHTML = '<div class="error-state">Ошибка загрузки задач</div>';
            }
        }
    }

    // Отображение списка задач
    function renderTasksList(tasks) {
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) return;
        
        if (!tasks || tasks.length === 0) {
            tasksList.innerHTML = `
                <div class="empty-state">
                    <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <h3>Нет задач</h3>
                    <p>Создайте первую задачу проекта</p>
                    <button class="create-btn" onclick="document.getElementById('createTaskBtn').click()">
                        Создать задачу
                    </button>
                </div>
            `;
            return;
        }

        tasksList.innerHTML = tasks.map(task => `
            <div class="task-item" data-task-id="${task.id}">
                <div class="task-checkbox">
                    <input type="checkbox" ${task.status === 'done' ? 'checked' : ''} 
                           onchange="window.toggleTaskStatus(${task.id}, this.checked)">
                </div>
                <div class="task-content">
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
                </div>
                <div class="task-meta">
                    <span class="task-priority priority-${task.priority}">
                        ${getPriorityText(task.priority)}
                    </span>
                    ${task.due_date ? `<span class="task-due-date">${formatDate(task.due_date)}</span>` : ''}
                </div>
                <div class="task-actions">
                    <button class="action-btn" onclick="window.editTask(${task.id})" title="Редактировать">✎</button>
                    <button class="action-btn" onclick="window.deleteTask(${task.id})" title="Удалить">🗑</button>
                </div>
            </div>
        `).join('');
    }

    // Отображение канбан доски
    function renderKanban(tasks) {
        const columns = {
            'todo': document.getElementById('todo-tasks'),
            'in_progress': document.getElementById('progress-tasks'),
            'review': document.getElementById('review-tasks'),
            'done': document.getElementById('done-tasks')
        };

        // Проверяем, существуют ли колонки
        if (!columns.todo || !columns.in_progress || !columns.review || !columns.done) {
            return;
        }

        // Сброс счетчиков
        document.getElementById('todo-count').textContent = '0';
        document.getElementById('progress-count').textContent = '0';
        document.getElementById('review-count').textContent = '0';
        document.getElementById('done-count').textContent = '0';

        // Очищаем колонки
        Object.values(columns).forEach(col => col.innerHTML = '');

        if (!tasks || tasks.length === 0) {
            Object.values(columns).forEach(col => {
                col.innerHTML = '<div class="empty-column">Нет задач</div>';
            });
            return;
        }

        // Распределяем задачи по колонкам
        tasks.forEach(task => {
            const taskElement = createKanbanTask(task);
            const status = task.status || 'todo';
            
            if (columns[status]) {
                columns[status].appendChild(taskElement);
                // Обновляем счетчик
                const countEl = document.getElementById(`${status}-count`);
                if (countEl) {
                    countEl.textContent = parseInt(countEl.textContent) + 1;
                }
            }
        });

        // Добавляем возможность перетаскивания (drag & drop) - заглушка
        enableDragAndDrop();
    }

    function createKanbanTask(task) {
        const div = document.createElement('div');
        div.className = 'kanban-task';
        div.dataset.taskId = task.id;
        div.draggable = true;
        div.innerHTML = `
            <div class="kanban-task-title">${escapeHtml(task.title)}</div>
            <div class="kanban-task-footer">
                <span class="kanban-task-priority priority-${task.priority}">
                    ${getPriorityText(task.priority)}
                </span>
                ${task.due_date ? `<span>${formatDate(task.due_date)}</span>` : ''}
            </div>
        `;
        
        div.addEventListener('click', () => window.editTask(task.id));
        div.addEventListener('dragstart', handleDragStart);
        div.addEventListener('dragend', handleDragEnd);
        
        return div;
    }

    // Заглушка для drag & drop
    function enableDragAndDrop() {
        const columns = document.querySelectorAll('.column-tasks');
        columns.forEach(column => {
            column.addEventListener('dragover', handleDragOver);
            column.addEventListener('drop', handleDrop);
        });
    }

    function handleDragStart(e) {
        e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
        e.target.classList.add('dragging');
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
    }

    function handleDragOver(e) {
        e.preventDefault();
    }

    function handleDrop(e) {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        const newStatus = e.target.closest('.kanban-column')?.dataset.status;
        
        if (taskId && newStatus) {
            // Здесь будет обновление статуса задачи
            console.log(`Move task ${taskId} to ${newStatus}`);
            showNotification('Перемещение задач будет доступно в следующем обновлении', 'info');
        }
    }

    // Отображение графа задач (улучшенная заглушка)
    function renderTaskGraph(tasks) {
        const canvas = document.getElementById('taskGraph');
        if (!canvas) return;

        // Устанавливаем размеры canvas
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!tasks || tasks.length === 0) {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#999';
            ctx.textAlign = 'center';
            ctx.fillText('Нет задач для отображения', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Рисуем простой граф для демонстрации
        ctx.font = '14px Arial';
        ctx.fillStyle = '#667eea';
        ctx.textAlign = 'center';
        ctx.fillText('Граф связей задач (в разработке)', canvas.width / 2, 50);
        
        // Рисуем несколько кружков для демонстрации
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        ctx.beginPath();
        ctx.arc(centerX - 100, centerY - 50, 40, 0, 2 * Math.PI);
        ctx.fillStyle = '#e8f0fe';
        ctx.fill();
        ctx.strokeStyle = '#667eea';
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, 40, 0, 2 * Math.PI);
        ctx.fillStyle = '#e8f0fe';
        ctx.fill();
        ctx.strokeStyle = '#667eea';
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(centerX + 100, centerY + 50, 40, 0, 2 * Math.PI);
        ctx.fillStyle = '#e8f0fe';
        ctx.fill();
        ctx.strokeStyle = '#667eea';
        ctx.stroke();
        
        // Рисуем линии связей
        ctx.beginPath();
        ctx.moveTo(centerX - 60, centerY - 50);
        ctx.lineTo(centerX - 40, centerY - 30);
        ctx.strokeStyle = '#999';
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(centerX + 40, centerY + 30);
        ctx.lineTo(centerX + 60, centerY + 50);
        ctx.strokeStyle = '#999';
        ctx.stroke();
    }

    // Вспомогательные функции
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return dateString;
            }
            return date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    }

    function getPriorityText(priority) {
        const priorities = {
            'low': 'Низкий',
            'medium': 'Средний',
            'high': 'Высокий'
        };
        return priorities[priority] || priority;
    }

    // Функция для показа уведомлений
    function showNotification(message, type = 'info') {
        // Проверяем, существует ли уже контейнер для уведомлений
        let container = document.querySelector('.notification-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notification-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Цвета для разных типов уведомлений
        const colors = {
            success: '#48bb78',
            error: '#f56565',
            warning: '#ed8936',
            info: '#667eea'
        };
        
        notification.style.cssText = `
            padding: 12px 24px;
            background: ${colors[type] || colors.info};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            font-size: 14px;
            font-weight: 500;
            animation: slideInRight 0.3s ease;
            cursor: pointer;
            max-width: 300px;
        `;
        
        notification.textContent = message;
        container.appendChild(notification);
        
        // Удаляем уведомление через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                notification.remove();
                if (container.children.length === 0) {
                    container.remove();
                }
            }, 300);
        }, 3000);
        
        // Клик для закрытия
        notification.addEventListener('click', function() {
            this.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => this.remove(), 300);
        });
    }

    // Добавляем стили для анимаций
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .dragging {
            opacity: 0.5;
            transform: scale(0.95);
        }
        
        .empty-column {
            color: #999;
            text-align: center;
            padding: 40px 20px;
            font-size: 14px;
            border: 2px dashed #e1e1e1;
            border-radius: 8px;
        }
        
        .error-state {
            color: #e53e3e;
            text-align: center;
            padding: 40px;
            font-size: 16px;
        }
    `;
    document.head.appendChild(style);

    // Глобальные функции для обработчиков
    window.toggleTaskStatus = async function(taskId, completed) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: completed ? 'done' : 'todo'
                })
            });
            
            if (response.ok) {
                await loadTasks(); // Перезагружаем задачи
                showNotification('Статус задачи обновлен', 'success');
            }
        } catch (error) {
            console.error('Error updating task:', error);
            showNotification('Ошибка при обновлении задачи', 'error');
        }
    };

    window.deleteTask = async function(taskId) {
        if (!confirm('Вы уверены, что хотите удалить задачу?')) return;
        
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                await loadTasks(); // Перезагружаем задачи
                showNotification('Задача удалена', 'success');
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            showNotification('Ошибка при удалении задачи', 'error');
        }
    };

    window.editTask = function(taskId) {
        // Здесь будет реализация редактирования задачи
        showNotification('Редактирование задачи будет доступно в следующем обновлении', 'info');
        console.log('Edit task:', taskId);
    };

    // Адаптация для мобильных устройств
    function handleMobileLayout() {
        if (window.innerWidth <= 768) {
            if (sidebar && !sidebar.classList.contains('collapsed')) {
                sidebar.classList.add('collapsed');
                if (sidebarToggle) sidebarToggle.textContent = '⟩';
            }
        }
    }

    handleMobileLayout();
    window.addEventListener('resize', handleMobileLayout);
});

// Экспортируем projectId для использования в других функциях
if (typeof projectId !== 'undefined') {
    window.projectId = projectId;
}