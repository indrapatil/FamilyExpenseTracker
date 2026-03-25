import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update, off } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD_6PqwNtvDYCRBNdueHIlOcUZ5QOjIVLc",
  authDomain: "indrajitp-4f98e.firebaseapp.com",
  projectId: "indrajitp-4f98e",
  storageBucket: "indrajitp-4f98e.firebasestorage.app",
  messagingSenderId: "288143412948",
  appId: "1:288143412948:web:77956d80aa80500003b541"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// State
let expenses = [];
let currentView = 'current';
let selectedArchiveId = null;
let myChart = null;
let activeFilters = { category: 'ALL', start: null, end: null };

// DOM
const loginUI = document.getElementById('login-ui');
const dashboardUI = document.getElementById('dashboard-ui');
const loginForm = document.getElementById('login-form');
const expenseForm = document.getElementById('expense-form');
const tbody = document.getElementById('expense-tbody');
const totalAmountEl = document.getElementById('total-amount');
const dateRangeEl = document.getElementById('report-date-range');
const archiveSelector = document.getElementById('archive-selector');

// --- Auth Handling ---

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginUI.style.display = 'none';
        dashboardUI.style.display = 'flex';
        document.getElementById('logged-user-email').innerText = user.email;
        loadApp();
    } else {
        loginUI.style.display = 'flex';
        dashboardUI.style.display = 'none';
        cleanupApp();
    }
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, email, pass).catch(err => {
        document.getElementById('login-error').innerText = "❌ " + err.message;
    });
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// --- Database Sync ---

function loadApp() {
    setDefaultDate();
    initSync();
}

function cleanupApp() {
    expenses = [];
    off(ref(db, 'current_expenses'));
    off(ref(db, 'archives'));
}

function initSync() {
    const currentRef = ref(db, 'current_expenses');
    onValue(currentRef, (snapshot) => {
        if (currentView === 'current') {
            const data = snapshot.val();
            expenses = data ? Object.keys(data).map(k => ({ ...data[k], id: k })) : [];
            expenses.sort((a,b) => new Date(b.date) - new Date(a.date));
            renderUI();
        }
    });

    const archivesRef = ref(db, 'archives');
    onValue(archivesRef, (snapshot) => {
        updateArchiveSelector(snapshot.val());
    });
}

function setDefaultDate() {
    const d = document.getElementById('exp-date');
    if(d) d.value = new Date().toISOString().split('T')[0];
}

window.switchView = (view) => {
    currentView = view;
    document.getElementById('view-current-btn').classList.toggle('active', view === 'current');
    document.getElementById('view-archives-btn').classList.toggle('active', view === 'archives');
    document.getElementById('current-report-header').style.display = view === 'current' ? 'flex' : 'none';
    document.getElementById('archive-header').style.display = view === 'archives' ? 'flex' : 'none';
    if(view === 'current') initSync();
};

function updateArchiveSelector(data) {
    archiveSelector.innerHTML = '<option value="">Select Archive...</option>';
    if (data) Object.keys(data).forEach(id => {
        const opt = document.createElement('option');
        opt.value = id; opt.innerText = data[id].name;
        archiveSelector.appendChild(opt);
    });
}

window.loadSpecificArchive = (id) => {
    if (!id) return;
    selectedArchiveId = id;
    onValue(ref(db, `archives/${id}/data`), (snap) => {
        if (currentView === 'archives' && selectedArchiveId === id) {
            const data = snap.val();
            expenses = data ? Object.keys(data).map(k => ({ ...data[k], id: k })) : [];
            expenses.sort((a,b) => new Date(b.date) - new Date(a.date));
            renderUI();
        }
    });
};

// --- CRUD ---

expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const entry = {
        spender: document.getElementById('exp-spender').value,
        date: document.getElementById('exp-date').value,
        category: document.getElementById('exp-category').value,
        remarks: document.getElementById('exp-remarks').value || "No remarks",
        amount: parseFloat(document.getElementById('exp-amount').value),
        addedBy: auth.currentUser.email
    };
    const path = currentView === 'current' ? 'current_expenses' : `archives/${selectedArchiveId}/data`;
    push(ref(db, path), entry);
    expenseForm.reset();
    setDefaultDate();
});

window.archiveCurrent = () => {
    if (expenses.length === 0) return;
    const name = prompt("Archive name (e.g. March 2026):");
    if (!name) return;
    const key = push(ref(db, 'archives')).key;
    const dataObj = {};
    expenses.forEach(e => {
        const { id, ...clean } = e;
        dataObj[push(ref(db, 'temp')).key] = clean;
    });
    set(ref(db, `archives/${key}`), { name, data: dataObj, timestamp: Date.now() }).then(() => {
        set(ref(db, 'current_expenses'), null);
        alert("Archived!");
    });
};

