"use strict";

const VIDEOTOME = {
  data: {},
  lines: [],
};

EVENTS.set("CLEARSCREEN", () => VIDEOTOME.scroller.replaceChildren());

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

function RUN_PASSAGE(passage) {
  if (!PASSAGES.has(passage)) {
    JUMP(passage);
    return;
  }

  VIDEOTOME.lines = [...PASSAGES.get(passage)];
  // VIDEOTOME.scroller.replaceChildren();
  ADVANCE(); 
}

function PUSH_TEXT(text, styles=[]) {
    const element = html("span", { class: ["text", ...styles].join(" ") });
    element.innerHTML = text;
    PUSH_ELEMENT(element);
}

function PUSH_CHOICE(choices, styles=[]) {
  function make_button({ label, event }) {
    const button = html("button", {}, label);
    button.addEventListener("click", () => RUN_PASSAGE(event));
    button.addEventListener("click", suppress);
    return button;
  }

  const buttons = choices.map(make_button);
  const element = html("form", { class: ["choice", ...styles].join(" ") }, ...buttons);
  PUSH_ELEMENT(element);
}

const _PADDING = [html("div"), html("div"), html("div")];

function PUSH_ELEMENT(element) {
  VIDEOTOME.scroller.append(element);
  VIDEOTOME.scroller.replaceChildren(...[..._PADDING, ...VIDEOTOME.scroller.children].slice(-3));
}

async function ADVANCE() {
  let line = VIDEOTOME.lines.shift();
  while (line && line.label) line = VIDEOTOME.lines.shift();
  if (line)
    return RUN_LINE(line);
}

async function JUMP(label) {
  for (const passage of PASSAGES.values()) {
    const index = passage.findIndex(line => line.label == label);
    if (index < 0) continue;
    VIDEOTOME.lines = [...passage.slice(index+1)];
    ADVANCE();
    return;
  }
}

async function RUN_LINE(line) {
  const styles = [];
  if (line.event)
    RUN_PASSAGE(line.event);
  if (line.choice)
    PUSH_CHOICE(line.choice);
  if (line.script)
    eval(line.script);
  if (line.tags) {
    for (const tag of line.tags) {
      if (EVENTS.has(tag))
        await EVENTS.get(tag)()
      else if (tag.endsWith("!"))
        styles.push(tag.slice(0, -1))
      else if (tag.startsWith("BG_"))
        VIDEOTOME.scroller.style.backgroundImage = `url(${IMAGES.get(tag)})`;
      else if (tag.startsWith("MUS_"))
        PLAY_MUSIC(tag);
      else if (tag.startsWith("SFX_"))
        PLAY_SOUND(tag);
      else if (tag.startsWith("X_"))
        PUSH_CHOICE([["🔥", "passages/test"], ["🔥", "passages/main"], ["🔥", "passages/test"]]);
    }
  }
  if (line.text || line.escape)
    PUSH_TEXT(line.text, styles);
}

const PASSAGES = new Map();

async function setup_videotome() {
  // find passages
  for (const element of document.querySelectorAll(`[type="text/videotome"]`))
    PASSAGES.set(element.id, PARSEDS.get(element.id));

  // find resources to preload
  const tags = [...new Set(
    [...PASSAGES.values()]
    .flatMap(passage => passage)
    .flatMap(line => line.tags ?? [])
  )];

  // setup
  VIDEOTOME.scroller = ENGINE.scroller;

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
