const INDEX_JSON_PATH = 'data/index.json';
const STORAGE_KEY = 'cbt_saved_results';

// Global State
let categoriesData = [];
let selectedCategory = null;
let questionsData = [];
let currentIndex = 0;
let userAnswers = {};
let doubtStatus = {};
let studentName = "";
let timerInterval = null;
let timeRemaining = 0;
let currentExamResult = null; // Menyimpan temporary result untuk di-save

// DOM Elements
const startScreen = document.getElementById('start-screen');
const categoryScreen = document.getElementById('category-screen');
const quizScreen = document.getElementById('quiz-screen');
const reviewScreen = document.getElementById('review-screen');
const savedReviewsScreen = document.getElementById('saved-reviews-screen');
const quizMeta = document.getElementById('quiz-meta');

const questionNumberEl = document.getElementById('question-number');
const questionTextEl = document.getElementById('question-text');
const optionsContainerEl = document.getElementById('options-container');
const navigationGridEl = document.getElementById('navigation-grid');
const doubtCheckbox = document.getElementById('doubt-checkbox');

// Router Listener
window.addEventListener('hashchange', handleRouting);
window.addEventListener('DOMContentLoaded', async () => {
    await fetchCategoryManifest();
    handleRouting();
});

// Routing Handler (#ujian vs #review)
function handleRouting() {
    const hash = window.location.hash || '#ujian';
    
    // Hide All Screens
    startScreen.classList.add('hidden');
    categoryScreen.classList.add('hidden');
    quizScreen.classList.add('hidden');
    reviewScreen.classList.add('hidden');
    savedReviewsScreen.classList.add('hidden');
    quizMeta.classList.add('hidden');

    if (hash === '#review') {
        renderSavedReviewsPage();
        savedReviewsScreen.classList.remove('hidden');
    } else {
        // Default: #ujian
        if (studentName) {
            categoryScreen.classList.remove('hidden');
            renderCategoryCards();
        } else {
            startScreen.classList.remove('hidden');
        }
    }
}

// Event Listeners
document.getElementById('btn-next-to-category').addEventListener('click', () => {
    const input = document.getElementById('student-name').value.trim();
    if (!input) {
        alert("Silakan masukkan nama Anda terlebih dahulu.");
        return;
    }
    studentName = input;
    document.getElementById('welcome-text').textContent = `Peserta: ${studentName}`;
    
    startScreen.classList.add('hidden');
    categoryScreen.classList.remove('hidden');
    renderCategoryCards();
});

document.getElementById('btn-back-to-name').addEventListener('click', () => {
    categoryScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

document.getElementById('btn-prev').addEventListener('click', () => navigateQuestion(currentIndex - 1));
document.getElementById('btn-next').addEventListener('click', () => navigateQuestion(currentIndex + 1));
document.getElementById('btn-submit').addEventListener('click', () => {
    if (confirm("Apakah Anda yakin ingin menyelesaikan ujian ini?")) {
        finishQuiz();
    }
});

document.getElementById('btn-save-result').addEventListener('click', saveCurrentResult);
document.getElementById('btn-clear-history').addEventListener('click', clearAllHistory);

doubtCheckbox.addEventListener('change', (e) => {
    doubtStatus[currentIndex] = e.target.checked;
    renderNavigation();
});

// Fetch Katalog
async function fetchCategoryManifest() {
    try {
        const res = await fetch(INDEX_JSON_PATH);
        if (!res.ok) throw new Error("Gagal mengambil katalog.");
        categoriesData = await res.json();
    } catch (err) {
        console.error(err);
    }
}

// Render Kartu Materi
function renderCategoryCards() {
    const listEl = document.getElementById('category-list');
    listEl.innerHTML = '';

    categoriesData.forEach(item => {
        const card = document.createElement('div');
        card.className = `p-5 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between`;
        
        card.innerHTML = `
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <span class="text-3xl">${item.icon || '📝'}</span>
                    <h3 class="font-bold text-slate-800 text-lg">${item.title}</h3>
                </div>
                <p class="text-sm text-slate-600 mb-4">${item.description}</p>
            </div>
            <div class="flex justify-between items-center text-xs text-slate-400 border-t pt-3">
                <span>⏱️ Waktu: ${Math.floor(item.timeLimit / 60)} Menit</span>
                <span class="text-blue-600 font-semibold">Pilih Materi &rarr;</span>
            </div>
        `;

        card.addEventListener('click', () => selectAndStartCategory(item));
        listEl.appendChild(card);
    });
}

// Load Soal & Start
async function selectAndStartCategory(category) {
    try {
        selectedCategory = category;
        const res = await fetch(`data/${category.file}`);
        if (!res.ok) throw new Error(`File ${category.file} tidak ditemukan.`);
        
        questionsData = await res.json();
        timeRemaining = category.timeLimit;

        document.getElementById('header-student-name').textContent = studentName;
        document.getElementById('header-category-title').textContent = category.title;

        categoryScreen.classList.add('hidden');
        quizScreen.classList.remove('hidden');
        quizMeta.classList.remove('hidden');

        currentIndex = 0;
        userAnswers = {};
        doubtStatus = {};

        startTimer();
        renderQuestion();
        renderNavigation();
    } catch (err) {
        alert("Gagal memuat soal: " + err.message);
    }
}

// Timer
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const timerEl = document.getElementById('timer');
    
    const updateDisplay = () => {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    updateDisplay();

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateDisplay();

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert("Waktu ujian telah habis!");
            finishQuiz();
        }
    }, 1000);
}

