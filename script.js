let allQuestions = [], quizQuestions = [], currentIdx = 0, userAnswers = {};
let globalTimerInterval, questionTimerInterval, isStudyMode = false, isChecked = false;

async function init() {
    try {
        const response = await fetch('questions.json');
        allQuestions = await response.json();
        document.getElementById('max-q').innerText = allQuestions.length;
        document.getElementById('q-count').value = allQuestions.length;
    } catch (e) { alert("Файл questions.json не найден!"); }
}

const modeSelect = document.getElementById('mode-select');
const shuffleQuestCheck = document.getElementById('shuffle-questions');
const startAtInput = document.getElementById('start-at');
const timerInputs = document.querySelectorAll('.timer-group input');

const updateSettingsUI = () => {
    isStudyMode = modeSelect.value === 'study';
    timerInputs.forEach(i => i.disabled = isStudyMode);
    startAtInput.disabled = shuffleQuestCheck.checked;
};
modeSelect.onchange = updateSettingsUI;
shuffleQuestCheck.onchange = updateSettingsUI;

document.getElementById('start-btn').onclick = () => {
    const count = parseInt(document.getElementById('q-count').value);
    const startAt = parseInt(startAtInput.value) - 1;
    const shuffleOpts = document.getElementById('shuffle-options').checked;

    if (shuffleQuestCheck.checked) {
        quizQuestions = [...allQuestions].sort(() => 0.5 - Math.random()).slice(0, count);
    } else {
        quizQuestions = [];
        for (let i = 0; i < count; i++) quizQuestions.push(allQuestions[(startAt + i) % allQuestions.length]);
    }

    quizQuestions = quizQuestions.map(q => {
        let opts = q.options.map((text, i) => ({ text, originalIdx: i }));
        if (shuffleOpts) opts.sort(() => 0.5 - Math.random());
        return { ...q, _displayOptions: opts };
    });

    if (isStudyMode) document.getElementById('modal-overlay').style.display = 'flex';
    else startQuiz();
};

document.getElementById('modal-close-btn').onclick = () => {
    document.getElementById('modal-overlay').style.display = 'none';
    startQuiz();
};

function startQuiz() {
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('quiz-screen').style.display = 'block';
    if (!isStudyMode) {
        const totalMin = parseInt(document.getElementById('total-time').value);
        if (totalMin > 0) {
            let time = totalMin * 60;
            globalTimerInterval = setInterval(() => {
                time--;
                document.getElementById('global-timer').innerText = `Тест: ${Math.floor(time/60)}:${(time%60).toString().padStart(2,'0')}`;
                if (time <= 0) finishQuiz();
            }, 1000);
        }
        startQuestionTimer();
    } else renderQuestion();
}

function startQuestionTimer() {
    renderQuestion();
    const qSec = parseInt(document.getElementById('question-time').value);
    if (qSec > 0 && !isStudyMode) {
        clearInterval(questionTimerInterval);
        let timeQ = qSec;
        document.getElementById('question-timer').innerText = `Вопрос: ${timeQ}с`;
        questionTimerInterval = setInterval(() => {
            timeQ--;
            document.getElementById('question-timer').innerText = `Вопрос: ${timeQ}с`;
            if (timeQ <= 0) {
                if (currentIdx < quizQuestions.length - 1) { currentIdx++; startQuestionTimer(); }
                else finishQuiz();
            }
        }, 1000);
    }
}

function renderQuestion() {
    const data = quizQuestions[currentIdx];
    const container = document.getElementById('options-container');
    isChecked = false;
    document.getElementById('question-text').innerText = data.question;
    container.innerHTML = '';
    document.getElementById('progress-bar').style.width = `${((currentIdx + 1) / quizQuestions.length) * 100}%`;
    document.getElementById('check-btn').style.display = isStudyMode ? 'block' : 'none';

    data._displayOptions.forEach((opt) => {
        const div = document.createElement('div');
        div.className = 'option-item';
        if (userAnswers[currentIdx]?.includes(opt.originalIdx)) div.classList.add('selected');
        div.innerText = opt.text;
        div.onclick = () => {
            if (isChecked) return;
            if (data.correct.length === 1) {
                Array.from(container.children).forEach(c => c.classList.remove('selected'));
                div.classList.add('selected');
                userAnswers[currentIdx] = [opt.originalIdx];
            } else {
                div.classList.toggle('selected');
                if (!userAnswers[currentIdx]) userAnswers[currentIdx] = [];
                userAnswers[currentIdx] = Array.from(container.querySelectorAll('.selected')).map(el => 
                    data._displayOptions[Array.from(container.children).indexOf(el)].originalIdx);
            }
        };
        container.appendChild(div);
    });
    document.getElementById('prev-btn').disabled = currentIdx === 0 || isStudyMode;
}

