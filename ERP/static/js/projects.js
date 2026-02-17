document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const createProjectBtn = document.getElementById('createProjectBtn');
    const projectModal = document.getElementById('projectModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const createProjectForm = document.getElementById('createProjectForm');
    const projectsGrid = document.getElementById('projectsGrid');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const contextMenu = document.getElementById('projectContextMenu');
    const editModal = document.getElementById('editModal');
    const closeEditModalBtn = document.getElementById('closeEditModalBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const editProjectForm = document.getElementById('editProjectForm');
    
    let currentProjectId = null;
    let selectedProjectCard = null;

    // Загрузка проектов при загрузке страницы
    loadProjects();

    // Открытие модального окна создания проекта
    createProjectBtn.addEventListener('click', function() {
        projectModal.classList.add('show');
        document.getElementById('projectName').focus();
    });

    // Добавьте эту функцию в начало файла для глобальной обработки ошибок
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        alert('Произошла ошибка при выполнении операции. Пожалуйста, попробуйте снова.');
    });

    // Улучшенная функция escapeHtml с обработкой специальных символов
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Улучшенная функция formatDate с обработкой некорректных дат
    function formatDate(dateString) {
        if (!dateString) return 'Дата неизвестна';
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return 'Дата неизвестна';
            }
            
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
                return 'Сегодня';
            } else if (diffDays === 1) {
                return 'Вчера';
            } else if (diffDays < 7) {
                return `${diffDays} ${getDaysWord(diffDays)} назад`;
            } else {
                return date.toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Дата неизвестна';
        }
    }

    // Вспомогательная функция для склонения слова "день"
    function getDaysWord(days) {
        if (days % 10 === 1 && days % 100 !== 11) {
            return 'день';
        } else if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)) {
            return 'дня';
        } else {
            return 'дней';
        }
    }

    // Добавьте обработку клавиши Escape для закрытия модальных окон
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (projectModal.classList.contains('show')) {
                closeModals();
            }
            if (editModal.classList.contains('show')) {
                closeModals();
            }
            if (contextMenu.classList.contains('show')) {
                contextMenu.classList.remove('show');
            }
        }
    });


    // Закрытие модальных окон
    function closeModals() {
        projectModal.classList.remove('show');
        editModal.classList.remove('show');
        contextMenu.classList.remove('show');
        createProjectForm.reset();
        editProjectForm.reset();
    }

    closeModalBtn.addEventListener('click', closeModals);
    cancelBtn.addEventListener('click', closeModals);
    closeEditModalBtn.addEventListener('click', closeModals);
    cancelEditBtn.addEventListener('click', closeModals);

    // Закрытие по клику вне модального окна
    window.addEventListener('click', function(e) {
        if (e.target === projectModal) {
            closeModals();
        }
        if (e.target === editModal) {
            closeModals();
        }
        if (!contextMenu.contains(e.target) && !e.target.classList.contains('project-menu-btn')) {
            contextMenu.classList.remove('show');
        }
    });

    // Создание нового проекта
    createProjectForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('projectName').value.trim();
        const description = document.getElementById('projectDescription').value.trim();

        if (!name) {
            alert('Введите название проекта');
            return;
        }

        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, description })
            });

            const data = await response.json();

            if (data.success) {
                closeModals();
                createProjectForm.reset();
                await loadProjects(); // Перезагружаем список проектов
            } else {
                alert(data.message || 'Ошибка при создании проекта');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Произошла ошибка при создании проекта');
        }
    });

    // Загрузка проектов
    async function loadProjects() {
        try {
            loadingSpinner.style.display = 'block';
            
            const response = await fetch('/api/projects');
            const projects = await response.json();

            renderProjects(projects);
        } catch (error) {
            console.error('Error:', error);
            projectsGrid.innerHTML = '<div class="empty-state"><p>Ошибка при загрузке проектов</p></div>';
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    // Отображение проектов
    function renderProjects(projects) {
        if (!projects || projects.length === 0) {
            projectsGrid.innerHTML = `
                <div class="empty-state">
                    <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="9" y1="21" x2="9" y2="9"></line>
                    </svg>
                    <h3>Нет проектов</h3>
                    <p>Создайте свой первый проект</p>
                    <button class="empty-state-btn" onclick="document.getElementById('createProjectBtn').click()">
                        Создать проект
                    </button>
                </div>
            `;
            return;
        }

        projectsGrid.innerHTML = projects.map(project => `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-card-header">
                    <h3 class="project-name">${escapeHtml(project.name)}</h3>
                    <button class="project-menu-btn" onclick="event.stopPropagation(); showContextMenu(event, ${project.id})">⋮</button>
                </div>
                <p class="project-description">${escapeHtml(project.description || 'Нет описания')}</p>
                <div class="project-footer">
                    <span class="project-date">${formatDate(project.created_at)}</span>
                    <span class="project-status ${project.status === 'completed' ? 'completed' : ''}">
                        ${project.status === 'completed' ? 'Завершен' : 'Активный'}
                    </span>
                </div>
            </div>
        `).join('');

        // Добавляем обработчики для карточек проектов
        document.querySelectorAll('.project-card').forEach(card => {
            card.addEventListener('click', function(e) {
                if (!e.target.classList.contains('project-menu-btn')) {
                    const projectId = this.dataset.projectId;
                    // Здесь можно перейти на страницу проекта
                    console.log('Open project:', projectId);
                }
            });
        });

        // В функции renderProjects, после создания карточек:
        document.querySelectorAll('.project-card').forEach(card => {
            card.addEventListener('click', function(e) {
                if (!e.target.classList.contains('project-menu-btn')) {
                    const projectId = this.dataset.projectId;
                    // Здесь можно перейти на страницу проекта
                    console.log('Open project:', projectId);
                }
            });
            
            // Добавляем обработчик двойного клика
            card.addEventListener('dblclick', function() {
                const projectId = this.dataset.projectId;
                window.location.href = `/project/${projectId}`;
            });
        });
    }

    // Показать контекстное меню
    window.showContextMenu = function(event, projectId) {
        event.stopPropagation();
        
        // Скрываем предыдущее меню
        contextMenu.classList.remove('show');
        
        // Сохраняем текущий проект
        currentProjectId = projectId;
        selectedProjectCard = event.target.closest('.project-card');
        
        // Позиционируем меню
        const rect = event.target.getBoundingClientRect();
        contextMenu.style.top = `${rect.bottom + window.scrollY}px`;
        contextMenu.style.left = `${rect.left + window.scrollX - 140}px`;
        
        // Показываем меню
        setTimeout(() => {
            contextMenu.classList.add('show');
        }, 10);
    };

    // Обработчики контекстного меню
    document.querySelector('.edit-project').addEventListener('click', function() {
        if (currentProjectId) {
            editProject(currentProjectId);
        }
        contextMenu.classList.remove('show');
    });

    document.querySelector('.delete-project').addEventListener('click', function() {
        if (currentProjectId) {
            deleteProject(currentProjectId);
        }
        contextMenu.classList.remove('show');
    });

    // Редактирование проекта
    async function editProject(projectId) {
        try {
            // Получаем данные проекта из карточки
            const card = document.querySelector(`[data-project-id="${projectId}"]`);
            const name = card.querySelector('.project-name').textContent;
            const description = card.querySelector('.project-description').textContent;
            
            // Заполняем форму редактирования
            document.getElementById('editProjectId').value = projectId;
            document.getElementById('editProjectName').value = name;
            document.getElementById('editProjectDescription').value = description === 'Нет описания' ? '' : description;
            
            // Показываем модальное окно
            editModal.classList.add('show');
        } catch (error) {
            console.error('Error:', error);
            alert('Ошибка при загрузке данных проекта');
        }
    }

    // Сохранение изменений проекта
    editProjectForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const projectId = document.getElementById('editProjectId').value;
        const name = document.getElementById('editProjectName').value.trim();
        const description = document.getElementById('editProjectDescription').value.trim();

        if (!name) {
            alert('Введите название проекта');
            return;
        }

        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, description })
            });

            const data = await response.json();

            if (data.success) {
                closeModals();
                await loadProjects(); // Перезагружаем список
            } else {
                alert(data.message || 'Ошибка при обновлении проекта');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Произошла ошибка при обновлении проекта');
        }
    });

    // Удаление проекта
    async function deleteProject(projectId) {
        if (!confirm('Вы уверены, что хотите удалить этот проект?')) {
            return;
        }

        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                await loadProjects(); // Перезагружаем список
            } else {
                alert(data.message || 'Ошибка при удалении проекта');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Произошла ошибка при удалении проекта');
        }
    }

    // Вспомогательные функции
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Сегодня';
        } else if (diffDays === 1) {
            return 'Вчера';
        } else if (diffDays < 7) {
            return `${diffDays} дня назад`;
        } else {
            return date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }
    }

    // Закрытие контекстного меню при скролле
    window.addEventListener('scroll', function() {
        contextMenu.classList.remove('show');
    });

    // Обновляем активную ссылку в навигации
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === '/projects') {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
});