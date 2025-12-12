import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs, Timestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- SUAS CHAVES ---
const firebaseConfig = {
    apiKey: "AIzaSyCICXCU3bgxoVK4kAXncxSWZHAazKFS65s",
    authDomain: "agenda-salao-bbddf.firebaseapp.com",
    projectId: "agenda-salao-bbddf",
    storageBucket: "agenda-salao-bbddf.firebasestorage.app",
    messagingSenderId: "977961284310",
    appId: "1:977961284310:web:de2776476262d942e68f77",
    measurementId: "G-WGP1LCJN9M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- ESTADO GLOBAL ---
let currentService = null;

// --- ELEMENTOS ---
const views = {
    services: document.getElementById('services-view'),
    booking: document.getElementById('booking-view'),
    listContainer: document.getElementById('services-list-container'),
    loader: document.getElementById('loading-services')
};

const bookingElements = {
    serviceName: document.getElementById('selectedServiceName'),
    professional: document.getElementById('professional'),
    calendarStrip: document.getElementById('calendarStrip'),
    monthLabel: document.getElementById('monthLabel'),
    selectedDateInput: document.getElementById('selectedDate'),
    slotsGrid: document.getElementById('slots-grid'),
    slotsLoader: document.getElementById('slots-loader'),
    selectedTimeInput: document.getElementById('selectedTime'),
    form: document.getElementById('bookingForm'),
    btn: document.getElementById('submitBtn'),
    msg: document.getElementById('message'),
    clientName: document.getElementById('clientName'),
    clientPhone: document.getElementById('clientPhone')
};

// --- 1. INICIALIZAÇÃO: CARREGAR LISTA DE SERVIÇOS ---
async function init() {
    views.loader.style.display = 'block';
    
    try {
        const q = query(collection(db, "procedimentos"), orderBy("nome"));
        const querySnapshot = await getDocs(q);

        views.listContainer.innerHTML = '';
        
        if (querySnapshot.empty) {
            views.listContainer.innerHTML = '<p style="text-align:center; color:#777;">Nenhum serviço disponível.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Cria o card do serviço (Igual imagem 1)
            const card = document.createElement('div');
            card.className = 'service-card';
            card.innerHTML = `
                <div class="service-info">
                    <h4>${data.nome}</h4>
                    <p><i class="far fa-clock"></i> ${data.duracao} min</p>
                    ${data.preco ? `<p class="service-price">R$ ${data.preco},00</p>` : ''} 
                </div>
                <button class="cta-btn" style="width: auto; padding: 8px 15px; font-size: 0.8rem;" onclick="selectService('${doc.id}', '${data.nome}', ${data.duracao})">
                    Reservar
                </button>
            `;
            views.listContainer.appendChild(card);
        });

    } catch (error) {
        console.error("Erro ao carregar serviços:", error);
        views.listContainer.innerHTML = '<p style="text-align:center; color:var(--error);">Erro ao carregar.</p>';
    } finally {
        views.loader.style.display = 'none';
    }
}

// --- 2. TRANSIÇÃO: SELECIONAR SERVIÇO ---
window.selectService = (id, nome, duracao) => {
    currentService = { id, nome, duracao };
    
    // Atualiza UI
    bookingElements.serviceName.textContent = nome;
    
    // Troca de tela
    views.services.classList.remove('active');
    views.booking.classList.add('active');

    // Carrega dependências da tela de agendamento
    loadProfessionals();
    renderCalendarStrip();
    bookingElements.slotsGrid.innerHTML = '<div style="grid-column: span 4; text-align: center; color: #555; padding: 10px;">Selecione data e profissional.</div>';
};

