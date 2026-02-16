"use strict";
console.clear();
// This is a prime example of what starts out as a simple project
// and snowballs way beyond its intended size. It's a little clunky
// reading/working on this single file, but here it is anyways :)
const IS_MOBILE = window.innerWidth <= 640;
const IS_DESKTOP = window.innerWidth > 800;
const IS_HEADER = IS_DESKTOP && window.innerHeight < 300;
// Detect high end devices. This will be a moving target.
const IS_HIGH_END_DEVICE = (() => {
  const hwConcurrency = navigator.hardwareConcurrency;
  if (!hwConcurrency) return false;
  const minCount = window.innerWidth <= 1024 ? 4 : 8;
  return hwConcurrency >= minCount;
})();
// Prevent canvases from getting too large on ridiculous screen sizes.
const MAX_WIDTH = 7680;
const MAX_HEIGHT = 4320;
const GRAVITY = 0.9; // Acceleration in px/s
let simSpeed = 1;
function getDefaultScaleFactor() {
  if (IS_MOBILE) return 0.9;
  if (IS_HEADER) return 0.75;
  return 1;
}
let stageW, stageH;
let quality = 1;
let isLowQuality = false;
let isNormalQuality = true;
let isHighQuality = false;
const QUALITY_LOW = 1;
const QUALITY_NORMAL = 2;
const QUALITY_HIGH = 3;
const SKY_LIGHT_NONE = 0;
const SKY_LIGHT_DIM = 1;
const SKY_LIGHT_NORMAL = 2;
const COLOR = {
  Red: "#ff0043",
  Green: "#14fc56",
  Blue: "#1e7fff",
  Purple: "#e60aff",
  Gold: "#ffbf36",
  White: "#ffffff",
};
const INVISIBLE = "_INVISIBLE_";
const PI_2 = Math.PI * 2;
const PI_HALF = Math.PI * 0.5;

const trailsStage = new Stage("trails-canvas");
const mainStage = new Stage("main-canvas");
const stages = [trailsStage, mainStage];

function fullscreenEnabled() {
  return fscreen.fullscreenEnabled;
}
function isFullscreen() {
  return !!fscreen.fullscreenElement;
}
function toggleFullscreen() {
  if (fullscreenEnabled()) {
    if (isFullscreen()) {
      fscreen.exitFullscreen();
    } else {
      fscreen.requestFullscreen(document.documentElement);
    }
  }
}
fscreen.addEventListener("fullscreenchange", () => {
  store.setState({ fullscreen: isFullscreen() });
});

const store = {
  _listeners: new Set(),
  _dispatch(prevState) {
    this._listeners.forEach((listener) => listener(this.state, prevState));
  },
  state: {
    paused: true,
    soundEnabled: false,
    menuOpen: false,
    openHelpTopic: null,
    fullscreen: isFullscreen(),
    config: {
      quality: String(IS_HIGH_END_DEVICE ? QUALITY_HIGH : QUALITY_NORMAL),
      shell: "Random",
      size: IS_DESKTOP ? "3" : IS_HEADER ? "1.2" : "2",
      autoLaunch: true,
      finale: false,
      skyLighting: SKY_LIGHT_NORMAL + "",
      hideControls: IS_HEADER,
      longExposure: false,
      scaleFactor: getDefaultScaleFactor(),
    },
  },
  setState(nextState) {
    const prevState = this.state;
    this.state = Object.assign({}, this.state, nextState);
    this._dispatch(prevState);
    this.persist();
  },
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  },
  load() {
    const serializedData = localStorage.getItem("cm_fireworks_data");
    if (serializedData) {
      const { schemaVersion, data } = JSON.parse(serializedData);
      const config = this.state.config;
      switch (schemaVersion) {
        case "1.1":
          config.quality = data.quality;
          config.size = data.size;
          config.skyLighting = data.skyLighting;
          break;
        case "1.2":
          config.quality = data.quality;
          config.size = data.size;
          config.skyLighting = data.skyLighting;
          config.scaleFactor = data.scaleFactor;
          break;
      }
    }
  },
  persist() {
    const config = this.state.config;
    localStorage.setItem(
      "cm_fireworks_data",
      JSON.stringify({
        schemaVersion: "1.2",
        data: {
          quality: config.quality,
          size: config.size,
          skyLighting: config.skyLighting,
          scaleFactor: config.scaleFactor,
        },
      })
    );
  },
};
if (!IS_HEADER) {
  store.load();
}

