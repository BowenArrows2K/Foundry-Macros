const { ApplicationV2 } = foundry.applications.api;

class MyCustomApp extends ApplicationV2 {
  constructor() {
    super();
  }

  static DEFAULT_OPTIONS = {
    id: "my-custom-app",
    uniqueId: "my-custom-app-001",
    classes: ["sheet", "dnd5e2"],
    tag: "section",
    actions: {
      clickButton: () => {
        ui.notifications.info("✅ Action handler: Button clicked!");
      }
    },
    position: {
      width: 400,
      height: "auto"
    },
    window: {
      title: "My V2 App",
      popOut: true,
      resizable: true,
      minimizable: true
    },
    form: {
      submitOnChange: false,
      submitOnClose: false,
      closeOnSubmit: false
    }
  };

  getData() {
    return {};
  }

  async _renderHTML(data) {
    // Pure native DOM rendering
    const div = document.createElement("div");
    div.classList.add("my-app-content");
    div.style.padding = "1em";
    div.innerHTML = `
      <p>This is a V2 Application</p>
      <button data-action="clickButton">Click Me!</button>
    `;
    return div; // ✅ Native HTMLElement (not jQuery)
  }

  async _replaceHTML(inner, outer) {
    // Native DOM replacement
    outer.innerHTML = "";
    outer.appendChild(inner);
  }
}

new MyCustomApp().render(true);