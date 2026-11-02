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
  const line = VIDEOTOME.lines.shift();
  if (line)
    return RUN_LINE(line);
}

async function RUN_LINE(line) {
  const styles = [];
  if (line.choice)
    PUSH_CHOICE(line.choice);
  if (line.script)
    eval(line.script);
  if (line.commands) {
    for (const command of line.commands) {
      if (EVENTS.has(command))
        await EVENTS.get(command)()
      else if (command.endsWith("!"))
        styles.push(command.slice(0, -1))
      else if (command.startsWith("BG_"))
        VIDEOTOME.scroller.style.backgroundImage = `url(${IMAGES.get(command)})`;
      else if (command.startsWith("MUS_"))
        PLAY_MUSIC(command);
      else if (command.startsWith("SFX_"))
        PLAY_SOUND(command);
      else if (command.startsWith("X_"))
        PUSH_CHOICE([["🔥", "passages/test"], ["🔥", "passages/main"], ["🔥", "passages/test"]]);
    }
  }
  if (line.text)
    PUSH_TEXT(line.text, styles);
}

const PASSAGES = new Map();

async function setup_videotome() {
  // load videotome grammar
  const grammar = document.getElementById("grammars/videotome").textContent;
  const parser = peggy.generate(grammar);

  // parse passages
  for (const element of document.querySelectorAll(`[type="text/videotome"]`))
    PASSAGES.set(element.id, parser.parse(element.textContent));

  // find resources to preload
  const commands = [...new Set(
    [...PASSAGES.values()]
    .flatMap(passage => passage)
    .flatMap(line => line.commands ?? [])
  )];

  // setup
  VIDEOTOME.scroller = ENGINE.scroller;

  commands
  .filter(command => command.startsWith("BG_"))
  .forEach(name => IMAGES.set(name, `assets/${name}`));
    
  commands
  .filter(command => command.startsWith("MUS_") || command.startsWith("SFX_"))
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