window.openEdit = (id) => {
    const item = expenses.find(e => e.id === id);
    if (!item) return;
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-date').value = item.date;
    document.getElementById('edit-spender').value = item.spender;
    document.getElementById('edit-category').value = item.category;
    document.getElementById('edit-remarks').value = item.remarks;
    document.getElementById('edit-amount').value = item.amount;
    document.getElementById('editModal').style.display = 'flex';
};
window.closeModal = () => document.getElementById('editModal').style.display = 'none';

window.saveEdit = () => {
    const id = document.getElementById('edit-id').value;
    const upd = {
        spender: document.getElementById('edit-spender').value,
        date: document.getElementById('edit-date').value,
        category: document.getElementById('edit-category').value,
        remarks: document.getElementById('edit-remarks').value,
        amount: parseFloat(document.getElementById('edit-amount').value)
    };
    const p = currentView === 'current' ? `current_expenses/${id}` : `archives/${selectedArchiveId}/data/${id}`;
    update(ref(db, p), upd).then(() => closeModal());
};

window.confirmDelete = () => {
    if (!confirm("Really delete?")) return;
    const id = document.getElementById('edit-id').value;
    const p = currentView === 'current' ? `current_expenses/${id}` : `archives/${selectedArchiveId}/data/${id}`;
    remove(ref(db, p)).then(() => closeModal());
};

window.deleteArchive = () => {
    if(!confirm("Delete entire archive?")) return;
    remove(ref(db, `archives/${selectedArchiveId}`)).then(() => {
        selectedArchiveId = null; expenses = []; renderUI();
    });
};

// --- Filters ---

window.applyFilters = () => {
    activeFilters.start = document.getElementById('filter-date-start').value || null;
    activeFilters.end = document.getElementById('filter-date-end').value || null;
    activeFilters.category = document.getElementById('filter-category').value;
    renderUI();
};

window.resetFilters = () => {
    activeFilters = { category: 'ALL', start: null, end: null };
    document.getElementById('filter-date-start').value = '';
    document.getElementById('filter-date-end').value = '';
    document.getElementById('filter-category').value = 'ALL';
    renderUI();
};

// --- View Rendering ---

