"use strict";

const VIDEOTOME = {
  data: {},
  lines: [],
};

const COMMANDS = new Map();

function SET_COMMAND(id, stall, action) {
  COMMANDS.set(id, (args) => { action(args); return stall });
}

SET_COMMAND("stall", true, () => {});
SET_COMMAND("stop", true, () => CUT_PASSAGE());

SET_COMMAND("sound", false, (id) => PLAY_SOUND(id));
SET_COMMAND("music", false, (id) => PLAY_MUSIC(id));
SET_COMMAND("jump", false, (id) => JUMP(id));
SET_COMMAND("clear", false, () => VIDEOTOME.container.replaceChildren());
SET_COMMAND("background", false, (id) => VIDEOTOME.container.style.backgroundImage = `url(${IMAGES.get(id)})`);

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

function PUSH_TEXT(text, styles=[], attrs=[]) {
    const attrs_ = Object.fromEntries(attrs.map((name) => [name, ""]));
    const element = html("span", { ...attrs_, class: ["text", ...styles].join(" ") });
    element.innerHTML = text;
    PUSH_ELEMENT(element);
}

function PUSH_CHOICE(choices, styles=[]) {
  function make_button({ text, label }) {
    const button = html("button", {}, text);
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
  const styles = [];
  const attrs = [];

  if (line.choice) {
    await PUSH_CHOICE(line.choice);
    return true;
  }
  if (line.script)
    return await async_eval(line.script);
  if (line.command)
    return COMMANDS.get(line.command.toLowerCase())(line.input);
  if (line.style)
    for (const style of line.style)
      if (style.cls)
        styles.push(style.cls);
      else if (style.attr)
        attrs.push(style.attr);
  if (line.text || line.escape) {
    await PUSH_TEXT(line.text, styles, attrs);
    return true;
  }

  return false;
}

const PASSAGES = new Map();

async function setup_videotome() {
  // find passages
  for (const element of document.querySelectorAll(`[type="text/videotome"]`))
    PASSAGES.set(element.id, PARSEDS.get(element.id));

  for (const id of PASSAGES.keys())
    EVENTS.set(id, RUN_PASSAGE(id));

  // find resources to preload
  const tags = [...new Set(
    [...PASSAGES.values()]
    .flatMap(passage => passage)
    .flatMap(line => line.input ?? [])
  )];

  // setup
  VIDEOTOME.container = html("section", { class: "container" });
  VIDEOTOME.controls = html("section", { class: "controls" });
  ENGINE.viewport.append(VIDEOTOME.container, VIDEOTOME.controls);

  tags
  .filter(tag => tag.startsWith("BG_"))
  .forEach(name => IMAGES.set(name, `assets/${name}`));
    
  tags
  .filter(tag => tag.startsWith("MUS_") || tag.startsWith("SFX_"))
  .forEach(name => AUDIOS.set(name, `assets/${name}`));

  // click to advance
  document.addEventListener("click", (event) => {
    event.preventDefault();
    ADVANCE();
  });

  // right / space to advance
  document.addEventListener("keydown", (event) => {
    if (event.key != "ArrowRight" && event.key != " ")
      return;
    event.preventDefault();
    ADVANCE();
  });

  RUN_PASSAGE("passages/main");
}
