
        const sentences = [
            { kana: "おやつたべたい", romaji: "oyatsutabetai" },
            { kana: "すやあ", romaji: "suyaa" },
            { kana: "がんばらなくていいよ", romaji: "ganbaranakuteiiyo" },
            { kana: "ぺたんいまからねるね", romaji: "petanimakaranerune" },
            { kana: "なんでもないひばんざい", romaji: "nandemonaihibanzai" }
        ];

        let currentSentence = {};
        let remainingSentences = [...sentences];
        let clearedCount = 0;
        const totalQuestions = 5;
        let lastCorrectValue = ''; // 正しい入力の最新状態を保持

        // Web Audio API のコンテキストとバッファ
        let audioContext;
        let correctSoundBuffer;
        let incorrectSoundBuffer;
        let clearSoundBuffer;

        const sentenceElement = document.getElementById('sentence');
        const romajiDisplay = document.getElementById('romaji-display');
        const inputBox = document.getElementById('input-box');
        const petanImg = document.getElementById('petan-img');
        const gameContainer = document.getElementById('game-container');
        const clearScreen = document.getElementById('clear-screen');
        const startScreen = document.getElementById('start-screen');
        const startButton = document.getElementById('start-button');

        // サウンドファイルを読み込む関数
        async function loadSound(url) {
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                return await audioContext.decodeAudioData(arrayBuffer);
            } catch (error) {
                console.error(`サウンドファイルの読み込みに失敗しました: ${url}`, error);
                return null; // 読み込み失敗時はnullを返す
            }
        }

        // サウンドを再生する関数
        function playSound(buffer) {
            if (!buffer) return; // バッファがなければ再生しない
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
        }

        // ビープ音を生成する関数
        function createBeepSound(frequency = 440, duration = 0.05) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = frequency;
            gainNode.gain.setValueAtTime(1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);

            // バッファとして返すために、一時的なAudioBufferSourceNodeを作成
            const arrayBuffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
            const data = arrayBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = Math.sin(i / (audioContext.sampleRate / (frequency * 2 * Math.PI)));
            }
            return arrayBuffer; // バッファを返す
        }

        function setNextSentence() {
            if (clearedCount >= totalQuestions) {
                showClearScreen();
                return;
            }
            
            if (remainingSentences.length === 0) {
                remainingSentences = [...sentences];
            }

            const randomIndex = Math.floor(Math.random() * remainingSentences.length);
            currentSentence = remainingSentences.splice(randomIndex, 1)[0];
            
            sentenceElement.textContent = currentSentence.kana;
            romajiDisplay.innerHTML = `<span class="untyped">${currentSentence.romaji}</span>`;
            inputBox.value = '';
            lastCorrectValue = ''; // リセット
            inputBox.style.backgroundColor = 'white';
            inputBox.focus();
        }

        function showClearScreen() {
            gameContainer.style.display = 'none';
            clearScreen.style.display = 'flex';
            playSound(clearSoundBuffer); // クリア音を再生
        }

        function react(type) {
            petanImg.classList.remove('shake', 'happy');
            setTimeout(() => {
                petanImg.classList.add(type);
            }, 10);
            
            setTimeout(() => {
                petanImg.classList.remove(type);
            }, 500);
        }

        /**
         * 入力が正しいかチェックし、ローマ字のどこまでマッチしたかを返す
         * @param {string} typed - 入力されたテキスト
         * @param {string} target - 正解のローマ字
         * @returns {{isCorrect: boolean, matchedLength: number}}
         */
        function checkInput(typed, target) {
            let typedIndex = 0;
            let targetIndex = 0;

            while (typedIndex < typed.length) {
                if (targetIndex >= target.length) {
                    return { isCorrect: false, matchedLength: targetIndex };
                }

                // Rule for "つ": "tu" can be typed for "tsu"
                if (target.startsWith('tsu', targetIndex) && typed.startsWith('tu', typedIndex)) {
                    typedIndex += 2;
                    targetIndex += 3;
                    continue;
                }

                // Rule for "ん": "nn" can be typed for "n"
                if (target.startsWith('n', targetIndex) && typed.startsWith('nn', typedIndex)) {
                    const nextTargetChar = target[targetIndex + 1];
                    // Check if 'n' is 'ん' (not part of な,に,ぬ,ね,の)
                    if (nextTargetChar === undefined || !'aiueoy'.includes(nextTargetChar)) {
                        typedIndex += 2;
                        targetIndex += 1;
                        continue;
                    }
                }

                // Default character comparison
                if (typed[typedIndex] !== target[targetIndex]) {
                    return { isCorrect: false, matchedLength: targetIndex };
                }

                typedIndex++;
                targetIndex++;
            }

            return { isCorrect: true, matchedLength: targetIndex };
        }

        inputBox.addEventListener('input', () => {
            const typedText = inputBox.value.toLowerCase();
            const targetRomaji = currentSentence.romaji;

            const result = checkInput(typedText, targetRomaji);

            if (result.isCorrect) {
                // 正しい文字が入力されたら効果音を鳴らす
                // inputイベントで鳴らすことで、nnやtuの判定後にも鳴るようにする
                playSound(correctSoundBuffer);

                lastCorrectValue = typedText; // 正しい状態を更新
                inputBox.style.backgroundColor = 'white';
                
                const typedPart = targetRomaji.slice(0, result.matchedLength);
                const remainingPart = targetRomaji.slice(result.matchedLength);
                romajiDisplay.innerHTML = `<span class="typed">${typedPart}</span><span class="untyped">${remainingPart}</span>`;

                if (result.matchedLength === targetRomaji.length) {
                    // 正解（文章全体が入力完了）
                    clearedCount++;
                    react('happy');
                    inputBox.style.backgroundColor = '#d4edda';
                    setTimeout(() => {
                        setNextSentence();
                    }, 300);
                }
            } else {
                // ミス
                playSound(incorrectSoundBuffer); // 不正解音を再生
                react('shake');
                inputBox.style.backgroundColor = '#f8d7da';
                inputBox.value = lastCorrectValue;
            }
        });

        inputBox.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
            }
            // IME入力中はinputイベントで処理するため、keydownでは効果音を鳴らさない
        });

        // ゲーム開始処理
        startButton.addEventListener('click', async () => {
            // ユーザー操作をトリガーにAudioContextを初期化
            audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // サウンドファイルを読み込み
            // 読み込み失敗してもゲームは続行できるようにする
            correctSoundBuffer = createBeepSound(); // ビープ音を生成
            incorrectSoundBuffer = createBeepSound(220); // 不正解音をビープ音で生成 (低い音)
            clearSoundBuffer = await loadSound('clear.mp3');

            startScreen.style.display = 'none';
            gameContainer.style.display = 'block';
            setNextSentence();
        });
