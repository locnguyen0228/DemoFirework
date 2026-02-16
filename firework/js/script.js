"use strict";
console.clear();

const IS_MOBILE = window.innerWidth <= 640;
const IS_DESKTOP = window.innerWidth > 800;
const IS_HEADER = IS_DESKTOP && window.innerHeight < 300;

const IS_HIGH_END_DEVICE = (() => {
  const hwConcurrency = navigator.hardwareConcurrency;
  if (!hwConcurrency) return false;
  const minCount = window.innerWidth <= 1024 ? 4 : 8;
  return hwConcurrency >= minCount;
})();

const MAX_WIDTH = 7680;
const MAX_HEIGHT = 4320;
const GRAVITY = 0.9;
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

if (!IS_HEADER) store.load();

function togglePause(toggle) {
  const paused = store.state.paused;
  let newValue = typeof toggle === "boolean" ? toggle : !paused;
  if (paused !== newValue) store.setState({ paused: newValue });
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
  shellType: { header: "Shell Type", body: 'Select "Random" for variety!' },
  shellSize: { header: "Shell Size", body: "Larger = bigger burst, more stars, more CPU usage." },
  quality: { header: "Quality", body: "Lower if lagging." },
  skyLighting: { header: "Sky Lighting", body: 'Dim or None if too bright.' },
  scaleFactor: { header: "Scale", body: "Zoom in/out effect." },
  autoLaunch: { header: "Auto Fire", body: "Automatic sequences." },
  finaleMode: { header: "Finale Mode", body: "Intense bursts (needs Auto Fire)." },
  hideControls: { header: "Hide Controls", body: "Cleaner view." },
  fullscreen: { header: "Fullscreen", body: "Toggle fullscreen." },
  longExposure: { header: "Open Shutter", body: "Long trails effect." },
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
  stageContainer: document.querySelector(".stage-container"),
  canvasContainer: document.querySelector(".canvas-container"),
  controls: document.querySelector(".controls"),
  menu: document.querySelector(".menu"),
  menuInnerWrap: document.querySelector(".menu__inner-wrap"),
  pauseBtn: document.querySelector(".pause-btn"),
  pauseBtnSVG: document.querySelector(".pause-btn use"),
  soundBtn: document.querySelector(".sound-btn"),
  soundBtnSVG: document.querySelector(".sound-btn use"),
  shellType: document.querySelector(".shell-type"),
  shellSize: document.querySelector(".shell-size"),
  quality: document.querySelector(".quality-ui"),
  skyLighting: document.querySelector(".sky-lighting"),
  scaleFactor: document.querySelector(".scaleFactor"),
  autoLaunch: document.querySelector(".auto-launch"),
  finaleMode: document.querySelector(".finale-mode"),
  hideControls: document.querySelector(".hide-controls"),
  fullscreen: document.querySelector(".fullscreen"),
  longExposure: document.querySelector(".long-exposure"),
  helpModal: document.querySelector(".help-modal"),
  helpModalOverlay: document.querySelector(".help-modal__overlay"),
  helpModalHeader: document.querySelector(".help-modal__header"),
  helpModalBody: document.querySelector(".help-modal__body"),
  helpModalCloseBtn: document.querySelector(".help-modal__close-btn"),
};

if (!fullscreenEnabled()) {
  appNodes.fullscreenFormOption?.classList.add("remove");
}

