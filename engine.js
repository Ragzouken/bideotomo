let ENGINE = {};

ENGINE.loadingDialog = document.getElementById("loading");
ENGINE.scroller = document.createElement("div");

const PARSERS = new Map();
const PARSEDS = new Map();

const IMAGES = new Map();
const AUDIOS = new Map();
const EVENTS = new Map();

const MUSIC = html("audio", { loop: "true" });

function PLAY_MUSIC(id) {
  MUSIC.pause();
  MUSIC.src = AUDIOS.get(id);
  MUSIC.play();
}

function PLAY_SOUND(id) {
  html("audio", { src: AUDIOS.get(id) }).play();
}

async function setup_engine() {
  ENGINE.scroller = html("section", { class: "scroller" });
  ENGINE.container = html("section", { class: "container" }, ENGINE.scroller);
  ENGINE.controls = html("section", { class: "controls" })
  ENGINE.viewport = html("div", { id: "viewport" }, ENGINE.container, ENGINE.controls);
  document.body.append(ENGINE.viewport);

  repeat(() => scaleElementToParent(ENGINE.viewport));

  load_grammars();
  use_grammars();
}

function make_element_parser(source, filename="anonymous") {
  try {
    const parser = peggy.generate(source, { grammarSource: filename });
    return (element) => {
      try {
        return parser.parse(element.textContent, { grammarSource: element.id });
      } catch (e) {
        if (typeof e.format === "function") {
          console.log(e.format([{ source: element.id, text: element.textContent }]));
        } else {
          throw e;
        }
      }
    }
  } catch (e) {
    if (typeof e.format === "function") {
      console.log(e.format([{ source: filename, text: source }]));
    } else {
      throw e;
    }
  }
}

function load_grammars() {
  for (const grammar of document.querySelectorAll(`script[type="text/pegjs"]`))
    PARSERS.set(grammar.id, make_element_parser(grammar.textContent, grammar.id));
}

function use_grammars() {
  for (const source of document.querySelectorAll(`script[grammar]`)) {
    const grammar = source.getAttribute("grammar");
    const parser = PARSERS.get(grammar);
    if (parser)
      PARSEDS.set(source.id, parser(source));
  }
}

async function do_loading() {
  const loads = [
    ...[...IMAGES.values()].map(src => loadImage(src)),
    ...[...AUDIOS.values()].map(src => loadAudio(src)),
  ];

  let done = 0;
  function complete() {
    done += 1;
    ENGINE.loadingDialog.replaceChildren(html("h1", {}, `LOADING (${done}/${loads.length})`));
  }

  try {
    await Promise.all(loads.map(load => load.then(complete).catch(console.log)));
  } catch (resource) {
    ENGINE.loadingDialog.replaceChildren(resource.error.message);
    console.log(resource.error.message);
    return;
  }

  ENGINE.loadingDialog.removeAttribute("loading");
  ENGINE.loadingDialog.replaceChildren(html("h1", {}, "tap or click to play"));
  ENGINE.loadingDialog.addEventListener("click", () => ENGINE.loadingDialog.close(), { once: true });
}

/**
 * Call the given function every animation frame.
 * @param {() => {}} callback 
 */
function repeat(callback) {
  callback();
  requestAnimationFrame(() => repeat(callback));
}

/**
 * Create an html element with the given attributes and children.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tagName 
 * @param {*} attributes 
 * @param  {...(Node | string)} children 
 * @returns {HTMLElementTagNameMap[K]}
 */
function html(tagName, attributes = {}, ...children) {
  const element = /** @type {HTMLElementTagNameMap[K]} */ (document.createElement(tagName)); 
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  children.forEach((child) => element.append(child));
  return element;
}

/**
 * @param {HTMLElement} element
 */
function scaleElementToParent(element) {
  const parent = element.parentElement;

  const [tw, th] = [parent.clientWidth, parent.clientHeight];
  const [sw, sh] = [tw / element.clientWidth, th / element.clientHeight];
  let scale = Math.min(sw, sh);

  if (element.dataset.scale !== scale.toString()) {
      element.dataset.scale = scale.toString();
      element.style.setProperty("scale", `${scale}`);
  }

  return scale;
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
async function loadImage(src) {
  return new Promise((resolve, reject) => {
      const image = document.createElement("img");
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", reject);
      image.src = src;
  });
}

const loadAudio = (src) => loadMediaElement(html("audio", { src }));
const loadVideo = (src) => loadMediaElement(html("video", { src }));

/**
 * @template {HTMLMediaElement} T 
 * @param {T} element
 * @returns {Promise<T>}
 */
async function loadMediaElement(element) {
  return new Promise((resolve, reject) => {
      let interval;
      
      function reset() {
          clearInterval(interval);
          interval = setInterval(() => resolve(element), 5000);
      }

      element.addEventListener("loadstart", reset);
      element.addEventListener("progress", reset);
      element.addEventListener("canplaythrough", () => resolve(element));
      element.addEventListener("error", () => reject(element));
      element.preload = "auto";
      element.load();
  });
}

class HoldableButton extends EventTarget {
  /** @param {HTMLElement} element */
  constructor(element) {
    super();
    this.element = element;
    this.holds = new Set();

    // pointer capture listens to cursor even when it leaves the element
    element.addEventListener("pointerdown", this.onPointerDown.bind(this));
    element.addEventListener("lostpointercapture", this.onLostPointerCapture.bind(this));
      
    // suppress mobile longpress (and haptic vibrate)
    element.addEventListener("touchstart", suppress);
    element.addEventListener("dragstart", suppress);
  }

  get isHeld() {
    return this.holds.size > 0;
  }

  bindKey(key) {
    document.addEventListener("keydown", (event) => {
      if (event.key != key)
        return;
      event.preventDefault();
      this.press(key);
    });

    document.addEventListener("keyup", (event) => {
      if (event.key != key)
        return;
      event.preventDefault();
      this.release(key);
    });
  }

  becomePressed() {
    this.element.classList.toggle("button-held", true);
    const event = new CustomEvent("pressed", { detail: { button: this } });
    this.dispatchEvent(event);
  }

  becomeReleased() {
    this.element.classList.toggle("button-held", false);
    const event = new CustomEvent("released", { detail: { button: this } });
    this.dispatchEvent(event);
  }

  press(id) {
    this.holds.add(id);
    if (this.holds.size == 1)
      this.becomePressed();
  }

  release(id) {
    this.holds.delete(id);
    if (this.holds.size == 0)
      this.becomeReleased();
  }
  
  onPointerDown(event) {
    this.element.setPointerCapture(event.pointerId);
    this.press(event.pointerId);
  }

  onLostPointerCapture(event) {
    this.release(event.pointerId);
  }
}

function suppress(event) {
  event.preventDefault();
  event.stopPropagation();
}


