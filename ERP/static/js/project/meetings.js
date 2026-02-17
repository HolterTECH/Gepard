// Состояние приложения
let currentProjectId = window.projectId;
let meetings = [];
let questions = [];
let teamMembers = [];
let currentMeeting = null;
let currentTab = 'upcoming';

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    loadMeetings();
    loadQuestions();
    loadTeamMembers();
    setupEventListeners();
});

// Настройка обработчиков событий
function setupEventListeners() {
    // Переключение вкладок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentTab = this.dataset.tab;
            renderMeetings();
        });
    });

    // Кнопка создания совещания
    document.getElementById('createMeetingBtn').addEventListener('click', showCreateMeetingModal);
    
    // Кнопка открытия реестра вопросов
    const registryBtn = document.createElement('button');
    registryBtn.className = 'create-btn registry-btn';
    registryBtn.innerHTML = '📋 Реестр вопросов';
    registryBtn.style.marginLeft = '10px';
    registryBtn.addEventListener('click', showQuestionRegistryModal);
    document.querySelector('.section-header').appendChild(registryBtn);
}

// Загрузка данных
async function loadMeetings() {
    try {
        const response = await fetch(`/api/project/${currentProjectId}/meetings`);
        meetings = await response.json();
        renderMeetings();
    } catch (error) {
        showNotification('Ошибка загрузки совещаний', 'error');
    }
}

async function loadQuestions() {
    try {
        const response = await fetch(`/api/project/${currentProjectId}/questions`);
        questions = await response.json();
    } catch (error) {
        showNotification('Ошибка загрузки вопросов', 'error');
    }
}

async function loadTeamMembers() {
    try {
        const response = await fetch(`/api/project/${currentProjectId}/team`);
        teamMembers = await response.json();
    } catch (error) {
        showNotification('Ошибка загрузки команды', 'error');
    }
}

