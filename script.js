// Firebase modular SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// --- PASTE YOUR CONFIG HERE ---
const firebaseConfig = {
  apiKey: "AIzaSyD_6PqwNtvDYCRBNdueHIlOcUZ5QOjIVLc",
  authDomain: "indrajitp-4f98e.firebaseapp.com",
  projectId: "indrajitp-4f98e",
  storageBucket: "indrajitp-4f98e.firebasestorage.app",
  messagingSenderId: "288143412948",
  appId: "1:288143412948:web:77956d80aa80500003b541"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// State
let expenses = [];
let currentView = 'current'; // 'current' or 'archives'
let selectedArchiveId = null;
let myChart = null;

// DOM references
const expenseForm = document.getElementById('expense-form');
const tbody = document.getElementById('expense-tbody');
const totalAmountEl = document.getElementById('total-amount');
const dateRangeEl = document.getElementById('report-date-range');
const archiveSelector = document.getElementById('archive-selector');
const editModal = document.getElementById('editModal');

// --- Initialization ---

window.addEventListener('DOMContentLoaded', () => {
    setDefaultDate();
    initApp();
});

function initApp() {
    // Listen for current month expenses
    const currentRef = ref(db, 'current_expenses');
    onValue(currentRef, (snapshot) => {
        if (currentView === 'current') {
            const data = snapshot.val();
            expenses = data ? Object.keys(data).map(key => ({ ...data[key], id: key })) : [];
            expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
            renderUI();
        }
    });

    // Listen for archives list
    const archivesRef = ref(db, 'archives');
    onValue(archivesRef, (snapshot) => {
        const data = snapshot.val();
        updateArchiveSelector(data);
    });
}

function setDefaultDate() {
    document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
}

// --- Navigation & Views ---

window.switchView = (view) => {
    currentView = view;
    document.getElementById('view-current-btn').classList.toggle('active', view === 'current');
    document.getElementById('view-archives-btn').classList.toggle('active', view === 'archives');
    
    document.getElementById('current-report-header').style.display = view === 'current' ? 'flex' : 'none';
    document.getElementById('archive-header').style.display = view === 'archives' ? 'flex' : 'none';

    if (view === 'current') {
        selectedArchiveId = null;
        initApp(); // Reset listener for current
    } else {
        expenses = [];
        renderUI();
    }
};

function updateArchiveSelector(archivesData) {
    archiveSelector.innerHTML = '<option value="">Select an Archive...</option>';
    if (archivesData) {
        Object.keys(archivesData).forEach(id => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.innerText = archivesData[id].name;
            archiveSelector.appendChild(opt);
        });
    }
}

window.loadSpecificArchive = (archiveId) => {
    if (!archiveId) {
        expenses = [];
        renderUI();
        return;
    }
    selectedArchiveId = archiveId;
    const archiveRef = ref(db, `archives/${archiveId}/data`);
    onValue(archiveRef, (snapshot) => {
        if (currentView === 'archives' && selectedArchiveId === archiveId) {
            const data = snapshot.val();
            expenses = data ? Object.keys(data).map(key => ({ ...data[key], id: key })) : [];
            expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
            renderUI();
        }
    }, { onlyOnce: false });
};

// --- CRUD Operations ---

expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newEntry = {
        spender: document.getElementById('exp-spender').value,
        date: document.getElementById('exp-date').value,
        category: document.getElementById('exp-category').value,
        remarks: document.getElementById('exp-remarks').value || "No remarks",
        amount: parseFloat(document.getElementById('exp-amount').value)
    };

    // Pushing to Firebase (Cloud Sync!)
    const targetPath = currentView === 'current' 
        ? 'current_expenses' 
        : `archives/${selectedArchiveId}/data`;
    
    push(ref(db, targetPath), newEntry);
    
    expenseForm.reset();
    setDefaultDate();
});

window.archiveCurrent = () => {
    if (expenses.length === 0) return alert("Nothing to archive.");
    const archiveName = prompt("Enter a name for this archive (e.g., March 2026):");
    if (!archiveName) return;

    const archiveKey = push(ref(db, 'archives')).key;
    
    // Convert array back to object format for Firebase
    const dataObj = {};
    expenses.forEach(exp => {
        const { id, ...cleanExp } = exp;
        dataObj[push(ref(db, 'temp')).key] = cleanExp;
    });

    set(ref(db, `archives/${archiveKey}`), {
        name: archiveName,
        data: dataObj,
        timestamp: Date.now()
    }).then(() => {
        // Clear current month
        set(ref(db, 'current_expenses'), null);
        alert("Archive saved! Current report cleared.");
    });
};

// --- Edit Logic ---

