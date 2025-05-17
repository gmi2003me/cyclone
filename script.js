const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Screen elements
const preGameScreen = document.getElementById('pre-game-screen');
const postGameScreen = document.getElementById('post-game-screen');
const gameElements = document.getElementById('game-elements');

// Start buttons (pre-game)
const start1PlayerButton = document.getElementById('start-1-player');
const start2PlayerButton = document.getElementById('start-2-player');
const start3PlayerButton = document.getElementById('start-3-player');

// Post-game UI elements
const finalScoresDiv = document.getElementById('final-scores');
const winnerAnnouncementP = document.getElementById('winner-announcement');
const restart1PlayerButton = document.getElementById('restart-1-player');
const restart2PlayerButton = document.getElementById('restart-2-player');
const restart3PlayerButton = document.getElementById('restart-3-player');

const scoreDisplayElement = document.getElementById('score-display');
const player1ActionButton = document.getElementById('player1-action-button');
const player2ActionButton = document.getElementById('player2-action-button');
const player3ActionButton = document.getElementById('player3-action-button');
const playerActionButtons = [player1ActionButton, player2ActionButton, player3ActionButton];
const clickablePlayerButtonsDiv = document.getElementById('clickable-player-buttons');

let numPlayers = 0;
let gameActive = false;
let players = [];
let currentLightIndex = 0;
const lightPositions = [];
const numLights = 30;
const lightRadius = 10;
const lightSpeed = 100;
let currentLightActivationTime = 0;
const playerColors = ['red', 'green', 'blue'];
let audioCtx = null;

// Scale for light movement sound - 8 notes Ascending, 8 notes Descending
const scaleFrequencies = [
    // Ascent (8 notes)
    261.63, // C4
    293.66, // D4
    329.63, // E4
    349.23, // F4
    392.00, // G4
    440.00, // A4
    493.88, // B4
    523.25, // C5 (Peak)
    // Descent (8 notes)
    523.25, // C5 (Start of descent)
    493.88, // B4
    440.00, // A4
    392.00, // G4
    349.23, // F4
    329.63, // E4
    293.66, // D4
    261.63  // C4 (End of descent, leads back to C4 root for next cycle)
];
let scaleNoteIndex = 0;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function playTone(frequency, duration = 50, type = 'sine') {
    const context = getAudioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gainNode.gain.setValueAtTime(0.1, context.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration / 1000);
}

function updateScoreDisplay() {
    if (!scoreDisplayElement) return;
    scoreDisplayElement.innerHTML = '';
    players.forEach(player => {
        const playerScoreElement = document.createElement('p');
        playerScoreElement.textContent = `Player ${player.id}: ${player.score} (Remaining Attempts: ${player.attempts})`;
        playerScoreElement.style.color = player.color || 'black';
        scoreDisplayElement.appendChild(playerScoreElement);
    });
}

function initializeLightPositions() {
    lightPositions.length = 0;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 30;
    let allPointValues = [];
    for (let i = 0; i < 4; i++) allPointValues.push(10);
    for (let i = 0; i < 3; i++) allPointValues.push(5);
    for (let i = 0; i < 6; i++) allPointValues.push(2);
    for (let i = 0; i < 17; i++) allPointValues.push(1);
    while (allPointValues.length < numLights) allPointValues.push(0);
    allPointValues = allPointValues.slice(0, numLights);
    shuffleArray(allPointValues);
    for (let i = 0; i < numLights; i++) {
        const angle = (i / numLights) * 2 * Math.PI;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        const currentPointValue = allPointValues[i];
        lightPositions.push({
            x, y,
            isMainTarget: currentPointValue === 10,
            isJackpot: false,
            pointValue: currentPointValue,
            flashOutlineColor: null,
            flashOutlineWidth: null
        });
    }
}