// Render Soal
function renderQuestion() {
    const q = questionsData[currentIndex];
    questionNumberEl.textContent = `Soal ${currentIndex + 1} dari ${questionsData.length}`;
    questionTextEl.textContent = q.question;
    
    doubtCheckbox.checked = !!doubtStatus[currentIndex];
    optionsContainerEl.innerHTML = '';

    Object.entries(q.options).forEach(([key, value]) => {
        const isSelected = userAnswers[currentIndex] === key;
        
        const optionCard = document.createElement('div');
        optionCard.className = `option-card border rounded-lg p-4 flex items-center cursor-pointer transition-all select-none ${
            isSelected 
                ? 'selected bg-blue-50 border-blue-600 ring-2 ring-blue-600' 
                : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
        }`;
        
        optionCard.innerHTML = `
            <input type="radio" name="option_${currentIndex}" value="${key}" ${isSelected ? 'checked' : ''} class="sr-only">
            <span class="w-7 h-7 rounded-full border ${
                isSelected ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 bg-white'
            } flex items-center justify-center text-xs font-bold mr-3 shrink-0">
                ${key}
            </span>
            <span class="text-sm text-slate-700 font-medium">${value}</span>
        `;

        optionCard.addEventListener('click', () => {
            userAnswers[currentIndex] = key;
            renderQuestion();
            renderNavigation();
        });

        optionsContainerEl.appendChild(optionCard);
    });

    document.getElementById('btn-prev').disabled = currentIndex === 0;
    document.getElementById('btn-next').textContent = currentIndex === questionsData.length - 1 ? 'Selesai' : 'Berikutnya';
}

// Render Navigasi
function renderNavigation() {
    navigationGridEl.innerHTML = '';
    
    questionsData.forEach((_, idx) => {
        const btn = document.createElement('button');
        btn.textContent = idx + 1;
        btn.className = `h-10 rounded-lg font-semibold text-xs transition-all `;

        if (idx === currentIndex) {
            btn.classList.add('ring-2', 'ring-blue-700', 'ring-offset-1');
        }

        if (doubtStatus[idx]) {
            btn.classList.add('nav-btn-doubt');
        } else if (userAnswers[idx]) {
            btn.classList.add('nav-btn-answered');
        } else {
            btn.classList.add('nav-btn-default');
        }

        btn.addEventListener('click', () => navigateQuestion(idx));
        navigationGridEl.appendChild(btn);
    });
}

function navigateQuestion(newIndex) {
    if (newIndex >= 0 && newIndex < questionsData.length) {
        currentIndex = newIndex;
        renderQuestion();
        renderNavigation();
    } else if (newIndex >= questionsData.length) {
        if (confirm("Apakah Anda yakin ingin menyelesaikan ujian ini?")) {
            finishQuiz();
        }
    }
}

// Selesaikan Ujian
function finishQuiz() {
    if (timerInterval) clearInterval(timerInterval);
    
    quizScreen.classList.add('hidden');
    quizMeta.classList.add('hidden');
    reviewScreen.classList.remove('hidden');

    let correctCount = 0;
    const totalQuestions = questionsData.length;

    questionsData.forEach((q, idx) => {
        const userAns = userAnswers[idx];
        if (userAns && userAns.trim().toUpperCase() === q.answer.trim().toUpperCase()) {
            correctCount++;
        }
    });

    const score = Math.round((correctCount / totalQuestions) * 100);

    // Simpan objek metadata evaluasi sementara
    currentExamResult = {
        id: Date.now(),
        date: new Date().toLocaleString('id-ID'),
        studentName: studentName,
        categoryTitle: selectedCategory ? selectedCategory.title : 'Ujian',
        score: score,
        correctCount: correctCount,
        wrongCount: totalQuestions - correctCount,
        totalQuestions: totalQuestions,
        questionsData: questionsData,
        userAnswers: userAnswers
    };

    document.getElementById('review-student-name').textContent = `Peserta: ${studentName}`;
    document.getElementById('review-score').textContent = score;
    document.getElementById('review-correct').textContent = `${correctCount} Soal`;
    document.getElementById('review-wrong').textContent = `${totalQuestions - correctCount} Soal`;

    renderReviewList(questionsData, userAnswers);
}