function togglePause(toggle) {
  const paused = store.state.paused;
  let newValue = typeof toggle === "boolean" ? toggle : !paused;
  if (paused !== newValue) {
    store.setState({ paused: newValue });
  }
}
function toggleSound(toggle) {
  store.setState({ soundEnabled: typeof toggle === "boolean" ? toggle : !store.state.soundEnabled });
}
function toggleMenu(toggle) {
  store.setState({ menuOpen: typeof toggle === "boolean" ? toggle : !store.state.menuOpen });
}
function updateConfig(nextConfig) {
  nextConfig = nextConfig || getConfigFromDOM();
  store.setState({ config: Object.assign({}, store.state.config, nextConfig) });
  configDidUpdate();
}
function configDidUpdate() {
  quality = qualitySelector();
  isLowQuality = quality === QUALITY_LOW;
  isNormalQuality = quality === QUALITY_NORMAL;
  isHighQuality = quality === QUALITY_HIGH;
  if (skyLightingSelector() === SKY_LIGHT_NONE) {
    appNodes.canvasContainer.style.backgroundColor = "#000";
  }
  Spark.drawWidth = quality === QUALITY_HIGH ? 0.75 : 1;
}
const isRunning = (state = store.state) => !state.paused && !state.menuOpen;
const soundEnabledSelector = (state = store.state) => state.soundEnabled;
const canPlaySoundSelector = (state = store.state) => isRunning(state) && soundEnabledSelector(state);
const qualitySelector = () => +store.state.config.quality;
const shellNameSelector = () => store.state.config.shell;
const shellSizeSelector = () => +store.state.config.size;
const finaleSelector = () => store.state.config.finale;
const skyLightingSelector = () => +store.state.config.skyLighting;
const scaleFactorSelector = () => store.state.config.scaleFactor;

const helpContent = {
  shellType: { header: "Shell Type", body: 'The type of firework that will be launched. Select "Random" for a nice assortment!' },
  shellSize: { header: "Shell Size", body: "The size of the fireworks. Larger shells have bigger bursts but require more processing power." },
  quality: { header: "Quality", body: "Overall graphics quality. Lower if animation lags." },
  skyLighting: { header: "Sky Lighting", body: 'Illuminates the background. Set to "Dim" or "None" if too bright.' },
  scaleFactor: { header: "Scale", body: "Scale all fireworks (zoom in/out effect)." },
  autoLaunch: { header: "Auto Fire", body: "Automatically launches sequences." },
  finaleMode: { header: "Finale Mode", body: 'Intense bursts. Requires "Auto Fire" enabled.' },
  hideControls: { header: "Hide Controls", body: "Hides controls for cleaner view." },
  fullscreen: { header: "Fullscreen", body: "Toggle fullscreen mode." },
  longExposure: { header: "Open Shutter", body: "Long exposure effect (trails preserved longer)." },
};

const nodeKeyToHelpKey = {
  shellTypeLabel: "shellType",
  shellSizeLabel: "shellSize",
  qualityLabel: "quality",
  skyLightingLabel: "skyLighting",
  scaleFactorLabel: "scaleFactor",
  autoLaunchLabel: "autoLaunch",
  finaleModeLabel: "finaleMode",
  hideControlsLabel: "hideControls",
  fullscreenLabel: "fullscreen",
  longExposureLabel: "longExposure",
};

