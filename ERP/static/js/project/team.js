document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const addMemberBtn = document.getElementById('addTeamMemberBtn');
    const memberModal = document.getElementById('teamMemberModal');
    const closeMemberModal = document.getElementById('closeMemberModal');
    const cancelMemberBtn = document.getElementById('cancelMemberBtn');
    const memberForm = document.getElementById('teamMemberForm');
    const modalTitle = document.getElementById('modalTitle');
    const memberId = document.getElementById('memberId');
    const statusGroup = document.getElementById('statusGroup');
    
    const roleInput = document.getElementById('memberRole');
    const roleSuggestions = document.getElementById('roleSuggestions');
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    const deleteModal = document.getElementById('deleteConfirmModal');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const deleteMemberName = document.getElementById('deleteMemberName');

    let currentMemberId = null;
    let roles = [];

    // Загрузка данных
    loadTeamMembers();
    loadRoles();

    // Переключение вкладок
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            this.classList.add('active');
            document.getElementById(`${tab}-tab`).classList.add('active');
            
            if (tab === 'workload') {
                loadWorkloadData();
            }
        });
    });

    // Открытие модального окна для добавления
    addMemberBtn.addEventListener('click', function() {
        openMemberModal();
    });

    // Закрытие модальных окон
    closeMemberModal.addEventListener('click', closeMemberModal_);
    cancelMemberBtn.addEventListener('click', closeMemberModal_);
    
    closeDeleteModal.addEventListener('click', closeDeleteModal_);
    cancelDeleteBtn.addEventListener('click', closeDeleteModal_);

    function closeMemberModal_() {
        memberModal.classList.remove('show');
        memberForm.reset();
        memberId.value = '';
        modalTitle.textContent = 'Добавить участника';
        statusGroup.style.display = 'none';
    }

    function closeDeleteModal_() {
        deleteModal.classList.remove('show');
        currentMemberId = null;
    }

    // Закрытие по клику вне модального окна
    window.addEventListener('click', function(e) {
        if (e.target === memberModal) closeMemberModal_();
        if (e.target === deleteModal) closeDeleteModal_();
    });

    // Автодополнение должностей
    roleInput.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        if (value.length < 1) {
            roleSuggestions.classList.remove('show');
            return;
        }

        const filtered = roles.filter(role => 
            role.toLowerCase().includes(value)
        ).slice(0, 8);

        if (filtered.length > 0) {
            showRoleSuggestions(filtered);
        } else {
            roleSuggestions.classList.remove('show');
        }
    });

    roleInput.addEventListener('focus', function() {
        if (this.value.length >= 1) {
            const filtered = roles.filter(role => 
                role.toLowerCase().includes(this.value.toLowerCase())
            ).slice(0, 8);
            if (filtered.length > 0) {
                showRoleSuggestions(filtered);
            }
        }
    });

    document.addEventListener('click', function(e) {
        if (!roleInput.contains(e.target) && !roleSuggestions.contains(e.target)) {
            roleSuggestions.classList.remove('show');
        }
    });

    function showRoleSuggestions(suggestions) {
        roleSuggestions.innerHTML = suggestions.map(role => 
            `<div class="suggestion-item">${escapeHtml(role)}</div>`
        ).join('');
        
        roleSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', function() {
                roleInput.value = this.textContent;
                roleSuggestions.classList.remove('show');
            });
        });
        
        roleSuggestions.classList.add('show');
    }

    // Отправка формы
    memberForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const memberData = {
            name: document.getElementById('memberName').value,
            role: document.getElementById('memberRole').value,
            email: document.getElementById('memberEmail').value,
            phone: document.getElementById('memberPhone').value
        };

        if (memberId.value) {
            memberData.status = document.getElementById('memberStatus').value;
        }

        try {
            let response;
            if (memberId.value) {
                // Обновление
                response = await fetch(`/api/team/${memberId.value}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(memberData)
                });
            } else {
                // Создание
                response = await fetch(`/api/project/${projectId}/team`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(memberData)
                });
            }

            const data = await response.json();

            if (data.success) {
                closeMemberModal_();
                loadTeamMembers();
                loadRoles(); // Обновляем список ролей
            } else {
                alert(data.message || 'Ошибка при сохранении');
            }
        } catch (error) {
            console.error('Error saving team member:', error);
            alert('Ошибка при сохранении');
        }
    });

    // Загрузка участников команды
    async function loadTeamMembers() {
        try {
            const response = await fetch(`/api/project/${projectId}/team`);
            const members = await response.json();
            
            renderTeamMembers(members);
            updateStats(members);
            renderRoles(members);
        } catch (error) {
            console.error('Error loading team members:', error);
        }
    }

    // Загрузка ролей для автодополнения
    async function loadRoles() {
        try {
            const response = await fetch('/api/roles');
            roles = await response.json();
        } catch (error) {
            console.error('Error loading roles:', error);
        }
    }

    // Отображение участников
    function renderTeamMembers(members) {
        const teamGrid = document.getElementById('teamGrid');
        
        if (!members || members.length === 0) {
            teamGrid.innerHTML = `
                <div class="empty-state">
                    <p>В команде пока нет участников</p>
                    <button class="create-btn" onclick="document.getElementById('addTeamMemberBtn').click()">
                        Добавить первого участника
                    </button>
                </div>
            `;
            return;
        }

        teamGrid.innerHTML = members.map(member => `
            <div class="team-member-card" data-member-id="${member.id}">
                <div class="member-avatar">${getInitials(member.name)}</div>
                <div class="member-info">
                    <h3 class="member-name">${escapeHtml(member.name)}</h3>
                    <span class="member-role">${escapeHtml(member.role)}</span>
                    <div class="member-contact">
                        ${member.email ? `<span>✉️ ${escapeHtml(member.email)}</span>` : ''}
                        ${member.phone ? `<span>📞 ${escapeHtml(member.phone)}</span>` : ''}
                    </div>
                    <span class="member-status ${member.status}">
                        ${member.status === 'active' ? '🟢 Активен' : '⚪ Неактивен'}
                    </span>
                </div>
                <div class="member-actions">
                    <button class="action-btn" onclick="event.stopPropagation(); editMember(${member.id})">✎</button>
                    <button class="action-btn delete" onclick="event.stopPropagation(); confirmDelete(${member.id}, '${escapeHtml(member.name)}')">🗑</button>
                </div>
            </div>
        `).join('');

        // Добавляем обработчик клика на карточку
        document.querySelectorAll('.team-member-card').forEach(card => {
            card.addEventListener('click', function() {
                const id = this.dataset.memberId;
                editMember(id);
            });
        });
    }

    // Обновление статистики
    function updateStats(members) {
        const total = members.length;
        const active = members.filter(m => m.status === 'active').length;
        const uniqueRoles = new Set(members.map(m => m.role)).size;

        document.getElementById('totalMembers').textContent = total;
        document.getElementById('activeMembers').textContent = active;
        document.getElementById('roleCount').textContent = uniqueRoles;
    }

    // Отображение ролей
    function renderRoles(members) {
        const roleCount = {};
        members.forEach(member => {
            roleCount[member.role] = (roleCount[member.role] || 0) + 1;
        });

        const sortedRoles = Object.entries(roleCount)
            .sort((a, b) => b[1] - a[1]);

        const rolesList = document.getElementById('rolesList');
        rolesList.innerHTML = sortedRoles.map(([role, count]) => `
            <div class="role-item">
                <span class="role-name">${escapeHtml(role)}</span>
                <span class="role-count">${count}</span>
            </div>
        `).join('');
    }

    // Загрузка данных загрузки
    async function loadWorkloadData() {
        try {
            const response = await fetch(`/api/project/${projectId}/team`);
            const members = await response.json();
            
            // Здесь будет загрузка задач для расчета загрузки
            const tasksResponse = await fetch(`/api/project/${projectId}/tasks`);
            const tasks = await tasksResponse.json();
            
            renderWorkload(members, tasks);
        } catch (error) {
            console.error('Error loading workload data:', error);
        }
    }

    // Отображение загрузки команды
    function renderWorkload(members, tasks) {
        const workloadList = document.getElementById('workloadList');
        
        if (!members || members.length === 0) {
            workloadList.innerHTML = `
                <div class="empty-state">
                    <p>Нет данных для отображения загрузки</p>
                </div>
            `;
            return;
        }

        // Распределяем задачи по участникам (упрощенно)
        const memberTasks = {};
        members.forEach(m => { memberTasks[m.id] = []; });
        
        tasks.forEach(task => {
            // Здесь должна быть логика назначения задач на участников
            // Пока распределяем случайно
            const randomMember = members[Math.floor(Math.random() * members.length)];
            if (randomMember) {
                memberTasks[randomMember.id].push(task);
            }
        });

        workloadList.innerHTML = members.map(member => {
            const memberTaskCount = memberTasks[member.id]?.length || 0;
            const workload = Math.min(memberTaskCount * 10, 100); // Упрощенный расчет
            
            let workloadStatus = 'normal';
            let statusText = 'Нормальная';
            
            if (workload > 80) {
                workloadStatus = 'critical';
                statusText = 'Критическая';
            } else if (workload > 50) {
                workloadStatus = 'high';
                statusText = 'Высокая';
            }

            return `
                <div class="workload-row">
                    <div class="member-name-cell">
                        <div class="member-avatar-small">${getInitials(member.name)}</div>
                        <span>${escapeHtml(member.name)}</span>
                    </div>
                    <div>${escapeHtml(member.role)}</div>
                    <div>
                        <div class="workload-bar-container">
                            <div class="workload-bar" style="width: ${workload}%"></div>
                        </div>
                        <span class="workload-value">${workload}%</span>
                    </div>
                    <div>${memberTaskCount} задач</div>
                    <div>
                        <span class="workload-status ${workloadStatus}">${statusText}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Редактирование участника
    window.editMember = async function(id) {
        try {
            const response = await fetch(`/api/project/${projectId}/team`);
            const members = await response.json();
            const member = members.find(m => m.id == id);
            
            if (member) {
                document.getElementById('memberId').value = member.id;
                document.getElementById('memberName').value = member.name;
                document.getElementById('memberRole').value = member.role;
                document.getElementById('memberEmail').value = member.email || '';
                document.getElementById('memberPhone').value = member.phone || '';
                document.getElementById('memberStatus').value = member.status;
                
                modalTitle.textContent = 'Редактировать участника';
                statusGroup.style.display = 'block';
                
                memberModal.classList.add('show');
            }
        } catch (error) {
            console.error('Error loading member:', error);
        }
    };

    // Подтверждение удаления
    window.confirmDelete = function(id, name) {
        currentMemberId = id;
        deleteMemberName.textContent = name;
        deleteModal.classList.add('show');
    };

    // Удаление участника
    confirmDeleteBtn.addEventListener('click', async function() {
        if (!currentMemberId) return;

        try {
            const response = await fetch(`/api/team/${currentMemberId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                closeDeleteModal_();
                loadTeamMembers();
                loadWorkloadData();
            } else {
                alert(data.message || 'Ошибка при удалении');
            }
        } catch (error) {
            console.error('Error deleting member:', error);
            alert('Ошибка при удалении');
        }
    });

    // Вспомогательные функции
    function getInitials(name) {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Обработка клавиши Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (memberModal.classList.contains('show')) closeMemberModal_();
            if (deleteModal.classList.contains('show')) closeDeleteModal_();
            roleSuggestions.classList.remove('show');
        }
    });
});

// Функция для открытия модального окна
function openMemberModal() {
    document.getElementById('memberId').value = '';
    document.getElementById('memberName').value = '';
    document.getElementById('memberRole').value = '';
    document.getElementById('memberEmail').value = '';
    document.getElementById('memberPhone').value = '';
    document.getElementById('modalTitle').textContent = 'Добавить участника';
    document.getElementById('statusGroup').style.display = 'none';
    document.getElementById('teamMemberModal').classList.add('show');
    document.getElementById('memberName').focus();
}