function renderUI() {
    tbody.innerHTML = '';
    let total = 0;
    let filteredCatData = {};

    // Apply Filter Logic
    const filtered = expenses.filter(e => {
        const matchesCat = activeFilters.category === 'ALL' || e.category === activeFilters.category;
        const matchesStart = !activeFilters.start || e.date >= activeFilters.start;
        const matchesEnd = !activeFilters.end || e.date <= activeFilters.end;
        return matchesCat && matchesStart && matchesEnd;
    });

    if (filtered.length === 0) {
        totalAmountEl.innerText = "₹ 0.00";
        dateRangeEl.innerText = "No matching records";
        if(myChart) myChart.destroy();
        return;
    }

    filtered.forEach(e => {
        total += e.amount;
        filteredCatData[e.category] = (filteredCatData[e.category] || 0) + e.amount;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(e.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</td>
            <td><span class="spender-tag">${e.spender}</span></td>
            <td><span class="category-pill">${e.category}</span></td>
            <td>${e.remarks}</td>
            <td class="text-right"><strong>₹${e.amount.toLocaleString('en-IN')}</strong></td>
            <td class="text-center"><button class="edit-btn" onclick="openEdit('${e.id}')">✏️</button></td>
        `;
        tbody.appendChild(tr);
    });

    totalAmountEl.innerText = `₹ ${total.toLocaleString('en-IN',{minimumFractionDigits:2})}`;
    
    const start = filtered[filtered.length-1].date;
    const end = filtered[0].date;
    dateRangeEl.innerText = `${new Date(start).toLocaleDateString('en-IN')} to ${new Date(end).toLocaleDateString('en-IN')}`;
    
    // Chart always reflects the FULL current report contexts but highlights the filter
    const allReportCatData = {};
    expenses.forEach(e => allReportCatData[e.category] = (allReportCatData[e.category]||0)+e.amount);
    updateChart(allReportCatData);
}

function updateChart(data) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    const sorted = Object.entries(data).sort((a,b) => b[1]-a[1]);
    
    if(myChart) myChart.destroy();
    
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(s => s[0]),
            datasets: [{
                data: sorted.map(s => s[1]),
                backgroundColor: sorted.map(s => s[0] === activeFilters.category ? '#4f46e5' : '#cbd5e1'),
                borderRadius: 4
            }]
        },
        options: { 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } },
            onClick: (evt, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    const cat = sorted[idx][0];
                    activeFilters.category = cat;
                    document.getElementById('filter-category').value = cat;
                    renderUI();
                } else {
                    resetFilters();
                }
            }
        }
    });
}

// --- XLSX & IMPORT ---

window.exportToExcel = () => {
    const raw = expenses.map(e => ({ "Date": e.date, "By": e.spender, "Category": e.category, "Remarks": e.remarks, "Amount": e.amount }));
    raw.push({ "Date": "GRAND TOTAL", "Amount": expenses.reduce((s,e)=>s+e.amount,0)});
    const sMap = {}; expenses.forEach(e => sMap[e.category] = (sMap[e.category]||0)+e.amount);
    const sum = Object.entries(sMap).sort((a,b)=>b[1]-a[1]).map(s=>({"Category":s[0], "Total":s[1]}));
    const wb = XLSX.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(raw), "Details");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sum), "Summary");
    XLSX.writeFile(wb, "Expense_Report.xlsx");
};

// V3.3 Native File Upload
window.triggerFileUpload = () => document.getElementById('bulk-file-input').click();

window.handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (rows.length === 0) return alert("File is empty!");

        if (!confirm(`Found ${rows.length} items. Add them to the CURRENT report?`)) return;

        const currentRef = ref(db, 'current_expenses');
        rows.forEach(row => {
            const cleanRow = {
                date: parseExcelDate(row.Date || row.date),
                category: normalizeCategory(row.Category || row.category || "Others"),
                remarks: row.Description || row.Remarks || row.remarks || "Bulk upload",
                amount: parseFloat(row.Amount || row.amount || 0),
                spender: "Indra",
                addedBy: "Excel Upload"
            };
            if (!isNaN(cleanRow.amount)) push(currentRef, cleanRow);
        });
        alert("Upload Complete!");
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
};

function parseExcelDate(val) {
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'string') {
        const parts = val.split(/[\/-]/);
        if (parts.length >= 2) {
            const d = parts[0].padStart(2, '0');
            const m = parts[1].padStart(2, '0');
            const y = parts[2] ? (parts[2].length === 2 ? '20'+parts[2] : parts[2]) : '2026';
            return `${y}-${m}-${d}`;
        }
    }
    return new Date().toISOString().split('T')[0];
}

function normalizeCategory(cat) {
    const c = cat.trim().toLowerCase();
    if (c.includes("grocery")) return "Grocery";
    if (c.includes("hotel")) return "Hotel";
    if (c.includes("shopping")) return "shopping";
    if (c.includes("fuel") || c.includes("petrol")) return "Fuel";
    if (c.includes("fruit")) return "Fruits";
    if (c.includes("med")) return "Medicines";
    if (c.includes("trave")) return "travel";
    if (c.includes("maint")) return "Maintenance";
    return "Others";
}

// V3.3 One-time Data Fix for March
window.wipeAndSeedMarch = () => {
    if (!confirm("⚠️ Wipe and Fix March Data?")) return;
    set(ref(db, 'current_expenses'), null).then(() => {
        const seedData = [
            {"date":"2026-03-08","category":"shopping","remarks":"Ira dress","amount":550},
            {"date":"2026-03-08","category":"Hotel","remarks":"KFC","amount":524},
            {"date":"2026-03-08","category":"Hotel","remarks":"Swad fish","amount":690},
            {"date":"2026-03-08","category":"shopping","remarks":"Blouse stitching","amount":1900},
            {"date":"2026-03-08","category":"Grocery","remarks":"Milk","amount":37},
            {"date":"2026-03-09","category":"Medicines","remarks":"Baby powder","amount":111},
            {"date":"2026-03-09","category":"Grocery","remarks":"Milk","amount":76},
            {"date":"2026-03-09","category":"Grocery","remarks":"Egg","amount":36},
            {"date":"2026-03-09","category":"Hotel","remarks":"Chat","amount":30},
            {"date":"2026-03-09","category":"Grocery","remarks":"Reliance","amount":268},
            {"date":"2026-03-09","category":"Grocery","remarks":"Bhaji","amount":205},
            {"date":"2026-03-10","category":"Fuel","remarks":"Petrol","amount":150},
            {"date":"2026-03-10","category":"Fruits","remarks":"kharbuj","amount":100},
            {"date":"2026-03-10","category":"Fruits","remarks":"Grapes","amount":150},
            {"date":"2026-03-10","category":"travel","remarks":"Ashtvinayak","amount":4900},
            {"date":"2026-03-11","category":"Grocery","remarks":"Milk","amount":114},
            {"date":"2026-03-11","category":"shopping","remarks":"Toys","amount":276},
            {"date":"2026-03-08","category":"shopping","remarks":"Mesho ira","amount":880},
            {"date":"2026-03-08","category":"Others","remarks":"Cricket","amount":500},
            {"date":"2026-03-08","category":"Hotel","remarks":"Misal","amount":100},
            {"date":"2026-03-12","category":"shopping","remarks":"Bean bag refill","amount":1286},
            {"date":"2026-03-12","category":"Utility","remarks":"Electricity Manjari","amount":1320},
            {"date":"2026-03-08","category":"Utility","remarks":"Lpg","amount":905},
            {"date":"2026-03-12","category":"Grocery","remarks":"","amount":290},
            {"date":"2026-03-12","category":"shopping","remarks":"Bean bag","amount":1286},
            {"date":"2026-03-12","category":"Fuel","remarks":"Petrol","amount":3686},
            {"date":"2026-03-13","category":"Fuel","remarks":"Petrol","amount":100},
            {"date":"2026-03-13","category":"shopping","remarks":"Ira's clips","amount":25},
            {"date":"2026-03-14","category":"travel","remarks":"","amount":66},
            {"date":"2026-03-15","category":"shopping","remarks":"","amount":150},
            {"date":"2026-03-15","category":"Grocery","remarks":"","amount":60},
            {"date":"2026-03-15","category":"Grocery","remarks":"","amount":10},
            {"date":"2026-03-15","category":"Grocery","remarks":"","amount":120},
            {"date":"2026-03-15","category":"Grocery","remarks":"","amount":140},
            {"date":"2026-03-15","category":"Grocery","remarks":"","amount":25},
            {"date":"2026-03-15","category":"Grocery","remarks":"","amount":30},
            {"date":"2026-03-15","category":"Grocery","remarks":"","amount":20},
            {"date":"2026-03-15","category":"Grocery","remarks":"","amount":50},
            {"date":"2026-03-15","category":"Hotel","remarks":"","amount":1186},
            {"date":"2026-03-15","category":"travel","remarks":"","amount":250},
            {"date":"2026-03-16","category":"Grocery","remarks":"","amount":30},
            {"date":"2026-03-16","category":"Grocery","remarks":"","amount":20},
            {"date":"2026-03-16","category":"Grocery","remarks":"","amount":60},
            {"date":"2026-03-16","category":"Maintenance","remarks":"Bike maintenance","amount":800},
            {"date":"2026-03-16","category":"Fruits","remarks":"","amount":100},
            {"date":"2026-03-16","category":"Grocery","remarks":"Egg","amount":39},
            {"date":"2026-03-16","category":"Others","remarks":"","amount":375},
            {"date":"2026-03-16","category":"Grocery","remarks":"","amount":220},
            {"date":"2026-03-18","category":"snacks","remarks":"","amount":60},
            {"date":"2026-03-17","category":"Maintenance","remarks":"","amount":50},
            {"date":"2026-03-18","category":"Others","remarks":"Misc","amount":200},
            {"date":"2026-03-19","category":"Grocery","remarks":"","amount":459},
            {"date":"2026-03-19","category":"shopping","remarks":"Ira hat","amount":50},
            {"date":"2026-03-19","category":"Hotel","remarks":"Biryani","amount":300},
            {"date":"2026-03-19","category":"Grocery","remarks":"Reliance","amount":88},
            {"date":"2026-03-19","category":"Others","remarks":"Flowers","amount":90},
            {"date":"2026-03-19","category":"shopping","remarks":"Ira's toy","amount":700},
            {"date":"2026-03-20","category":"Grocery","remarks":"","amount":404},
            {"date":"2026-03-20","category":"hospital","remarks":"Ira dentist","amount":490},
            {"date":"2026-03-20","category":"Hotel","remarks":"Snacks","amount":260},
            {"date":"2026-03-20","category":"Grocery","remarks":"","amount":150},
            {"date":"2026-03-20","category":"Grocery","remarks":"","amount":285},
            {"date":"2026-03-20","category":"Grocery","remarks":"","amount":36},
            {"date":"2026-03-20","category":"Grocery","remarks":"","amount":20},
            {"date":"2026-03-22","category":"Fuel","remarks":"","amount":366},
            {"date":"2026-03-22","category":"Grocery","remarks":"","amount":80},
            {"date":"2026-03-22","category":"Grocery","remarks":"","amount":320},
            {"date":"2026-03-22","category":"Grocery","remarks":"","amount":1350},
            {"date":"2026-03-23","category":"Hotel","remarks":"","amount":10},
            {"date":"2026-03-23","category":"Grocery","remarks":"","amount":247},
            {"date":"2026-03-23","category":"snacks","remarks":"","amount":40},
            {"date":"2026-03-24","category":"snacks","remarks":"","amount":40},
            {"date":"2026-03-24","category":"Grocery","remarks":"","amount":32},
            {"date":"2026-03-24","category":"Grocery","remarks":"","amount":111},
            {"date":"2026-03-24","category":"Grocery","remarks":"","amount":546},
            {"date":"2026-03-24","category":"Medicines","remarks":"","amount":120}
        ];
        const currentRef = ref(db, 'current_expenses');
        seedData.forEach(item => push(currentRef, { ...item, spender: "Indra", addedBy: "Admin Fix" }));
        alert("Done!");
    });
};
