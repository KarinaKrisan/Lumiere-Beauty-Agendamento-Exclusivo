import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs, Timestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURAÇÃO FIREBASE ---
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

// Variável para armazenar o serviço escolhido na Tela 1
let currentService = null;

// Elementos do DOM
const views = {
    services: document.getElementById('services-view'),
    booking: document.getElementById('booking-view'),
    list: document.getElementById('services-list'),
    loader: document.getElementById('loading-services')
};

const bookingEl = {
    serviceName: document.getElementById('selectedServiceName'),
    profSelect: document.getElementById('professional'),
    calendarStrip: document.getElementById('calendarStrip'),
    monthLabel: document.getElementById('monthLabel'),
    slotsGrid: document.getElementById('slots-grid'),
    slotsLoader: document.getElementById('slots-loader'),
    timeLabel: document.getElementById('timeLabel'),
    dateInput: document.getElementById('selectedDate'),
    timeInput: document.getElementById('selectedTime'),
    form: document.getElementById('bookingForm'),
    btn: document.getElementById('submitBtn'),
    msg: document.getElementById('message'),
    name: document.getElementById('clientName'),
    phone: document.getElementById('clientPhone')
};

// --- PASSO 1: CARREGAR LISTA DE SERVIÇOS ---
async function init() {
    views.loader.style.display = 'block';
    try {
        const q = query(collection(db, "procedimentos"), orderBy("nome"));
        const querySnapshot = await getDocs(q);

        views.list.innerHTML = '';
        if (querySnapshot.empty) {
            views.list.innerHTML = '<p style="text-align:center;color:#777">Nenhum procedimento encontrado.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'service-card';
            div.innerHTML = `
                <div class="service-info">
                    <h4>${data.nome}</h4>
                    <div class="service-meta">
                        <span><i class="far fa-clock"></i> ${formatTime(data.duracao)}</span>
                        ${data.preco ? `<span><i class="fas fa-dollar-sign"></i> R$ ${data.preco},00</span>` : ''}
                    </div>
                </div>
                <button class="btn-reservar" onclick="selectService('${doc.id}', '${data.nome}', ${data.duracao})">
                    <i class="far fa-calendar-check"></i> Agendar
                </button>
            `;
            views.list.appendChild(div);
        });
    } catch (err) { console.error(err); } 
    finally { views.loader.style.display = 'none'; }
}

function formatTime(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0 && m > 0) return `${h}h:${m < 10 ? '0'+m : m}min`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
}

// --- PASSO 2: TRANSIÇÃO PARA TELA DE AGENDAMENTO ---
window.selectService = (id, nome, duracao) => {
    // 1. Salva o serviço selecionado
    currentService = { id, nome, duracao };
    
    // 2. Atualiza o cabeçalho da Tela 2
    bookingEl.serviceName.textContent = nome;
    
    // 3. Troca as telas
    views.services.classList.remove('active');
    views.booking.classList.add('active');
    
    // 4. Carrega os dados necessários para a Tela 2
    loadProfessionals();
    renderCalendar();
    
    // 5. Reseta campos visuais
    bookingEl.slotsGrid.innerHTML = '<p class="instruction-text">Escolha um profissional e uma data.</p>';
    bookingEl.timeLabel.style.display = 'block';
    bookingEl.timeInput.value = '';
    bookingEl.dateInput.value = '';
};