document.getElementById('check-btn').onclick = () => {
    isChecked = true;
    const data = quizQuestions[currentIdx];
    const userAns = userAnswers[currentIdx] || [];
    const items = document.querySelectorAll('.option-item');
    data._displayOptions.forEach((opt, i) => {
        items[i].classList.add('disabled');
        if (data.correct.includes(opt.originalIdx) && userAns.includes(opt.originalIdx)) items[i].classList.add('correct-hit');
        else if (data.correct.includes(opt.originalIdx)) items[i].classList.add('correct-missed');
        else if (userAns.includes(opt.originalIdx)) items[i].classList.add('wrong-hit');
    });
};

document.getElementById('next-btn').onclick = () => {
    if (currentIdx < quizQuestions.length - 1) { currentIdx++; isStudyMode ? renderQuestion() : startQuestionTimer(); }
    else finishQuiz();
};

document.getElementById('prev-btn').onclick = () => {
    if (currentIdx > 0) { currentIdx--; renderQuestion(); }
};

function finishQuiz() {
    clearInterval(globalTimerInterval); clearInterval(questionTimerInterval);
    let score = 0; let report = '';
    quizQuestions.forEach((q, i) => {
        const ans = userAnswers[i] || [];
        if (JSON.stringify(ans.sort()) === JSON.stringify([...q.correct].sort())) score++;
        let opts = '';
        q.options.forEach((o, idx) => {
            let cls = q.correct.includes(idx) && ans.includes(idx) ? 'correct-hit' : (q.correct.includes(idx) ? 'correct-missed' : (ans.includes(idx) ? 'wrong-hit' : 'neutral'));
            opts += `<div class="report-opt ${cls}">${o}</div>`;
        });
        report += `<div class="report-item"><b>${q.question}</b>${opts}</div>`;
    });
    document.getElementById('quiz-screen').innerHTML = `<h2>Итог: ${score}/${quizQuestions.length}</h2><div class="report-container">${report}</div><button onclick="location.reload()" style="width:100%; background:#333; color:white; padding:15px; margin-top:20px; border-radius:10px;">В начало</button>`;
}

init(); updateSettingsUI();
let allQuestions = [], quizQuestions = [], currentIdx = 0, userAnswers = {};
let globalTimerInterval, questionTimerInterval, isStudyMode = false, isChecked = false;

async function init() {
    try {
        const response = await fetch('questions.json');
        allQuestions = await response.json();
        document.getElementById('max-q').innerText = allQuestions.length;
        document.getElementById('q-count').value = allQuestions.length;
    } catch (e) { alert("Файл questions.json не найден!"); }
}

const modeSelect = document.getElementById('mode-select');
const shuffleQuestCheck = document.getElementById('shuffle-questions');
const startAtInput = document.getElementById('start-at');
const timerInputs = document.querySelectorAll('.timer-group input');

const updateSettingsUI = () => {
    isStudyMode = modeSelect.value === 'study';
    timerInputs.forEach(i => i.disabled = isStudyMode);
    startAtInput.disabled = shuffleQuestCheck.checked;
};
modeSelect.onchange = updateSettingsUI;
shuffleQuestCheck.onchange = updateSettingsUI;

document.getElementById('start-btn').onclick = () => {
    const countInput = document.getElementById('q-count').value;
    const count = countInput ? parseInt(countInput) : allQuestions.length;
    const startAt = parseInt(startAtInput.value) - 1;
    const shuffleOpts = document.getElementById('shuffle-options').checked;

    if (shuffleQuestCheck.checked) {
        quizQuestions = [...allQuestions].sort(() => 0.5 - Math.random()).slice(0, count);
    } else {
        quizQuestions = [];
        for (let i = 0; i < count; i++) quizQuestions.push(allQuestions[(startAt + i) % allQuestions.length]);
    }

    quizQuestions = quizQuestions.map(q => {
        let opts = q.options.map((text, i) => ({ text, originalIdx: i }));
        if (shuffleOpts) opts.sort(() => 0.5 - Math.random());
        return { ...q, _displayOptions: opts };
    });

    if (isStudyMode) document.getElementById('modal-overlay').style.display = 'flex';
    else startQuiz();
};

document.getElementById('modal-close-btn').onclick = () => {
    document.getElementById('modal-overlay').style.display = 'none';
    startQuiz();
};