const appNodes = {
  stageContainer: ".stage-container",
  canvasContainer: ".canvas-container",
  controls: ".controls",
  menu: ".menu",
  menuInnerWrap: ".menu__inner-wrap",
  pauseBtn: ".pause-btn",
  pauseBtnSVG: ".pause-btn use",
  soundBtn: ".sound-btn",
  soundBtnSVG: ".sound-btn use",
  shellType: ".shell-type",
  shellTypeLabel: ".shell-type-label",
  shellSize: ".shell-size",
  shellSizeLabel: ".shell-size-label",
  quality: ".quality-ui",
  qualityLabel: ".quality-ui-label",
  skyLighting: ".sky-lighting",
  skyLightingLabel: ".sky-lighting-label",
  scaleFactor: ".scaleFactor",
  scaleFactorLabel: ".scaleFactor-label",
  autoLaunch: ".auto-launch",
  autoLaunchLabel: ".auto-launch-label",
  finaleModeFormOption: ".form-option--finale-mode",
  finaleMode: ".finale-mode",
  finaleModeLabel: ".finale-mode-label",
  hideControls: ".hide-controls",
  hideControlsLabel: ".hide-controls-label",
  fullscreenFormOption: ".form-option--fullscreen",
  fullscreen: ".fullscreen",
  fullscreenLabel: ".fullscreen-label",
  longExposure: ".long-exposure",
  longExposureLabel: ".long-exposure-label",
  helpModal: ".help-modal",
  helpModalOverlay: ".help-modal__overlay",
  helpModalHeader: ".help-modal__header",
  helpModalBody: ".help-modal__body",
  helpModalCloseBtn: ".help-modal__close-btn",
};

Object.keys(appNodes).forEach((key) => {
  appNodes[key] = document.querySelector(appNodes[key]);
});

if (!fullscreenEnabled()) {
  appNodes.fullscreenFormOption.classList.add("remove");
}

function renderApp(state) {
  const pauseBtnIcon = `#icon-${state.paused ? "play" : "pause"}`;
  const soundBtnIcon = `#icon-sound-${soundEnabledSelector() ? "on" : "off"}`;
  appNodes.pauseBtnSVG.setAttribute("href", pauseBtnIcon);
  appNodes.pauseBtnSVG.setAttribute("xlink:href", pauseBtnIcon);
  appNodes.soundBtnSVG.setAttribute("href", soundBtnIcon);
  appNodes.soundBtnSVG.setAttribute("xlink:href", soundBtnIcon);
  appNodes.controls.classList.toggle("hide", state.menuOpen || state.config.hideControls);
  appNodes.canvasContainer.classList.toggle("blur", state.menuOpen);
  appNodes.menu.classList.toggle("hide", !state.menuOpen);
  appNodes.finaleModeFormOption.style.opacity = state.config.autoLaunch ? 1 : 0.32;
  appNodes.quality.value = state.config.quality;
  appNodes.shellType.value = state.config.shell;
  appNodes.shellSize.value = state.config.size;
  appNodes.autoLaunch.checked = state.config.autoLaunch;
  appNodes.finaleMode.checked = state.config.finale;
  appNodes.skyLighting.value = state.config.skyLighting;
  appNodes.hideControls.checked = state.config.hideControls;
  appNodes.fullscreen.checked = state.fullscreen;
  appNodes.longExposure.checked = state.config.longExposure;
  appNodes.scaleFactor.value = state.config.scaleFactor.toFixed(2);
  appNodes.menuInnerWrap.style.opacity = state.openHelpTopic ? 0.12 : 1;
  appNodes.helpModal.classList.toggle("active", !!state.openHelpTopic);
  if (state.openHelpTopic) {
    const { header, body } = helpContent[state.openHelpTopic];
    appNodes.helpModalHeader.textContent = header;
    appNodes.helpModalBody.textContent = body;
  }
}
store.subscribe(renderApp);

function handleStateChange(state, prevState) {
  const canPlaySound = canPlaySoundSelector(state);
  const canPlaySoundPrev = canPlaySoundSelector(prevState);
  if (canPlaySound !== canPlaySoundPrev) {
    if (canPlaySound) soundManager.resumeAll();
    else soundManager.pauseAll();
  }
}
store.subscribe(handleStateChange);

function getConfigFromDOM() {
  return {
    quality: appNodes.quality.value,
    shell: appNodes.shellType.value,
    size: appNodes.shellSize.value,
    autoLaunch: appNodes.autoLaunch.checked,
    finale: appNodes.finaleMode.checked,
    skyLighting: appNodes.skyLighting.value,
    longExposure: appNodes.longExposure.checked,
    hideControls: appNodes.hideControls.checked,
    scaleFactor: parseFloat(appNodes.scaleFactor.value),
  };
}