// Render Review Detail
function renderReviewList(questions, answers, containerId = 'review-list') {
    const listEl = document.getElementById(containerId);
    listEl.innerHTML = '';

    questions.forEach((q, idx) => {
        const userAns = answers[idx] || null;
        const isCorrect = userAns && userAns.trim().toUpperCase() === q.answer.trim().toUpperCase();

        const userAnsText = userAns 
            ? `${userAns}. ${q.options[userAns]}` 
            : '<span class="italic text-rose-500 font-semibold">Tidak Dijawab</span>';
        const keyAnsText = `${q.answer}. ${q.options[q.answer]}`;

        const card = document.createElement('div');
        card.className = `p-5 rounded-lg border ${
            isCorrect 
                ? 'border-emerald-200 bg-emerald-50/40' 
                : 'border-rose-200 bg-rose-50/40'
        }`;

        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold px-2.5 py-1 rounded-full ${
                    isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }">
                    ${isCorrect ? 'BENAR' : 'SALAH'}
                </span>
                <span class="text-xs text-slate-400 font-semibold">Soal #${idx + 1}</span>
            </div>
            
            <p class="font-medium text-slate-800 mb-4">${q.question}</p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-4 bg-white p-3 rounded-lg border border-slate-200">
                <div>
                    <span class="text-xs text-slate-400 uppercase font-bold block mb-1">Jawaban Anda:</span>
                    <span class="${isCorrect ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}">
                        ${userAnsText}
                    </span>
                </div>
                <div>
                    <span class="text-xs text-slate-400 uppercase font-bold block mb-1">Kunci Jawaban:</span>
                    <span class="text-emerald-700 font-semibold">
                        ${keyAnsText}
                    </span>
                </div>
            </div>
            
            <div class="text-xs text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
                <strong class="text-slate-700">Pembahasan:</strong> ${q.explanation || 'Tidak ada pembahasan.'}
            </div>
        `;

        listEl.appendChild(card);
    });
}

// 💾 FITUR SAVING KE LOCALSTORAGE
function saveCurrentResult() {
    if (!currentExamResult) return;

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    saved.unshift(currentExamResult); // Tambah ke awal array
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    alert("Hasil evaluasi berhasil disimpan! Anda bisa mengeceknya kapan saja di menu Riwayat Review.");
    window.location.hash = '#review';
}

// 📖 RENDER LAMAN REVIEWS SAVED (#review)
function renderSavedReviewsPage() {
    const listEl = document.getElementById('saved-reviews-list');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

    if (saved.length === 0) {
        listEl.innerHTML = `
            <div class="bg-white p-8 rounded-xl border text-center text-slate-400">
                <p>Belum ada riwayat hasil ujian yang disimpan.</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = '';
    saved.forEach(item => {
        const card = document.createElement('div');
        card.className = `bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4`;
        
        card.innerHTML = `
            <div class="flex justify-between items-start border-b pb-3">
                <div>
                    <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">${item.categoryTitle}</span>
                    <h3 class="font-bold text-slate-800 text-base mt-1">${item.studentName}</h3>
                    <p class="text-xs text-slate-400">${item.date}</p>
                </div>
                <div class="text-right">
                    <span class="text-2xl font-black text-blue-600">${item.score}</span>
                    <span class="text-[10px] block text-slate-400 font-bold uppercase">Nilai</span>
                </div>
            </div>
            <div class="flex justify-between items-center text-xs text-slate-600">
                <span>✓ Benar: <strong>${item.correctCount}</strong> | ✗ Salah: <strong>${item.wrongCount}</strong></span>
                <button class="toggle-detail-btn text-blue-600 font-semibold hover:underline">Lihat Rincian Jawaban &darr;</button>
            </div>
            <div class="detail-container hidden pt-3 border-t space-y-3"></div>
        `;

        const btnToggle = card.querySelector('.toggle-detail-btn');
        const detailContainer = card.querySelector('.detail-container');

        btnToggle.addEventListener('click', () => {
            const isHidden = detailContainer.classList.contains('hidden');
            if (isHidden) {
                detailContainer.classList.remove('hidden');
                btnToggle.innerHTML = 'Sembunyikan Rincian &uparrow;';
                // Render rincian menggunakan ID unik container
                const tempId = `saved-detail-${item.id}`;
                detailContainer.id = tempId;
                renderReviewList(item.questionsData, item.userAnswers, tempId);
            } else {
                detailContainer.classList.add('hidden');
                btnToggle.innerHTML = 'Lihat Rincian Jawaban &darr;';
            }
        });

        listEl.appendChild(card);
    });
}

// Clear History
function clearAllHistory() {
    if (confirm("Apakah Anda yakin ingin menghapus seluruh riwayat ujian tersimpan?")) {
        localStorage.removeItem(STORAGE_KEY);
        renderSavedReviewsPage();
    }
}