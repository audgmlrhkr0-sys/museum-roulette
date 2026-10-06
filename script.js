const SYMBOLS = [
  "assets/1.png",
  "assets/2.png",
  "assets/3.png",
  "4.png",
  "assets/5.png",
  "6.png",
  "assets/7.png",
];
const REEL_HEIGHT = 245;
const SPIN_TIME = 3700;
const JACKPOT_RATE = 0.05;

const machine = document.querySelector(".machine");
const reels = [...document.querySelectorAll(".reel")];
const lever = document.querySelector("#lever");
const leverTrack = document.querySelector("#leverTrack");
const jackpotTest = document.querySelector("#jackpotTest");
const settingsTrigger = document.querySelector("#settingsTrigger");
const settingsModal = document.querySelector("#settingsModal");
const settingsClose = document.querySelector("#settingsClose");
const settingsGate = document.querySelector("#settingsGate");
const settingsControls = document.querySelector("#settingsControls");
const settingsPassword = document.querySelector("#settingsPassword");
const settingsUnlock = document.querySelector("#settingsUnlock");
const settingsError = document.querySelector("#settingsError");
const fullscreenToggle = document.querySelector("#fullscreenToggle");
const message = document.querySelector("#message");
const messageText = message.querySelector("p");

let spinning = false;
let dragging = false;
let dragStartY = 0;
let dragDistance = 0;
let audioContext;
let spinSound;

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getResult() {
  if (Math.random() < JACKPOT_RATE) {
    const winner = randomItem(SYMBOLS);
    return [winner, winner, winner];
  }

  let result;
  do {
    result = [randomItem(SYMBOLS), randomItem(SYMBOLS), randomItem(SYMBOLS)];
  } while (result[0] === result[1] && result[1] === result[2]);
  return result;
}

function renderSymbol(source) {
  const extraClass = source.endsWith("3.png") ? " symbol-image--scale" : "";
  return `<img class="symbol-image${extraClass}" src="${source}" alt="" draggable="false">`;
}

function renderStaticReels(result = SYMBOLS.slice(0, 3)) {
  reels.forEach((reel, index) => {
    reel.innerHTML = `<div class="symbol">${renderSymbol(result[index])}</div>`;
    reel.style.transform = "translateY(-50%)";
    reel.style.transition = "none";
  });
}

function makeStrip(finalSymbol, reelIndex) {
  const itemHeight = document.querySelector(".reels").clientHeight;
  const count = 24 + reelIndex * 3;
  const items = Array.from({ length: count }, () => randomItem(SYMBOLS));
  items.push(finalSymbol);

  return {
    html: items
      .map(
        (symbol, index) =>
          `<div class="symbol" style="top:${50 + index * 100}%">${renderSymbol(symbol)}</div>`,
      )
      .join(""),
    distance: itemHeight * (items.length - 1),
  };
}

function getAudioContext() {
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playTone(
  frequency,
  duration,
  type = "square",
  volume = 0.025,
  delay = 0,
) {
  try {
    const context = getAudioContext();
    const startAt = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, startAt);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      startAt + duration,
    );
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  } catch {
    // Sound is optional; the machine remains fully functional without Web Audio.
  }
}

function playNoise(
  duration,
  volume,
  filterFrequency,
  delay = 0,
  filterType = "bandpass",
) {
  try {
    const context = getAudioContext();
    const startAt = context.currentTime + delay;
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * duration),
      context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.value = filterFrequency;
    filter.Q.value = 1.2;
    gain.gain.setValueAtTime(volume, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(startAt);
  } catch {
    // Sound is optional.
  }
}

function playLeverSound() {
  try {
    const context = getAudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(105, context.currentTime + 0.12);
    oscillator.frequency.exponentialRampToValueAtTime(
      42,
      context.currentTime + 0.36,
    );
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.setValueAtTime(0.11, context.currentTime + 0.12);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + 0.37,
    );
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + 0.12);
    oscillator.stop(context.currentTime + 0.38);
  } catch {
    // Sound is optional.
  }

  // Metal scraping down the rail, followed by a heavy two-part latch.
  playNoise(0.16, 0.075, 950, 0, "highpass");
  playNoise(0.07, 0.2, 360, 0.1, "lowpass");
  playNoise(0.045, 0.15, 1200, 0.13);
  playNoise(0.08, 0.16, 280, 0.22, "lowpass");
  playTone(58, 0.28, "sine", 0.09, 0.21);
}