// Carrega profissionais do Firebase
async function loadProfessionals() {
    bookingEl.profSelect.innerHTML = '<option>Carregando...</option>';
    try {
        const q = query(collection(db, "profissionais"), orderBy("nome"));
        const snap = await getDocs(q);
        bookingEl.profSelect.innerHTML = '<option value="" disabled selected>Selecione um profissional...</option>';
        snap.forEach(doc => {
            const d = doc.data();
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.text = d.nome; 
            opt.setAttribute('data-name', d.nome);
            bookingEl.profSelect.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

// Gera o calendário horizontal
function renderCalendar() {
    const strip = bookingEl.calendarStrip;
    strip.innerHTML = '';
    
    const today = new Date();
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    bookingEl.monthLabel.textContent = `${months[today.getMonth()]} ${today.getFullYear()}`;

    // Gera 14 dias a partir de hoje
    for(let i=0; i<14; i++) {
        const d = new Date();
        d.setDate(today.getDate() + i);
        const val = d.toISOString().split('T')[0];
        
        const btn = document.createElement('div');
        btn.className = 'date-card';
        // Desabilita visualmente Domingo (opcional)
        if(d.getDay() === 0) btn.style.opacity = '0.4'; 

        btn.innerHTML = `
            <span class="day">${days[d.getDay()]}</span>
            <span class="date">${d.getDate()}</span>
        `;
        
        btn.onclick = () => {
            // Remove seleção anterior
            document.querySelectorAll('.date-card').forEach(c => c.classList.remove('selected'));
            // Adiciona seleção nova
            btn.classList.add('selected');
            bookingEl.dateInput.value = val;
            checkAvailability();
        };
        strip.appendChild(btn);
    }
}

// Checa horários disponíveis
async function checkAvailability() {
    const profId = bookingEl.profSelect.value;
    const dateVal = bookingEl.dateInput.value;
    
    if(!profId || !dateVal) return;
    
    bookingEl.slotsGrid.innerHTML = '';
    bookingEl.slotsLoader.style.display = 'block';
    
    try {
        // Busca agendamentos ocupados
        const q = query(collection(db, "agendamentos"), 
            where("profissionalId", "==", profId), 
            where("data", "==", dateVal));
            
        const snap = await getDocs(q);
        const busy = [];
        snap.forEach(doc => busy.push({ start: doc.data().hora, duration: doc.data().duracao }));
        
        generateSlots(busy, currentService.duracao);
    } catch(e) {
        console.error(e);
        bookingEl.slotsGrid.innerHTML = '<p style="color:var(--error); width:100%; text-align:center;">Erro ao buscar agenda.</p>';
    } finally {
        bookingEl.slotsLoader.style.display = 'none';
    }
}

// Gera os botões de horário
function generateSlots(busy, duration) {
    const startHour = 9;
    const endHour = 19;
    const interval = 30; 
    
    let now = new Date();
    now.setHours(startHour, 0, 0, 0);
    const end = new Date();
    end.setHours(endHour, 0, 0, 0);
    
    let html = '';
    let count = 0;

    while(now < end) {
        const timeStr = now.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
        
        const slotEnd = new Date(now.getTime() + duration*60000);
        const isBusy = checkCollision(timeStr, duration, busy);
        const isLate = slotEnd > end;
        
        if(!isBusy && !isLate) {
            html += `<div class="slot-btn" onclick="selectTime(this, '${timeStr}')">${timeStr}</div>`;
            count++;
        }
        now.setMinutes(now.getMinutes() + interval);
    }

    if(count === 0) {
        bookingEl.slotsGrid.innerHTML = `<div class="no-slots-message">Nenhum horário disponível para esta data.</div>`;
        bookingEl.timeLabel.style.display = 'none';
    } else {
        bookingEl.slotsGrid.innerHTML = html;
        bookingEl.timeLabel.style.display = 'block';
    }
}

function checkCollision(time, dur, busyList) {
    const toMin = t => { const [h, m] = t.split(':').map(Number); return h*60 + m; };
    const start = toMin(time);
    const end = start + dur;
    
    for(let b of busyList) {
        const bStart = toMin(b.start);
        const bEnd = bStart + b.duration;
        if( (start >= bStart && start < bEnd) || (end > bStart && end <= bEnd) || (start <= bStart && end >= bEnd) ) return true;
    }
    return false;
}

window.selectTime = (el, time) => {
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    bookingEl.timeInput.value = time;
};

// --- PASSO 3: ENVIAR AGENDAMENTO ---
bookingEl.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!bookingEl.timeInput.value) {
        alert("Por favor, selecione um horário.");
        return;
    }
    
    bookingEl.btn.disabled = true;
    bookingEl.btn.textContent = "Processando...";
    
    try {
        const profOpt = bookingEl.profSelect.options[bookingEl.profSelect.selectedIndex];
        await addDoc(collection(db, "agendamentos"), {
            cliente: bookingEl.name.value,
            telefone: bookingEl.phone.value,
            servico: currentService.nome,
            duracao: currentService.duracao,
            profissional: profOpt.getAttribute('data-name'),
            profissionalId: profOpt.value,
            data: bookingEl.dateInput.value,
            hora: bookingEl.timeInput.value,
            criadoEm: Timestamp.now()
        });
        
        bookingEl.msg.innerHTML = '<span class="success">Agendamento realizado com sucesso!</span>';
        setTimeout(() => location.reload(), 2000);
    } catch(err) {
        console.error(err);
        bookingEl.msg.innerHTML = '<span class="error">Erro ao agendar. Tente novamente.</span>';
        bookingEl.btn.disabled = false;
        bookingEl.btn.textContent = "Confirmar Agendamento";
    }
});

// Atualiza horários se mudar o profissional
bookingEl.profSelect.addEventListener('change', checkAvailability);

init();
