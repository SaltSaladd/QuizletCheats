// ==UserScript==
// @name         Quizlet Hacks GUI
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  simple quizlet cheat gui
// @author       saltsalad
// @match        https://quizlet.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const panel = document.createElement('div');
    panel.id = 'qh-gui';
    panel.style.position = 'fixed';
    panel.style.right = '12px';
    panel.style.bottom = '12px';
    panel.style.zIndex = 9999999;
    panel.style.background = 'rgba(20,20,20,0.95)';
    panel.style.color = '#fff';
    panel.style.padding = '10px';
    panel.style.borderRadius = '8px';
    panel.style.fontFamily = 'Arial, sans-serif';
    panel.style.fontSize = '13px';
    panel.style.width = '260px';
    panel.style.boxShadow = '0 4px 14px rgba(0,0,0,0.5)';

    panel.innerHTML = `
        <div id="qh-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:move;">
            <strong style="user-select:none">Quizlet Hacks</strong>
            <div style="display:flex;gap:6px;align-items:center">
                <button id="qh-toggle" title="Minimize" style="background:#333;color:#fff;border:none;padding:2px 6px;border-radius:4px;cursor:pointer">−</button>
            </div>
        </div>
        <div id="qh-list" style="display:flex;flex-direction:column;gap:6px;max-height:360px;overflow:auto"></div>
        <div id="qh-footer" style="margin-top:8px;text-align:right;font-size:11px;opacity:0.8">GUI</div>
    `;

    document.body.appendChild(panel);
    const toggleBtn = document.getElementById('qh-toggle');
    const listEl = document.getElementById('qh-list');
    const footerEl = document.getElementById('qh-footer');
    let minimized = false;
    toggleBtn.addEventListener('click', ()=>{
        minimized = !minimized;
        if (minimized){
            listEl.style.display = 'none';
            footerEl.style.display = 'none';
            toggleBtn.textContent = '+';
            toggleBtn.title = 'Restore';
            panel.style.width = '160px';
        } else {
            listEl.style.display = 'flex';
            footerEl.style.display = 'block';
            toggleBtn.textContent = '−';
            toggleBtn.title = 'Minimize';
            panel.style.width = '260px';
        }
    });

    const list = document.getElementById('qh-list');

    let intervals = {};

    function startBlastHighlight(){
        if (intervals.blast) return;
        console.log('[Quizlet Hacks] blast: interval started');
        intervals.blast = setInterval(()=>{
            // New structure: look inside #__next > main
            const main = document.querySelector('#__next > main');
            if (!main) {
                console.warn('[Quizlet Hacks] blast: main not found');
                return;
            }
            // Try to find the parent with answer options
            let parent = main.querySelector('div[role="group"]');
            if (!parent) {
                // Fallback: first div with many children
                parent = Array.from(main.querySelectorAll('div')).find(div => div.children.length > 3);
            }
            if (!parent) {
                console.warn('[Quizlet Hacks] blast: parent not found');
                return;
            }
            const customElements = [...parent.children].filter(e => e.tagName === 'DIV');
            if (!customElements.length) {
                console.warn('[Quizlet Hacks] blast: customElements not found');
            }
            // Try to find a wrapper with a React fiber
            let wrapper = null;
            for (const el of main.querySelectorAll('div')) {
                const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
                if (fiberKey) {
                    wrapper = el;
                    break;
                }
            }
            if (!wrapper) {
                console.warn('[Quizlet Hacks] blast: wrapper not found');
                return;
            }
            const fiberKey = Object.keys(wrapper).find(k => k.startsWith('__reactFiber$'));
            if (!fiberKey) {
                console.warn('[Quizlet Hacks] blast: fiberKey not found');
                return;
            }
            const fiber = wrapper[fiberKey];
            if (!fiber) {
                console.warn('[Quizlet Hacks] blast: fiber not found');
                return;
            }
            // Try to find props in a robust way
            let props = null;
            let f = fiber;
            for (let i = 0; i < 6; i++) {
                if (f?.memoizedProps?.children?.[0]?.props) {
                    props = f.memoizedProps.children[0].props;
                    break;
                }
                f = f.return;
            }
            if (!props || !props.currentQuestion) {
                console.warn('[Quizlet Hacks] blast: props or currentQuestion not found');
                return;
            }
            const answerSide = props.currentQuestion.cardSides[props.options.answerWith === 'definition' ? 1 : 0];
            if (!answerSide || !answerSide.media || !answerSide.media[0]) {
                console.warn('[Quizlet Hacks] blast: answerSide or media not found');
                return;
            }
            const answerElement = customElements.find(e => e.innerText === answerSide.media[0].plainText);
            if (answerElement) {
                answerElement.style.color = 'lime';
            } else {
                // Print all customElements for debugging
                console.log('[Quizlet Hacks] blast: answerElement not found. customElements:', customElements.map(e => e.innerText));
            }
        }, 75);
    }
    function stopBlastHighlight(){ clearInterval(intervals.blast); delete intervals.blast; }

    function startBlocksShowAnswer(){
        if (intervals.blocks) return;
        // Remove any old answer display
        function removeOldAnswer() {
            const old = document.getElementById('qh-blocks-answer');
            if (old) old.remove();
        }
        intervals.blocks = setInterval(()=>{
            const setData = JSON.parse(__NEXT_DATA__.props.pageProps.dehydratedReduxStateKey);
            const cards = setData.studyModesCommon.studiableData.studiableItems;
            const image = document.querySelector('img[src]')?.src;
            const term = document.querySelector('p')?.innerText;
            if (!term) { removeOldAnswer(); return; }
            const card = cards.find((card) => card.cardSides.some((side) => side.media[0].plainText == term && (image ? side.media[1]?.url?.replace('_m.', '.') === image : true)));
            if (!card) { removeOldAnswer(); return; }
            const otherSide = card.cardSides.find((side) => side.media[0].plainText !== term);
            const input = document.querySelector('input');
            if (!input) { removeOldAnswer(); return; }
            // Find the prompt container (assume input's parent or grandparent)
            let promptContainer = input.parentElement;
            for (let i = 0; i < 3 && promptContainer; i++) {
                if (promptContainer.querySelector('input') === input) break;
                promptContainer = promptContainer.parentElement;
            }
            if (!promptContainer) { removeOldAnswer(); return; }
            // Remove any old answer display
            removeOldAnswer();
            // Insert answer above the prompt
            const answerDiv = document.createElement('div');
            answerDiv.id = 'qh-blocks-answer';
            answerDiv.textContent = 'answer: ' + otherSide.media[0].plainText;
            answerDiv.style.color = 'lime';
            answerDiv.style.fontWeight = 'bold';
            answerDiv.style.marginBottom = '8px';
            promptContainer.parentElement.insertBefore(answerDiv, promptContainer);
        }, 100);
    }
    function stopBlocksShowAnswer(){ clearInterval(intervals.blocks); delete intervals.blocks; }


    function startLearnHighlight(){
        if (intervals.learn) return;
        intervals.learn = setInterval(()=>{
            const element = document.querySelector('article');
            if (!element) return;
            const fiber = element[Object.keys(element).find(k => k.startsWith('__reactFiber$'))];
            const question = fiber.return.return.return.return?.memoizedProps?.question || fiber.return.return.return.memoizedProps.question;
            if (!question?.type) return;
            if (question.type === 'MultipleChoiceQuestion'){
                const answerIndex = question.metadata.optionGenerationSource.findIndex(k => k === 'key');
                const answerElement = document.querySelector('[data-testid="MCQ Answers"]').children[answerIndex];
                const answerText = answerElement.querySelector('section > :nth-child(2)');
                if (answerText) answerText.style.color = 'lime';
            } else if (question.type === 'WrittenQuestion'){
                const allCards = __NEXT_DATA__.props.pageProps.studyModesCommon.studiableDocumentData.studiableItems;
                const card = allCards.find(c => c.id === question.metadata.studiableItemId);
                const otherSide = card.cardSides[question.metadata.answerSide === 'definition' ? 1 : 0];
                const existingAnswerElement = document.querySelector('#x-answer');
                if (existingAnswerElement) existingAnswerElement.innerText = `correct answer: ${otherSide.media[0].plainText}`;
                else document.querySelector('form')?.parentElement?.insertAdjacentHTML('afterbegin', `<p style="color: lime; padding-bottom: 10px;" id="x-answer">correct answer: ${otherSide.media[0].plainText}</p>`);
            }
        }, 100);
    }
    function stopLearnHighlight(){ clearInterval(intervals.learn); delete intervals.learn; }


    function startLiveShowAnswers(){
        if (intervals.live) return;
        intervals.live = setInterval(()=>{
            const target = document.querySelector('[data-testid="normalPrompt"]')?.parentElement;
            if (!target) return;
            const targetFiber = target[Object.keys(target).find(e => e.startsWith('__reactFiber$'))];
            const stateNode = targetFiber.child.pendingProps;
            const cardSides = stateNode.currentQuestion.cardSides.map(e => e.media);
            const questionType = stateNode.options.answerWith;
            const side1IsQuestion = questionType === 'definition';
            const answerSide = side1IsQuestion ? cardSides[1] : cardSides[0];
            const answerIsImage = answerSide[0].languageCode === 'photo';
            if (answerIsImage){
                const answerOpts = document.querySelectorAll('.Image-image');
                answerOpts.forEach((opt) => {
                    const isCorrect = opt.getAttribute('style')?.includes(answerSide[1].url);
                    opt.style.border = isCorrect ? '3px solid lime' : '3px solid red';
                    opt.style.borderRadius = '3px';
                });
            } else {
                const answerOpts = document.querySelector('div[data-testid="normalPrompt"]').parentElement.children[1];
                const answerCard = [...answerOpts.children].find((opt) => opt.children[0].innerText === answerSide[0].plainText);
                const wrongCards = [...answerOpts.children].filter(a => a !== answerCard);
                if (answerCard) answerCard.style.color = 'lime';
                wrongCards.forEach((card) => card.style.color = 'red');
            }
        }, 50);
    }
    function stopLiveShowAnswers(){ clearInterval(intervals.live); delete intervals.live; }

    function startMatchMultiplayer(){
        if (intervals.matchMulti) return;
        intervals.matchMulti = setInterval(()=>{
            const cardParentParent = document.querySelector('#__next > :nth-child(2) > :nth-child(3) > :nth-child(1)');
            if (!cardParentParent) return;
            const cardParent = [...cardParentParent.children];
            const allCards = cardParent.map(c => [...c.children[0].children]).flat(1);
            if (!allCards || !allCards[0]) return;
            const fiberName = Object.keys(allCards[0]).find(k => k.startsWith('__reactFiber$'));
            const knownIds = new Set();
            const RANDOM_COLORS = ['#FF007F','#FFAA1D','#FFF000','#66FF00','#08E8DE','#1974D2'];
            allCards.forEach((cardElement) => {
                const keyParts = cardElement[fiberName].return.return.return.key.split('-');
                const key = keyParts[keyParts.length - 1];
                cardElement.setAttribute('data-key', key);
                knownIds.add(key);
            });
            [...knownIds].map((index, i) => {
                const matchingCards = allCards.filter(c => c.getAttribute('data-key') === index);
                const color = RANDOM_COLORS[i];
                matchingCards.forEach(card => {
                    if (card.children[0]){
                        card.children[0].style.border = `3px solid ${color}`;
                        card.children[0].style.borderRadius = '3px';
                    }
                });
            });
        }, 100);
    }
    function stopMatchMultiplayer(){ clearInterval(intervals.matchMulti); delete intervals.matchMulti; }

    function startMatchNormal(){
        if (intervals.matchNormal) return;
        console.log('[Quizlet Hacks] matchNormal: interval started');
        intervals.matchNormal = setInterval(()=>{
            try{
                // Updated selector for new DOM structure
                const cardContainer = document.querySelector('#__next > .c1jr5744 > .b1hkvota.b9et6b9');
                if (!cardContainer) {
                    console.warn('[Quizlet Hacks] matchNormal: cardContainer not found');
                    return;
                }
                const fiberName = Object.keys(cardContainer).find(c => c.startsWith('__reactFiber$'));
                if (!fiberName) {
                    console.warn('[Quizlet Hacks] matchNormal: fiberName not found');
                    return;
                }
                const fiber = cardContainer[fiberName];
                const opts = fiber.return?.return?.return?.memoizedProps?.matchingQuestions?.options;
                if (!opts) {
                    console.warn('[Quizlet Hacks] matchNormal: options not found');
                    return;
                }
                const RANDOM_COLORS = ['#FF007F','#FFAA1D','#FFF000','#66FF00','#08E8DE','#1974D2'];
                let setData;
                try {
                    setData = JSON.parse(__NEXT_DATA__.props.pageProps.dehydratedReduxStateKey);
                } catch (e) {
                    console.warn('[Quizlet Hacks] matchNormal: setData not found');
                    return;
                }
                const cards = setData.studyModesCommon.studiableData.studiableItems.map(c => c.cardSides);
                const cardParents = [...cardContainer.children].map(e => [...[...e.children][0].children]).flat(1);
                const knownIndexes = new Set();
                opts.map(({ attributes }, i) => {
                    const isText = attributes[1].type === 'AudioAttribute';
                    const theCard = cards.findIndex((card) => {
                        if (isText) return card.some(side => side.media[0].plainText === attributes[0].plainText);
                        return card.some(side => side.media[1]?.url === attributes[1].url);
                    });
                    const parent = cardParents[i];
                    if (!parent) return;
                    parent.setAttribute('data-cardIndex', theCard);
                    parent.setAttribute('data-isCard', 'true');
                    knownIndexes.add(theCard);
                });
                [...knownIndexes].map((index, i) => {
                    const matchingCards = cardParents.filter(c => parseInt(c.getAttribute('data-cardIndex')) === index);
                    const color = RANDOM_COLORS[i];
                    matchingCards.forEach(card => card.style.border = `3px solid ${color}`);
                });
            }catch(e){
                console.error('[Quizlet Hacks] matchNormal: error in interval', e);
            }
        }, 250);
    }
    function stopMatchNormal(){
        if (intervals.matchNormal) {
            clearInterval(intervals.matchNormal);
            delete intervals.matchNormal;
            console.log('[Quizlet Hacks] matchNormal: interval stopped');
        }
    }

    function runSolveInTime(){
        const encodeData = (data) => {
            let str = JSON.stringify(data);
            let encodedParts = [];
            for (let i = 0; i < str.length; i++){
                let modifiedCharCode = str.charCodeAt(i) + (77 % (i + 1));
                encodedParts.push(modifiedCharCode);
            }
            return encodedParts.join('-');
        };
        const convertScore = (s) => {
            if (s.includes('.')) return parseInt(s.replace('.', ''), 10);
            return parseInt(s + '0', 10);
        };
        let inputNum = prompt('what do you want your match time to be? enter in the format "5.1":');
        if (isNaN(inputNum)) { alert('uhh might be wrong but that doesn\'t look very numberlike'); return; }
        if (inputNum.includes('.') && ((inputNum.indexOf('.') + 2) !== inputNum.length)) alert('scores cannot have more than one decimal place');
        const num = convertScore(inputNum);
        let data = encodeData({ previous_record: 0, score: num, selectedOnly: false, time_started: Date.now() - (num * 100) - 1500, too_small: 0 });
        let token = document.cookie.split('qtkn=')[1].split(';')[0];
        let setId = __NEXT_DATA__.query.setId;
        fetch(`https://quizlet.com/${setId}/scatter/highscores`, {
            headers: {
                'content-type': 'application/json',
                'cs-token': token,
                'x-quizlet-api-security-id': token,
                'x-requested-with': 'XMLHttpRequest'
            },
            body: JSON.stringify({ data }),
            method: 'POST'
        }).then(r => {
            if (r.ok) alert('done! double check the leaderboard...');
            else alert('quizlet reported an error...check the leaderboard');
        });
    }

    const rows = [
        { id: 'blast', label: 'Blast: Highlight Answers', type: 'toggle', start:startBlastHighlight, stop:stopBlastHighlight },
        { id: 'blocks', label: 'Blocks: Show Answer Placeholder', type: 'toggle', start:startBlocksShowAnswer, stop:stopBlocksShowAnswer },
        { id: 'learn', label: 'Learn: Highlight Answers', type: 'toggle', start:startLearnHighlight, stop:stopLearnHighlight },
        { id: 'live', label: 'Live: Show Answers', type: 'toggle', start:startLiveShowAnswers, stop:stopLiveShowAnswers },
        { id: 'matchMulti', label: 'Match (Multiplayer): Show Answers', type: 'toggle', start:startMatchMultiplayer, stop:stopMatchMultiplayer },
        { id: 'matchNormal', label: 'Match (Normal): Show Answers', type: 'toggle', start:startMatchNormal, stop:stopMatchNormal },
        { id: 'solve', label: 'Match: Solve In Time (run)', type: 'run', run: runSolveInTime }
    ];


    const toggleElements = {};
    rows.forEach(r => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        const label = document.createElement('div');
        label.textContent = r.label;
        label.style.flex = '1';
        label.style.marginRight = '8px';
        if (r.type === 'toggle'){
            const toggle = document.createElement('input');
            toggle.type = 'checkbox';
            toggle.style.cursor = 'pointer';
            // Store reference for later
            toggleElements[r.id] = toggle;
            // make the label text not intercept pointer events so the checkbox gets clicks reliably
            label.style.pointerEvents = 'none';
            row.appendChild(label);
            row.appendChild(toggle);
            // Sync checkbox state with interval running
            const isRunning = () => !!intervals[r.id];
            toggle.checked = isRunning();
            // When toggled, start/stop and update state
            toggle.addEventListener('change', (ev)=>{
                try {
                    if (ev.target.checked) {
                        r.start();
                    } else {
                        r.stop();
                    }
                } catch(e){}
                // After action, sync all toggles
                syncToggles();
            });
        } else {
            const btn = document.createElement('button');
            btn.textContent = 'Run';
            btn.style.background = '#0a84ff';
            btn.style.border = 'none';
            btn.style.color = '#fff';
            btn.style.padding = '4px 8px';
            btn.style.borderRadius = '6px';
            btn.style.cursor = 'pointer';
            btn.addEventListener('click', r.run);
            row.appendChild(label);
            row.appendChild(btn);
        }
        list.appendChild(row);
    });


    function syncToggles() {
        rows.forEach(r => {
            if (r.type === 'toggle' && toggleElements[r.id]) {
                toggleElements[r.id].checked = !!intervals[r.id];
            }
        });
    }

    rows.forEach(r => {
        if (r.type === 'toggle') {
            const origStart = r.start;
            const origStop = r.stop;
            r.start = function() {
                origStart();
                syncToggles();
            };
            r.stop = function() {
                origStop();
                syncToggles();
            };
        }
    });


    (function makeDraggable(elem){
        let isDown = false; let offsetX = 0, offsetY = 0;
        const header = document.getElementById('qh-header');
        header.addEventListener('mousedown', e => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
            isDown = true;
            const rect = elem.getBoundingClientRect();
            if (!elem.style.left) elem.style.left = rect.left + 'px';
            if (!elem.style.top) elem.style.top = rect.top + 'px';
            elem.style.right = 'auto';
            elem.style.bottom = 'auto';
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            e.preventDefault();
        });
        window.addEventListener('mousemove', e => {
            if (!isDown) return;
            elem.style.left = (e.clientX - offsetX) + 'px';
            elem.style.top = (e.clientY - offsetY) + 'px';
        });
        window.addEventListener('mouseup', ()=> isDown = false);
    })(panel);

})();