function startSpinSound() {
  const startedAt = performance.now();
  const totalDuration = SPIN_TIME + (reels.length - 1) * 380;
  const state = { timer: null };

  const flipCard = () => {
    const elapsed = performance.now() - startedAt;
    if (elapsed >= totalDuration || spinSound !== state) return;

    // Short layered taps recreate cards rapidly striking the display frame.
    playNoise(0.018, 0.065, 1450 + Math.random() * 900);
    playNoise(0.026, 0.032, 520 + Math.random() * 260, 0, "lowpass");
    if (Math.random() > 0.72) {
      playNoise(0.012, 0.025, 3200 + Math.random() * 1000, 0.008);
    }

    const progress = elapsed / totalDuration;
    let nextFlip;
    if (progress < 0.12) {
      nextFlip = 90 - progress * 430;
    } else if (progress < 0.72) {
      nextFlip = 35 + Math.random() * 12;
    } else {
      const slowDown = (progress - 0.72) / 0.28;
      nextFlip = 42 + slowDown ** 2 * 150;
    }
    state.timer = window.setTimeout(flipCard, nextFlip);
  };

  spinSound = state;
  flipCard();
}

function stopSpinSound() {
  if (!spinSound) return;
  window.clearTimeout(spinSound.timer);
  spinSound = null;
}

function playStopSound(index) {
  playTone(130 + index * 30, 0.11, "triangle", 0.045);
  setTimeout(() => playTone(72, 0.08, "square", 0.02), 35);
}

function playJackpotSound() {
  // Short brass-style fanfare.
  [
    [392, 0],
    [523, 0.14],
    [659, 0.28],
    [784, 0.42],
    [1047, 0.6],
  ].forEach(([note, delay]) => {
    playTone(note, 0.42, "sawtooth", 0.035, delay);
    playTone(note * 2, 0.3, "sine", 0.022, delay);
  });

  // A dense cascade of small metallic impacts, like coins pouring into a tray.
  for (let index = 0; index < 24; index += 1) {
    const delay = 0.58 + index * 0.038 + Math.random() * 0.025;
    const pitch = 1200 + Math.random() * 2200;
    playTone(pitch, 0.12 + Math.random() * 0.16, "sine", 0.025, delay);
    playNoise(0.025, 0.035, pitch, delay);
  }
  playNoise(0.85, 0.04, 2600, 0.62, "highpass");
}

function launchConfetti() {
  document.querySelector(".confetti-layer")?.remove();
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  layer.setAttribute("aria-hidden", "true");
  const colors = ["#b8ff35", "#efffc9", "#ffffff", "#9ba4a0", "#4f7118"];

  for (let index = 0; index < 90; index += 1) {
    const piece = document.createElement("i");
    piece.style.setProperty("--x", `${Math.random() * 100}vw`);
    piece.style.setProperty("--drift", `${(Math.random() - 0.5) * 240}px`);
    piece.style.setProperty("--delay", `${Math.random() * 0.65}s`);
    piece.style.setProperty("--duration", `${2.2 + Math.random() * 1.4}s`);
    piece.style.setProperty("--spin", `${360 + Math.random() * 900}deg`);
    piece.style.setProperty("--color", colors[index % colors.length]);
    piece.style.setProperty("--size", `${6 + Math.random() * 8}px`);
    layer.appendChild(piece);
  }

  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 4300);
}

function playFailureSound() {
  playTone(196, 0.9, "sine", 0.075);
  playTone(193, 0.85, "sine", 0.05);
  playTone(98, 0.7, "triangle", 0.035, 0.04);
}

function pullLever() {
  lever.classList.remove("is-returning");
  lever.style.transform = "translateY(178px)";
  playLeverSound();

  window.setTimeout(() => {
    lever.classList.add("is-returning");
    lever.style.transform = "translateY(0)";
  }, 180);
}

