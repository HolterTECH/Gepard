document.addEventListener('DOMContentLoaded', function() {
    // Загрузка данных для главной страницы
    loadDashboardData();

    async function loadDashboardData() {
        try {
            // Загрузка статистики
            const tasksResponse = await fetch(`/api/project/${projectId}/tasks`);
            const tasks = await tasksResponse.json();
            
            // Обновляем статистику
            updateStats(tasks);
            
            // Загружаем ближайшие задачи
            updateUpcomingTasks(tasks);
            
            // Загружаем последние совещания
            loadRecentMeetings();
            
            // Загружаем активность
            loadActivity();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    function updateStats(tasks) {
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'done').length;
        const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
        
        document.getElementById('totalTasks').textContent = totalTasks;
        document.getElementById('completedTasks').textContent = completedTasks;
        document.getElementById('inProgressTasks').textContent = inProgressTasks;
        // Количество участников пока заглушка
        document.getElementById('teamMembers').textContent = '4';
    }

    function updateUpcomingTasks(tasks) {
        const upcomingContainer = document.getElementById('upcomingTasks');
        const now = new Date();
        
        // Фильтруем задачи с датой и сортируем по ближайшей
        const upcomingTasks = tasks
            .filter(t => t.due_date && t.status !== 'done')
            .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
            .slice(0, 5);

        if (upcomingTasks.length === 0) {
            upcomingContainer.innerHTML = '<p class="placeholder-text">Нет ближайших задач</p>';
            return;
        }

        upcomingContainer.innerHTML = upcomingTasks.map(task => `
            <div class="task-item-mini">
                <span class="task-title">${escapeHtml(task.title)}</span>
                <span class="task-due">${formatDate(task.due_date)}</span>
            </div>
        `).join('');
    }

    async function loadRecentMeetings() {
        // Здесь будет загрузка совещаний из API
        const meetingsContainer = document.getElementById('recentMeetings');
        // Пока заглушка
        meetingsContainer.innerHTML = '<p class="placeholder-text">Нет запланированных совещаний</p>';
    }

    async function loadActivity() {
        const activityContainer = document.getElementById('activityList');
        // Пока заглушка
        activityContainer.innerHTML = `
            <div class="activity-item">
                <span class="activity-time">Только что</span>
                <span class="activity-text">Создана задача "Разработка интерфейса"</span>
            </div>
            <div class="activity-item">
                <span class="activity-time">2 часа назад</span>
                <span class="activity-text">Завершена задача "Настройка сервера"</span>
            </div>
        `;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short'
        });
    }
});