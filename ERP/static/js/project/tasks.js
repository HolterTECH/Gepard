// Состояние приложения
let currentTaskData = null;
let pendingAction = null;
let projectTeam = [];
let allTasks = [];
let filteredTasks = [];
let currentSort = {
    field: 'planned_start',
    direction: 'asc'
};
let currentFilters = {
    status: 'all',
    assignee: 'all',
    priority: 'all',
    search: ''
};
let currentPage = 1;
const itemsPerPage = 20;

// Загрузка команды проекта
async function loadProjectTeam() {
    try {
        const response = await fetch(`/api/project/${projectId}/team`);
        if (response.ok) {
            projectTeam = await response.json();
            updateAssigneeSelects();
            updateAssigneeFilter();
        }
    } catch (error) {
        console.error('Error loading team:', error);
    }
}

// Загрузка всех задач
async function loadTasks() {
    try {
        const response = await fetch(`/api/project/${projectId}/tasks`);
        if (response.ok) {
            allTasks = await response.json();
            // Добавляем поля для дат, если их нет
            allTasks = allTasks.map(task => ({
                ...task,
                planned_start_date: task.planned_start_date || null,
                actual_start_date: task.actual_start_date || null,
                actual_end_date: task.actual_end_date || null,
                status: task.status || 'planned'
            }));
            applyFilters();
            loadPredecessorTasks();
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

// Загрузка задач для выпадающего списка предшественников
async function loadPredecessorTasks() {
    try {
        const response = await fetch(`/api/project/${projectId}/tasks`);
        if (response.ok) {
            const tasks = await response.json();
            const select = document.getElementById('predecessorTask');
            select.innerHTML = '<option value="">Нет предшественника</option>';
            
            tasks.forEach(task => {
                const option = document.createElement('option');
                option.value = task.id;
                option.textContent = task.title;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading tasks for predecessor:', error);
    }
}

// Обновление выпадающих списков исполнителей
function updateAssigneeSelects() {
    // Для формы создания
    const createSelect = document.getElementById('taskAssignee');
    if (createSelect) {
        createSelect.innerHTML = '<option value="">Выберите исполнителя</option>';
        projectTeam.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = `${member.name} (${member.role})`;
            createSelect.appendChild(option);
        });
    }
    
    // Для формы редактирования
    const editSelect = document.getElementById('editTaskAssignee');
    if (editSelect) {
        editSelect.innerHTML = '<option value="">Выберите исполнителя</option>';
        projectTeam.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = `${member.name} (${member.role})`;
            editSelect.appendChild(option);
        });
    }
}

// Обновление фильтра исполнителей
function updateAssigneeFilter() {
    const select = document.getElementById('assigneeFilter');
    if (!select) return;
    
    select.innerHTML = '<option value="all">Все исполнители</option>';
    projectTeam.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.name;
        select.appendChild(option);
    });
}

// Применение фильтров
function applyFilters() {
    filteredTasks = allTasks.filter(task => {
        // Фильтр по состоянию
        if (currentFilters.status !== 'all') {
            const state = getTaskState(task);
            if (state !== currentFilters.status) return false;
        }
        
        // Фильтр по исполнителю
        if (currentFilters.assignee !== 'all' && task.assignee_id != currentFilters.assignee) {
            return false;
        }
        
        // Фильтр по приоритету
        if (currentFilters.priority !== 'all' && task.priority !== currentFilters.priority) {
            return false;
        }
        
        // Поиск по названию
        if (currentFilters.search && !task.title.toLowerCase().includes(currentFilters.search.toLowerCase())) {
            return false;
        }
        
        return true;
    });
    
    // Сортировка
    sortTasks();
    
    // Рендеринг
    renderTasksTable();
    renderPagination();
}

// Получение состояния задачи
function getTaskState(task) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const plannedEnd = task.due_date ? new Date(task.due_date) : null;
    const actualEnd = task.actual_end_date ? new Date(task.actual_end_date) : null;
    const actualStart = task.actual_start_date ? new Date(task.actual_start_date) : null;
    
    // Если есть фактическая дата окончания - выполнено
    if (actualEnd) {
        return 'completed';
    }
    
    // Если есть фактическая дата начала - в работе
    if (actualStart) {
        // Проверяем просрочку
        if (plannedEnd && plannedEnd < today) {
            return 'overdue';
        }
        // Проверяем срыв сроков (2 дня до дедлайна)
        if (plannedEnd) {
            const daysUntilDeadline = Math.ceil((plannedEnd - today) / (1000 * 60 * 60 * 24));
            if (daysUntilDeadline <= 2 && daysUntilDeadline >= 0) {
                return 'deadline_soon';
            }
        }
        return 'in_progress';
    }
    
    // Запланировано
    return 'planned';
}

