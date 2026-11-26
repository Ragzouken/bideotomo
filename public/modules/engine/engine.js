"use strict";

document.addEventListener("DOMContentLoaded", setup_engine);
document.addEventListener("DOMContentLoaded", do_loading);

const PARSERS = new Map();
const PARSEDS = new Map();

const IMAGES = new Map();
const AUDIOS = new Map();
const EVENTS = new Map();

function RUN_EVENT(id) {
  return EVENTS.get(id)();
}

function PLAY_MUSIC(id) {
  ENGINE.musicElement.pause();
  ENGINE.musicElement.src = AUDIOS.get(id);
  ENGINE.musicElement.play();
}

function PLAY_SOUND(id) {
  html("audio", { src: AUDIOS.get(id) }).play();
}

let ENGINE = {};

async function setup_engine() {
  ENGINE.loadingDialog = document.getElementById("loading");
  ENGINE.musicElement = html("audio", { loop: "true" });

  ENGINE.view = html("div", { id: "viewport" });
  ENGINE.full = document.body;

  document.body.append(ENGINE.view);
  repeat(() => scaleElementToParent(ENGINE.view));

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

function add_grammar(id, source) {
  PARSERS.set(id, make_element_parser(source, id));
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
  for (const bundle of document.querySelectorAll("[assets]")) {
    for (const element of bundle.content.querySelectorAll("audio"))
      AUDIOS.set(element.id, element.src)
    for (const element of bundle.content.querySelectorAll("img"))
      IMAGES.set(element.id, element.src)
  }

  const loads = [
    ...[...IMAGES.values()].map(src => loadImage(src)),
    ...[...AUDIOS.values()].map(src => loadAudio(src)),
  ];

  let done = 0;
  function complete() {
    done += 1;
    ENGINE.loadingDialog.replaceChildren(`LOADING (${done}/${loads.length})`);
  }

  try {
    await Promise.all(loads.map(load => load.then(complete).catch(console.log)));
  } catch (resource) {
    ENGINE.loadingDialog.replaceChildren(resource.error.message);
    console.log(resource.error.message);
    return;
  }

  ENGINE.loadingDialog.removeAttribute("loading");
  ENGINE.loadingDialog.replaceChildren("tap or click to play");

  // wait for input and close loading dialogue
  const closed = new AbortController();
  const signal = closed.signal;

  function onFirstInput(event) {
    event.preventDefault();
    event.stopPropagation();
    ENGINE.loadingDialog.close();
  }

  window.addEventListener("click", onFirstInput, { signal, capture: true });
  window.addEventListener("keydown", onFirstInput, { signal, capture: true });
  ENGINE.loadingDialog.addEventListener("close", () => closed.abort());
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

/**
 * @template {keyof HTMLElementEventMap} K
 * @param {HTMLElement} element 
 * @param {K} type 
 * @param {(event: HTMLElementEventMap[K]) => any} listener 
 * @param {AddEventListenerOptions} options?
 */
function listen_event_exact(element, type, listener, options) {
  element.addEventListener(type, (event) => {
    if (event.target === element) listener.call(element, event)
  }, options);
}

class HoldableButton extends EventTarget {
  constructor() {
    super();
    this.holds = new Set();
  }

  get isHeld() {
    return this.holds.size > 0;
  }

  /**
   * @param {HTMLElement} element 
   */
  bindElement(element) {
    // pointer capture listens to cursor even when it leaves the element
    listen_event_exact(element, "pointerdown", (event) => {
      element.setPointerCapture(event.pointerId);
      this.press(event.pointerId);
    });
    listen_event_exact(element, "lostpointercapture", (event) => {
      this.release(event.pointerId);
    });
      
    // suppress mobile longpress (and haptic vibrate)
    listen_event_exact(element, "touchstart", suppress);
    listen_event_exact(element, "dragstart", suppress);

    this.addEventListener("pressed", () => element.classList.toggle("button-held", true));
    this.addEventListener("released", () => element.classList.toggle("button-held", false));
  }

  bindKey(key) {
    document.addEventListener("keydown", (event) => {
      if (event.key != key || event.repeat)
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
    const event = new CustomEvent("pressed", { detail: { button: this } });
    this.dispatchEvent(event);
  }

  becomeReleased() {
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
}

function suppress(event) {
  event.preventDefault();
  event.stopPropagation();
}

function capture(event) {
  event.stopImmediatePropagation();
}

const _AsyncFunction = Object.getPrototypeOf(async function(){}).constructor

function async_eval(code) {
  const script = _AsyncFunction(code)
  return script.call();
}
