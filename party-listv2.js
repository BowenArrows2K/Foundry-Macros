const { ApplicationV2 } = foundry.applications.api;

class PartyMembersAppV2 extends ApplicationV2 {
  constructor() {
    super();
    this._hookId = null;
    this._recentlyUpdatedId = null;
    this._sortBy = "name";
    this._sortDir = "asc";
    this._debounceTimeout = null;
  }

  static DEFAULT_OPTIONS = {
    id: "party-members-app",
    uniqueId: "party-members-app-001",
    classes: ["sheet", "dnd5e2"],
    tag: "section",
    position: { width: 1000, height: "auto" },
    window: {
      title: "Party Members",
      icon: "fas fa-users",
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

  get partyMembers() {
    let members = game.actors.filter(actor =>
      actor.hasPlayerOwner &&
      actor.type === "character" &&
      !actor.name.toLowerCase().includes("spectator") &&
      !actor.name.toLowerCase().includes("map")
    );

    members.sort((a, b) => {
      let fieldA = this.#getSortValue(a);
      let fieldB = this.#getSortValue(b);
      if (typeof fieldA === "string") fieldA = fieldA.toLowerCase();
      if (typeof fieldB === "string") fieldB = fieldB.toLowerCase();
      if (fieldA === fieldB) return 0;
      return (fieldA < fieldB ? -1 : 1) * (this._sortDir === "asc" ? 1 : -1);
    });

    return members;
  }

  #getSortValue(actor) {
    switch (this._sortBy) {
      case "class": return actor.items.find(i => i.type === "class")?.name ?? "";
      case "hp": return actor.system.attributes.hp.value;
      case "ac": return actor.system.attributes.ac?.value ?? 0;
      case "pp": return actor.system.skills.prc.passive;
      case "gp": {
        const c = actor.system.currency;
        return c.pp * 10 + c.gp + c.ep / 2 + c.sp / 10 + c.cp / 100;
      }
      default: return actor.name;
    }
  }

  getData() { return {}; }

  close(options) {
    if (this._hookId) Hooks.off("updateActor", this._hookId);
    return super.close(options);
  }

  async _renderHTML(data) {
    const container = document.createElement("div");
    container.classList.add("party-members-v2");

    const style = document.createElement("style");
    style.textContent = `
      #party-members-app table {
        margin: 0rem;
        width: 100%;
        border-collapse: collapse;
      }
      #party-members-app table th,
      #party-members-app table td {
        text-align: center;
        padding: 0rem; !important
      }
      #party-members-app th {
        border-bottom: 1px solid #888;
        cursor: pointer;
      }
      #party-members-app .health-container {
        position: relative;
        display: inline-block;
        padding: 0 20px;
        box-sizing: content-box;
      }
      #party-members-app .healthbar {
        width: 100%;
        height: 16px;
        border-radius: 4px;
        overflow: hidden;
      }
      #party-members-app .health-label {
        overflow: hidden;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        text-align: center;
        font-size: 0.9em;
        line-height: 16px;
        font-weight: bold;
        color: #fff;
        text-shadow: 0 0 2px #000;
        white-space: nowrap;
      }
      #party-members-app .temp-hp {
        color: #00bfff;
      }
      #party-members-app .highlight-flash {
        animation: flashHighlight 1.2s ease-out;
      }
      @keyframes flashHighlight {
        0% {
          background-color: #fff3cd;
        }
        100% {
          background-color: transparent;
        }
      }
      #party-members-app .portrait-img {
        border-radius: 4px;
        width: 32px;
        height: 32px;
        object-fit: cover;
      }
      #party-members-app .hp-input {
        display: inline;
        width: auto;
        height: auto;
        padding: 0;
        margin: 0;
        text-align: right;
        border: none;
        background: none;
        font-size: 1em;
        line-height: 16px;
        font-weight: bold;
        color: #fff;
        text-shadow: 0 0 2px #000;
      }
      #party-members-app .clickable-name {
        cursor: pointer;
        color: var(--color-text-hyperlink);
        text-decoration: underline;
      }
    `;

    const table = document.createElement("table");
    table.innerHTML = `
      <thead>
        <tr>
          <th data-sort="portrait"></th>
          <th data-sort="name">Name</th>
          <th>★</th>
          <th data-sort="class">Class</th>
          <th data-sort="background">Background</th>
          <th data-sort="hp">HP</th>
          <th data-sort="ac">AC</th>
          <th data-sort="pp">👁️</th>
          <th data-sort="gp">GP</th>
        </tr>
      </thead>
      <tbody id="party-list"></tbody>
    `;

    container.appendChild(style);

    container.appendChild(table);

    this.#updatePartyList(container);

    table.querySelectorAll("th[data-sort]").forEach(th => {
      th.addEventListener("click", () => {
        const sortKey = th.dataset.sort;
        if (this._sortBy === sortKey) this._sortDir = this._sortDir === "asc" ? "desc" : "asc";
        else { this._sortBy = sortKey; this._sortDir = "asc"; }
        this.#updatePartyList(container);
      });
    });

    if (!this._hookId) {
      this._hookId = Hooks.on("updateActor", (actor, data) => {
        const hasRelevantChanges =
          data.system?.attributes?.hp !== undefined ||
          data.system?.attributes?.ac !== undefined ||
          data.system?.skills?.prc?.passive !== undefined ||
          data.system?.attributes?.inspiration !== undefined ||
          data.system?.currency !== undefined ||
          data.items !== undefined ||
          data.img !== undefined ||
          data.name !== undefined;

        const isPartyMember =
          actor.hasPlayerOwner &&
          actor.type === "character" &&
          !actor.name.toLowerCase().includes("spectator") &&
          !actor.name.toLowerCase().includes("map");

        if (hasRelevantChanges && isPartyMember) {
          this._recentlyUpdatedId = actor.id;
          clearTimeout(this._debounceTimeout);
          this._debounceTimeout = setTimeout(() => {
            this.#updatePartyList(container);
            this._recentlyUpdatedId = null;
          }, 150);
        }
      });
    }

    return container;
  }

  async _replaceHTML(inner, outer) {
    outer.innerHTML = "";
    outer.appendChild(inner);
  }

  #updatePartyList(container) {
    const tbody = container.querySelector("#party-list");
    const updatedParty = this.partyMembers;

    let totalGP = 0;

    const partyHtml = updatedParty.map(member => {
      const hp = member.system.attributes.hp;
      const ac = member.system.attributes.ac?.value ?? "";
      const passive = member.system.skills.prc.passive;
      const inspiration = member.system.attributes?.inspiration ? "✨" : "○";
      const classes = member.items.filter(i => i.type === "class").map(cls => `${cls.name} (${cls.system.levels})`).join(", ");
      const background = member.system.details.background;
      const currencies = member.system.currency;
      const totalMemberGP = (currencies.pp * 10) + currencies.gp + (currencies.ep / 2) + (currencies.sp / 10) + (currencies.cp / 100);
      totalGP += totalMemberGP;
      const gpFormatted = totalMemberGP.toFixed(2);

      const hpText = `<input class="hp-input" id="hp-input-${member.id}" style="max-width: ${(`${hp.value}`.length * 10)}px;" type="string" max="${hp.max}" value="${hp.value}"></input>/${hp.max}`;
      const tempText = hp.temp > 0 ? ` <span class=\"temp-hp\">(+${hp.temp})</span>` : "";
      const textWidth = (hp.value +"/"+ hp.max + tempText).length * 8 + 40;
      const totalHP = hp.max + (hp.temp || 0);
      const hpPercent = (hp.value / totalHP) * 100;
      const tempPercent = ((hp.temp || 0) / totalHP) * 100;
      const healthColor = hpPercent > 66 ? 'green' : hpPercent > 33 ? 'orange' : 'red';
      const barGradient = `linear-gradient(to right, ${healthColor} ${hpPercent}%, blue ${hpPercent}% ${hpPercent + tempPercent}%, #555 ${hpPercent + tempPercent}%)`;
      const highlightClass = this._recentlyUpdatedId === member.id ? ` class="highlight-flash";` : "";

      return `
        <tr${highlightClass}>
          <td><img src="${member.img}" class="portrait-img" alt="portrait"></td>
          <td><span class="clickable-name" data-actor-id="${member.id}">${member.name}</span></td>
          <td class="clickable-inspiration" data-actor-id="${member.id}">${inspiration}</td>
          <td>${classes}</td>
          <td>${background.name}</td>
          <td>
            <div class="health-container" style="min-width: ${textWidth}px;">
              <div class="healthbar" style="background: ${barGradient};"></div>
              <div class="health-label">${hpText}${tempText}</div>
            </div>
          </td>
          <td>${ac}</td>
          <td>${passive}</td>
          <td title="PP: ${currencies.pp}, GP: ${currencies.gp}, EP: ${currencies.ep}, SP: ${currencies.sp}, CP: ${currencies.cp}">
            ${gpFormatted} gp
          </td>
        </tr>
      `;
    }).join("");

    const totalRow = `
      <tr>
        <td colspan="8" style="text-align: right; font-weight: bold;">Total GP:</td>
        <td style="font-weight: bold; padding: 0.5em;">${totalGP.toFixed(2)} gp</td>
      </tr>
    `;

    tbody.innerHTML = partyHtml + totalRow;

    container.querySelectorAll("input[id^=hp-input-]").forEach(input => {
      input.addEventListener("change", (event) => {
        const actor = game.actors.get(input.id.replace("hp-input-", ""));
        if (event.target.value.charAt(0) === "-" || event.target.value.charAt(0) === "+") {
          var currenthp = actor.system.attributes.hp.value
          var finalHP = currenthp + parseInt(event.target.value)
          actor.update({ "system.attributes.hp.value": parseInt(finalHP) });
        } else {
          var newHP = parseInt(event.target.value);
          actor.update({ "system.attributes.hp.value": newHP });
        }
      });
    });

    container.querySelectorAll(".clickable-inspiration").forEach(el => {
      el.addEventListener("click", () => {
        const actor = game.actors.get(el.dataset.actorId);
        if (actor) actor.update({ "system.attributes.inspiration": !actor.system.attributes.inspiration });
      });
    });

    container.querySelectorAll(".clickable-name").forEach(el => {
      el.addEventListener("click", () => {
        const actor = game.actors.get(el.dataset.actorId);
        if (actor) actor.sheet.render(true);
      });
    });
  }
}

new PartyMembersAppV2().render(true);