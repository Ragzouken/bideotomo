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

const _PADDING = [html("div"), html("div"), html("div")];

function PUSH_ELEMENT(element) {
  VIDEOTOME.scroller.append(element);
  VIDEOTOME.scroller.replaceChildren(...[..._PADDING, ...VIDEOTOME.scroller.children].slice(-3));
}

async function ADVANCE() {
  if (VIDEOTOME.lines.length == 0) {
    VIDEOTOME.lines = VIDEOTOME.data.slice(1);
    VIDEOTOME.scroller.replaceChildren();
  }

  const styles = [];
  const line = VIDEOTOME.lines.shift();
  if (line.commands) {
    for (const command of line.commands) {
      if (EVENTS.has(command))
        await EVENTS.get(command)()
      else if (command.endsWith("!"))
        styles.push(command.slice(0, -1))
      else if (command.startsWith("BG_"))
        VIDEOTOME.scroller.style.backgroundImage = `url(images/${command}.png)`;
      else if (command.startsWith("MUS_"))
        PLAY_MUSIC(command);
      else if (command.startsWith("SFX_"))
        PLAY_SOUND(command);
    }
  }
  if (line.text)
    PUSH_ELEMENT(html("span", { class: ["text", ...styles].join(" ") }, line.text));
}

async function setup_videotome() {
  // parse main passage
  const grammar = document.getElementById("grammars/videotome").textContent;
  const parser = peggy.generate(grammar);
  const passage = document.getElementById("passages/main").textContent;
  const data = parser.parse(passage);

  // add lines to engine
  VIDEOTOME.data = data;
  VIDEOTOME.lines = [];
  VIDEOTOME.scroller = ENGINE.scroller;

  // find resources to preload
  const commands = [...new Set(data.flatMap(line => line.commands ?? []))];

  commands
  .filter(command => command.startsWith("BG_"))
  .forEach(name => IMAGES.set(name, `images/${name}.png`));
    
  commands
  .filter(command => command.startsWith("MUS_") || command.startsWith("SFX_"))
  .forEach(name => AUDIOS.set(name, `music/${name}.m4a`));
}