function startQuiz() {
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('quiz-screen').style.display = 'block';
    if (!isStudyMode) {
        const totalMin = parseInt(document.getElementById('total-time').value);
        if (totalMin > 0) {
            let time = totalMin * 60;
            globalTimerInterval = setInterval(() => {
                time--;
                document.getElementById('global-timer').innerText = `Тест: ${Math.floor(time/60)}:${(time%60).toString().padStart(2,'0')}`;
                if (time <= 0) finishQuiz();
            }, 1000);
        }
        startQuestionTimer();
    } else renderQuestion();
}

function startQuestionTimer() {
    renderQuestion();
    const qSec = parseInt(document.getElementById('question-time').value);
    if (qSec > 0 && !isStudyMode) {
        clearInterval(questionTimerInterval);
        let timeQ = qSec;
        document.getElementById('question-timer').innerText = `Вопрос: ${timeQ}с`;
        questionTimerInterval = setInterval(() => {
            timeQ--;
            document.getElementById('question-timer').innerText = `Вопрос: ${timeQ}с`;
            if (timeQ <= 0) {
                if (currentIdx < quizQuestions.length - 1) { currentIdx++; startQuestionTimer(); }
                else finishQuiz();
            }
        }, 1000);
    }
}

function renderQuestion() {
    const data = quizQuestions[currentIdx];
    const container = document.getElementById('options-container');
    isChecked = false;
    document.getElementById('question-text').innerText = data.question;
    container.innerHTML = '';
    document.getElementById('progress-bar').style.width = `${((currentIdx + 1) / quizQuestions.length) * 100}%`;
    document.getElementById('check-btn').style.display = isStudyMode ? 'block' : 'none';

    data._displayOptions.forEach((opt) => {
        const div = document.createElement('div');
        div.className = 'option-item';
        if (userAnswers[currentIdx]?.includes(opt.originalIdx)) div.classList.add('selected');
        div.innerText = opt.text;
        div.onclick = () => {
            if (isChecked) return;
            if (data.correct.length === 1) {
                Array.from(container.children).forEach(c => c.classList.remove('selected'));
                div.classList.add('selected');
                userAnswers[currentIdx] = [opt.originalIdx];
            } else {
                div.classList.toggle('selected');
                if (!userAnswers[currentIdx]) userAnswers[currentIdx] = [];
                const currentSelection = Array.from(container.querySelectorAll('.selected')).map(el => 
                    data._displayOptions[Array.from(container.children).indexOf(el)].originalIdx);
                userAnswers[currentIdx] = currentSelection;
            }
        };
        container.appendChild(div);
    });
    document.getElementById('prev-btn').disabled = currentIdx === 0 || isStudyMode;
    document.getElementById('next-btn').innerText = currentIdx === quizQuestions.length - 1 ? "Завершить" : "Далее";
}

document.getElementById('check-btn').onclick = () => {
    isChecked = true;
    const data = quizQuestions[currentIdx];
    const userAns = userAnswers[currentIdx] || [];
    const items = document.querySelectorAll('.option-item');
    data._displayOptions.forEach((opt, i) => {
        items[i].classList.add('disabled');
        if (data.correct.includes(opt.originalIdx) && userAns.includes(opt.originalIdx)) items[i].classList.add('correct-hit');
        else if (data.correct.includes(opt.originalIdx)) items[i].classList.add('correct-missed');
        else if (userAns.includes(opt.originalIdx)) items[i].classList.add('wrong-hit');
    });
};

document.getElementById('next-btn').onclick = () => {
    if (currentIdx < quizQuestions.length - 1) { currentIdx++; isStudyMode ? renderQuestion() : startQuestionTimer(); }
    else finishQuiz();
};

document.getElementById('prev-btn').onclick = () => {
    if (currentIdx > 0) { currentIdx--; renderQuestion(); }
};

function finishQuiz() {
    clearInterval(globalTimerInterval); clearInterval(questionTimerInterval);
    let score = 0; let report = '';
    quizQuestions.forEach((q, i) => {
        const ans = userAnswers[i] || [];
        if (JSON.stringify(ans.sort()) === JSON.stringify([...q.correct].sort())) score++;
        let opts = '';
        q.options.forEach((o, idx) => {
            let cls = q.correct.includes(idx) && ans.includes(idx) ? 'correct-hit' : (q.correct.includes(idx) ? 'correct-missed' : (ans.includes(idx) ? 'wrong-hit' : 'neutral'));
            opts += `<div class="report-opt ${cls}">${o}</div>`;
        });
        report += `<div class="report-item"><b>${q.question}</b>${opts}</div>`;
    });
    document.getElementById('quiz-screen').innerHTML = `<h2>Итог: ${score}/${quizQuestions.length}</h2><div class="report-container">${report}</div><button onclick="location.reload()" style="width:100%; background:#333; color:white; padding:15px; margin-top:20px; border-radius:10px;">В начало</button>`;
}

init(); updateSettingsUI();
