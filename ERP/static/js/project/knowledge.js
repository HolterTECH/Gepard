document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const sectionItems = document.querySelectorAll('.section-item');
    const currentSectionTitle = document.getElementById('currentSection');
    const createDocBtn = document.getElementById('createDocBtn');
    const addSectionBtn = document.getElementById('addSectionBtn');
    const documentModal = document.getElementById('documentModal');
    const sectionModal = document.getElementById('sectionModal');
    const closeDocModal = document.getElementById('closeDocModal');
    const closeSectionModal = document.getElementById('closeSectionModal');
    const cancelDocBtn = document.getElementById('cancelDocBtn');
    const cancelSectionBtn = document.getElementById('cancelSectionBtn');
    const documentForm = document.getElementById('documentForm');
    const sectionForm = document.getElementById('sectionForm');
    const searchInput = document.querySelector('.search-input');

    // Переключение между разделами
    sectionItems.forEach(item => {
        item.addEventListener('click', function() {
            // Убираем активный класс у всех
            sectionItems.forEach(si => si.classList.remove('active'));
            // Добавляем активный класс текущему
            this.classList.add('active');
            
            // Обновляем заголовок
            const sectionName = this.querySelector('.section-name').textContent;
            currentSectionTitle.textContent = sectionName;
            
            // Здесь будет загрузка документов раздела
            loadSectionDocuments(this.dataset.section);
        });
    });

    // Открытие модального окна создания документа
    createDocBtn.addEventListener('click', function() {
        documentModal.classList.add('show');
        document.getElementById('docTitle').focus();
    });

    // Открытие модального окна создания раздела
    addSectionBtn.addEventListener('click', function() {
        sectionModal.classList.add('show');
        document.getElementById('sectionName').focus();
    });

    // Закрытие модальных окон
    function closeModals() {
        documentModal.classList.remove('show');
        sectionModal.classList.remove('show');
        documentForm.reset();
        sectionForm.reset();
    }

    closeDocModal.addEventListener('click', closeModals);
    cancelDocBtn.addEventListener('click', closeModals);
    closeSectionModal.addEventListener('click', closeModals);
    cancelSectionBtn.addEventListener('click', closeModals);

    // Закрытие по клику вне модального окна
    window.addEventListener('click', function(e) {
        if (e.target === documentModal) closeModals();
        if (e.target === sectionModal) closeModals();
    });

    // Обработка формы создания документа
    documentForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Здесь будет отправка данных на сервер
        const docData = {
            title: document.getElementById('docTitle').value,
            section: document.getElementById('docSection').value,
            content: document.getElementById('docContent').value
        };
        
        console.log('Creating document:', docData);
        
        // Пока просто закрываем модальное окно
        closeModals();
        
        // Показываем уведомление
        showNotification('Документ создан', 'success');
    });

    // Обработка формы создания раздела
    sectionForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const sectionName = document.getElementById('sectionName').value;
        const sectionIcon = document.getElementById('sectionIcon').value || '📁';
        
        // Создаем новый элемент раздела
        const newSection = document.createElement('div');
        newSection.className = 'section-item';
        newSection.dataset.section = sectionName.toLowerCase().replace(/\s+/g, '_');
        newSection.innerHTML = `
            <span class="section-icon">${sectionIcon}</span>
            <span class="section-name">${escapeHtml(sectionName)}</span>
            <span class="section-count">0</span>
        `;
        
        // Добавляем обработчик клика
        newSection.addEventListener('click', function() {
            sectionItems.forEach(si => si.classList.remove('active'));
            this.classList.add('active');
            currentSectionTitle.textContent = sectionName;
            loadSectionDocuments(this.dataset.section);
        });
        
        // Вставляем перед кнопкой добавления
        const sectionsContainer = document.querySelector('.knowledge-sections');
        sectionsContainer.insertBefore(newSection, addSectionBtn);
        
        closeModals();
        showNotification('Раздел добавлен', 'success');
    });

    // Поиск по документам
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = this.value.toLowerCase();
                filterDocuments(query);
            }, 300);
        });
    }

    // Работа с тегами
    const tagInput = document.querySelector('.add-tag-input');
    if (tagInput) {
        tagInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && this.value.trim()) {
                e.preventDefault();
                addTag(this.value.trim());
                this.value = '';
            }
        });
    }

    function addTag(tagText) {
        const tagsContainer = document.getElementById('docTags');
        const newTag = document.createElement('span');
        newTag.className = 'tag';
        newTag.innerHTML = `${escapeHtml(tagText)} <span class="tag-remove">×</span>`;
        
        // Добавляем обработчик удаления
        newTag.querySelector('.tag-remove').addEventListener('click', function() {
            newTag.remove();
        });
        
        // Вставляем перед полем ввода
        tagsContainer.insertBefore(newTag, document.querySelector('.add-tag-input'));
    }

    // Удаление тегов
    document.querySelectorAll('.tag-remove').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.tag').remove();
        });
    });

    // Действия с документами
    document.querySelectorAll('.doc-action-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const action = this.title;
            const documentItem = this.closest('.document-item');
            const docTitle = documentItem.querySelector('.document-title').textContent;
            
            switch(action) {
                case 'Редактировать':
                    editDocument(documentItem);
                    break;
                case 'Скачать':
                    downloadDocument(docTitle);
                    break;
                case 'Удалить':
                    deleteDocument(documentItem, docTitle);
                    break;
            }
        });
    });

    // Функции для работы с документами
    function loadSectionDocuments(sectionId) {
        console.log('Loading documents for section:', sectionId);
        // Здесь будет загрузка документов с сервера
    }

    function filterDocuments(query) {
        const documents = document.querySelectorAll('.document-item');
        documents.forEach(doc => {
            const title = doc.querySelector('.document-title').textContent.toLowerCase();
            const tags = Array.from(doc.querySelectorAll('.tag')).map(t => t.textContent.toLowerCase());
            
            if (title.includes(query) || tags.some(t => t.includes(query))) {
                doc.style.display = 'flex';
            } else {
                doc.style.display = 'none';
            }
        });
    }

    function editDocument(docItem) {
        const title = docItem.querySelector('.document-title').textContent;
        document.getElementById('docTitle').value = title;
        documentModal.classList.add('show');
    }

    function downloadDocument(title) {
        showNotification(`Скачивание: ${title}`, 'info');
    }

    function deleteDocument(docItem, title) {
        if (confirm(`Удалить документ "${title}"?`)) {
            docItem.remove();
            showNotification('Документ удален', 'success');
        }
    }

    // Уведомления
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 24px;
            background: ${type === 'success' ? '#48bb78' : '#667eea'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Добавляем стили для уведомлений
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    // Функция для экранирования HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Обработка клавиши Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (documentModal.classList.contains('show')) closeModals();
            if (sectionModal.classList.contains('show')) closeModals();
        }
    });
});