function drawLights() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lightPositions.forEach((pos, index) => {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, lightRadius, 0, 2 * Math.PI);
        ctx.fillStyle = 'lightgray';
        if (pos.pointValue === 10) ctx.fillStyle = 'gold';
        else if (pos.pointValue === 5) ctx.fillStyle = '#FFB700';
        else if (pos.pointValue === 2) ctx.fillStyle = '#FFD700';
        else if (pos.pointValue === 1) ctx.fillStyle = '#ADD8E6';
        if (index === currentLightIndex) {
            if (pos.pointValue === 10) ctx.fillStyle = 'darkorange';
            else if (pos.pointValue === 5) ctx.fillStyle = 'orangered';
            else if (pos.pointValue === 2) ctx.fillStyle = 'coral';
            else if (pos.pointValue === 1) ctx.fillStyle = 'deepskyblue';
            else ctx.fillStyle = 'blue';
        }
        ctx.fill();
        ctx.strokeStyle = pos.flashOutlineColor || 'black';
        ctx.lineWidth = pos.flashOutlineWidth || 1;
        ctx.stroke();
        ctx.closePath();
        if (pos.pointValue > 0) {
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let textColor = 'black';
            if (index === currentLightIndex) textColor = 'white';
            else if (pos.pointValue === 1) textColor = 'black';
            else if (pos.pointValue === 10 || pos.pointValue === 5 || pos.pointValue === 2) textColor = 'black';
            ctx.fillStyle = textColor;
            ctx.fillText(pos.pointValue.toString(), pos.x, pos.y);
        }
    });
}

function updateLight() {
    if (!gameActive) return;
    currentLightIndex = (currentLightIndex + 1) % numLights;
    currentLightActivationTime = Date.now();
    
    // Play next note in the scale
    playTone(scaleFrequencies[scaleNoteIndex], 60, 'sine'); 
    scaleNoteIndex = (scaleNoteIndex + 1) % scaleFrequencies.length;

    drawLights();
    setTimeout(updateLight, lightSpeed);
}

function processPlayerAttempt(playerObject) {
    if (!gameActive || !playerObject || playerObject.attempts <= 0) return;
    const pressTime = Date.now();
    const lightToFlash = lightPositions[currentLightIndex];
    if (lightToFlash) {
        lightToFlash.flashOutlineColor = playerObject.color;
        lightToFlash.flashOutlineWidth = 3;
        drawLights();
        setTimeout(() => {
            if (lightToFlash) {
                lightToFlash.flashOutlineColor = null;
                lightToFlash.flashOutlineWidth = null;
                drawLights();
            }
        }, 200);
    }
    playerObject.attempts--;
    const hitLight = lightPositions[currentLightIndex];
    let scoredPointsThisTurn = 0;
    if (hitLight.pointValue > 0) {
        const points = hitLight.pointValue;
        let windowDuration = lightSpeed / points;
        windowDuration = Math.max(windowDuration, 15);
        const windowCenter = currentLightActivationTime + (lightSpeed / 2);
        const windowStart = windowCenter - (windowDuration / 2);
        const windowEnd = windowCenter + (windowDuration / 2);
        if (pressTime >= windowStart && pressTime <= windowEnd) {
            scoredPointsThisTurn = hitLight.pointValue;
            playerObject.score += scoredPointsThisTurn;
            console.log(`Player ${playerObject.id} hit light worth ${scoredPointsThisTurn} (Window: ${windowDuration.toFixed(2)}ms)`);
            switch (scoredPointsThisTurn) {
                case 1: playTone(250, 80, 'sine'); break;
                case 2: playTone(350, 100, 'square'); break;
                case 5: playTone(500, 120, 'sawtooth'); break;
                case 10: playTone(600, 80, 'triangle'); setTimeout(() => playTone(800, 80, 'triangle'), 80); setTimeout(() => playTone(1000, 80, 'triangle'), 160); break;
            }
        } else {
            console.log(`Player ${playerObject.id} hit light ${hitLight.pointValue} OUTSIDE window.`);
            playTone(80, 250, 'sawtooth');
        }
    } else {
        console.log(`Player ${playerObject.id} hit a 0-point light.`);
        playTone(80, 250, 'sawtooth');
    }
    updateScoreDisplay();
    if (players.every(p => p.attempts <= 0)) {
        gameOver();
    }
}