function renderApp(state) {
  appNodes.pauseBtnSVG.setAttribute("href", `#icon-${state.paused ? "play" : "pause"}`);
  appNodes.pauseBtnSVG.setAttribute("xlink:href", `#icon-${state.paused ? "play" : "pause"}`);
  appNodes.soundBtnSVG.setAttribute("href", `#icon-sound-${soundEnabledSelector() ? "on" : "off"}`);
  appNodes.soundBtnSVG.setAttribute("xlink:href", `#icon-sound-${soundEnabledSelector() ? "on" : "off"}`);

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

store.subscribe((state, prevState) => {
  if (canPlaySoundSelector(state) !== canPlaySoundSelector(prevState)) {
    if (canPlaySoundSelector(state)) soundManager.resumeAll();
    else soundManager.pauseAll();
  }
});

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

function updateConfigNoEvent() { updateConfig(); }

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

Object.keys(nodeKeyToHelpKey).forEach(key => {
  appNodes[key]?.addEventListener("click", () => {
    store.setState({ openHelpTopic: nodeKeyToHelpKey[key] });
  });
});

appNodes.helpModalCloseBtn?.addEventListener("click", () => store.setState({ openHelpTopic: null }));
appNodes.helpModalOverlay?.addEventListener("click", () => store.setState({ openHelpTopic: null }));

const COLOR_NAMES = Object.keys(COLOR);
const COLOR_CODES = COLOR_NAMES.map(n => COLOR[n]);
const COLOR_CODES_W_INVIS = [...COLOR_CODES, INVISIBLE];
const COLOR_TUPLES = {};
COLOR_CODES.forEach(hex => {
  COLOR_TUPLES[hex] = {
    r: parseInt(hex.slice(1,3),16),
    g: parseInt(hex.slice(3,5),16),
    b: parseInt(hex.slice(5,7),16),
  };
});

function randomColorSimple() {
  return COLOR_CODES[Math.random() * COLOR_CODES.length | 0];
}

let lastColor;
function randomColor(opts = {}) {
  let c = randomColorSimple();
  if (opts.limitWhite && c === COLOR.White && Math.random() < 0.6) c = randomColorSimple();
  if (opts.notSame) while (c === lastColor) c = randomColorSimple();
  if (opts.notColor) while (c === opts.notColor) c = randomColorSimple();
  lastColor = c;
  return c;
}

function whiteOrGold() {
  return Math.random() < 0.5 ? COLOR.Gold : COLOR.White;
}

function makePistilColor(shellColor) {
  return (shellColor === COLOR.White || shellColor === COLOR.Gold)
    ? randomColor({ notColor: shellColor })
    : whiteOrGold();
}

// ────────────────────────────────
// HEART SHELL - ĐÃ SỬA HƯỚNG LÊN TRÊN
// ────────────────────────────────
const heartShell = (size = 1) => {
  const color = randomColor({ limitWhite: true });
  const useSecond = Math.random() < 0.4;
  return {
    shellSize: size,
    spreadSize: 260 + size * 90,
    starLife: 1100 + size * 220,
    starLifeVariation: 0.35,
    starDensity: 1.15,
    color,
    secondColor: useSecond ? randomColor({ notColor: color, limitWhite: true }) : null,
    heart: true,
    pistil: Math.random() < 0.55,
    pistilColor: makePistilColor(color),
    glitter: Math.random() < 0.65 ? "light" : "",
    glitterColor: whiteOrGold(),
  };
};

// Các loại shell khác (bạn có thể giữ nguyên hoặc copy từ file cũ)
const crysanthemumShell = (size = 1) => ({
  shellSize: size,
  spreadSize: 300 + size * 100,
  starLife: 900 + size * 200,
  starDensity: 1.25,
  color: randomColor(),
  glitter: Math.random() < 0.25 ? "light" : "",
  glitterColor: whiteOrGold(),
});

const ringShell = (size = 1) => ({
  shellSize: size,
  ring: true,
  color: randomColor(),
  spreadSize: 300 + size * 100,
  starLife: 900 + size * 200,
  starCount: 2.2 * PI_2 * (size + 1),
  pistil: Math.random() < 0.75,
  pistilColor: makePistilColor(randomColor()),
  glitter: "light",
  glitterColor: COLOR.White,
});

const shellTypes = {
  Random: size => shellTypes[Object.keys(shellTypes)[Math.random() * (Object.keys(shellTypes).length - 1) | 0]](size),
  Heart: heartShell,
  Crysanthemum: crysanthemumShell,
  Ring: ringShell,
  // thêm các loại khác nếu bạn có...
};

const shellNames = Object.keys(shellTypes);

function init() {
  document.querySelector(".loading-init")?.remove();
  appNodes.stageContainer?.classList.remove("remove");

  let opts = "";
  shellNames.forEach(s => opts += `<option>${s}</option>`);
  appNodes.shellType.innerHTML = opts;

  opts = ['3"','4"','6"','8"','12"','16"'].map((t,i) => `<option value="${i+1}">${t}</option>`).join("");
  appNodes.shellSize.innerHTML = opts;

  togglePause(false);
  renderApp(store.state);
  configDidUpdate();
  handleResize();
}

// ────────────────────────────────────────────────
// PHẦN CÒN LẠI (bạn cần giữ nguyên hoặc bổ sung từ file gốc)
// ────────────────────────────────────────────────
// handleResize, launchShellFromConfig, sequences, update, render, Shell class, Star, Spark, soundManager, v.v.

function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cw = Math.min(w, MAX_WIDTH);
  const ch = w <= 420 ? h : Math.min(h, MAX_HEIGHT);

  appNodes.stageContainer.style.width = cw + "px";
  appNodes.stageContainer.style.height = ch + "px";

  stages.forEach(s => s.resize(cw, ch));

  const sf = scaleFactorSelector();
  stageW = cw / sf;
  stageH = ch / sf;
}

window.addEventListener("resize", handleResize);

// ... (phần còn lại: class Shell với burst đã sửa, Star, Spark, soundManager, preload, v.v.)

// Cuối file
if (IS_HEADER) {
  init();
} else {
  // Giả sử bạn có soundManager.preload() từ code gốc
  setTimeout(() => {
    // soundManager.preload().then(init, init);  // nếu có audio
    init();
  }, 300);
}