function spin(forceJackpot = false) {
  if (spinning) return;
  spinning = true;
  jackpotTest.disabled = true;
  const forcedSymbol = randomItem(SYMBOLS);
  const result = forceJackpot
    ? [forcedSymbol, forcedSymbol, forcedSymbol]
    : getResult();

  pullLever();
  window.setTimeout(startSpinSound, 150);
  message.classList.remove("is-jackpot", "is-fail");
  machine.classList.remove("is-fail");
  messageText.textContent = "경북대미술관 행운의 룰렛 돌리는 중🍀";

  reels.forEach((reel, index) => {
    const strip = makeStrip(result[index], index);
    reel.innerHTML = strip.html;
    reel.classList.add("is-spinning");
    reel.style.transition = "none";
    reel.style.transform = "translateY(-50%)";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const duration = SPIN_TIME + index * 380;
        reel.style.transition = `transform ${duration}ms cubic-bezier(.12,.68,.16,1)`;
        reel.style.transform = `translateY(calc(-50% - ${strip.distance}px))`;

        window.setTimeout(() => {
          reel.classList.remove("is-spinning");
          playStopSound(index);
          machine.classList.add("is-hit");
          window.setTimeout(() => machine.classList.remove("is-hit"), 340);
        }, duration);
      });
    });
  });

  const finalTime = SPIN_TIME + (reels.length - 1) * 380;
  window.setTimeout(() => {
    stopSpinSound();
    const jackpot = result.every((symbol) => symbol === result[0]);
    messageText.textContent = jackpot
      ? "잭팟! 미술관 굿즈를 증정합니다!"
      : "아쉬워요, 그래도 간식 하나 챙겨가세요!";

    if (jackpot) {
      message.classList.add("is-jackpot");
      playJackpotSound();
      launchConfetti();
    } else {
      playFailureSound();
      message.classList.add("is-fail");
      machine.classList.add("is-fail");
      window.setTimeout(() => {
        message.classList.remove("is-fail");
        machine.classList.remove("is-fail");
      }, 900);
    }
    spinning = false;
    jackpotTest.disabled = false;
  }, finalTime + 120);
}

lever.addEventListener("pointerdown", (event) => {
  if (spinning) return;
  dragging = true;
  dragStartY = event.clientY;
  dragDistance = 0;
  lever.setPointerCapture(event.pointerId);
  lever.classList.remove("is-returning");
});

lever.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  dragDistance = Math.max(0, Math.min(178, event.clientY - dragStartY));
  lever.style.transform = `translateY(${dragDistance}px)`;
});

function finishDrag(event) {
  if (!dragging) return;
  dragging = false;
  if (lever.hasPointerCapture(event.pointerId)) {
    lever.releasePointerCapture(event.pointerId);
  }

  if (dragDistance > 75) {
    spin();
  } else {
    lever.classList.add("is-returning");
    lever.style.transform = "translateY(0)";
  }
}

lever.addEventListener("pointerup", finishDrag);
lever.addEventListener("pointercancel", finishDrag);

lever.addEventListener("click", () => {
  if (!spinning && dragDistance < 8) spin();
});

leverTrack.addEventListener("dblclick", (event) => event.preventDefault());

function openSettings() {
  settingsModal.hidden = false;
  settingsGate.hidden = false;
  settingsControls.hidden = true;
  settingsPassword.value = "";
  settingsError.textContent = "";
  window.setTimeout(() => settingsPassword.focus(), 0);
}

function closeSettings() {
  settingsModal.hidden = true;
  settingsPassword.value = "";
  settingsError.textContent = "";
}

function unlockSettings() {
  if (settingsPassword.value === "000") {
    settingsGate.hidden = true;
    settingsControls.hidden = false;
    settingsError.textContent = "";
    jackpotTest.focus();
  } else {
    settingsError.textContent = "비밀번호가 올바르지 않습니다";
    settingsPassword.value = "";
    settingsPassword.focus();
  }
}

settingsTrigger.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsUnlock.addEventListener("click", unlockSettings);
settingsPassword.addEventListener("input", () => {
  settingsPassword.value = settingsPassword.value.replace(/\D/g, "");
});
settingsPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") unlockSettings();
});
settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) closeSettings();
});
jackpotTest.addEventListener("click", () => {
  closeSettings();
  spin(true);
});

fullscreenToggle.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    settingsError.textContent = "전체화면을 사용할 수 없습니다";
  }
});

document.addEventListener("fullscreenchange", () => {
  const isFullscreen = Boolean(document.fullscreenElement);
  fullscreenToggle.querySelector("span").textContent = isFullscreen ? "↙" : "⛶";
  fullscreenToggle.setAttribute(
    "aria-label",
    isFullscreen ? "전체화면 종료" : "전체화면",
  );
  fullscreenToggle.title = isFullscreen ? "전체화면 종료" : "전체화면";
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsModal.hidden) closeSettings();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !event.repeat) {
    if (!settingsModal.hidden) return;
    event.preventDefault();
    spin();
  }
});

renderStaticReels();
