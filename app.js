// Wordle Deluxe Game Engine - Upgraded with Progression, Shop, Categories, PvP, and Bot AI
(function () {
  // Game Setup & Constants
  let MAX_ROWS = 6;
  const WORD_LENGTH = 5;

  // Audio Context (Initialized lazily on user interaction)
  let audioCtx = null;

  // Confetti Animation State
  let confettiActive = false;
  let confettiParticles = [];
  const CONFETTI_COLORS = [
    '#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'
  ];

  // Keyboard layout
  const KEYBOARD_ROWS = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"]
  ];

  // User Settings & Preferences
  let preferences = {
    hardMode: false,
    soundEffects: true,
    lightTheme: false
  };

  // Progression & Inventory
  let playerProgression = {
    xp: 0,
    level: 1,
    credits: 200, // Starts with some credits for immediate fun
    powerups: {
      reveal: 1,
      ditch: 1,
      extra: 1
    },
    unlockedThemes: ["synthwave"],
    activeTheme: "synthwave",
    timeAttackHighscore: 0,
    stats: {
      played: 0,
      won: 0,
      streak: 0,
      maxStreak: 0,
      winDistribution: [0, 0, 0, 0, 0, 0, 0, 0] // Up to 8 indexes for 7-row expansion support
    }
  };

  // Active Gameplay States
  let activeScreen = "dashboard"; // dashboard, classic, categories, timeattack, multiplayer, shop, leaderboard
  let currentGameMode = ""; // classic-daily, classic-unlimited, category-game, time-attack, vs-bot, local-pvp
  let targetWord = "";
  let currentCategory = "";
  
  // Game variables (Single Player/Shared Keyboard Modes)
  let currentRow = 0;
  let currentCol = 0;
  let boardState = [];
  let rowStatuses = [];
  let gameStatus = "IN_PROGRESS"; // IN_PROGRESS, WON, LOST, TRANSITION
  let powerupsUsedInGame = { reveal: 0, ditch: 0, extra: 0 };
  let disabledKeysThisGame = new Set();

  // Time Attack Mode Variables
  let timeAttackTimeLeft = 120;
  let timeAttackTimerInterval = null;
  let timeAttackScore = 0;
  let timeAttackSolvedCount = 0;

  // VS Bot Mode Variables
  let botTargetWord = "";
  let botCurrentRow = 0;
  let botBoardState = [];
  let botRowStatuses = [];
  let botGameStatus = "IN_PROGRESS";
  let botTimerInterval = null;
  let botGuessesRemaining = [];

  // Local PvP split screen variables
  let pvpP1 = {
    currentRow: 0,
    currentCol: 0,
    boardState: [],
    rowStatuses: [],
    gameStatus: "IN_PROGRESS",
    targetWord: "",
    disabledKeys: new Set()
  };
  let pvpP2 = {
    currentRow: 0,
    currentCol: 0,
    boardState: [],
    rowStatuses: [],
    gameStatus: "IN_PROGRESS",
    targetWord: "",
    disabledKeys: new Set()
  };

  // Mock Competitors for Leaderboard
  const MOCK_COMPETITORS = [
    { name: "WordleWizard", streak: 27, timeattack: 1850, level: 12 },
    { name: "LexiconLover", streak: 19, timeattack: 1500, level: 9 },
    { name: "SynthScribe", streak: 14, timeattack: 1300, level: 7 },
    { name: "ByteBrain", streak: 11, timeattack: 1100, level: 6 },
    { name: "AlphaCoder", streak: 8, timeattack: 950, level: 4 },
    { name: "TickingTimer", streak: 5, timeattack: 750, level: 3 }
  ];

  // Initialize Audio
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  // Synth Low-Latency Retro Sounds
  function playSound(type, delayOffset = 0) {
    if (!preferences.soundEffects) return;
    initAudio();
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime + delayOffset;

    switch (type) {
      case 'key':
        {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          gain.gain.setValueAtTime(0.04, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.05);
        }
        break;

      case 'flip':
        {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          const baseFreq = 380 + (delayOffset * 90);
          osc.frequency.setValueAtTime(baseFreq, now);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, now + 0.12);
          gain.gain.setValueAtTime(0.04, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.13);
        }
        break;

      case 'error':
        {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(140, now);
          osc.frequency.linearRampToValueAtTime(80, now + 0.2);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.23);
        }
        break;

      case 'win':
        {
          const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5
          notes.forEach((freq, i) => {
            const t = now + (i * 0.07);
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.06, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(t);
            osc.stop(t + 0.4);
          });
        }
        break;

      case 'lose':
        {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.linearRampToValueAtTime(90, now + 0.5);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.6);
        }
        break;

      case 'buy':
        {
          const notes = [440, 880]; // A4, A5 chime
          notes.forEach((freq, i) => {
            const t = now + (i * 0.1);
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.08, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(t);
            osc.stop(t + 0.25);
          });
        }
        break;

      case 'powerup':
        {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(300, now);
          osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.45);
        }
        break;

      case 'levelup':
        {
          const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // Ascending cascade
          notes.forEach((freq, i) => {
            const t = now + (i * 0.06);
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.07, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(t);
            osc.stop(t + 0.35);
          });
        }
        break;
    }
  }

  // Load Saved Game State & Progression Data
  function loadUserData() {
    try {
      // Preferences
      const storedPrefs = localStorage.getItem("wordle_deluxe_prefs");
      if (storedPrefs) {
        preferences = JSON.parse(storedPrefs);
        const hardModeEl = document.getElementById("setting-hard-mode");
        const soundEffectsEl = document.getElementById("setting-sound-effects");
        const themeEl = document.getElementById("setting-theme");
        
        if (hardModeEl) hardModeEl.checked = !!preferences.hardMode;
        if (soundEffectsEl) soundEffectsEl.checked = !!preferences.soundEffects;
        if (themeEl) themeEl.checked = !!preferences.lightTheme;
        
        if (preferences.lightTheme) {
          document.body.classList.remove("dark-theme");
          document.body.classList.add("light-theme");
        }
      }

      // Progression Data
      const storedProg = localStorage.getItem("wordle_deluxe_progression");
      if (storedProg) {
        playerProgression = JSON.parse(storedProg);
      }
      
      applyTheme(playerProgression.activeTheme || "synthwave");
      updateProgressionHUD();
      updateShopUI();
    } catch (e) {
      console.error("Error loading user data, resetting", e);
    }
  }

  // Save Progression Data
  function saveUserData() {
    localStorage.setItem("wordle_deluxe_progression", JSON.stringify(playerProgression));
  }

  // Update level / XP top HUD
  function updateProgressionHUD() {
    document.getElementById("player-level").textContent = playerProgression.level;
    document.getElementById("player-credits").textContent = playerProgression.credits;
    
    const xpNeeded = playerProgression.level * 500;
    document.getElementById("player-xp-text").textContent = `${playerProgression.xp} / ${xpNeeded} XP`;
    const pct = Math.min((playerProgression.xp / xpNeeded) * 100, 100);
    document.getElementById("player-xp-bar").style.width = `${pct}%`;
  }

  // Add XP and handle levels
  function addXP(amount) {
    playerProgression.xp += amount;
    let xpNeeded = playerProgression.level * 500;
    let leveledUp = false;

    while (playerProgression.xp >= xpNeeded) {
      playerProgression.xp -= xpNeeded;
      playerProgression.level++;
      playerProgression.credits += 100; // 100 bonus coins on level up
      xpNeeded = playerProgression.level * 500;
      leveledUp = true;
    }

    saveUserData();
    updateProgressionHUD();

    if (leveledUp) {
      playSound('levelup');
      triggerConfetti();
      document.getElementById("levelup-new-val").textContent = playerProgression.level;
      openModal("modal-levelup");
    }
  }

  // Theme styling applying
  function applyTheme(themeId) {
    document.body.className = preferences.lightTheme ? "light-theme" : "dark-theme";
    document.body.classList.add(`theme-${themeId}`);
    playerProgression.activeTheme = themeId;
    saveUserData();
  }

  // Screen management navigation
  function switchScreen(screenName) {
    initAudio();
    // Stop time attack loop if active
    if (activeScreen === "timeattack" && screenName !== "timeattack") {
      clearInterval(timeAttackTimerInterval);
    }
    // Stop VS Bot loop if active
    if (activeScreen === "multiplayer" && screenName !== "multiplayer") {
      clearInterval(botTimerInterval);
    }

    document.querySelectorAll(".app-screen").forEach(screen => {
      screen.classList.remove("active");
    });
    
    const activeScr = document.getElementById(`screen-${screenName}`);
    if (activeScr) {
      activeScr.classList.add("active");
    }
    
    activeScreen = screenName;

    // Remove wide layout on navigating away from multiplayer screens
    if (screenName !== "multiplayer") {
      const appContainer = document.querySelector(".app-container");
      if (appContainer) appContainer.classList.remove("layout-wide");
    }
    
    // Toggle header navigation home button
    const homeBtn = document.getElementById("btn-home");
    if (screenName === "dashboard") {
      homeBtn.style.display = "none";
    } else {
      homeBtn.style.display = "inline-flex";
    }

    // Single-player Keyboard showing / hiding
    const kbdFooter = document.getElementById("main-keyboard-footer");
    if (screenName === "classic" || screenName === "categories" || screenName === "timeattack" || screenName === "multiplayer") {
      // For multiplayer, only show standard keyboard if we are in VS Bot mode selection or play
      const vsLocalActive = document.getElementById("mp-pvp-panel").style.display === "block";
      const vsBotActive = document.getElementById("mp-vsbot-panel").style.display === "block";
      const mpSelectorActive = document.getElementById("mp-selector-panel").style.display === "block";
      
      if (screenName === "multiplayer" && vsLocalActive) {
        kbdFooter.style.display = "none";
      } else if (screenName === "multiplayer" && mpSelectorActive) {
        kbdFooter.style.display = "none";
      } else {
        kbdFooter.style.display = "block";
      }
    } else {
      kbdFooter.style.display = "none";
    }

    // Refresh layout-specific data
    if (screenName === "shop") {
      updateShopUI();
    } else if (screenName === "leaderboard") {
      populateLeaderboard("streak");
    }
  }

  // Renders a generic Wordle Grid dynamically
  function buildGridDOM(containerId, rows, cols) {
    const gridContainer = document.getElementById(containerId);
    gridContainer.innerHTML = "";
    gridContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    for (let r = 0; r < rows; r++) {
      const rowDiv = document.createElement("div");
      rowDiv.className = "grid-row";
      rowDiv.id = `${containerId}-row-${r}`;
      rowDiv.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

      for (let c = 0; c < cols; c++) {
        const cellDiv = document.createElement("div");
        cellDiv.className = "cell";
        cellDiv.id = `${containerId}-cell-${r}-${c}`;
        rowDiv.appendChild(cellDiv);
      }
      gridContainer.appendChild(rowDiv);
    }
  }

  // Single Player Game Start
  function initSinglePlayerGame(mode, themeWord = null) {
    MAX_ROWS = 6;
    currentRow = 0;
    currentCol = 0;
    gameStatus = "IN_PROGRESS";
    currentGameMode = mode;
    powerupsUsedInGame = { reveal: 0, ditch: 0, extra: 0 };
    disabledKeysThisGame.clear();

    if (mode === "classic-daily") {
      targetWord = getDailyWord();
    } else if (mode === "classic-unlimited") {
      const idx = Math.floor(Math.random() * TARGET_WORDS.length);
      targetWord = TARGET_WORDS[idx].toUpperCase();
    } else if (mode === "category-game") {
      targetWord = themeWord.toUpperCase();
    }

    boardState = Array(MAX_ROWS).fill(null).map(() => Array(WORD_LENGTH).fill(""));
    rowStatuses = Array(MAX_ROWS).fill(null).map(() => Array(WORD_LENGTH).fill(""));

    // Render board
    const gridId = mode === "category-game" ? "category-grid" : "classic-grid";
    buildGridDOM(gridId, MAX_ROWS, WORD_LENGTH);
    renderVirtualKeyboard("keyboard", handleSharedKeyboardInput);
    updatePowerupHUDButtons();
  }

  // Update counts on active classic HUD powerup buttons
  function updatePowerupHUDButtons() {
    document.getElementById("count-pwr-reveal").textContent = playerProgression.powerups.reveal;
    document.getElementById("count-pwr-ditch").textContent = playerProgression.powerups.ditch;
    document.getElementById("count-pwr-extra").textContent = playerProgression.powerups.extra;
  }

  // Virtual keyboard creator
  function renderVirtualKeyboard(containerId, pressHandler, disabledKeys = new Set(), keyStatuses = {}) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    KEYBOARD_ROWS.forEach(row => {
      const rowDiv = document.createElement("div");
      rowDiv.className = "keyboard-row";

      row.forEach(key => {
        const keyBtn = document.createElement("button");
        keyBtn.className = "key";
        keyBtn.id = `${containerId}-key-${key}`;

        if (key === "ENTER") {
          keyBtn.classList.add("wide");
          keyBtn.textContent = "ENTER";
        } else if (key === "BACKSPACE") {
          keyBtn.classList.add("wide");
          keyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>`;
        } else {
          keyBtn.textContent = key;
        }

        if (keyStatuses[key]) {
          keyBtn.classList.add(keyStatuses[key]);
        }

        if (disabledKeys.has(key)) {
          keyBtn.classList.add("disabled");
          keyBtn.disabled = true;
          keyBtn.style.opacity = "0.2";
        }

        keyBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          pressHandler(key);
        });
        rowDiv.appendChild(keyBtn);
      });
      container.appendChild(rowDiv);
    });
  }

  // Single keyboard color mapping update
  function updateKeyboardColors(gridId, kbdId, disabledSet) {
    const keyStatuses = {};
    for (let r = 0; r < currentRow; r++) {
      for (let c = 0; c < WORD_LENGTH; c++) {
        const letter = boardState[r][c];
        const status = rowStatuses[r][c];
        if (letter && status) {
          const cur = keyStatuses[letter];
          if (cur === "correct") continue;
          if (cur === "present" && status !== "correct") continue;
          keyStatuses[letter] = status;
        }
      }
    }
    renderVirtualKeyboard(kbdId, handleSharedKeyboardInput, disabledSet, keyStatuses);
  }

  // Handle keys for single player, categories, bot race, and time attack
  function handleSharedKeyboardInput(key) {
    if (gameStatus !== "IN_PROGRESS") return;

    if (key === "ENTER") {
      submitSinglePlayerGuess();
    } else if (key === "BACKSPACE" || key === "BACK") {
      deleteLetterSingle();
    } else if (/^[A-Z]$/.test(key.toUpperCase())) {
      enterLetterSingle(key.toUpperCase());
    }
  }

  function enterLetterSingle(letter) {
    const gridId = currentGameMode === "category-game" ? "category-grid" : 
                   currentGameMode === "time-attack" ? "timeattack-grid" : 
                   currentGameMode === "vs-bot" ? "vsbot-player-grid" : "classic-grid";

    if (currentCol < WORD_LENGTH) {
      playSound('key');
      const cell = document.getElementById(`${gridId}-cell-${currentRow}-${currentCol}`);
      if (cell) {
        cell.textContent = letter;
        cell.classList.add("filled");
        boardState[currentRow][currentCol] = letter;
        currentCol++;
      }
    }
  }

  function deleteLetterSingle() {
    const gridId = currentGameMode === "category-game" ? "category-grid" : 
                   currentGameMode === "time-attack" ? "timeattack-grid" : 
                   currentGameMode === "vs-bot" ? "vsbot-player-grid" : "classic-grid";

    if (currentCol > 0) {
      playSound('key');
      currentCol--;
      const cell = document.getElementById(`${gridId}-cell-${currentRow}-${currentCol}`);
      if (cell) {
        cell.textContent = "";
        cell.classList.remove("filled");
        boardState[currentRow][currentCol] = "";
      }
    }
  }

  function shakeActiveRow(gridId, rowIdx) {
    const row = document.getElementById(`${gridId}-row-${rowIdx}`);
    if (row) {
      row.classList.add("cell-shake");
      setTimeout(() => {
        row.classList.remove("cell-shake");
      }, 450);
    }
  }

  // Evaluate guess algorithm
  function evaluateGuessColors(guess, target) {
    const result = Array(WORD_LENGTH).fill("absent");
    const targetLetters = target.split("");
    const guessLetters = guess.split("");

    // Step 1: Greens
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guessLetters[i] === targetLetters[i]) {
        result[i] = "correct";
        targetLetters[i] = null;
        guessLetters[i] = null;
      }
    }
    // Step 2: Yellows
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guessLetters[i] === null) continue;
      const idx = targetLetters.indexOf(guessLetters[i]);
      if (idx !== -1) {
        result[i] = "present";
        targetLetters[idx] = null;
      }
    }
    return result;
  }

  // Submit and flip cells for single player configurations
  function submitSinglePlayerGuess() {
    const gridId = currentGameMode === "category-game" ? "category-grid" : 
                   currentGameMode === "time-attack" ? "timeattack-grid" : 
                   currentGameMode === "vs-bot" ? "vsbot-player-grid" : "classic-grid";

    if (currentCol < WORD_LENGTH) {
      playSound('error');
      shakeActiveRow(gridId, currentRow);
      showToast("Not enough letters");
      return;
    }

    const guess = boardState[currentRow].join("").toUpperCase();

    if (!isValidWordleWord(guess.toLowerCase())) {
      playSound('error');
      shakeActiveRow(gridId, currentRow);
      showToast("Not in word list");
      return;
    }

    if (preferences.hardMode && currentRow > 0) {
      const prevGuess = boardState[currentRow - 1].join("");
      const prevStatuses = rowStatuses[currentRow - 1];

      for (let i = 0; i < WORD_LENGTH; i++) {
        if (prevStatuses[i] === "correct" && guess[i] !== prevGuess[i]) {
          playSound('error');
          shakeActiveRow(gridId, currentRow);
          showToast(`Must use ${prevGuess[i]} in spot ${i + 1}`);
          return;
        }
      }
      for (let i = 0; i < WORD_LENGTH; i++) {
        if (prevStatuses[i] === "present" && !guess.includes(prevGuess[i])) {
          playSound('error');
          shakeActiveRow(gridId, currentRow);
          showToast(`Must use revealed letter ${prevGuess[i]}`);
          return;
        }
      }
    }

    const evaluation = evaluateGuessColors(guess, targetWord);
    rowStatuses[currentRow] = evaluation;

    gameStatus = "TRANSITION";

    const cells = [];
    for (let c = 0; c < WORD_LENGTH; c++) {
      cells.push(document.getElementById(`${gridId}-cell-${currentRow}-${c}`));
    }

    cells.forEach((cell, idx) => {
      setTimeout(() => {
        cell.classList.add("cell-flip");
        playSound('flip', idx * 0.05);

        setTimeout(() => {
          cell.classList.add(evaluation[idx]);
        }, 250);
      }, idx * 150);
    });

    const revealDuration = WORD_LENGTH * 150 + 550;
    setTimeout(() => {
      if (guess === targetWord) {
        gameStatus = "WON";
        playSound('win');
        triggerConfetti();

        let xpGained = Math.max(1100 - (currentRow * 200), 100);
        let credsGained = Math.max(250 - (currentRow * 40), 50);

        if (currentGameMode === "time-attack") {
          handleTimeAttackWordSolved();
        } else if (currentGameMode === "vs-bot") {
          handleVsBotResolved(true);
        } else {
          playerProgression.stats.played++;
          playerProgression.stats.won++;
          playerProgression.stats.streak++;
          if (playerProgression.stats.streak > playerProgression.stats.maxStreak) {
            playerProgression.stats.maxStreak = playerProgression.stats.streak;
          }
          playerProgression.stats.winDistribution[currentRow + 1]++;
          
          playerProgression.credits += credsGained;
          addXP(xpGained);
          saveUserData();

          showToast(`Solved in ${currentRow + 1}! +${credsGained} RC`, 3000);
          setTimeout(() => {
            openModal("modal-stats");
          }, 1500);
        }
      } else if (currentRow === MAX_ROWS - 1) {
        gameStatus = "LOST";
        playSound('lose');

        if (currentGameMode === "time-attack") {
          timeAttackTimeLeft = Math.max(timeAttackTimeLeft - 10, 0);
          showToast(`Incorrect! -10s penalty. Word was: ${targetWord}`, 3000);
          resetTimeAttackWord();
        } else if (currentGameMode === "vs-bot") {
          handleVsBotResolved(false);
        } else {
          playerProgression.stats.played++;
          playerProgression.stats.streak = 0;
          saveUserData();

          showToast(`Game Over. Word was: ${targetWord}`, 5000);
          setTimeout(() => {
            openModal("modal-stats");
          }, 2000);
        }
      } else {
        currentRow++;
        currentCol = 0;
        gameStatus = "IN_PROGRESS";
        updateKeyboardColors(gridId, "keyboard", disabledKeysThisGame);
      }
    }, revealDuration);
  }

  // Category Selection
  function bindCategoryMenu() {
    document.querySelectorAll(".category-card").forEach(card => {
      card.addEventListener("click", () => {
        const cat = card.dataset.category;
        currentCategory = cat;
        
        const wordList = CATEGORY_WORDS[cat];
        const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
        
        document.getElementById("category-hud-title").textContent = `THEME: ${cat.toUpperCase()}`;
        document.getElementById("category-selector-panel").style.display = "none";
        document.getElementById("category-game-panel").style.display = "block";
        
        initSinglePlayerGame("category-game", randomWord);
      });
    });

    document.getElementById("btn-back-categories").addEventListener("click", () => {
      document.getElementById("category-game-panel").style.display = "none";
      document.getElementById("category-selector-panel").style.display = "block";
    });
  }

  // Time Attack Loop
  function startTimeAttackMode() {
    timeAttackTimeLeft = 120;
    timeAttackScore = 0;
    timeAttackSolvedCount = 0;
    
    document.getElementById("timeattack-timer").textContent = timeAttackTimeLeft;
    document.getElementById("timeattack-score").textContent = timeAttackScore;
    document.getElementById("timeattack-solved").textContent = timeAttackSolvedCount;
    
    const timerValEl = document.getElementById("timeattack-timer");
    timerValEl.className = "hud-val timer-glow";

    resetTimeAttackWord();

    clearInterval(timeAttackTimerInterval);
    timeAttackTimerInterval = setInterval(() => {
      timeAttackTimeLeft--;
      timerValEl.textContent = timeAttackTimeLeft;

      if (timeAttackTimeLeft <= 10) {
        timerValEl.className = "hud-val timer-low";
        playSound('key');
      }

      if (timeAttackTimeLeft <= 0) {
        clearInterval(timeAttackTimerInterval);
        handleTimeAttackGameOver();
      }
    }, 1000);
  }

  function resetTimeAttackWord() {
    MAX_ROWS = 6;
    currentRow = 0;
    currentCol = 0;
    gameStatus = "IN_PROGRESS";
    currentGameMode = "time-attack";
    powerupsUsedInGame = { reveal: 0, ditch: 0, extra: 0 };
    disabledKeysThisGame.clear();

    const idx = Math.floor(Math.random() * TARGET_WORDS.length);
    targetWord = TARGET_WORDS[idx].toUpperCase();

    boardState = Array(MAX_ROWS).fill(null).map(() => Array(WORD_LENGTH).fill(""));
    rowStatuses = Array(MAX_ROWS).fill(null).map(() => Array(WORD_LENGTH).fill(""));

    buildGridDOM("timeattack-grid", MAX_ROWS, WORD_LENGTH);
    renderVirtualKeyboard("keyboard", handleSharedKeyboardInput);
  }

  function handleTimeAttackWordSolved() {
    timeAttackSolvedCount++;
    const scoreAdd = Math.max(600 - (currentRow * 100), 100);
    timeAttackScore += scoreAdd;
    timeAttackTimeLeft += 15;

    document.getElementById("timeattack-score").textContent = timeAttackScore;
    document.getElementById("timeattack-solved").textContent = timeAttackSolvedCount;
    document.getElementById("timeattack-timer").textContent = timeAttackTimeLeft;

    showToast(`Correct! +15s & +${scoreAdd} pts!`);
    resetTimeAttackWord();
  }

  function handleTimeAttackGameOver() {
    gameStatus = "LOST";
    playSound('lose');
    showToast(`Time's up! Total score: ${timeAttackScore}`);

    const credsGained = Math.floor(timeAttackScore / 10);
    playerProgression.credits += credsGained;
    
    if (timeAttackScore > playerProgression.timeAttackHighscore) {
      playerProgression.timeAttackHighscore = timeAttackScore;
      showToast("New High Score! 🏆");
    }

    addXP(Math.floor(timeAttackScore / 2));
    saveUserData();

    renderVirtualKeyboard("keyboard", () => {});
    
    setTimeout(() => {
      switchScreen("dashboard");
    }, 3000);
  }

  // Multiplayer VS Bot Race
  function startVsBotRace() {
    MAX_ROWS = 6;
    currentRow = 0;
    currentCol = 0;
    gameStatus = "IN_PROGRESS";
    currentGameMode = "vs-bot";
    disabledKeysThisGame.clear();

    const idx = Math.floor(Math.random() * TARGET_WORDS.length);
    targetWord = TARGET_WORDS[idx].toUpperCase();
    botTargetWord = targetWord;

    boardState = Array(MAX_ROWS).fill(null).map(() => Array(WORD_LENGTH).fill(""));
    rowStatuses = Array(MAX_ROWS).fill(null).map(() => Array(WORD_LENGTH).fill(""));

    buildGridDOM("vsbot-player-grid", MAX_ROWS, WORD_LENGTH);
    renderVirtualKeyboard("keyboard", handleSharedKeyboardInput);

    botCurrentRow = 0;
    botGameStatus = "IN_PROGRESS";
    botBoardState = Array(MAX_ROWS).fill(null).map(() => Array(WORD_LENGTH).fill(""));
    botRowStatuses = Array(MAX_ROWS).fill(null).map(() => Array(WORD_LENGTH).fill(""));
    buildGridDOM("vsbot-bot-grid", MAX_ROWS, WORD_LENGTH);

    botGuessesRemaining = generateBotGuessesSequence(botTargetWord);
    
    document.getElementById("bot-status-text").textContent = "Thinking...";
    document.getElementById("bot-progress-bar").style.width = "0%";

    clearInterval(botTimerInterval);
    
    let botWaitTime = getRandomInt(16000, 22000);
    
    function botLoop() {
      if (gameStatus !== "IN_PROGRESS" || botGameStatus !== "IN_PROGRESS") return;
      
      simulateBotMove();
      
      if (botGameStatus === "IN_PROGRESS") {
        botWaitTime = getRandomInt(16000, 22000);
        botTimerInterval = setTimeout(botLoop, botWaitTime);
      }
    }
    
    botTimerInterval = setTimeout(botLoop, botWaitTime);
  }

  function simulateBotMove() {
    if (botCurrentRow >= MAX_ROWS) {
      botGameStatus = "LOST";
      return;
    }

    const botGuess = botGuessesRemaining[botCurrentRow] || botTargetWord;
    const gridId = "vsbot-bot-grid";
    document.getElementById("bot-status-text").textContent = "Typing...";
    
    for (let c = 0; c < WORD_LENGTH; c++) {
      const char = botGuess[c];
      setTimeout(() => {
        if (gameStatus !== "IN_PROGRESS") return;
        const cell = document.getElementById(`${gridId}-cell-${botCurrentRow}-${c}`);
        if (cell) {
          cell.textContent = char;
          cell.classList.add("filled");
        }
      }, c * 300);
    }

    setTimeout(() => {
      if (gameStatus !== "IN_PROGRESS") return;
      
      const evaluation = evaluateGuessColors(botGuess, botTargetWord);
      botRowStatuses[botCurrentRow] = evaluation;
      
      const cells = [];
      for (let c = 0; c < WORD_LENGTH; c++) {
        cells.push(document.getElementById(`${gridId}-cell-${botCurrentRow}-${c}`));
      }

      cells.forEach((cell, idx) => {
        setTimeout(() => {
          cell.classList.add("cell-flip");
          setTimeout(() => {
            cell.classList.add(evaluation[idx]);
          }, 250);
        }, idx * 150);
      });

      const flipDuration = WORD_LENGTH * 150 + 550;
      setTimeout(() => {
        if (gameStatus !== "IN_PROGRESS") return;
        
        botBoardState[botCurrentRow] = botGuess.split("");
        
        if (botGuess === botTargetWord) {
          botGameStatus = "WON";
          document.getElementById("bot-status-text").textContent = "FINISHED!";
          document.getElementById("bot-progress-bar").style.width = "100%";
          
          handleVsBotResolved(false);
        } else {
          botCurrentRow++;
          document.getElementById("bot-status-text").textContent = "Thinking...";
          const progressPct = Math.round((botCurrentRow / MAX_ROWS) * 100);
          document.getElementById("bot-progress-bar").style.width = `${progressPct}%`;
          
          if (botCurrentRow === MAX_ROWS) {
            botGameStatus = "LOST";
            document.getElementById("bot-status-text").textContent = "STUCK!";
          }
        }
      }, flipDuration);

    }, 2000);
  }

  function handleVsBotResolved(playerWon) {
    clearInterval(botTimerInterval);
    
    if (playerWon) {
      gameStatus = "WON";
      playSound('win');
      triggerConfetti();
      
      const credsGained = 150;
      playerProgression.credits += credsGained;
      addXP(500);
      saveUserData();

      showToast(`You Beat the Bot! +500 XP & +150 RC! 🏆`, 4000);
    } else {
      gameStatus = "LOST";
      playSound('lose');
      showToast(`ByteBrain Won the Race! Word was: ${targetWord}`, 4000);
    }

    setTimeout(() => {
      switchScreen("dashboard");
    }, 4500);
  }

  function generateBotGuessesSequence(target) {
    const list = [];
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    
    let g1 = "SLATE";
    if (g1 === target) g1 = "CRATE";
    list.push(g1);

    let g2 = "";
    for (let i = 0; i < 5; i++) {
      if (Math.random() > 0.6) {
        g2 += target[i];
      } else {
        g2 += alphabet[Math.floor(Math.random() * 26)];
      }
    }
    list.push(isValidWordleWord(g2.toLowerCase()) ? g2 : "ROBOT");

    let g3 = "";
    for (let i = 0; i < 5; i++) {
      if (Math.random() > 0.25) {
        g3 += target[i];
      } else {
        g3 += alphabet[Math.floor(Math.random() * 26)];
      }
    }
    list.push(isValidWordleWord(g3.toLowerCase()) ? g3 : "REACT");

    list.push(target);
    return list;
  }

  // Local PvP Arena
  function startLocalPvP() {
    currentGameMode = "local-pvp";
    
    const idx = Math.floor(Math.random() * TARGET_WORDS.length);
    const sharedWord = TARGET_WORDS[idx].toUpperCase();
    
    pvpP1.currentRow = 0;
    pvpP1.currentCol = 0;
    pvpP1.gameStatus = "IN_PROGRESS";
    pvpP1.targetWord = sharedWord;
    pvpP1.disabledKeys.clear();
    pvpP1.boardState = Array(6).fill(null).map(() => Array(5).fill(""));
    pvpP1.rowStatuses = Array(6).fill(null).map(() => Array(5).fill(""));
    buildGridDOM("pvp-p1-grid", 6, 5);
    renderVirtualKeyboard("pvp-p1-keyboard", handleP1Key, pvpP1.disabledKeys);
    document.getElementById("pvp-p1-badge").textContent = "Solving...";
    document.getElementById("pvp-p1-badge").className = "pvp-status-badge";
    
    pvpP2.currentRow = 0;
    pvpP2.currentCol = 0;
    pvpP2.gameStatus = "IN_PROGRESS";
    pvpP2.targetWord = sharedWord;
    pvpP2.disabledKeys.clear();
    pvpP2.boardState = Array(6).fill(null).map(() => Array(5).fill(""));
    pvpP2.rowStatuses = Array(6).fill(null).map(() => Array(5).fill(""));
    buildGridDOM("pvp-p2-grid", 6, 5);
    renderVirtualKeyboard("pvp-p2-keyboard", handleP2Key, pvpP2.disabledKeys);
    document.getElementById("pvp-p2-badge").textContent = "Solving...";
    document.getElementById("pvp-p2-badge").className = "pvp-status-badge";
  }

  function handleP1Key(key) {
    if (pvpP1.gameStatus !== "IN_PROGRESS") return;

    if (key === "ENTER") {
      submitPvPGuess("p1");
    } else if (key === "BACKSPACE" || key === "BACK") {
      if (pvpP1.currentCol > 0) {
        playSound('key');
        pvpP1.currentCol--;
        document.getElementById(`pvp-p1-grid-cell-${pvpP1.currentRow}-${pvpP1.currentCol}`).textContent = "";
        document.getElementById(`pvp-p1-grid-cell-${pvpP1.currentRow}-${pvpP1.currentCol}`).classList.remove("filled");
        pvpP1.boardState[pvpP1.currentRow][pvpP1.currentCol] = "";
      }
    } else if (/^[A-Z]$/.test(key.toUpperCase())) {
      if (pvpP1.currentCol < WORD_LENGTH) {
        playSound('key');
        const cell = document.getElementById(`pvp-p1-grid-cell-${pvpP1.currentRow}-${pvpP1.currentCol}`);
        cell.textContent = key.toUpperCase();
        cell.classList.add("filled");
        pvpP1.boardState[pvpP1.currentRow][pvpP1.currentCol] = key.toUpperCase();
        pvpP1.currentCol++;
      }
    }
  }

  function handleP2Key(key) {
    if (pvpP2.gameStatus !== "IN_PROGRESS") return;

    if (key === "ENTER") {
      submitPvPGuess("p2");
    } else if (key === "BACKSPACE" || key === "BACK") {
      if (pvpP2.currentCol > 0) {
        playSound('key');
        pvpP2.currentCol--;
        document.getElementById(`pvp-p2-grid-cell-${pvpP2.currentRow}-${pvpP2.currentCol}`).textContent = "";
        document.getElementById(`pvp-p2-grid-cell-${pvpP2.currentRow}-${pvpP2.currentCol}`).classList.remove("filled");
        pvpP2.boardState[pvpP2.currentRow][pvpP2.currentCol] = "";
      }
    } else if (/^[A-Z]$/.test(key.toUpperCase())) {
      if (pvpP2.currentCol < WORD_LENGTH) {
        playSound('key');
        const cell = document.getElementById(`pvp-p2-grid-cell-${pvpP2.currentRow}-${pvpP2.currentCol}`);
        cell.textContent = key.toUpperCase();
        cell.classList.add("filled");
        pvpP2.boardState[pvpP2.currentRow][pvpP2.currentCol] = key.toUpperCase();
        pvpP2.currentCol++;
      }
    }
  }

  function submitPvPGuess(player) {
    const p = player === "p1" ? pvpP1 : pvpP2;
    const gridId = player === "p1" ? "pvp-p1-grid" : "pvp-p2-grid";
    const kbdId = player === "p1" ? "pvp-p1-keyboard" : "pvp-p2-keyboard";
    const badgeId = player === "p1" ? "pvp-p1-badge" : "pvp-p2-badge";

    if (p.currentCol < WORD_LENGTH) {
      playSound('error');
      shakeActiveRow(gridId, p.currentRow);
      return;
    }

    const guess = p.boardState[p.currentRow].join("").toUpperCase();

    if (!isValidWordleWord(guess.toLowerCase())) {
      playSound('error');
      shakeActiveRow(gridId, p.currentRow);
      return;
    }

    const evaluation = evaluateGuessColors(guess, p.targetWord);
    p.rowStatuses[p.currentRow] = evaluation;

    p.gameStatus = "TRANSITION";

    const cells = [];
    for (let c = 0; c < WORD_LENGTH; c++) {
      cells.push(document.getElementById(`${gridId}-cell-${p.currentRow}-${c}`));
    }

    cells.forEach((cell, idx) => {
      setTimeout(() => {
        cell.classList.add("cell-flip");
        playSound('flip', idx * 0.04);
        setTimeout(() => {
          cell.classList.add(evaluation[idx]);
        }, 250);
      }, idx * 120);
    });

    const revealDuration = WORD_LENGTH * 120 + 550;
    setTimeout(() => {
      if (guess === p.targetWord) {
        p.gameStatus = "WON";
        playSound('win');
        triggerConfetti();

        document.getElementById(badgeId).textContent = "WINNER! 🎉";
        document.getElementById(badgeId).classList.add("correct");

        const opponent = player === "p1" ? pvpP2 : pvpP1;
        opponent.gameStatus = "LOST";
        const oppBadgeId = player === "p1" ? "pvp-p2-badge" : "pvp-p1-badge";
        document.getElementById(oppBadgeId).textContent = "DEFEAT";
        document.getElementById(oppBadgeId).classList.add("absent");

        showToast(`${player === "p1" ? "Player 1" : "Player 2"} wins!`);
        
        playerProgression.credits += 80;
        addXP(200);
        saveUserData();

        setTimeout(() => {
          switchScreen("dashboard");
        }, 4000);

      } else if (p.currentRow === 5) {
        p.gameStatus = "LOST";
        playSound('lose');
        document.getElementById(badgeId).textContent = "FAILED";
        document.getElementById(badgeId).classList.add("absent");

        const opponent = player === "p1" ? pvpP2 : pvpP1;
        if (opponent.gameStatus === "LOST") {
          showToast(`Both players failed! Word: ${p.targetWord}`, 4000);
          setTimeout(() => {
            switchScreen("dashboard");
          }, 4500);
        }
      } else {
        p.currentRow++;
        p.currentCol = 0;
        p.gameStatus = "IN_PROGRESS";

        const keyStatuses = {};
        for (let r = 0; r < p.currentRow; r++) {
          for (let c = 0; c < WORD_LENGTH; c++) {
            const letter = p.boardState[r][c];
            const status = p.rowStatuses[r][c];
            if (letter && status) {
              const cur = keyStatuses[letter];
              if (cur === "correct") continue;
              if (cur === "present" && status !== "correct") continue;
              keyStatuses[letter] = status;
            }
          }
        }
        renderVirtualKeyboard(kbdId, player === "p1" ? handleP1Key : handleP2Key, p.disabledKeys, keyStatuses);
      }
    }, revealDuration);
  }

  // Shop Purchasing & Skin Equipping
  function updateShopUI() {
    document.getElementById("buy-reveal-btn").textContent = `Buy (150 RC) - Have ${playerProgression.powerups.reveal}`;
    document.getElementById("buy-ditch-btn").textContent = `Buy (100 RC) - Have ${playerProgression.powerups.ditch}`;
    document.getElementById("buy-extra-btn").textContent = `Buy (200 RC) - Have ${playerProgression.powerups.extra}`;

    const themes = ["synthwave", "cyberpunk", "forest", "terminal"];
    themes.forEach(t => {
      const card = document.getElementById(`theme-card-${t}`);
      const btn = document.getElementById(`btn-unlock-${t}`);

      if (playerProgression.unlockedThemes.includes(t)) {
        card.className = "theme-card unlocked";
        if (playerProgression.activeTheme === t) {
          btn.textContent = "Equipped";
          btn.disabled = true;
          btn.style.opacity = "1";
        } else {
          btn.textContent = "Equip";
          btn.disabled = false;
          btn.style.opacity = "1";
        }
      } else {
        card.className = "theme-card locked";
        btn.textContent = "Unlock (300 RC)";
        btn.disabled = false;
        btn.style.opacity = "1";
      }
    });
  }

  function bindShopActions() {
    document.getElementById("buy-reveal-btn").addEventListener("click", () => {
      buyPowerup("reveal", 150);
    });
    document.getElementById("buy-ditch-btn").addEventListener("click", () => {
      buyPowerup("ditch", 100);
    });
    document.getElementById("buy-extra-btn").addEventListener("click", () => {
      buyPowerup("extra", 200);
    });

    const themes = ["synthwave", "cyberpunk", "forest", "terminal"];
    themes.forEach(t => {
      document.getElementById(`btn-unlock-${t}`).addEventListener("click", () => {
        if (playerProgression.unlockedThemes.includes(t)) {
          applyTheme(t);
          updateShopUI();
          playSound('key');
          showToast(`${t.toUpperCase()} skin equipped!`);
        } else {
          if (playerProgression.credits >= 300) {
            playerProgression.credits -= 300;
            playerProgression.unlockedThemes.push(t);
            applyTheme(t);
            updateShopUI();
            updateProgressionHUD();
            playSound('buy');
            showToast(`${t.toUpperCase()} theme unlocked!`);
          } else {
            playSound('error');
            showToast("Not enough credits!");
          }
        }
      });
    });
  }

  function buyPowerup(type, price) {
    if (playerProgression.credits >= price) {
      playerProgression.credits -= price;
      playerProgression.powerups[type]++;
      saveUserData();
      updateProgressionHUD();
      updateShopUI();
      playSound('buy');
      showToast(`Bought 1 Power-up!`);
    } else {
      playSound('error');
      showToast("Not enough credits!");
    }
  }

  // Active Power-ups Usage
  function useRevealPowerup() {
    if (gameStatus !== "IN_PROGRESS") return;
    if (playerProgression.powerups.reveal <= 0) {
      playSound('error');
      showToast("Buy more in Shop!");
      return;
    }

    let colToReveal = -1;
    for (let c = 0; c < WORD_LENGTH; c++) {
      if (boardState[currentRow][c] !== targetWord[c]) {
        colToReveal = c;
        break;
      }
    }

    if (colToReveal === -1) {
      showToast("Row already correct!");
      return;
    }

    playerProgression.powerups.reveal--;
    saveUserData();
    updateProgressionHUD();
    updatePowerupHUDButtons();
    playSound('powerup');

    const correctLetter = targetWord[colToReveal];
    boardState[currentRow][colToReveal] = correctLetter;

    const gridId = currentGameMode === "category-game" ? "category-grid" : 
                   currentGameMode === "time-attack" ? "timeattack-grid" : 
                   currentGameMode === "vs-bot" ? "vsbot-player-grid" : "classic-grid";
                   
    const cell = document.getElementById(`${gridId}-cell-${currentRow}-${colToReveal}`);
    cell.textContent = correctLetter;
    cell.classList.add("filled", "correct"); 
    
    if (currentCol === colToReveal) {
      currentCol++;
    }
    
    showToast("Correct letter placed!");
  }

  function useDitchPowerup() {
    if (gameStatus !== "IN_PROGRESS") return;
    if (playerProgression.powerups.ditch <= 0) {
      playSound('error');
      showToast("Buy more in Shop!");
      return;
    }

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const badLetters = letters.filter(l => !targetWord.includes(l) && !disabledKeysThisGame.has(l));

    if (badLetters.length === 0) {
      showToast("No bad letters remaining!");
      return;
    }

    playerProgression.powerups.ditch--;
    saveUserData();
    updateProgressionHUD();
    updatePowerupHUDButtons();
    playSound('powerup');

    let count = 0;
    while (badLetters.length > 0 && count < 3) {
      const idx = Math.floor(Math.random() * badLetters.length);
      const letter = badLetters.splice(idx, 1)[0];
      disabledKeysThisGame.add(letter);
      count++;
    }

    const gridId = currentGameMode === "category-game" ? "category-grid" : 
                   currentGameMode === "time-attack" ? "timeattack-grid" : 
                   currentGameMode === "vs-bot" ? "vsbot-player-grid" : "classic-grid";
                   
    updateKeyboardColors(gridId, "keyboard", disabledKeysThisGame);
    showToast(`Disabled ${count} keyboard letters!`);
  }

  function useExtraGuessPowerup() {
    if (gameStatus !== "IN_PROGRESS") return;
    if (playerProgression.powerups.extra <= 0) {
      playSound('error');
      showToast("Buy more in Shop!");
      return;
    }
    if (MAX_ROWS >= 7) {
      showToast("Extra row already unlocked!");
      return;
    }

    playerProgression.powerups.extra--;
    saveUserData();
    updateProgressionHUD();
    updatePowerupHUDButtons();
    playSound('powerup');

    MAX_ROWS = 7;
    boardState.push(Array(WORD_LENGTH).fill(""));
    rowStatuses.push(Array(WORD_LENGTH).fill(""));

    const gridId = currentGameMode === "category-game" ? "category-grid" : 
                   currentGameMode === "time-attack" ? "timeattack-grid" : 
                   currentGameMode === "vs-bot" ? "vsbot-player-grid" : "classic-grid";
                   
    const gridContainer = document.getElementById(gridId);
    gridContainer.style.gridTemplateRows = `repeat(${MAX_ROWS}, 1fr)`;

    const rowDiv = document.createElement("div");
    rowDiv.className = "grid-row";
    rowDiv.id = `${gridId}-row-6`;
    rowDiv.style.gridTemplateColumns = `repeat(${WORD_LENGTH}, 1fr)`;

    for (let c = 0; c < WORD_LENGTH; c++) {
      const cellDiv = document.createElement("div");
      cellDiv.className = "cell";
      cellDiv.id = `${gridId}-cell-6-${c}`;
      rowDiv.appendChild(cellDiv);
    }
    gridContainer.appendChild(rowDiv);
    showToast("7th attempt row added!");
  }

  // Populate Leaderboard Rankings
  function populateLeaderboard(boardType) {
    const tableBody = document.getElementById("leaderboard-table-body");
    tableBody.innerHTML = "";
    
    const metricLabel = document.getElementById("lbl-leaderboard-metric");
    metricLabel.textContent = boardType === "streak" ? "Streak" : boardType === "timeattack" ? "Score" : "Level";

    const pRecord = {
      name: "YOU (Player)",
      streak: playerProgression.stats.streak,
      timeattack: playerProgression.timeAttackHighscore,
      level: playerProgression.level,
      isPlayer: true
    };

    const records = [...MOCK_COMPETITORS, pRecord];
    records.sort((a, b) => b[boardType] - a[boardType]);

    records.forEach((rec, idx) => {
      const row = document.createElement("tr");
      if (rec.isPlayer) {
        row.className = "highlight";
      }

      const rankTd = document.createElement("td");
      rankTd.textContent = `#${idx + 1}`;
      
      const nameTd = document.createElement("td");
      nameTd.textContent = rec.name;

      const valTd = document.createElement("td");
      valTd.textContent = rec[boardType];

      row.appendChild(rankTd);
      row.appendChild(nameTd);
      row.appendChild(valTd);
      tableBody.appendChild(row);
    });
  }

  function bindLeaderboardTabs() {
    document.querySelectorAll(".leaderboard-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".leaderboard-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        populateLeaderboard(btn.dataset.board);
      });
    });
  }

  // Confetti Particle System
  function triggerConfetti() {
    const canvas = document.getElementById("confetti-canvas");
    const ctx = canvas.getContext("2d");
    canvas.style.display = "block";
    confettiActive = true;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener("resize", () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * -height - 20;
        this.color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
        this.r = Math.random() * 6 + 4;
        this.d = Math.random() * height + 10;
        this.vx = Math.random() * 4 - 2;
        this.vy = Math.random() * 5 + 3;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 10 - 5;
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.r, -this.r, this.r * 2, this.r * 2);
        ctx.restore();
      }

      update() {
        this.y += this.vy;
        this.x += this.vx;
        this.rotation += this.rotationSpeed;
        this.vx += Math.sin(this.y / 30) * 0.05;
      }
    }

    confettiParticles = [];
    for (let i = 0; i < 150; i++) {
      confettiParticles.push(new Particle());
    }

    function loop() {
      if (!confettiActive) return;
      ctx.clearRect(0, 0, width, height);

      let visible = 0;
      confettiParticles.forEach(p => {
        if (p.y < height && p.x > -20 && p.x < width + 20) {
          p.update();
          p.draw();
          visible++;
        }
      });

      if (visible === 0) {
        confettiActive = false;
        canvas.style.display = "none";
      } else {
        requestAnimationFrame(loop);
      }
    }

    loop();
    setTimeout(() => {
      confettiActive = false;
      canvas.style.display = "none";
    }, 4500);
  }

  // Modals Controller
  function openModal(id) {
    initAudio();
    const modal = document.getElementById(id);
    if (modal) {
      if (id === "modal-stats") {
        populateStatsModal();
      }
      modal.classList.add("open");
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove("open");
    }
  }

  function populateStatsModal() {
    document.getElementById("stat-played").textContent = playerProgression.stats.played;
    const ratio = playerProgression.stats.played > 0 ? Math.round((playerProgression.stats.won / playerProgression.stats.played) * 100) : 0;
    document.getElementById("stat-win-ratio").textContent = ratio;
    document.getElementById("stat-current-streak").textContent = playerProgression.stats.streak;
    document.getElementById("stat-max-streak").textContent = playerProgression.stats.maxStreak;

    const barsContainer = document.getElementById("guess-distribution-bars");
    barsContainer.innerHTML = "";

    const maxVal = Math.max(...playerProgression.stats.winDistribution.slice(1), 1);

    for (let i = 1; i <= 6; i++) {
      const row = document.createElement("div");
      row.className = "dist-row";

      const indexLbl = document.createElement("span");
      indexLbl.textContent = i;

      const barWrapper = document.createElement("div");
      barWrapper.className = "dist-bar-wrapper";

      const bar = document.createElement("div");
      bar.className = "dist-bar";
      const val = playerProgression.stats.winDistribution[i] || 0;
      bar.textContent = val;
      
      const widthPct = Math.max((val / maxVal) * 100, 7);
      bar.style.width = `${widthPct}%`;

      if (gameStatus === "WON" && currentRow === i - 1) {
        bar.classList.add("highlight");
      }

      barWrapper.appendChild(bar);
      row.appendChild(indexLbl);
      row.appendChild(barWrapper);
      barsContainer.appendChild(row);
    }
  }

  // Toasts
  function showToast(message, duration = 1800) {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, duration);
  }

  // Navigation Links Binding
  function bindDashboardNavigation() {
    document.querySelectorAll(".mode-card").forEach(card => {
      card.addEventListener("click", () => {
        const mode = card.dataset.mode;
        
        if (mode === "classic") {
          document.getElementById("classic-hud-title").textContent = "CLASSIC MODE";
          switchScreen("classic");
          initSinglePlayerGame("classic-unlimited");
        } else if (mode === "categories") {
          document.getElementById("category-game-panel").style.display = "none";
          document.getElementById("category-selector-panel").style.display = "block";
          switchScreen("categories");
        } else if (mode === "timeattack") {
          switchScreen("timeattack");
          startTimeAttackMode();
        } else if (mode === "multiplayer") {
          document.getElementById("mp-vsbot-panel").style.display = "none";
          document.getElementById("mp-pvp-panel").style.display = "none";
          document.getElementById("mp-selector-panel").style.display = "block";
          switchScreen("multiplayer");
        } else if (mode === "shop") {
          switchScreen("shop");
        } else if (mode === "leaderboard") {
          switchScreen("leaderboard");
        }
      });
    });

    document.getElementById("btn-home").addEventListener("click", () => {
      switchScreen("dashboard");
    });
  }

  // Multiplayer submenus clicks
  function bindMultiplayerSubMenu() {
    document.getElementById("btn-mp-vsbot").addEventListener("click", () => {
      const appContainer = document.querySelector(".app-container");
      if (appContainer) appContainer.classList.add("layout-wide");
      document.getElementById("mp-selector-panel").style.display = "none";
      document.getElementById("mp-vsbot-panel").style.display = "block";
      switchScreen("multiplayer");
      startVsBotRace();
    });

    document.getElementById("btn-mp-vslocal").addEventListener("click", () => {
      const appContainer = document.querySelector(".app-container");
      if (appContainer) appContainer.classList.add("layout-wide");
      document.getElementById("mp-selector-panel").style.display = "none";
      document.getElementById("mp-pvp-panel").style.display = "block";
      switchScreen("multiplayer");
      startLocalPvP();
    });
  }

  // Powerups HUD actions clicks
  function bindPowerupsHUDUsage() {
    document.getElementById("pwr-reveal").addEventListener("click", (e) => {
      e.stopPropagation();
      useRevealPowerup();
    });
    document.getElementById("pwr-ditch").addEventListener("click", (e) => {
      e.stopPropagation();
      useDitchPowerup();
    });
    document.getElementById("pwr-extra").addEventListener("click", (e) => {
      e.stopPropagation();
      useExtraGuessPowerup();
    });
  }

  // Settings & Modals bindings
  function bindModals() {
    document.getElementById("btn-help").addEventListener("click", () => openModal("modal-help"));
    document.getElementById("btn-stats").addEventListener("click", () => openModal("modal-stats"));
    document.getElementById("btn-settings").addEventListener("click", () => openModal("modal-settings"));

    document.getElementById("close-help").addEventListener("click", () => closeModal("modal-help"));
    document.getElementById("close-stats").addEventListener("click", () => closeModal("modal-stats"));
    document.getElementById("close-settings").addEventListener("click", () => closeModal("modal-settings"));
    document.getElementById("btn-start-playing").addEventListener("click", () => closeModal("modal-help"));

    document.getElementById("btn-levelup-confirm").addEventListener("click", () => closeModal("modal-levelup"));

    document.getElementById("btn-next-game").addEventListener("click", () => {
      closeModal("modal-stats");
      if (currentGameMode.startsWith("classic")) {
        initSinglePlayerGame("classic-unlimited");
      }
    });

    document.querySelectorAll(".modal-overlay").forEach(overlay => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          closeModal(overlay.id);
        }
      });
    });

    document.getElementById("setting-hard-mode").addEventListener("change", (e) => {
      preferences.hardMode = e.target.checked;
      localStorage.setItem("wordle_deluxe_prefs", JSON.stringify(preferences));
    });

    document.getElementById("setting-sound-effects").addEventListener("change", (e) => {
      preferences.soundEffects = e.target.checked;
      localStorage.setItem("wordle_deluxe_prefs", JSON.stringify(preferences));
    });

    document.getElementById("setting-theme").addEventListener("change", (e) => {
      preferences.lightTheme = e.target.checked;
      localStorage.setItem("wordle_deluxe_prefs", JSON.stringify(preferences));
      applyTheme(playerProgression.activeTheme);
    });
  }

  // Physical keyboard listeners
  function bindPhysicalKeyboard() {
    window.addEventListener("keydown", (e) => {
      const activeModal = document.querySelector(".modal-overlay.open");
      if (activeModal) return;

      if (currentGameMode === "local-pvp" && activeScreen === "multiplayer") return;

      if (e.key === "Enter") {
        handleSharedKeyboardInput("ENTER");
      } else if (e.key === "Backspace") {
        handleSharedKeyboardInput("BACKSPACE");
      } else {
        handleSharedKeyboardInput(e.key.toUpperCase());
      }
    });
  }

  // Countdown Daily Timer
  function initDailyTimer() {
    const timerEl = document.getElementById("countdown-timer");
    if (!timerEl) return;
    
    function updateTimer() {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const diff = nextMidnight - now;

      const hrs = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const mins = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const secs = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");

      timerEl.textContent = `${hrs}:${mins}:${secs}`;
    }

    updateTimer();
    setInterval(updateTimer, 1000);
  }

  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  // Boot
  function init() {
    loadUserData();
    bindDashboardNavigation();
    bindCategoryMenu();
    bindMultiplayerSubMenu();
    bindPowerupsHUDUsage();
    bindShopActions();
    bindLeaderboardTabs();
    bindModals();
    bindPhysicalKeyboard();
    initDailyTimer();

    if (playerProgression.stats.played === 0) {
      setTimeout(() => {
        openModal("modal-help");
      }, 500);
    }
  }

  window.addEventListener("DOMContentLoaded", init);

})();
