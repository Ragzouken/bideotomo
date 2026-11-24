"use strict";

document.addEventListener("DOMContentLoaded", setup_videotome);

const VIDEOTOME = {
  data: {},
  lines: [],
  styling: { attributes: [], classes: [] },
  empty: [html("div"), html("div"), html("div")],
};

const COMMANDS = new Map();

function SET_COMMAND(id, stall, action) {
  COMMANDS.set(id, (args) => { action(args); return stall });
}

SET_COMMAND("wait", true, () => {});
SET_COMMAND("stop", true, () => VIDEOTOME.lines = []);
SET_COMMAND("sound", false, (id) => PLAY_SOUND(id));
SET_COMMAND("music", false, (id) => PLAY_MUSIC(id));
SET_COMMAND("jump", false, (id) => JUMP(id));
SET_COMMAND("clear", false, () => CLEAR());
SET_COMMAND("background", false, (id) => SET_BACKGROUND(id));

let AUTO;
function AUTO_ON(interval=500) {
  AUTO_OFF();
  AUTO = setInterval(ADVANCE, interval);
  ADVANCE();
}

function AUTO_OFF() {
  clearInterval(AUTO);
  AUTO = undefined;
}

function RUN_PASSAGE(passage) {
  if (!VIDEOTOME.passages.has(passage)) {
    JUMP(passage);
    return;
  }

  VIDEOTOME.lines = [...VIDEOTOME.passages.get(passage)];
}

function SET_BACKGROUND(id) {
  ENGINE.view.style.backgroundImage = `url(${IMAGES.get(id) ?? ""})`;
}

function make_clickable(element) {
  element.addEventListener("pointerdown", capture);
}

function PUSH_TEXT(text, styling={ attributes: [], classes: [] }) {
  const attrs_ = Object.fromEntries(styling.attributes.map((name) => [name, ""]));
  const element = html("span", { ...attrs_, class: ["text", ...styling.classes].join(" ") });
  element.innerHTML = text;

  for (const link of element.querySelectorAll("a")) {
    // open in new tab
    link.target = "_blank";
    // don't bubble on to click screen and advance
    link.addEventListener("pointerdown", capture);
  }

  PUSH_ELEMENT(element);
}

function PUSH_CHOICE(choices, styles=[]) {
  function make_button({ text, label }) {
    const button = html("button", {}, text);
    // hack...
    // make_clickable(button);
    button.addEventListener("click", () => { JUMP(label); ADVANCE(); } );
    button.addEventListener("click", suppress);
    return button;
  }

  const buttons = choices.map(make_button);
  const element = html("form", { class: ["choice", ...styles].join(" ") }, ...buttons);
  PUSH_ELEMENT(element);
}

function PUSH_ELEMENT(element) {
  VIDEOTOME.container.append(element);
  VIDEOTOME.container.firstChild.remove();
}

function CLEAR() {
  VIDEOTOME.container.replaceChildren(...VIDEOTOME.empty)
}

async function ADVANCE() {
  // run lines until returns true
  let line;
  do line = VIDEOTOME.lines.shift();
  while (line && !await RUN_LINE(line))
}

async function JUMP(label) {
  for (const passage of VIDEOTOME.passages.values()) {
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
  if (line.text != null || line.escape) {
    await PUSH_TEXT(line.text, VIDEOTOME.styling);
    return true;
  }

  return false;
}

VIDEOTOME.passages = new Map();

const ADVANCE_KEYS = new Set(["ArrowRight", " ", "Enter"]);

async function setup_videotome() {
  // find passages
  for (const element of document.querySelectorAll(`[type="text/videotome"]`))
    VIDEOTOME.passages.set(element.id, PARSEDS.get(element.id));

  // setup html and controls
  const autoButton = html("button", {}, html("img", { src: "assets/chevron-double-down.svg" }));
  VIDEOTOME.container = html("section", { id: "container" }, ...VIDEOTOME.empty);
  VIDEOTOME.controls = html("section", { id: "controls" }, autoButton);
  
  ENGINE.view.append(VIDEOTOME.container);
  ENGINE.full.append(VIDEOTOME.controls);

  // click/hold to advance
  const auto = new HoldableButton();
  auto.addEventListener("pressed", () => AUTO_ON());
  auto.addEventListener("released", () => AUTO_OFF());
  
  auto.bindElement(autoButton);
  auto.bindElement(VIDEOTOME.container);

  for (const key of ADVANCE_KEYS)
    auto.bindKey(key);

  // run starting passage
  RUN_PASSAGE("passages/main");

  // advance immediately on enter
  ENGINE.loadingDialog.addEventListener("close", () => ADVANCE());
}
