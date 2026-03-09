import { a as ensure_array_like, e as escape_html, b as attr_class, h as head } from "../../chunks/root.js";
import "../../chunks/url.js";
import "@sveltejs/kit/internal/server";
function createAppState() {
  let contentIndex = null;
  let currentSceneIndex = -1;
  let selectedActor = -1;
  let currentAnimation = null;
  let paused = false;
  let loading = true;
  let loadingMessage = "";
  let skillNames = [];
  let actorNames = [];
  let selectedCharacter = -1;
  return {
    get contentIndex() {
      return contentIndex;
    },
    set contentIndex(v) {
      contentIndex = v;
    },
    get currentSceneIndex() {
      return currentSceneIndex;
    },
    set currentSceneIndex(v) {
      currentSceneIndex = v;
    },
    get selectedActor() {
      return selectedActor;
    },
    set selectedActor(v) {
      selectedActor = v;
    },
    get currentAnimation() {
      return currentAnimation;
    },
    set currentAnimation(v) {
      currentAnimation = v;
    },
    get paused() {
      return paused;
    },
    set paused(v) {
      paused = v;
    },
    get loading() {
      return loading;
    },
    set loading(v) {
      loading = v;
    },
    get loadingMessage() {
      return loadingMessage;
    },
    set loadingMessage(v) {
      loadingMessage = v;
    },
    get skillNames() {
      return skillNames;
    },
    set skillNames(v) {
      skillNames = v;
    },
    get actorNames() {
      return actorNames;
    },
    set actorNames(v) {
      actorNames = v;
    },
    get selectedCharacter() {
      return selectedCharacter;
    },
    set selectedCharacter(v) {
      selectedCharacter = v;
    },
    get scenes() {
      return contentIndex?.scenes ?? [];
    },
    get characters() {
      return contentIndex?.characters ?? [];
    },
    get filteredSkillNames() {
      const blacklist = [
        "twiststart",
        "twiststop",
        "-start",
        "-stop",
        "-walkon",
        "-walkoff",
        "-divein",
        "-jumpin",
        "a2o-stand",
        "c2o-"
      ];
      return skillNames.filter((name) => {
        const l = name.toLowerCase();
        return !blacklist.some((b) => l.includes(b));
      });
    }
  };
}
function VitaMooSpace($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const app = createAppState();
    let activeDistance = "medium";
    $$renderer2.push(`<div class="vitamoospace svelte-1k03tmx"><header class="svelte-1k03tmx"><h1 class="svelte-1k03tmx">VitaMoo</h1> <span class="subtitle svelte-1k03tmx">Spin the Sims!</span></header> <div class="layout svelte-1k03tmx"><div class="sidebar svelte-1k03tmx"><div class="group svelte-1k03tmx"><h3 class="svelte-1k03tmx">Scene</h3> <select class="svelte-1k03tmx"><!--[-->`);
    const each_array = ensure_array_like(app.scenes);
    for (let i = 0, $$length = each_array.length; i < $$length; i++) {
      let scene = each_array[i];
      $$renderer2.option({ value: i, selected: i === app.currentSceneIndex }, ($$renderer3) => {
        $$renderer3.push(`${escape_html(scene.name)}`);
      });
    }
    $$renderer2.push(`<!--]--></select> <div class="nav-row svelte-1k03tmx"><button class="nav-btn svelte-1k03tmx" tabindex="-1">← Prev</button> <button class="nav-btn svelte-1k03tmx" tabindex="-1">Next →</button></div></div> `);
    if (app.actorNames.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="group svelte-1k03tmx"><h3 class="svelte-1k03tmx">Actor</h3> <select class="svelte-1k03tmx">`);
      if (app.actorNames.length > 1) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.option({ value: -1, selected: app.selectedActor === -1 }, ($$renderer3) => {
          $$renderer3.push(`All (${escape_html(app.actorNames.length)})`);
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--><!--[-->`);
      const each_array_1 = ensure_array_like(app.actorNames);
      for (let i = 0, $$length = each_array_1.length; i < $$length; i++) {
        let name = each_array_1[i];
        $$renderer2.option({ value: i, selected: i === app.selectedActor }, ($$renderer3) => {
          $$renderer3.push(`${escape_html(name)}`);
        });
      }
      $$renderer2.push(`<!--]--></select> <div class="nav-row svelte-1k03tmx"><button class="nav-btn svelte-1k03tmx" tabindex="-1">← Prev</button> <button class="nav-btn svelte-1k03tmx" tabindex="-1">Next →</button></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (app.characters.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="group svelte-1k03tmx"><h3 class="svelte-1k03tmx">Character</h3> <select class="svelte-1k03tmx">`);
      $$renderer2.option({ value: "" }, ($$renderer3) => {
        $$renderer3.push(`-- all --`);
      });
      $$renderer2.push(`<!--[-->`);
      const each_array_2 = ensure_array_like(app.characters);
      for (let i = 0, $$length = each_array_2.length; i < $$length; i++) {
        let char = each_array_2[i];
        $$renderer2.option({ value: i, selected: i === app.selectedCharacter }, ($$renderer3) => {
          $$renderer3.push(`${escape_html(char.name)}`);
        });
      }
      $$renderer2.push(`<!--]--></select> <div class="nav-row svelte-1k03tmx"><button class="nav-btn svelte-1k03tmx" tabindex="-1">← Prev</button> <button class="nav-btn svelte-1k03tmx" tabindex="-1">Next →</button></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="group svelte-1k03tmx"><h3 class="svelte-1k03tmx">Animation</h3> <select class="svelte-1k03tmx">`);
    $$renderer2.option({ value: "" }, ($$renderer3) => {
      $$renderer3.push(`-- all --`);
    });
    $$renderer2.push(`<!--[-->`);
    const each_array_3 = ensure_array_like(app.filteredSkillNames);
    for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
      let name = each_array_3[$$index_3];
      $$renderer2.option({ value: name, selected: app.currentAnimation === name }, ($$renderer3) => {
        $$renderer3.push(`${escape_html(name)}`);
      });
    }
    $$renderer2.push(`<!--]--></select> <div class="nav-row svelte-1k03tmx"><button class="nav-btn svelte-1k03tmx" tabindex="-1">← Prev</button> <button class="nav-btn svelte-1k03tmx" tabindex="-1">Next →</button></div></div></div> <div class="viewer svelte-1k03tmx"><canvas class="svelte-1k03tmx"></canvas> <div class="controls svelte-1k03tmx"><button${attr_class("dist-btn svelte-1k03tmx", void 0, { "active": activeDistance === "far" })} tabindex="-1">Far</button> <button${attr_class("dist-btn svelte-1k03tmx", void 0, { "active": activeDistance === "medium" })} tabindex="-1">Med</button> <button${attr_class("dist-btn svelte-1k03tmx", void 0, { "active": activeDistance === "near" })} tabindex="-1">Near</button> <label class="svelte-1k03tmx">Rotate <input type="range" min="0" max="360" value="30" class="svelte-1k03tmx"/></label> <label class="svelte-1k03tmx">Tilt <input type="range" min="-89" max="89" value="15" class="svelte-1k03tmx"/></label> <label class="svelte-1k03tmx">Zoom <input type="range" min="15" max="400" value="160" class="svelte-1k03tmx"/></label> <label class="svelte-1k03tmx">Speed <input type="range" min="0" max="1000" value="100" class="svelte-1k03tmx"/></label> <button${attr_class("pause-btn svelte-1k03tmx", void 0, { "active": app.paused })} tabindex="-1">${escape_html(app.paused ? "Play" : "Pause")}</button></div></div></div> <button class="help-btn svelte-1k03tmx" tabindex="-1">${escape_html("Help?!?")}</button> `);
    if (app.loading) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="overlay svelte-1k03tmx"><div class="loader-spinner svelte-1k03tmx"></div> <div class="loader-text svelte-1k03tmx">${escape_html(app.loadingMessage)}</div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function _page($$renderer) {
  head("1uha8ag", $$renderer, ($$renderer2) => {
    $$renderer2.title(($$renderer3) => {
      $$renderer3.push(`<title>VitaMooSpace — Spin the Sims!</title>`);
    });
  });
  VitaMooSpace($$renderer);
}
export {
  _page as default
};