window.openEdit = (id) => {
    const item = expenses.find(e => e.id === id);
    if (!item) return;

    document.getElementById('edit-id').value = id;
    document.getElementById('edit-date').value = item.date;
    document.getElementById('edit-spender').value = item.spender;
    document.getElementById('edit-category').value = item.category;
    document.getElementById('edit-remarks').value = item.remarks;
    document.getElementById('edit-amount').value = item.amount;
    editModal.style.display = 'flex';
};

window.closeModal = () => editModal.style.display = 'none';

window.saveEdit = () => {
    const id = document.getElementById('edit-id').value;
    const updated = {
        spender: document.getElementById('edit-spender').value,
        date: document.getElementById('edit-date').value,
        category: document.getElementById('edit-category').value,
        remarks: document.getElementById('edit-remarks').value,
        amount: parseFloat(document.getElementById('edit-amount').value)
    };

    const path = currentView === 'current' 
        ? `current_expenses/${id}` 
        : `archives/${selectedArchiveId}/data/${id}`;
    
    update(ref(db, path), updated).then(() => {
        closeModal();
    });
};

window.confirmDelete = () => {
    if (!confirm("Are you sure you want to delete this expense permanently?")) return;
    const id = document.getElementById('edit-id').value;
    const path = currentView === 'current' 
        ? `current_expenses/${id}` 
        : `archives/${selectedArchiveId}/data/${id}`;
    
    remove(ref(db, path)).then(() => closeModal());
};

// --- Rendering & Charts ---

function renderUI() {
    tbody.innerHTML = '';
    let total = 0;
    let categoryData = {};

    if (expenses.length === 0) {
        totalAmountEl.innerText = "₹ 0.00";
        dateRangeEl.innerText = "No data found.";
        document.getElementById('empty-state').style.display = 'block';
        updateChart({});
        return;
    }

    document.getElementById('empty-state').style.display = 'none';
    let minD = expenses[0].date;
    let maxD = expenses[0].date;

    expenses.forEach(exp => {
        total += exp.amount;
        categoryData[exp.category] = (categoryData[exp.category] || 0) + exp.amount;
        
        if (exp.date < minD) minD = exp.date;
        if (exp.date > maxD) maxD = exp.date;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(exp.date)}</td>
            <td><span class="spender-tag">${exp.spender}</span></td>
            <td><span class="category-pill">${exp.category}</span></td>
            <td>${exp.remarks}</td>
            <td class="text-right"><strong>₹${exp.amount.toLocaleString('en-IN')}</strong></td>
            <td class="text-center">
                <button class="edit-btn" onclick="openEdit('${exp.id}')">✏️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    totalAmountEl.innerText = `₹ ${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    dateRangeEl.innerText = `${formatDate(minD)} to ${formatDate(maxD)}`;

    updateChart(categoryData);
}

function updateChart(data) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    const labels = Object.keys(data);
    const values = Object.values(data);
    
    // Distinct colors for categories
    const colors = [
        '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
        '#ec4899', '#06b6d4', '#f97316', '#22c55e', '#64748b'
    ];

    if (myChart) myChart.destroy();
    
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses by Category (₹)',
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderRadius: 5
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });
}

// --- Helpers ---

function formatDate(ds) {
    return new Date(ds).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// --- XLSX Export ---
window.exportToExcel = () => {
    if (expenses.length === 0) return alert("Nothing to export");

    // 1. Raw Data Sheet
    const rawContent = expenses.map(e => ({
        "Date": e.date,
        "Spender": e.spender,
        "Category": e.category,
        "Remarks": e.remarks,
        "Amount (₹)": e.amount
    }));

    // Add Grand Total Row
    const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);
    rawContent.push({
        "Date": "GRAND TOTAL",
        "Spender": "",
        "Category": "",
        "Remarks": "",
        "Amount (₹)": grandTotal
    });

    // 2. Summary Data Sheet (Aggregation)
    const summaryMap = {};
    expenses.forEach(e => {
        summaryMap[e.category] = (summaryMap[e.category] || 0) + e.amount;
    });
    const summaryContent = Object.keys(summaryMap).map(cat => ({
        "Category": cat,
        "Total Amount (₹)": summaryMap[cat]
    }));

    const wb = XLSX.utils.book_new();
    const wsRaw = XLSX.utils.json_to_sheet(rawContent);
    const wsSum = XLSX.utils.json_to_sheet(summaryContent);

    XLSX.utils.book_append_sheet(wb, wsRaw, "Detailed Report");
    XLSX.utils.book_append_sheet(wb, wsSum, "Summary");

    const fileName = currentView === 'current' ? 'Family_Expenses.xlsx' : 'Archived_Expense_Report.xlsx';
    XLSX.writeFile(wb, fileName);
};