const updateConfigNoEvent = () => updateConfig();
appNodes.quality.addEventListener("input", updateConfigNoEvent);
appNodes.shellType.addEventListener("input", updateConfigNoEvent);
appNodes.shellSize.addEventListener("input", updateConfigNoEvent);
appNodes.autoLaunch.addEventListener("click", () => setTimeout(updateConfig, 0));
appNodes.finaleMode.addEventListener("click", () => setTimeout(updateConfig, 0));
appNodes.skyLighting.addEventListener("input", updateConfigNoEvent);
appNodes.longExposure.addEventListener("click", () => setTimeout(updateConfig, 0));
appNodes.hideControls.addEventListener("click", () => setTimeout(updateConfig, 0));
appNodes.fullscreen.addEventListener("click", () => setTimeout(toggleFullscreen, 0));
appNodes.scaleFactor.addEventListener("input", () => { updateConfig(); handleResize(); });

Object.keys(nodeKeyToHelpKey).forEach((nodeKey) => {
  const helpKey = nodeKeyToHelpKey[nodeKey];
  appNodes[nodeKey].addEventListener("click", () => {
    store.setState({ openHelpTopic: helpKey });
  });
});
appNodes.helpModalCloseBtn.addEventListener("click", () => store.setState({ openHelpTopic: null }));
appNodes.helpModalOverlay.addEventListener("click", () => store.setState({ openHelpTopic: null }));

const COLOR_NAMES = Object.keys(COLOR);
const COLOR_CODES = COLOR_NAMES.map((colorName) => COLOR[colorName]);
const COLOR_CODES_W_INVIS = [...COLOR_CODES, INVISIBLE];
const COLOR_CODE_INDEXES = COLOR_CODES_W_INVIS.reduce((obj, code, i) => { obj[code] = i; return obj; }, {});
const COLOR_TUPLES = {};
COLOR_CODES.forEach((hex) => {
  COLOR_TUPLES[hex] = {
    r: parseInt(hex.substr(1, 2), 16),
    g: parseInt(hex.substr(3, 2), 16),
    b: parseInt(hex.substr(5, 2), 16),
  };
});

function randomColorSimple() {
  return COLOR_CODES[(Math.random() * COLOR_CODES.length) | 0];
}
let lastColor;
function randomColor(options = {}) {
  let color = randomColorSimple();
  if (options.limitWhite && color === COLOR.White && Math.random() < 0.6) {
    color = randomColorSimple();
  }
  if (options.notSame) {
    while (color === lastColor) color = randomColorSimple();
  } else if (options.notColor) {
    while (color === options.notColor) color = randomColorSimple();
  }
  lastColor = color;
  return color;
}
function whiteOrGold() {
  return Math.random() < 0.5 ? COLOR.Gold : COLOR.White;
}
function makePistilColor(shellColor) {
  return shellColor === COLOR.White || shellColor === COLOR.Gold
    ? randomColor({ notColor: shellColor })
    : whiteOrGold();
}

// ────────────────────────────────────────────────
// HEART SHELL DEFINITION
// ────────────────────────────────────────────────
const heartShell = (size = 1) => {
  const color = randomColor({ limitWhite: true });
  const secondColorChance = Math.random() < 0.4;
  const useSecondColor = secondColorChance ? randomColor({ notColor: color, limitWhite: true }) : null;
  return {
    shellSize: size,
    spreadSize: 260 + size * 90,
    starLife: 1100 + size * 220,
    starLifeVariation: 0.35,
    starDensity: 1.15,
    color,
    secondColor: useSecondColor,
    heart: true,
    pistil: Math.random() < 0.55,
    pistilColor: makePistilColor(color),
    glitter: Math.random() < 0.65 ? "light" : "",
    glitterColor: whiteOrGold(),
  };
};

// Other shell types (kept original)
const crysanthemumShell = (size = 1) => { /* ... giữ nguyên như code gốc ... */ };
const ghostShell = (size = 1) => { /* ... giữ nguyên ... */ };
const strobeShell = (size = 1) => { /* ... giữ nguyên ... */ };
const palmShell = (size = 1) => { /* ... giữ nguyên ... */ };
const ringShell = (size = 1) => { /* ... giữ nguyên ... */ };
const crossetteShell = (size = 1) => { /* ... giữ nguyên ... */ };
const floralShell = (size = 1) => { /* ... giữ nguyên ... */ };
const fallingLeavesShell = (size = 1) => { /* ... giữ nguyên ... */ };
const willowShell = (size = 1) => { /* ... giữ nguyên ... */ };
const crackleShell = (size = 1) => { /* ... giữ nguyên ... */ };
const horsetailShell = (size = 1) => { /* ... giữ nguyên ... */ };

