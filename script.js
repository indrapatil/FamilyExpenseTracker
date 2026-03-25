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
        document.getElementById('login-error').innerText = "❌ Login Failed: " + err.message;
    });
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// --- Database Logic ---

function loadApp() {
    setDefaultDate();
    initSync();
}

function cleanupApp() {
    expenses = [];
    const currentRef = ref(db, 'current_expenses');
    const archivesRef = ref(db, 'archives');
    off(currentRef);
    off(archivesRef);
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
    const dateInput = document.getElementById('exp-date');
    if(dateInput) dateInput.value = new Date().toISOString().split('T')[0];
}

window.switchView = (view) => {
    currentView = view;
    document.getElementById('view-current-btn').classList.toggle('active', view === 'current');
    document.getElementById('view-archives-btn').classList.toggle('active', view === 'archives');
    document.getElementById('current-report-header').style.display = view === 'current' ? 'flex' : 'none';
    document.getElementById('archive-header').style.display = view === 'archives' ? 'flex' : 'none';
    if (view === 'current') initSync();
};

function updateArchiveSelector(data) {
    archiveSelector.innerHTML = '<option value="">Select an Archive...</option>';
    if (data) Object.keys(data).forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.innerText = data[id].name;
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
    const name = prompt("Name this archive (e.g. March 2026):");
    if (!name) return;
    const key = push(ref(db, 'archives')).key;
    const dataObj = {};
    expenses.forEach(e => {
        const { id, ...clean } = e;
        dataObj[push(ref(db, 'temp')).key] = clean;
    });
    set(ref(db, `archives/${key}`), { name, data: dataObj, timestamp: Date.now() }).then(() => {
        set(ref(db, 'current_expenses'), null);
        alert("Archived successfully!");
    });
};

// --- Edit/Delete ---

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
    const updated = {
        spender: document.getElementById('edit-spender').value,
        date: document.getElementById('edit-date').value,
        category: document.getElementById('edit-category').value,
        remarks: document.getElementById('edit-remarks').value,
        amount: parseFloat(document.getElementById('edit-amount').value)
    };
    const path = currentView === 'current' ? `current_expenses/${id}` : `archives/${selectedArchiveId}/data/${id}`;
    update(ref(db, path), updated).then(() => closeModal());
};

window.confirmDelete = () => {
    if (!confirm("Delete permanently?")) return;
    const id = document.getElementById('edit-id').value;
    const path = currentView === 'current' ? `current_expenses/${id}` : `archives/${selectedArchiveId}/data/${id}`;
    remove(ref(db, path)).then(() => closeModal());
};

window.deleteArchive = () => {
    if (!selectedArchiveId) return alert("Select an archive first.");
    if (!confirm("Are you sure you want to permanently DELETE this entire archive? This cannot be undone.")) return;
    
    remove(ref(db, `archives/${selectedArchiveId}`)).then(() => {
        alert("Archive deleted!");
        selectedArchiveId = null;
        expenses = [];
        renderUI();
    });
};

// --- View ---

function renderUI() {
    tbody.innerHTML = '';
    let total = 0;
    let categoryData = {};
    if (expenses.length === 0) {
        totalAmountEl.innerText = "₹ 0.00";
        dateRangeEl.innerText = "No entries.";
        updateChart({});
        return;
    }
    expenses.forEach(e => {
        total += e.amount;
        categoryData[e.category] = (categoryData[e.category] || 0) + e.amount;
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
    totalAmountEl.innerText = `₹ ${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    dateRangeEl.innerText = `${new Date(expenses[expenses.length-1].date).toLocaleDateString('en-IN')} to ${new Date(expenses[0].date).toLocaleDateString('en-IN')}`;
    updateChart(categoryData);
}

function updateChart(data) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    const labels = Object.keys(data);
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: Object.values(data),
                backgroundColor: ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316','#22c55e','#64748b'].slice(0, labels.length)
            }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

window.exportToExcel = () => {
    const raw = expenses.map(e => ({ "Date": e.date, "By": e.spender, "Category": e.category, "Remarks": e.remarks, "Amount": e.amount }));
    raw.push({ "Date": "GRAND TOTAL", "By": "", "Category": "", "Remarks": "", "Amount": expenses.reduce((s,e)=>s+e.amount,0)});
    const sumMap = {}; expenses.forEach(e => sumMap[e.category] = (sumMap[e.category]||0)+e.amount);
    const sum = Object.keys(sumMap).map(k=>({"Category":k, "Total":sumMap[k]}));
    
    // V3.1: Sort Summary by Amount Descending
    sum.sort((a, b) => b["Total"] - a["Total"]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(raw), "Details");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sum), "Summary");
    XLSX.writeFile(wb, "Expense_Report.xlsx");
};
