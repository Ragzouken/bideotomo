let SPEED = 0;

async function setup_game() {
  ENGINE.container.append(html("div", { class: "scroller-bg-1" }))
  ENGINE.container.append(html("div", { class: "scroller-bg-2" }))
  
  function make_pedal() {
    return new HoldableButton(html(
      "button", 
      { class: "pedal", draggable: "false" }, 
      html("img", { src: "images/pedal-brake.png" }),
    ));
  }

  const accelButton = make_pedal();
  const brakeButton = make_pedal();
  
  accelButton.bindKey("ArrowRight");
  brakeButton.bindKey("ArrowLeft");
  
  accelButton.bindKey("ArrowUp");
  brakeButton.bindKey("ArrowDown");

  accelButton.bindKey("w");
  brakeButton.bindKey("s");

  ENGINE.controls.append(brakeButton.element);
  ENGINE.controls.append(accelButton.element);

  IMAGES.set("BG_CAR", "images/BG_CAR.webp");
  AUDIOS.set("MUS_FOSSILS", "music/MUS_FOSSILS.m4a");

  const vroom = new Howl({ src: "music/SFX_ENGINE.m4a", loop: true });
  const wreee = new Howl({ src: "music/SFX_BRAKE.m4a", loop: true });
  wreee.volume(0);
  let sound = null;
  let sound2 = null;

  MUSIC.volume = 0;
  let BRAKE = 0;

  let prev = performance.now();

  let timer = 0;
  const interval = .25;

  let STARTED = false;

  repeat(() => {
    const next = performance.now();
    dt = Math.min((next - prev) / 1000, .1);
    prev = next;

    if (STARTED)
      timer += (SPEED + .1) * dt;

    const progress = Math.max(0, Math.min(1 - (interval - timer) / interval, 1));

    if (timer >= interval) {
      timer -= interval;
      
      EVENTS.get("CLEARSCREEN")();
      ADVANCE();
    }

    if (accelButton.isHeld)
      SPEED = Math.min(SPEED + 0.125 * dt, 1);
    else
      SPEED = Math.max(0, SPEED - 0.05 * dt);

    if (!sound)
      sound = vroom.play();
    if (!sound2)
      sound2 = wreee.play();

    if (SPEED >= 0.75 && !STARTED) {
      PLAY_MUSIC("MUS_FOSSILS");
      MUSIC.volume = .5;
      MUSIC.currentTime = 0;
      STARTED = true;
    } else if (STARTED) {
      MUSIC.volume = .2 + SPEED * .7;
    }

    vroom.rate(SPEED * .25 + .85, sound)
    vroom.volume(.3 + SPEED * .7, sound);

    if (brakeButton.isHeld)
      BRAKE = Math.min(BRAKE + .1, 1);
    else
      BRAKE = Math.max(BRAKE - .1, 0);

    wreee.volume((SPEED + .1) * BRAKE);
    SPEED = Math.max(0, SPEED - BRAKE * .25 * dt);

    ENGINE.viewport.style.setProperty("--speed", `${SPEED}`);
    ENGINE.viewport.style.setProperty("--progress", `${Math.sin(progress * Math.PI)}`)
  });
}
