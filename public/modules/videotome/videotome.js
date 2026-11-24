"use strict";

document.addEventListener("DOMContentLoaded", setup_videotome);

const VIDEOTOME = {
  data: {},
  lines: [],
  styling: { attributes: [], classes: [] },
};

const COMMANDS = new Map();

function SET_COMMAND(id, stall, action) {
  COMMANDS.set(id, (args) => { action(args); return stall });
}

SET_COMMAND("wait", true, () => {});
SET_COMMAND("stop", true, () => CUT_PASSAGE());
SET_COMMAND("sound", false, (id) => PLAY_SOUND(id));
SET_COMMAND("music", false, (id) => PLAY_MUSIC(id));
SET_COMMAND("jump", false, (id) => JUMP(id));
SET_COMMAND("clear", false, () => VIDEOTOME.container.replaceChildren());
SET_COMMAND("background", false, (id) => SET_BACKGROUND(id));

let AUTO;
function AUTO_ON(interval=500) {
  AUTO_OFF();
  AUTO = setInterval(ADVANCE, interval);
  ADVANCE();
}

function AUTO_OFF() {
  if (!AUTO) return;

  clearInterval(AUTO);
  AUTO = undefined;
}

function CUT_PASSAGE() {
  VIDEOTOME.lines = [];
}

function RUN_PASSAGE(passage) {
  if (!PASSAGES.has(passage)) {
    JUMP(passage);
    return;
  }

  VIDEOTOME.lines = [...PASSAGES.get(passage)];
}

function SET_BACKGROUND(id) {
  ENGINE.view.style.backgroundImage = `url(${IMAGES.get(id) ?? ""})`;
}

function PUSH_TEXT(text, styling={ attributes: [], classes: [] }) {
    const attrs_ = Object.fromEntries(styling.attributes.map((name) => [name, ""]));
    const element = html("span", { ...attrs_, class: ["text", ...styling.classes].join(" ") });
    element.innerHTML = text;
    PUSH_ELEMENT(element);
}

function PUSH_CHOICE(choices, styles=[]) {
  function make_button({ text, label }) {
    const button = html("button", {}, text);
    // hack...
    button.addEventListener("pointerdown", function(event) { button.setPointerCapture(event.pointerId); });
    button.addEventListener("click", () => { JUMP(label); ADVANCE(); } );
    button.addEventListener("click", suppress);
    return button;
  }

  const buttons = choices.map(make_button);
  const element = html("form", { class: ["choice", ...styles].join(" ") }, ...buttons);
  PUSH_ELEMENT(element);
}

const _PADDING = [html("div"), html("div"), html("div")];

function PUSH_ELEMENT(element) {
  VIDEOTOME.container.append(element);
  VIDEOTOME.container.replaceChildren(...[..._PADDING, ...VIDEOTOME.container.children].slice(-3));
}

async function ADVANCE() {
  let line;
  do line = VIDEOTOME.lines.shift();
  while (line && !await RUN_LINE(line))
}

async function JUMP(label) {
  for (const passage of PASSAGES.values()) {
    const index = passage.findIndex(line => line.label == label);
    if (index < 0) continue;
    VIDEOTOME.lines = [...passage.slice(index+1)];
    return;
  }
}

async function RUN_LINE(line) {
  if (line.choice) {
    await PUSH_CHOICE(line.choice);
    return true;
  }
  if (line.script)
    return await async_eval(line.script);
  if (line.command)
    return COMMANDS.get(line.command.toLowerCase())(line.input);
  if (line.style && line.style.length > 0) {
    VIDEOTOME.styling = { attributes: [], classes: [] }
    for (const style of line.style)
      if (style.cls)
        VIDEOTOME.styling.classes.push(style.cls);
      else if (style.attr)
        VIDEOTOME.styling.attributes.push(style.attr);
  }
  if (line.text || line.escape) {
    await PUSH_TEXT(line.text, VIDEOTOME.styling);
    return true;
  }

  return false;
}

const PASSAGES = new Map();

const ADVANCE_KEYS = new Set(["ArrowRight", " ", "Enter"]);

async function setup_videotome() {
  // find passages
  for (const element of document.querySelectorAll(`[type="text/videotome"]`))
    PASSAGES.set(element.id, PARSEDS.get(element.id));

  // setup
  const auto = new HoldableButton();
  auto.addEventListener("pressed", () => AUTO_ON());
  auto.addEventListener("released", () => AUTO_OFF());
  
  const autoButton = html("button", {}, html("img", { src: "assets/chevron-double-down.svg" }));
  VIDEOTOME.container = html("section", { id: "container" });
  VIDEOTOME.controls = html("section", { id: "controls" }, autoButton);
  
  ENGINE.view.append(VIDEOTOME.container);
  ENGINE.full.append(VIDEOTOME.controls);

  // click to advance
  auto.bindElement(autoButton);
  auto.bindElement(VIDEOTOME.container);

  for (const key of ADVANCE_KEYS)
    auto.bindKey(key);

  RUN_PASSAGE("passages/main");

  ENGINE.loadingDialog.addEventListener("close", () => ADVANCE());
}