// Получение цвета состояния
function getStateColor(state) {
    const colors = {
        'planned': '#9e9e9e',      // Серый
        'in_progress': '#2196f3',   // Синий
        'completed': '#4caf50',     // Зеленый
        'overdue': '#f44336',       // Красный
        'deadline_soon': '#ffc107'  // Желтый
    };
    return colors[state] || '#9e9e9e';
}

// Получение текста состояния
function getStateText(state) {
    const texts = {
        'planned': 'Запланировано',
        'in_progress': 'В работе',
        'completed': 'Выполнено',
        'overdue': 'Просрочено',
        'deadline_soon': 'Срыв сроков'
    };
    return texts[state] || state;
}

// Сортировка задач
function sortTasks() {
    filteredTasks.sort((a, b) => {
        let aVal = a[currentSort.field];
        let bVal = b[currentSort.field];
        
        // Обработка дат
        if (currentSort.field.includes('date')) {
            aVal = aVal ? new Date(aVal) : null;
            bVal = bVal ? new Date(bVal) : null;
        }
        
        // Обработка null значений
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        
        // Сравнение
        if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });
}

// Рендеринг таблицы задач
function renderTasksTable() {
    const tbody = document.getElementById('tasksTableBody');
    if (!tbody) return;
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageTasks = filteredTasks.slice(start, end);
    
    tbody.innerHTML = '';
    
    pageTasks.forEach(task => {
        const state = getTaskState(task);
        const stateColor = getStateColor(state);
        const stateText = getStateText(state);
        
        const assignee = task.assignee_id ? 
            projectTeam.find(m => m.id == task.assignee_id)?.name || 'Не назначен' : 
            'Не назначен';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="task-state-indicator" style="background-color: ${stateColor}" 
                     title="${stateText}"></div>
            </td>
            <td class="task-title-cell">
                <div class="task-title-wrapper">
                    ${task.parent_id ? '<span class="subtask-indicator">↳</span>' : ''}
                    <span>${escapeHtml(task.title)}</span>
                </div>
                ${task.description ? `<div class="task-description-preview">${escapeHtml(task.description.substring(0, 50))}${task.description.length > 50 ? '...' : ''}</div>` : ''}
            </td>
            <td>${escapeHtml(assignee)}</td>
            <td>
                <span class="priority-badge priority-${task.priority}">${getPriorityText(task.priority)}</span>
            </td>
            <td>${formatDate(task.planned_start_date)}</td>
            <td>${formatDate(task.actual_start_date)}</td>
            <td>${formatDate(task.due_date)}</td>
            <td>${formatDate(task.actual_end_date)}</td>
            <td>
                <div class="task-actions">
                    <button onclick="editTask(${task.id})" class="action-btn edit-btn" title="Редактировать">✏️</button>
                    <button onclick="openCreateTaskModal(${task.id}, null)" class="action-btn subtask-btn" title="Добавить подзадачу">➕</button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    if (pageTasks.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="9" class="no-tasks">Задачи не найдены</td>';
        tbody.appendChild(row);
    }
}

// Рендеринг пагинации
function renderPagination() {
    const container = document.getElementById('pagination');
    if (!container) return;
    
    const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Кнопка "Предыдущая"
    html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">←</button>`;
    
    // Номера страниц
    for (let i = 1; i <= totalPages; i++) {
        if (
            i === 1 ||
            i === totalPages ||
            (i >= currentPage - 2 && i <= currentPage + 2)
        ) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<span class="page-dots">...</span>`;
        }
    }
    
    // Кнопка "Следующая"
    html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">→</button>`;
    
    container.innerHTML = html;
}

// Смена страницы
function changePage(page) {
    currentPage = page;
    renderTasksTable();
    renderPagination();
}

// Форматирование даты
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

// Получение текста приоритета
function getPriorityText(priority) {
    const texts = {
        'low': 'Низкий',
        'medium': 'Средний',
        'high': 'Высокий'
    };
    return texts[priority] || 'Средний';
}

// Открыть модальное окно создания задачи
function openCreateTaskModal(parentTaskId = null, previousTaskId = null) {
    const modal = document.getElementById('createTaskModal');
    const form = document.getElementById('createTaskForm');
    
    form.reset();
    document.getElementById('parentTaskId').value = parentTaskId || '';
    document.getElementById('previousTaskId').value = previousTaskId || '';
    
    modal.classList.add('show');
}

// Закрыть модальное окно создания задачи
function closeCreateTaskModal() {
    document.getElementById('createTaskModal').classList.remove('show');
    currentTaskData = null;
}

// Сохранить задачу
async function saveTask() {
    const form = document.getElementById('createTaskForm');
    
    const taskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        assignee_id: document.getElementById('taskAssignee').value || null,
        priority: document.getElementById('taskPriority').value,
        status: document.getElementById('taskStatus').value,
        planned_start_date: document.getElementById('plannedStartDate').value || null,
        actual_start_date: document.getElementById('actualStartDate').value || null,
        due_date: document.getElementById('plannedEndDate').value || null,
        actual_end_date: document.getElementById('actualEndDate').value || null,
        parent_id: document.getElementById('parentTaskId').value || null
    };
    
    // Валидация
    if (!taskData.title) {
        alert('Введите название задачи');
        return;
    }
    
    try {
        const response = await fetch(`/api/project/${projectId}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Если есть задача-предшественник, создаем связь
            const predecessorId = document.getElementById('predecessorTask').value;
            if (predecessorId) {
                await createTaskLink(predecessorId, result.task_id, 'depends_on');
            }
            
            closeCreateTaskModal();
            await loadTasks();
            showNotification('Задача создана', 'success');
        } else {
            showNotification('Ошибка при создании задачи', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Ошибка при создании задачи', 'error');
    }
}

// Сохранить и создать новую задачу
async function saveAndCreateNew() {
    const afterSaveAction = document.querySelector('input[name="after_save_action"]:checked')?.value || 'none';
    
    // Сохраняем данные для следующей задачи
    currentTaskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        assignee_id: document.getElementById('taskAssignee').value,
        priority: document.getElementById('taskPriority').value,
        status: document.getElementById('taskStatus').value,
        planned_start_date: document.getElementById('plannedStartDate').value,
        actual_start_date: document.getElementById('actualStartDate').value,
        due_date: document.getElementById('plannedEndDate').value,
        actual_end_date: document.getElementById('actualEndDate').value,
        project_id: projectId
    };
    
    const taskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        assignee_id: document.getElementById('taskAssignee').value || null,
        priority: document.getElementById('taskPriority').value,
        status: document.getElementById('taskStatus').value,
        planned_start_date: document.getElementById('plannedStartDate').value || null,
        actual_start_date: document.getElementById('actualStartDate').value || null,
        due_date: document.getElementById('plannedEndDate').value || null,
        actual_end_date: document.getElementById('actualEndDate').value || null,
        parent_id: document.getElementById('parentTaskId').value || null
    };
    
    if (!taskData.title) {
        alert('Введите название задачи');
        return;
    }
    
    try {
        const response = await fetch(`/api/project/${projectId}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            const predecessorId = document.getElementById('predecessorTask').value;
            if (predecessorId) {
                await createTaskLink(predecessorId, result.task_id, 'depends_on');
            }
            
            if (afterSaveAction === 'create_next') {
                pendingAction = 'create_next';
                currentTaskData.previous_task_id = result.task_id;
                showConfirmModal('Создать следующую задачу?');
            } else if (afterSaveAction === 'create_subtask') {
                pendingAction = 'create_subtask';
                currentTaskData.parent_task_id = result.task_id;
                showConfirmModal('Создать подзадачу?');
            } else {
                closeCreateTaskModal();
                await loadTasks();
                showNotification('Задача создана', 'success');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Ошибка при создании задачи', 'error');
    }
}

// Создать связь между задачами
async function createTaskLink(sourceId, targetId, linkType = 'depends_on') {
    try {
        await fetch('/api/task-links', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                source_task_id: sourceId,
                target_task_id: targetId,
                link_type: linkType
            })
        });
    } catch (error) {
        console.error('Error creating task link:', error);
    }
}

// Показать модальное окно подтверждения
function showConfirmModal(message) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').classList.add('show');
}