function randomShellName() {
  return Math.random() < 0.5 ? "Crysanthemum" : shellNames[(Math.random() * (shellNames.length - 1) + 1) | 0];
}
function randomShell(size) {
  if (IS_HEADER) return randomFastShell()(size);
  return shellTypes[randomShellName()](size);
}
function shellFromConfig(size) {
  return shellTypes[shellNameSelector()](size);
}

const fastShellBlacklist = ["Falling Leaves", "Floral", "Willow"];
function randomFastShell() {
  const isRandom = shellNameSelector() === "Random";
  let shellName = isRandom ? randomShellName() : shellNameSelector();
  if (isRandom) {
    while (fastShellBlacklist.includes(shellName)) {
      shellName = randomShellName();
    }
  }
  return shellTypes[shellName];
}

const shellTypes = {
  Random: randomShell,
  Crackle: crackleShell,
  Crossette: crossetteShell,
  Crysanthemum: crysanthemumShell,
  "Falling Leaves": fallingLeavesShell,
  Floral: floralShell,
  Ghost: ghostShell,
  "Horse Tail": horsetailShell,
  Palm: palmShell,
  Ring: ringShell,
  Strobe: strobeShell,
  Willow: willowShell,
  Heart: heartShell,
};
const shellNames = Object.keys(shellTypes);

function init() {
  document.querySelector(".loading-init").remove();
  appNodes.stageContainer.classList.remove("remove");

  let options = "";
  shellNames.forEach((opt) => (options += `<option>${opt}</option>`));
  appNodes.shellType.innerHTML = options;

  options = "";
  ['3"', '4"', '6"', '8"', '12"', '16"'].forEach((opt, i) => (options += `<option value="${i+1}">${opt}</option>`));
  appNodes.shellSize.innerHTML = options;

  setOptionsForSelect(appNodes.quality, [
    { label: "Low", value: QUALITY_LOW },
    { label: "Normal", value: QUALITY_NORMAL },
    { label: "High", value: QUALITY_HIGH },
  ]);

  setOptionsForSelect(appNodes.skyLighting, [
    { label: "None", value: SKY_LIGHT_NONE },
    { label: "Dim", value: SKY_LIGHT_DIM },
    { label: "Normal", value: SKY_LIGHT_NORMAL },
  ]);

  setOptionsForSelect(
    appNodes.scaleFactor,
    [0.5, 0.62, 0.75, 0.9, 1.0, 1.5, 2.0].map((v) => ({ value: v.toFixed(2), label: `${v * 100}%` }))
  );

  togglePause(false);
  renderApp(store.state);
  configDidUpdate();
}

function fitShellPositionInBoundsH(position) {
  const edge = 0.18;
  return (1 - edge * 2) * position + edge;
}
function fitShellPositionInBoundsV(position) {
  return position * 0.75;
}
function getRandomShellPositionH() {
  return fitShellPositionInBoundsH(Math.random());
}
function getRandomShellPositionV() {
  return fitShellPositionInBoundsV(Math.random());
}
function getRandomShellSize() {
  const baseSize = shellSizeSelector();
  const maxVariance = Math.min(2.5, baseSize);
  const variance = Math.random() * maxVariance;
  const size = baseSize - variance;
  const height = maxVariance === 0 ? Math.random() : 1 - variance / maxVariance;
  const centerOffset = Math.random() * (1 - height * 0.65) * 0.5;
  const x = Math.random() < 0.5 ? 0.5 - centerOffset : 0.5 + centerOffset;
  return {
    size,
    x: fitShellPositionInBoundsH(x),
    height: fitShellPositionInBoundsV(height),
  };
}

function launchShellFromConfig(event) {
  const shell = new Shell(shellFromConfig(shellSizeSelector()));
  const w = mainStage.width;
  const h = mainStage.height;
  shell.launch(
    event ? event.x / w : getRandomShellPositionH(),
    event ? 1 - event.y / h : getRandomShellPositionV()
  );
}

// Sequences, update, render, etc. (giữ nguyên như code gốc của bạn)
// ... (phần còn lại: seqRandomShell, seqTwoRandom, startSequence, handlePointerStart, handleResize, updateGlobals, update, render, colorSky, createParticleArc, createBurst, crossetteEffect, floralEffect, etc.)