function startGame(playersCount) {
    numPlayers = playersCount;
    gameActive = true;
    players = [];
    for (let i = 0; i < numPlayers; i++) {
        players.push({ 
            id: i + 1, 
            score: 0, 
            attempts: 10, 
            color: playerColors[i] 
        });
    }
    currentLightIndex = 0;
    currentLightActivationTime = Date.now();
    
    preGameScreen.style.display = 'none';
    postGameScreen.style.display = 'none';
    gameElements.style.display = 'flex'; // Use flex for the game-elements container
    clickablePlayerButtonsDiv.style.display = 'flex';

    playerActionButtons.forEach((button, index) => {
        if (index < numPlayers) {
            button.style.display = 'inline-block';
            button.onclick = () => processPlayerAttempt(players[index]); 
        } else {
            button.style.display = 'none';
            button.onclick = null;
        }
    });

    initializeLightPositions(); 
    updateScoreDisplay(); 
    drawLights();
    updateLight();
}

function gameOver() {
    gameActive = false;
    console.log("Game Over!");

    gameElements.style.display = 'none';
    clickablePlayerButtonsDiv.style.display = 'none';
    postGameScreen.style.display = 'flex'; // Use flex for centering

    finalScoresDiv.innerHTML = ''; // Clear previous scores
    let maxScore = -1;
    let winners = [];

    players.forEach(p => {
        const scoreP = document.createElement('p');
        scoreP.textContent = `Player ${p.id}: ${p.score} points`;
        scoreP.style.color = p.color || 'black';
        finalScoresDiv.appendChild(scoreP);

        if (p.score > maxScore) {
            maxScore = p.score;
            winners = [p.id];
        } else if (p.score === maxScore && p.score > 0) {
            winners.push(p.id);
        }
    });

    if (winners.length > 0 && maxScore > 0) {
        winnerAnnouncementP.textContent = `Winner(s): Player ${winners.join(' & ')} with ${maxScore} points!`;
    } else {
        winnerAnnouncementP.textContent = "No one scored any points this time!";
    }
    // The old alert is removed as results are on screen now.
}

// Initial Setup: Pre-game screen is visible by default CSS, others hidden.
// Game elements are set to display:none in HTML/CSS.
// Post-game screen is set to display:none in HTML/CSS.

// Event listeners for PRE-GAME start buttons
start1PlayerButton.addEventListener('click', () => startGame(1));
start2PlayerButton.addEventListener('click', () => startGame(2));
start3PlayerButton.addEventListener('click', () => startGame(3));

// Event listeners for POST-GAME restart buttons
restart1PlayerButton.addEventListener('click', () => startGame(1));
restart2PlayerButton.addEventListener('click', () => startGame(2));
restart3PlayerButton.addEventListener('click', () => startGame(3));

window.addEventListener('keydown', (event) => {
    if (!gameActive) return;
    let playerToProcess = null;
    if (event.code === 'ShiftLeft' && numPlayers >= 1) playerToProcess = players[0];
    else if (event.code === 'Space' && numPlayers >= 2) { event.preventDefault(); playerToProcess = players[1]; }
    else if (event.code === 'Enter' && numPlayers >= 3) { event.preventDefault(); playerToProcess = players[2]; }
    if (playerToProcess) {
        processPlayerAttempt(playerToProcess);
    }
});

// Initialize canvas and lights for initial view (all off)
// Canvas dimensions are set in global scope in script.js
canvas.width = 600;
canvas.height = 400;
initializeLightPositions();
drawLights(); 