// Рендеринг совещаний
function renderMeetings() {
    const container = document.getElementById(`${currentTab}Meetings`);
    if (!container) return;
    
    const filteredMeetings = meetings.filter(meeting => {
        const meetingDate = new Date(meeting.meeting_date);
        const now = new Date();
        if (currentTab === 'upcoming') {
            return meetingDate >= now;
        } else {
            return meetingDate < now;
        }
    });
    
    if (filteredMeetings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Нет ${currentTab === 'upcoming' ? 'предстоящих' : 'прошедших'} совещаний</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredMeetings.map(meeting => `
        <div class="meeting-card ${meeting.meeting_date < new Date().toISOString() ? 'past' : ''}" 
             data-meeting-id="${meeting.id}">
            <div class="meeting-time">
                <span class="meeting-date">${formatDate(meeting.meeting_date)}</span>
                <span class="meeting-time">${formatTime(meeting.meeting_date)}</span>
            </div>
            <div class="meeting-info" onclick="openMeetingDetails(${meeting.id})">
                <h3 class="meeting-title">${escapeHtml(meeting.title)}</h3>
                <p class="meeting-description">${escapeHtml(meeting.description || '')}</p>
                <div class="meeting-meta">
                    <span class="meeting-location">📍 ${escapeHtml(meeting.location || 'Не указано')}</span>
                    <span class="meeting-participants">👥 ${meeting.participants_count || 0} участников</span>
                    <span class="meeting-questions">📋 ${meeting.questions_count || 0} вопросов</span>
                </div>
            </div>
            <div class="meeting-actions">
                <button class="action-btn" onclick="editMeeting(${meeting.id})">✎</button>
                <button class="action-btn" onclick="deleteMeeting(${meeting.id})">🗑</button>
            </div>
        </div>
    `).join('');
}

// Модальное окно создания совещания
function showCreateMeetingModal() {
    const modal = createModal(`
        <h2>Новое совещание</h2>
        <form id="createMeetingForm">
            <div class="form-group">
                <label>Тема совещания *</label>
                <input type="text" id="meetingTitle" required>
            </div>
            <div class="form-group">
                <label>Описание</label>
                <textarea id="meetingDescription" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label>Дата и время *</label>
                <input type="datetime-local" id="meetingDateTime" required>
            </div>
            <div class="form-group">
                <label>Длительность (минуты)</label>
                <input type="number" id="meetingDuration" value="60" min="15" step="15">
            </div>
            <div class="form-group">
                <label>Место проведения</label>
                <input type="text" id="meetingLocation" placeholder="Например: Zoom, переговорка">
            </div>
            <div class="form-group">
                <label>Участники</label>
                <div class="participants-selector" id="participantsSelector">
                    ${teamMembers.map(member => `
                        <label class="participant-checkbox">
                            <input type="checkbox" value="${member.id}">
                            <span class="participant-name">${escapeHtml(member.name)}</span>
                            <span class="participant-role">${escapeHtml(member.role)}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="cancel-btn" onclick="closeModal()">Отмена</button>
                <button type="submit" class="create-btn">Создать</button>
            </div>
        </form>
    `);
    
    document.getElementById('createMeetingForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const meetingData = {
            title: document.getElementById('meetingTitle').value,
            description: document.getElementById('meetingDescription').value,
            meeting_date: document.getElementById('meetingDateTime').value,
            duration: parseInt(document.getElementById('meetingDuration').value),
            location: document.getElementById('meetingLocation').value
        };
        
        try {
            const response = await fetch(`/api/project/${currentProjectId}/meetings`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(meetingData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Добавляем участников
                const selectedParticipants = Array.from(document.querySelectorAll('#participantsSelector input:checked'))
                    .map(cb => cb.value);
                
                for (const memberId of selectedParticipants) {
                    await fetch(`/api/meetings/${result.meeting_id}/participants`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({team_member_id: memberId})
                    });
                }
                
                showNotification('Совещание создано', 'success');
                closeModal();
                loadMeetings();
            }
        } catch (error) {
            showNotification('Ошибка создания совещания', 'error');
        }
    });
}

// Модальное окно реестра вопросов
function showQuestionRegistryModal() {
    loadQuestions(); // Обновляем список вопросов
    
    const modal = createModal(`
        <h2>Реестр вопросов</h2>
        <div class="registry-toolbar">
            <button class="create-btn" onclick="showCreateQuestionModal()">+ Новый вопрос</button>
            <div class="registry-filters">
                <select id="statusFilter" onchange="filterQuestions()">
                    <option value="all">Все статусы</option>
                    <option value="pending">Ожидает решения</option>
                    <option value="scheduled">Запланировано</option>
                    <option value="resolved">Решено</option>
                    <option value="unresolved">Не решено</option>
                </select>
            </div>
        </div>
        <div class="registry-table-container">
            <table class="registry-table">
                <thead>
                    <tr>
                        <th>Тема</th>
                        <th>Дата создания</th>
                        <th>Статус</th>
                        <th>Совещание</th>
                        <th>Решение</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody id="registryTableBody">
                    ${renderRegistryRows(questions)}
                </tbody>
            </table>
        </div>
    `);
}

function renderRegistryRows(questions) {
    if (questions.length === 0) {
        return `<tr><td colspan="6" class="empty-state">Нет вопросов</td></tr>`;
    }
    
    return questions.map(q => `
        <tr>
            <td>${escapeHtml(q.topic)}</td>
            <td>${formatDate(q.created_date)}</td>
            <td>
                <span class="status-badge ${q.status}">
                    ${getStatusText(q.status)}
                </span>
            </td>
            <td>${q.meeting_title ? escapeHtml(q.meeting_title) : '-'}</td>
            <td>${q.resolution ? escapeHtml(q.resolution.substring(0, 50)) + '...' : '-'}</td>
            <td class="actions-cell">
                <button class="icon-btn" onclick="editQuestion(${q.id})" title="Редактировать">✎</button>
                <button class="icon-btn" onclick="deleteQuestion(${q.id})" title="Удалить">🗑</button>
            </td>
        </tr>
    `).join('');
}

function filterQuestions() {
    const status = document.getElementById('statusFilter').value;
    const filtered = status === 'all' 
        ? questions 
        : questions.filter(q => q.status === status);
    
    document.getElementById('registryTableBody').innerHTML = renderRegistryRows(filtered);
}

function showCreateQuestionModal(meetingId = null) {
    const modal = createModal(`
        <h2>Новый вопрос</h2>
        <form id="createQuestionForm">
            <div class="form-group">
                <label>Тема *</label>
                <input type="text" id="questionTopic" required>
            </div>
            <div class="form-group">
                <label>Описание</label>
                <textarea id="questionDescription" rows="3"></textarea>
            </div>
            ${meetingId ? '<input type="hidden" id="questionMeetingId" value="' + meetingId + '">' : ''}
            <div class="modal-actions">
                <button type="button" class="cancel-btn" onclick="closeModal()">Отмена</button>
                <button type="submit" class="create-btn">Создать</button>
            </div>
        </form>
    `);
    
    document.getElementById('createQuestionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const questionData = {
            topic: document.getElementById('questionTopic').value,
            description: document.getElementById('questionDescription').value,
            status: 'pending',
            meeting_id: document.getElementById('questionMeetingId')?.value || null
        };
        
        try {
            const response = await fetch(`/api/project/${currentProjectId}/questions`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(questionData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification('Вопрос создан', 'success');
                closeModal();
                loadQuestions();
            }
        } catch (error) {
            showNotification('Ошибка создания вопроса', 'error');
        }
    });
}

async function deleteQuestion(questionId) {
    if (!confirm('Вы уверены, что хотите удалить этот вопрос?')) return;
    
    try {
        const response = await fetch(`/api/questions/${questionId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Вопрос удален', 'success');
            loadQuestions();
        }
    } catch (error) {
        showNotification('Ошибка удаления вопроса', 'error');
    }
}

// Детальная страница совещания
async function openMeetingDetails(meetingId) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    
    currentMeeting = meeting;
    
    // Загружаем участников и вопросы
    const [participants, meetingQuestions] = await Promise.all([
        fetch(`/api/meetings/${meetingId}/participants`).then(r => r.json()),
        fetch(`/api/meetings/${meetingId}/questions`).then(r => r.json())
    ]);
    
    const modal = createModal(`
        <h2>${escapeHtml(meeting.title)}</h2>
        <div class="meeting-details">
            <div class="meeting-info-block">
                <p><strong>📅 Дата:</strong> ${formatDate(meeting.meeting_date)} ${formatTime(meeting.meeting_date)}</p>
                <p><strong>⏱ Длительность:</strong> ${meeting.duration || 60} мин</p>
                <p><strong>📍 Место:</strong> ${escapeHtml(meeting.location || 'Не указано')}</p>
                <p><strong>📝 Описание:</strong> ${escapeHtml(meeting.description || '')}</p>
            </div>
            
            <div class="meeting-section">
                <h3>Участники</h3>
                <button class="add-btn" onclick="manageParticipants(${meetingId})">+ Управлять участниками</button>
                <div class="participants-list">
                    ${participants.map(p => `
                        <div class="participant-item ${p.attended ? 'attended' : ''}">
                            <span class="participant-name">${escapeHtml(p.name)}</span>
                            <span class="participant-role">${escapeHtml(p.role)}</span>
                            <span class="attendance-badge">${p.attended ? '✅ Был' : '⭕ Не был'}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="meeting-section">
                <h3>Вопросы для обсуждения</h3>
                <button class="add-btn" onclick="addQuestionToMeeting(${meetingId})">+ Добавить вопрос</button>
                <div class="questions-list">
                    ${meetingQuestions.map(q => `
                        <div class="question-item ${q.discussed ? 'discussed' : ''}">
                            <div class="question-header">
                                <strong>${escapeHtml(q.topic)}</strong>
                                <span class="question-status ${q.status}">${getStatusText(q.status)}</span>
                            </div>
                            <p class="question-description">${escapeHtml(q.description || '')}</p>
                            ${q.discussed ? `
                                <div class="question-resolution">
                                    <strong>Решение:</strong> ${escapeHtml(q.resolution_notes || '')}
                                </div>
                            ` : ''}
                            <div class="question-actions">
                                <button class="icon-btn" onclick="editQuestionInMeeting(${q.id})">✎</button>
                                <button class="icon-btn" onclick="removeQuestionFromMeeting(${q.id})">🗑</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="modal-actions">
                <button type="button" class="cancel-btn" onclick="closeModal()">Закрыть</button>
                ${new Date(meeting.meeting_date) < new Date() ? `
                    <button type="button" class="create-btn" onclick="completeMeeting(${meetingId})">
                        Завершить совещание
                    </button>
                ` : ''}
            </div>
        </div>
    `);
}

async function manageParticipants(meetingId) {
    const participants = await fetch(`/api/meetings/${meetingId}/participants`).then(r => r.json());
    
    const modal = createModal(`
        <h2>Управление участниками</h2>
        <div class="participants-manager">
            ${teamMembers.map(member => {
                const participant = participants.find(p => p.team_member_id === member.id);
                return `
                    <div class="participant-row">
                        <span class="participant-info">
                            <strong>${escapeHtml(member.name)}</strong>
                            <span class="role">${escapeHtml(member.role)}</span>
                        </span>
                        <div class="participant-controls">
                            <label class="attended-checkbox">
                                <input type="checkbox" 
                                       ${participant ? 'checked' : ''}
                                       onchange="toggleParticipant(${meetingId}, ${member.id}, this.checked)">
                                Пригласить
                            </label>
                            ${participant ? `
                                <label class="attended-checkbox">
                                    <input type="checkbox" 
                                           ${participant.attended ? 'checked' : ''}
                                           onchange="setParticipantAttended(${participant.id}, this.checked)">
                                    Был на совещании
                                </label>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="modal-actions">
            <button type="button" class="cancel-btn" onclick="closeModal()">Закрыть</button>
        </div>
    `);
}

async function toggleParticipant(meetingId, memberId, add) {
    if (add) {
        await fetch(`/api/meetings/${meetingId}/participants`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({team_member_id: memberId})
        });
    } else {
        const participants = await fetch(`/api/meetings/${meetingId}/participants`).then(r => r.json());
        const participant = participants.find(p => p.team_member_id === memberId);
        if (participant) {
            await fetch(`/api/meeting-participants/${participant.id}`, {
                method: 'DELETE'
            });
        }
    }
    showNotification('Участники обновлены', 'success');
}

async function setParticipantAttended(participantId, attended) {
    await fetch(`/api/meeting-participants/${participantId}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({attended: attended ? 1 : 0})
    });
    showNotification('Статус участника обновлен', 'success');
}

async function addQuestionToMeeting(meetingId) {
    const modal = createModal(`
        <h2>Добавить вопрос в совещание</h2>
        <div class="question-selector">
            <div class="form-group">
                <label>Выберите из реестра</label>
                <select id="existingQuestionSelect">
                    <option value="">-- Создать новый вопрос --</option>
                    ${questions.filter(q => q.status === 'pending').map(q => `
                        <option value="${q.id}">${escapeHtml(q.topic)}</option>
                    `).join('')}
                </select>
            </div>
            
            <div id="newQuestionFields" class="form-group">
                <label>Новый вопрос</label>
                <input type="text" id="newQuestionTopic" placeholder="Тема вопроса">
                <textarea id="newQuestionDescription" placeholder="Описание" rows="2"></textarea>
            </div>
        </div>
        <div class="modal-actions">
            <button type="button" class="cancel-btn" onclick="closeModal()">Отмена</button>
            <button type="button" class="create-btn" onclick="submitAddQuestionToMeeting(${meetingId})">Добавить</button>
        </div>
    `);
    
    document.getElementById('existingQuestionSelect').addEventListener('change', function() {
        const newFields = document.getElementById('newQuestionFields');
        newFields.style.display = this.value ? 'none' : 'block';
    });
}

async function submitAddQuestionToMeeting(meetingId) {
    const select = document.getElementById('existingQuestionSelect');
    const isNew = !select.value;
    
    const data = {
        is_new: isNew,
        project_id: currentProjectId
    };
    
    if (isNew) {
        data.topic = document.getElementById('newQuestionTopic').value;
        data.description = document.getElementById('newQuestionDescription').value;
        if (!data.topic) {
            showNotification('Введите тему вопроса', 'error');
            return;
        }
    } else {
        data.question_id = select.value;
    }
    
    try {
        const response = await fetch(`/api/meetings/${meetingId}/questions`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Вопрос добавлен в совещание', 'success');
            closeModal();
            loadQuestions();
            openMeetingDetails(meetingId);
        }
    } catch (error) {
        showNotification('Ошибка добавления вопроса', 'error');
    }
}

// Вспомогательные функции
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('ru-RU');
}

function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Ожидает решения',
        'scheduled': 'Запланировано',
        'resolved': 'Решено',
        'unresolved': 'Не решено'
    };
    return statusMap[status] || status;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Глобальные функции для модальных окон
let currentModal = null;

function createModal(content) {
    if (currentModal) {
        currentModal.remove();
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    
    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.innerHTML = content;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    currentModal = overlay;
    
    // Закрытие по клику вне модального окна
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
    
    return modal;
}

function closeModal() {
    if (currentModal) {
        currentModal.remove();
        currentModal = null;
    }
}

// Функции для работы с совещаниями
async function editMeeting(meetingId) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    
    // Загружаем участников
    const participants = await fetch(`/api/meetings/${meetingId}/participants`).then(r => r.json());
    
    const modal = createModal(`
        <h2>Редактировать совещание</h2>
        <form id="editMeetingForm">
            <div class="form-group">
                <label>Тема совещания *</label>
                <input type="text" id="meetingTitle" value="${escapeHtml(meeting.title)}" required>
            </div>
            <div class="form-group">
                <label>Описание</label>
                <textarea id="meetingDescription" rows="3">${escapeHtml(meeting.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Дата и время *</label>
                <input type="datetime-local" id="meetingDateTime" value="${meeting.meeting_date.slice(0,16)}" required>
            </div>
            <div class="form-group">
                <label>Длительность (минуты)</label>
                <input type="number" id="meetingDuration" value="${meeting.duration || 60}" min="15" step="15">
            </div>
            <div class="form-group">
                <label>Место проведения</label>
                <input type="text" id="meetingLocation" value="${escapeHtml(meeting.location || '')}">
            </div>
            <div class="form-group">
                <label>Участники</label>
                <div class="participants-selector">
                    ${teamMembers.map(member => `
                        <label class="participant-checkbox">
                            <input type="checkbox" value="${member.id}"
                                   ${participants.some(p => p.team_member_id === member.id) ? 'checked' : ''}>
                            <span class="participant-name">${escapeHtml(member.name)}</span>
                            <span class="participant-role">${escapeHtml(member.role)}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="cancel-btn" onclick="closeModal()">Отмена</button>
                <button type="submit" class="create-btn">Сохранить</button>
            </div>
        </form>
    `);
    
    document.getElementById('editMeetingForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const meetingData = {
            title: document.getElementById('meetingTitle').value,
            description: document.getElementById('meetingDescription').value,
            meeting_date: document.getElementById('meetingDateTime').value,
            duration: parseInt(document.getElementById('meetingDuration').value),
            location: document.getElementById('meetingLocation').value
        };
        
        try {
            const response = await fetch(`/api/meetings/${meetingId}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(meetingData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Обновляем участников
                const selectedParticipants = Array.from(document.querySelectorAll('.participants-selector input:checked'))
                    .map(cb => cb.value);
                
                // Удаляем старых участников
                for (const p of participants) {
                    await fetch(`/api/meeting-participants/${p.id}`, {
                        method: 'DELETE'
                    });
                }
                
                // Добавляем новых
                for (const memberId of selectedParticipants) {
                    await fetch(`/api/meetings/${meetingId}/participants`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({team_member_id: memberId})
                    });
                }
                
                showNotification('Совещание обновлено', 'success');
                closeModal();
                loadMeetings();
            }
        } catch (error) {
            showNotification('Ошибка обновления совещания', 'error');
        }
    });
}

async function deleteMeeting(meetingId) {
    if (!confirm('Вы уверены, что хотите удалить это совещание?')) return;
    
    try {
        const response = await fetch(`/api/meetings/${meetingId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Совещание удалено', 'success');
            loadMeetings();
        }
    } catch (error) {
        showNotification('Ошибка удаления совещания', 'error');
    }
}

async function completeMeeting(meetingId) {
    if (!confirm('Завершить совещание? После завершения вы сможете отметить, кто был на совещании и записать решения.')) return;
    
    const meeting = meetings.find(m => m.id === meetingId);
    const participants = await fetch(`/api/meetings/${meetingId}/participants`).then(r => r.json());
    const meetingQuestions = await fetch(`/api/meetings/${meetingId}/questions`).then(r => r.json());
    
    const modal = createModal(`
        <h2>Завершение совещания: ${escapeHtml(meeting.title)}</h2>
        <form id="completeMeetingForm">
            <div class="meeting-section">
                <h3>Отметка присутствия</h3>
                <div class="participants-check-list">
                    ${participants.map(p => `
                        <label class="participant-check">
                            <input type="checkbox" class="attended-check" data-participant-id="${p.id}" checked>
                            <span class="participant-name">${escapeHtml(p.name)}</span>
                            <span class="participant-role">${escapeHtml(p.role)}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            
            <div class="meeting-section">
                <h3>Решения по вопросам</h3>
                <div class="questions-resolution-list">
                    ${meetingQuestions.map(q => `
                        <div class="question-resolution-item">
                            <div class="question-header">
                                <strong>${escapeHtml(q.topic)}</strong>
                            </div>
                            <div class="question-resolution-controls">
                                <label>
                                    <input type="radio" name="question_${q.id}" value="resolved" checked>
                                    Решено
                                </label>
                                <label>
                                    <input type="radio" name="question_${q.id}" value="unresolved">
                                    Не решено
                                </label>
                                <textarea class="resolution-notes" data-question-id="${q.id}" 
                                          placeholder="Заметки по решению..."></textarea>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="modal-actions">
                <button type="button" class="cancel-btn" onclick="closeModal()">Отмена</button>
                <button type="submit" class="create-btn">Завершить</button>
            </div>
        </form>
    `);
    
    document.getElementById('completeMeetingForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Обновляем статус участников
        document.querySelectorAll('.attended-check').forEach(async (check) => {
            const participantId = check.dataset.participantId;
            await fetch(`/api/meeting-participants/${participantId}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({attended: check.checked ? 1 : 0})
            });
        });
        
        // Обновляем решения по вопросам
        for (const q of meetingQuestions) {
            const status = document.querySelector(`input[name="question_${q.id}"]:checked`)?.value;
            const notes = document.querySelector(`.resolution-notes[data-question-id="${q.id}"]`)?.value;
            
            if (status) {
                await fetch(`/api/meeting-questions/${q.id}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        discussed: 1,
                        resolution_notes: notes
                    })
                });
            }
        }
        
        showNotification('Совещание завершено', 'success');
        closeModal();
        loadMeetings();
        loadQuestions();
    });
}