class Shell {
  constructor(options) {
    Object.assign(this, options);
    this.starLifeVariation = options.starLifeVariation || 0.125;
    this.color = options.color || randomColor();
    this.glitterColor = options.glitterColor || this.color;
    if (!this.starCount) {
      const density = options.starDensity || 1;
      const scaledSize = this.spreadSize / 54;
      this.starCount = Math.max(6, scaledSize * scaledSize * density);
    }
  }

  launch(position, launchHeight) {
    const width = stageW;
    const height = stageH;
    const hpad = 60;
    const vpad = 50;
    const minHeightPercent = 0.45;
    const minHeight = height - height * minHeightPercent;
    const launchX = position * (width - hpad * 2) + hpad;
    const launchY = height;
    const burstY = minHeight - launchHeight * (minHeight - vpad);
    const launchDistance = launchY - burstY;
    const launchVelocity = Math.pow(launchDistance * 0.04, 0.64);

    const comet = (this.comet = Star.add(
      launchX,
      launchY,
      typeof this.color === "string" && this.color !== "random" ? this.color : COLOR.White,
      Math.PI,
      launchVelocity * (this.horsetail ? 1.2 : 1),
      launchVelocity * (this.horsetail ? 100 : 400)
    ));

    comet.heavy = true;
    comet.spinRadius = MyMath.random(0.32, 0.85);
    comet.sparkFreq = 32 / quality;
    if (isHighQuality) comet.sparkFreq = 8;
    comet.sparkLife = 320;
    comet.sparkLifeVariation = 3;

    if (this.glitter === "willow" || this.fallingLeaves) {
      comet.sparkFreq = 20 / quality;
      comet.sparkSpeed = 0.5;
      comet.sparkLife = 500;
    }
    if (this.color === INVISIBLE) {
      comet.sparkColor = COLOR.Gold;
    }
    if (Math.random() > 0.4 && !this.horsetail) {
      comet.secondColor = INVISIBLE;
      comet.transitionTime = Math.pow(Math.random(), 1.5) * 700 + 500;
    }

    comet.onDeath = (comet) => this.burst(comet.x, comet.y);
    soundManager.playSound("lift");
  }

