import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIG DO FIREBASE (MANTIDA)
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
const appointmentsRef = collection(db, "agendamentos");

// DADOS (Simulados, em produção viriam do BD)
const professionalsConfig = [
    { id: "ana_corte", name: "Ana Silva", specialty: "Hair Stylist", img: "https://i.pravatar.cc/150?u=ana", rating: "5.0" },
    { id: "carlos_color", name: "Carlos", specialty: "Colorista", img: "https://i.pravatar.cc/150?u=carlos", rating: "4.9" },
    { id: "bia_nails", name: "Bia", specialty: "Nails", img: "https://i.pravatar.cc/150?u=bia", rating: "4.8" },
    { id: "pedro_barber", name: "Pedro", specialty: "Barber", img: "https://i.pravatar.cc/150?u=pedro", rating: "5.0" }
];

const servicesConfig = [
    { id: "corte_fem", name: "Corte Feminino", duration: 60 },
    { id: "corte_masc", name: "Corte Masculino", duration: 30 },
    { id: "coloracao", name: "Coloração", duration: 120 },
    { id: "manicure", name: "Manicure", duration: 45 }
];

// STATE MANAGEMENT
let bookingState = {
    professional: null,
    service: null,
    date: null,
    time: null
};

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
    renderProfessionals();
    populateServices();
    
    // Tornar função global para o HTML acessar
    window.changeStep = changeStep;
});

// 1. RENDER PROFISSIONAIS
function renderProfessionals() {
    const grid = document.getElementById('professionalsGrid');
    professionalsConfig.forEach(pro => {
        const card = document.createElement('div');
        card.className = 'pro-card';
        card.innerHTML = `
            <img src="${pro.img}">
            <div class="pro-info">
                <h3>${pro.name}</h3>
                <span>${pro.specialty}</span>
                <div class="rating">★★★★★ ${pro.rating}</div>
            </div>
        `;
        card.onclick = () => {
            bookingState.professional = pro;
            changeStep(2);
        };
        grid.appendChild(card);
    });
}

function populateServices() {
    const select = document.getElementById('service');
    servicesConfig.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.duration} min)`;
        select.appendChild(opt);
    });
}

// 2. NAVIGATOR (Lógica de Troca de Tela)
function changeStep(stepNumber) {
    // Validação simples antes de avançar
    if (stepNumber === 3) {
        const servId = document.getElementById('service').value;
        const dateVal = document.getElementById('date').value;
        
        if (!servId || !dateVal) {
            alert("Por favor, selecione serviço e data.");
            return;
        }
        
        bookingState.service = servicesConfig.find(s => s.id === servId);
        bookingState.date = dateVal;
        
        document.getElementById('summaryService').innerText = bookingState.service.name;
        loadSlots(); // Carrega horários
    }

    if (stepNumber === 4) {
        if (!bookingState.time) {
            alert("Escolha um horário.");
            return;
        }
        updateSummaryCard();
    }

    // UI Updates
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
    document.getElementById(`step${stepNumber}`).classList.add('active');
    
    // Atualiza Bolinhas do Header
    const dots = document.querySelectorAll('.step-dot');
    dots.forEach((d, i) => {
        d.classList.toggle('active', i < stepNumber);
    });
}

// 3. SLOTS LOGIC (Mesma lógica robusta anterior, visual novo)
async function loadSlots() {
    const container = document.getElementById('slotsContainer');
    container.innerHTML = '<div style="grid-column: span 3; text-align:center; color:#fff;">Buscando disponibilidade...</div>';
    
    // Firebase Query
    const q = query(
        appointmentsRef,
        where("date", "==", bookingState.date),
        where("professional", "==", bookingState.professional.id)
    );
    
    const snapshot = await getDocs(q);
    const busyTimes = [];
    snapshot.forEach(doc => busyTimes.push(doc.data()));

    // Generate
    container.innerHTML = '';
    const startMin = 9 * 60; 
    const endMin = 19 * 60;
    const duration = bookingState.service.duration;

    let hasSlot = false;

    for (let time = startMin; time + duration <= endMin; time += 30) {
        let isFree = true;
        
        // Verifica Colisão
        for (let busy of busyTimes) {
            const [h, m] = busy.time.split(':').map(Number);
            const bStart = h * 60 + m;
            const bEnd = bStart + busy.durationMinutes;
            
            // Lógica de colisão
            if (time < bEnd && (time + duration) > bStart) {
                isFree = false; 
                break; 
            }
        }

        if (isFree) {
            hasSlot = true;
            createTimeChip(time, container);
        }
    }
    
    if (!hasSlot) container.innerHTML = '<div style="grid-column: span 3; text-align:center;">Sem horários livres :(</div>';
}

function createTimeChip(minutes, container) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    
    const chip = document.createElement('div');
    chip.className = 'time-chip';
    chip.innerText = timeStr;
    chip.onclick = () => {
        document.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        bookingState.time = timeStr;
        
        // Auto avança após 300ms para UX fluida
        setTimeout(() => changeStep(4), 300);
    };
    container.appendChild(chip);
}

// 4. SUMMARY & SUBMIT
function updateSummaryCard() {
    document.getElementById('finalProImg').src = bookingState.professional.img;
    document.getElementById('finalProName').innerText = bookingState.professional.name;
    document.getElementById('finalService').innerText = bookingState.service.name;
    
    // Formata Data
    const d = new Date(bookingState.date);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset()); // Ajuste fuso
    document.getElementById('finalDate').innerText = d.toLocaleDateString('pt-BR');
    document.getElementById('finalTime').innerText = bookingState.time;
}

document.getElementById('bookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.innerText = "Confirmando...";
    
    const data = {
        professional: bookingState.professional.id,
        professionalName: bookingState.professional.name,
        service: bookingState.service.name,
        date: bookingState.date,
        time: bookingState.time,
        durationMinutes: bookingState.service.duration,
        clientName: document.getElementById('name').value,
        clientPhone: document.getElementById('phone').value,
        createdAt: new Date()
    };

    try {
        await addDoc(appointmentsRef, data);
        document.getElementById('toast').classList.add('show');
        setTimeout(() => window.location.reload(), 3000);
    } catch (err) {
        console.error(err);
        alert("Erro ao agendar");
        btn.innerText = "Tentar Novamente";
    }
});