// Закрыть модальное окно подтверждения
function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('show');
    pendingAction = null;
    currentTaskData = null;
}

// Продолжить создание новой задачи
function proceedWithNewTask() {
    closeConfirmModal();
    closeCreateTaskModal();
    
    setTimeout(() => {
        if (pendingAction === 'create_next') {
            openCreateTaskModal(null, currentTaskData?.previous_task_id);
        } else if (pendingAction === 'create_subtask') {
            openCreateTaskModal(currentTaskData?.parent_task_id);
        }
        
        // Восстанавливаем данные формы
        if (currentTaskData) {
            document.getElementById('taskTitle').value = currentTaskData.title || '';
            document.getElementById('taskDescription').value = currentTaskData.description || '';
            document.getElementById('taskAssignee').value = currentTaskData.assignee_id || '';
            document.getElementById('taskPriority').value = currentTaskData.priority || 'medium';
            document.getElementById('taskStatus').value = currentTaskData.status || 'planned';
            document.getElementById('plannedStartDate').value = currentTaskData.planned_start_date || '';
            document.getElementById('actualStartDate').value = currentTaskData.actual_start_date || '';
            document.getElementById('plannedEndDate').value = currentTaskData.due_date || '';
            document.getElementById('actualEndDate').value = currentTaskData.actual_end_date || '';
        }
    }, 300);
}

