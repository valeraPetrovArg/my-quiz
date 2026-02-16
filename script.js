let allQuestions = [], quizQuestions = [], currentIdx = 0, userAnswers = {};
let globalTimerInterval, questionTimerInterval, isStudyMode = false, isChecked = false;

async function init() {
    try {
        const response = await fetch('questions.json');
        if (!response.ok) throw new Error('Сеть ответила с ошибкой');
        allQuestions = await response.json();
        document.getElementById('max-q').innerText = allQuestions.length;
        document.getElementById('q-count').value = allQuestions.length;
    } catch (e) { 
        console.error("Ошибка загрузки JSON:", e);
        document.getElementById('question-text').innerText = "Ошибка загрузки вопросов!";
    }
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

if (modeSelect) modeSelect.onchange = updateSettingsUI;
if (shuffleQuestCheck) shuffleQuestCheck.onchange = updateSettingsUI;

document.getElementById('start-btn').onclick = () => {
    const countInput = document.getElementById('q-count').value;
    const count = countInput ? parseInt(countInput) : allQuestions.length;
    const startAt = parseInt(startAtInput.value || 1) - 1;
    const shuffleOpts = document.getElementById('shuffle-options').checked;

    if (shuffleQuestCheck.checked) {
        quizQuestions = [...allQuestions].sort(() => 0.5 - Math.random()).slice(0, count);
    } else {
        quizQuestions = [];
        for (let i = 0; i < count; i++) {
            quizQuestions.push(allQuestions[(startAt + i) % allQuestions.length]);
        }
    }

    quizQuestions = quizQuestions.map(q => {
        let opts = q.options.map((text, i) => ({ text, originalIdx: i }));
        if (shuffleOpts) opts.sort(() => 0.5 - Math.random());
        return { ...q, _displayOptions: opts };
    });

    if (isStudyMode) {
        document.getElementById('modal-overlay').style.display = 'flex';
    } else {
        startQuiz();
    }
};

document.getElementById('modal-close-btn').onclick = () => {
    document.getElementById('modal-overlay').style.display = 'none';
    startQuiz();
};

function startQuiz() {
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('quiz-screen').style.display = 'block';
    if (!isStudyMode) {
        const totalMin = parseInt(document.getElementById('total-time').value || 0);
        if (totalMin > 0) {
            let time = totalMin * 60;
            globalTimerInterval = setInterval(() => {
                time--;
                const m = Math.floor(time/60);
                const s = (time%60).toString().padStart(2,'0');
                document.getElementById('global-timer').innerText = `Тест: ${m}:${s}`;
                if (time <= 0) finishQuiz();
            }, 1000);
        }
        startQuestionTimer();
    } else {
        renderQuestion();
    }
}

function startQuestionTimer() {
    renderQuestion();
    const qSec = parseInt(document.getElementById('question-time').value || 0);
    if (qSec > 0 && !isStudyMode) {
        clearInterval(questionTimerInterval);
        let timeQ = qSec;
        document.getElementById('question-timer').innerText = `Вопрос: ${timeQ}с`;
        questionTimerInterval = setInterval(() => {
            timeQ--;
            document.getElementById('question-timer').innerText = `Вопрос: ${timeQ}с`;
            if (timeQ <= 0) {
                if (currentIdx < quizQuestions.length - 1) { 
                    currentIdx++; 
                    startQuestionTimer(); 
                } else {
                    finishQuiz();
                }
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
        if (userAnswers[currentIdx] && userAnswers[currentIdx].includes(opt.originalIdx)) div.classList.add('selected');
        div.innerText = opt.text;
        div.onclick = () => {
            if (isChecked) return;
            if (data.correct.length === 1) {
                Array.from(container.children).forEach(c => c.classList.remove('selected'));
                div.classList.add('selected');
                userAnswers[currentIdx] = [opt.originalIdx];
            } else {
                div.classList.toggle('selected');
                const selectedElements = Array.from(container.querySelectorAll('.selected'));
                userAnswers[currentIdx] = selectedElements.map(el => 
                    data._displayOptions[Array.from(container.children).indexOf(el)].originalIdx
                );
            }
        };
        container.appendChild(div);
    });
    document.getElementById('prev-btn').disabled = currentIdx === 0 || isStudyMode;
    document.getElementById('next-btn').innerText = currentIdx === quizQuestions.length - 1 ? "Завершить" : "Далее";
}

document.getElementById('check-btn').onclick = () => {
    if (isChecked) return;
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
    if (currentIdx < quizQuestions.length - 1) { 
        currentIdx++; 
        isStudyMode ? renderQuestion() : startQuestionTimer(); 
    } else {
        finishQuiz();
    }
};

document.getElementById('prev-btn').onclick = () => {
    if (currentIdx > 0) { 
        currentIdx--; 
        renderQuestion(); 
    }
};

function finishQuiz() {
    clearInterval(globalTimerInterval);
    clearInterval(questionTimerInterval);
    let score = 0;
    let report = '';
    
    const legendHTML = `
        <div style="text-align:left; margin: 15px 0; padding: 12px; background: #fdfdfd; border-radius: 10px; font-size: 13px; border: 1px solid #eee;">
            <div style="margin-bottom:8px;"><span style="display:inline-block; width:16px; height:16px; background:#FFEB3B; border-radius:4px; vertical-align:middle; border:1px solid #ddd;"></span> <b>Желтый:</b> Выбрано верно</div>
            <div style="margin-bottom:8px;"><span style="display:inline-block; width:16px; height:16px; background:#4CAF50; border-radius:4px; vertical-align:middle; border:1px solid #ddd;"></span> <b>Зеленый:</b> Нужно было выбрать</div>
            <div><span style="display:inline-block; width:16px; height:16px; background:#F44336; border-radius:4px; vertical-align:middle; border:1px solid #ddd;"></span> <b>Красный:</b> Ошибка (лишнее)</div>
        </div>
    `;

    quizQuestions.forEach((q, i) => {
        const ans = userAnswers[i] || [];
        const isCorrect = ans.length === q.correct.length && ans.every(v => q.correct.includes(v));
        if (isCorrect) score++;
        
        let opts = '';
        q.options.forEach((o, idx) => {
            let cls = 'report-opt';
            if (q.correct.includes(idx) && ans.includes(idx)) cls += ' correct-hit';
            else if (q.correct.includes(idx)) cls += ' correct-missed';
            else if (ans.includes(idx)) cls += ' wrong-hit';
            opts += `<div class="${cls}">${o}</div>`;
        });
        report += `<div class="report-item"><b>${i + 1}. ${q.question}</b>${opts}</div>`;
    });

    document.getElementById('quiz-screen').innerHTML = `
        <div style="text-align:center">
            <h2>Результат: ${score} из ${quizQuestions.length}</h2>
            ${legendHTML}
            <div class="report-container">${report}</div>
            <button onclick="location.reload()" style="width:100%; background:#333; color:white; padding:15px; margin-top:20px; border-radius:12px; font-weight:bold;">На главную</button>
        </div>`;
}

init();
updateSettingsUI();