  burst(x, y) {
    const speed = this.spreadSize / 96;
    let color, onDeath, sparkFreq, sparkSpeed, sparkLife;
    let sparkLifeVariation = 0.25;
    let playedDeathSound = false;

    if (this.crossette) {
      onDeath = (star) => {
        if (!playedDeathSound) {
          soundManager.playSound("crackleSmall");
          playedDeathSound = true;
        }
        crossetteEffect(star);
      };
    }
    if (this.crackle) {
      onDeath = (star) => {
        if (!playedDeathSound) {
          soundManager.playSound("crackle");
          playedDeathSound = true;
        }
        crackleEffect(star);
      };
    }
    if (this.floral) onDeath = floralEffect;
    if (this.fallingLeaves) onDeath = fallingLeavesEffect;

    if (this.glitter === "light") {
      sparkFreq = 400; sparkSpeed = 0.3; sparkLife = 300; sparkLifeVariation = 2;
    } else if (this.glitter === "medium") {
      sparkFreq = 200; sparkSpeed = 0.44; sparkLife = 700; sparkLifeVariation = 2;
    } else if (this.glitter === "heavy") {
      sparkFreq = 80; sparkSpeed = 0.8; sparkLife = 1400; sparkLifeVariation = 2;
    } else if (this.glitter === "thick") {
      sparkFreq = 16; sparkSpeed = isHighQuality ? 1.65 : 1.5; sparkLife = 1400; sparkLifeVariation = 3;
    } else if (this.glitter === "streamer") {
      sparkFreq = 32; sparkSpeed = 1.05; sparkLife = 620; sparkLifeVariation = 2;
    } else if (this.glitter === "willow") {
      sparkFreq = 120; sparkSpeed = 0.34; sparkLife = 1400; sparkLifeVariation = 3.8;
    }

    sparkFreq = sparkFreq / quality;

    const starFactory = (angle, speedMult) => {
      const standardInitialSpeed = this.spreadSize / 1800;
      const star = Star.add(
        x, y,
        color || randomColor(),
        angle,
        speedMult * speed,
        this.starLife + Math.random() * this.starLife * this.starLifeVariation,
        this.horsetail ? (this.comet && this.comet.speedX) : 0,
        this.horsetail ? (this.comet && this.comet.speedY) : -standardInitialSpeed
      );

      if (this.secondColor) {
        star.transitionTime = this.starLife * (Math.random() * 0.05 + 0.32);
        star.secondColor = this.secondColor;
      }
      if (this.strobe) {
        star.transitionTime = this.starLife * (Math.random() * 0.08 + 0.46);
        star.strobe = true;
        star.strobeFreq = Math.random() * 20 + 40;
        if (this.strobeColor) star.secondColor = this.strobeColor;
      }
      star.onDeath = onDeath;

      if (this.glitter) {
        star.sparkFreq = sparkFreq;
        star.sparkSpeed = sparkSpeed;
        star.sparkLife = sparkLife;
        star.sparkLifeVariation = sparkLifeVariation;
        star.sparkColor = this.glitterColor;
        star.sparkTimer = Math.random() * star.sparkFreq;
      }
    };

    // ──── HEART ──── (đã sửa hướng lên trên)
    if (this.heart) {
      const heartPoints = 72;
      const heartScale = this.spreadSize * 0.52;

      for (let i = 0; i < heartPoints; i++) {
        const t = (i / heartPoints) * PI_2 - Math.PI / 2; // pha -90° để hướng lên

        const tx = 16 * Math.pow(Math.sin(t), 3);
        const ty = -(
          13 * Math.cos(t)
          - 5 * Math.cos(2 * t)
          - 2 * Math.cos(3 * t)
          - Math.cos(4 * t)
        );

        const angle = Math.atan2(ty, tx);
        const dist = Math.hypot(tx, ty) / 16;

        const speedMult = dist * 1.42; // điều chỉnh độ phồng

        starFactory(angle, speedMult);
      }

      if (Math.random() < 0.62) {
        createBurst(Math.round(this.starCount * 0.26), starFactory);
      }
    }
    // ────────────────────────────────────────────────

    else if (this.ring) {
      // phần ring giữ nguyên như cũ...
      // (bạn copy phần ring từ code gốc vào đây)
    } else if (typeof this.color === "string") {
      if (this.color === "random") color = null;
      else color = this.color;
      createBurst(this.starCount, starFactory);
    } else if (Array.isArray(this.color)) {
      // phần xử lý mảng màu giữ nguyên...
    } else {
      throw new Error("Invalid shell color...");
    }

    if (this.pistil) {
      const innerShell = new Shell({
        spreadSize: this.spreadSize * 0.5,
        starLife: this.starLife * 0.6,
        starLifeVariation: this.starLifeVariation,
        starDensity: 1.4,
        color: this.pistilColor,
        glitter: "light",
        glitterColor: this.pistilColor === COLOR.Gold ? COLOR.Gold : COLOR.White,
      });
      innerShell.burst(x, y);
    }

    if (this.streamers) {
      const innerShell = new Shell({
        spreadSize: this.spreadSize * 0.9,
        starLife: this.starLife * 0.8,
        starLifeVariation: this.starLifeVariation,
        starCount: Math.floor(Math.max(6, this.spreadSize / 45)),
        color: COLOR.White,
        glitter: "streamer",
      });
      innerShell.burst(x, y);
    }

    BurstFlash.add(x, y, this.spreadSize / 4);

    if (this.comet) {
      const maxDiff = 2;
      const sizeDifferenceFromMaxSize = Math.min(maxDiff, shellSizeSelector() - this.shellSize);
      const soundScale = (1 - sizeDifferenceFromMaxSize / maxDiff) * 0.3 + 0.7;
      soundManager.playSound("burst", soundScale);
    }
  }
}

// Phần còn lại của code (BurstFlash, Star, Spark, soundManager, setLoadingStatus, preload, etc.)
// Bạn cần copy nguyên các phần này từ file gốc của bạn vào đây, vì chúng không thay đổi

// Cuối cùng:
if (IS_HEADER) {
  init();
} else {
  setLoadingStatus("Lighting Fuses");
  setTimeout(() => {
    soundManager.preload().then(init, () => {
      init(); // fallback nếu audio lỗi
    });
  }, 0);
}