// Редактирование задачи
async function editTask(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    
    const modal = document.getElementById('editTaskModal');
    document.getElementById('editTaskId').value = task.id;
    document.getElementById('editTaskTitle').value = task.title || '';
    document.getElementById('editTaskDescription').value = task.description || '';
    document.getElementById('editTaskAssignee').value = task.assignee_id || '';
    document.getElementById('editTaskPriority').value = task.priority || 'medium';
    document.getElementById('editTaskStatus').value = task.status || 'planned';
    document.getElementById('editPlannedStartDate').value = task.planned_start_date || '';
    document.getElementById('editActualStartDate').value = task.actual_start_date || '';
    document.getElementById('editPlannedEndDate').value = task.due_date || '';
    document.getElementById('editActualEndDate').value = task.actual_end_date || '';
    
    modal.classList.add('show');
}

// Обновление задачи
document.getElementById('editTaskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const taskId = document.getElementById('editTaskId').value;
    const taskData = {
        title: document.getElementById('editTaskTitle').value,
        description: document.getElementById('editTaskDescription').value,
        assignee_id: document.getElementById('editTaskAssignee').value || null,
        priority: document.getElementById('editTaskPriority').value,
        status: document.getElementById('editTaskStatus').value,
        planned_start_date: document.getElementById('editPlannedStartDate').value || null,
        actual_start_date: document.getElementById('editActualStartDate').value || null,
        due_date: document.getElementById('editPlannedEndDate').value || null,
        actual_end_date: document.getElementById('editActualEndDate').value || null
    };
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        
        if (response.ok) {
            document.getElementById('editTaskModal').classList.remove('show');
            await loadTasks();
            showNotification('Задача обновлена', 'success');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Ошибка при обновлении задачи', 'error');
    }
});

// Удаление задачи
document.getElementById('deleteTaskBtn')?.addEventListener('click', async () => {
    if (!confirm('Вы уверены, что хотите удалить задачу?')) return;
    
    const taskId = document.getElementById('editTaskId').value;
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            document.getElementById('editTaskModal').classList.remove('show');
            await loadTasks();
            showNotification('Задача удалена', 'success');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Ошибка при удалении задачи', 'error');
    }
});

// Показать уведомление
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        background: ${type === 'success' ? '#4caf50' : '#f44336'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Обработчики фильтров
document.getElementById('statusFilter')?.addEventListener('change', (e) => {
    currentFilters.status = e.target.value;
    currentPage = 1;
    applyFilters();
});

document.getElementById('assigneeFilter')?.addEventListener('change', (e) => {
    currentFilters.assignee = e.target.value;
    currentPage = 1;
    applyFilters();
});

document.getElementById('priorityFilter')?.addEventListener('change', (e) => {
    currentFilters.priority = e.target.value;
    currentPage = 1;
    applyFilters();
});

document.getElementById('searchFilter')?.addEventListener('input', (e) => {
    currentFilters.search = e.target.value;
    currentPage = 1;
    applyFilters();
});

document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
    currentFilters = {
        status: 'all',
        assignee: 'all',
        priority: 'all',
        search: ''
    };
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('assigneeFilter').value = 'all';
    document.getElementById('priorityFilter').value = 'all';
    document.getElementById('searchFilter').value = '';
    currentPage = 1;
    applyFilters();
});

// Обработчики сортировки
document.querySelectorAll('.sortable').forEach(header => {
    header.addEventListener('click', () => {
        const field = header.dataset.sort;
        if (currentSort.field === field) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.field = field;
            currentSort.direction = 'asc';
        }
        applyFilters();
    });
});

// Обработчики модальных окон
document.getElementById('createTaskBtn')?.addEventListener('click', () => openCreateTaskModal());
document.getElementById('closeCreateTaskModal')?.addEventListener('click', closeCreateTaskModal);
document.getElementById('cancelCreateTaskBtn')?.addEventListener('click', closeCreateTaskModal);
document.getElementById('closeEditTaskModal')?.addEventListener('click', () => {
    document.getElementById('editTaskModal').classList.remove('show');
});
document.getElementById('cancelEditTaskBtn')?.addEventListener('click', () => {
    document.getElementById('editTaskModal').classList.remove('show');
});
document.getElementById('closeConfirmModal')?.addEventListener('click', closeConfirmModal);

// Закрытие по клику вне модального окна
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('show');
        }
    });
});

// Вспомогательная функция
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}