// --- 3. CARREGAR PROFISSIONAIS ---
async function loadProfessionals() {
    bookingElements.professional.innerHTML = '<option value="" disabled selected>Carregando...</option>';
    try {
        const q = query(collection(db, "profissionais"), orderBy("nome"));
        const querySnapshot = await getDocs(q);
        
        bookingElements.professional.innerHTML = '<option value="" disabled selected>Selecione...</option>';

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${data.nome} - ${data.especialidade}`;
            option.setAttribute('data-name', data.nome);
            bookingElements.professional.appendChild(option);
        });
    } catch (error) {
        console.error("Erro profissionais:", error);
    }
}

// --- 4. RENDERIZAR CALENDÁRIO HORIZONTAL (Igual Imagem 2) ---
function renderCalendarStrip() {
    const strip = bookingElements.calendarStrip;
    strip.innerHTML = '';
    
    const today = new Date();
    const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    // Atualiza o mês no topo (baseado em hoje por simplicidade)
    bookingElements.monthLabel.textContent = `${months[today.getMonth()]} ${today.getFullYear()}`;

    // Gera os próximos 14 dias
    for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        
        // Formato YYYY-MM-DD para o value
        const dateVal = date.toISOString().split('T')[0];
        
        const dayName = daysOfWeek[date.getDay()];
        const dayNumber = date.getDate();

        // Cria o botão da data
        const btn = document.createElement('div');
        btn.className = 'date-card';
        // Se for domingo (dia 0), pode desabilitar visualmente se quiser
        if(date.getDay() === 0) btn.style.opacity = "0.5"; 

        btn.innerHTML = `
            <span class="day">${dayName}</span>
            <span class="date">${dayNumber}</span>
        `;
        
        btn.onclick = () => {
            // Remove seleção anterior
            document.querySelectorAll('.date-card').forEach(b => b.classList.remove('selected'));
            // Adiciona seleção atual
            btn.classList.add('selected');
            // Atualiza input oculto
            bookingElements.selectedDateInput.value = dateVal;
            // Carrega horários
            loadAvailability();
        };

        strip.appendChild(btn);
    }
}

// --- 5. DISPONIBILIDADE E SLOTS ---
async function loadAvailability() {
    const profId = bookingElements.professional.value;
    const dateVal = bookingElements.selectedDateInput.value;
    
    if (!profId || !dateVal || !currentService) return;

    bookingElements.slotsGrid.innerHTML = '';
    bookingElements.slotsLoader.style.display = 'block';
    bookingElements.selectedTimeInput.value = '';

    try {
        const q = query(
            collection(db, "agendamentos"),
            where("profissionalId", "==", profId),
            where("data", "==", dateVal)
        );
        
        const querySnapshot = await getDocs(q);
        const busyTimes = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            busyTimes.push({ start: data.hora, duration: data.duracao });
        });

        generateSlots(busyTimes, currentService.duracao);

    } catch (error) {
        console.error("Erro agenda:", error);
        bookingElements.msg.innerHTML = '<span class="error">Erro ao buscar horários.</span>';
    } finally {
        bookingElements.slotsLoader.style.display = 'none';
    }
}

function generateSlots(busyTimes, duration) {
    const startHour = 9; 
    const endHour = 19; 
    const interval = 30; 

    let currentTime = new Date();
    currentTime.setHours(startHour, 0, 0, 0);
    const endTime = new Date();
    endTime.setHours(endHour, 0, 0, 0);

    let html = '';
    let hasSlots = false;

    while (currentTime < endTime) {
        const timeStr = currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        // Colisão
        const serviceEnd = new Date(currentTime.getTime() + duration * 60000);
        const isBusy = checkCollision(timeStr, duration, busyTimes);
        const isTooLate = serviceEnd > endTime;

        if (!isBusy && !isTooLate) {
            html += `<button type="button" class="slot-btn" onclick="selectSlot(this, '${timeStr}')">${timeStr}</button>`;
            hasSlots = true;
        }
        currentTime.setMinutes(currentTime.getMinutes() + interval);
    }

    if (!hasSlots) {
        bookingElements.slotsGrid.innerHTML = '<p style="grid-column: span 4; color: #777; text-align: center;">Sem horários livres.</p>';
    } else {
        bookingElements.slotsGrid.innerHTML = html;
    }
}

function checkCollision(slotTime, newDuration, busyList) {
    const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const start = toMin(slotTime);
    const end = start + newDuration;

    for (let busy of busyList) {
        const bStart = toMin(busy.start);
        const bEnd = bStart + busy.duration;
        if (start < bEnd && end > bStart) return true;
    }
    return false;
}

// Helper Global para seleção de slot
window.selectSlot = (btn, time) => {
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    bookingElements.selectedTimeInput.value = time;
};

// --- 6. SUBMIT ---
bookingElements.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!bookingElements.selectedTimeInput.value) {
        bookingElements.msg.innerHTML = '<span class="error">Selecione um horário.</span>';
        return;
    }

    bookingElements.btn.disabled = true;
    bookingElements.btn.textContent = 'Agendando...';

    try {
        const profOpt = bookingElements.professional.options[bookingElements.professional.selectedIndex];
        
        await addDoc(collection(db, "agendamentos"), {
            cliente: bookingElements.clientName.value,
            telefone: bookingElements.clientPhone.value,
            servico: currentService.nome,
            servicoId: currentService.id,
            duracao: currentService.duracao,
            profissional: profOpt.getAttribute('data-name'),
            profissionalId: profOpt.value,
            data: bookingElements.selectedDateInput.value,
            hora: bookingElements.selectedTimeInput.value,
            status: 'pendente',
            criadoEm: Timestamp.now()
        });

        bookingElements.msg.innerHTML = '<span class="success">Agendado com sucesso!</span>';
        setTimeout(() => location.reload(), 2000); // Recarrega para voltar ao início

    } catch (error) {
        console.error(error);
        bookingElements.msg.innerHTML = '<span class="error">Erro ao agendar.</span>';
        bookingElements.btn.disabled = false;
        bookingElements.btn.textContent = 'Confirmar Agendamento';
    }
});

// Listener de mudança no profissional para recarregar slots se já tiver data
bookingElements.professional.addEventListener('change', loadAvailability);

// Inicia
init();
