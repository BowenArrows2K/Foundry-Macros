class PartyMembersApp extends Application {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "party-members-app",
      title: "Party Members",
      template: null,
      popOut: true,
      resizable: true,
      width: 900,
      height: "auto",
      classes: ["sheet", "standard-form", "dnd5e2"]
    });
  }

  async getData() {
    const partyMembers = game.actors.filter(actor =>
      actor.hasPlayerOwner &&
      actor.type === "character" &&
      !actor.name.toLowerCase().includes("spectator") &&
      !actor.name.toLowerCase().includes("map")
    );

    return { partyMembers };
  }

  activateListeners(html) {
    super.activateListeners(html);
    this.updatePartyList(html);

    Hooks.on("updateActor", (actor, data) => {
      const hasRelevantChanges =
        data.system?.attributes?.hp !== undefined ||
        data.system?.attributes?.ac !== undefined ||
        data.system?.currency !== undefined ||
        data.items !== undefined;
      if (hasRelevantChanges) {
        this.updatePartyList(html);
      }
    });
  }

  updatePartyList(html) {
    const tbody = html.find("#party-list")[0];
    const updatedParty = game.actors.filter(actor =>
      actor.hasPlayerOwner &&
      actor.type === "character" &&
      !actor.name.toLowerCase().includes("spectator") &&
      !actor.name.toLowerCase().includes("map")
    );

    const partyHtml = updatedParty.map(member => {
      const hp = member.system.attributes.hp;
      const ac = member.system.attributes.ac?.value ?? "";
      const classes = member.items.filter(i => i.type === "class").map(cls => `${cls.name} (${cls.system.levels})`).join(", ");
      const currencies = member.system.currency;
      const totalGP = (currencies.pp * 10) + currencies.gp + (currencies.ep / 2) + (currencies.sp / 10) + (currencies.cp / 100);
      const gpFormatted = totalGP.toFixed(2);

      const hpText = `${hp.value} / ${hp.max}`;
      const tempText = hp.temp > 0 ? ` <span class="temp-hp">(+${hp.temp})</span>` : "";
      const textWidth = hpText.length * 8 + 40;

      const totalHP = hp.max + (hp.temp || 0);
      const hpPercent = (hp.value / totalHP) * 100;
      const tempPercent = ((hp.temp || 0) / totalHP) * 100;

      const barGradient = `linear-gradient(to right, green ${hpPercent}%, blue ${hpPercent}% ${hpPercent + tempPercent}%, #555 ${hpPercent + tempPercent}%)`;

      const hpBar = `
        <div class="health-container" style="min-width: ${textWidth}px;">
          <div class="healthbar" style="background: ${barGradient};"></div>
          <div class="health-label">${hpText}${tempText}</div>
        </div>
      `;

      return `
        <tr>
          <td>${member.name}</td>
          <td>${classes}</td>
          <td>${hpBar}</td>
          <td>${ac}</td>
          <td>${gpFormatted} gp</td>
        </tr>
      `;
    }).join("");

    const totalGP = updatedParty.reduce((sum, member) => {
      const c = member.system.currency;
      return sum + (c.pp * 10) + c.gp + (c.ep / 2) + (c.sp / 10) + (c.cp / 100);
    }, 0);

    const totalRow = `
      <tr>
        <td colspan="4" style="text-align: right; font-weight: bold;">Total GP:</td>
        <td style="font-weight: bold;">${totalGP.toFixed(2)} gp</td>
      </tr>
    `;

    tbody.innerHTML = partyHtml + totalRow;
  }

  async _renderInner(...args) {
    const partyMembers = game.actors.filter(actor =>
      actor.hasPlayerOwner &&
      actor.type === "character" &&
      !actor.name.toLowerCase().includes("spectator") &&
      !actor.name.toLowerCase().includes("map")
    );
    const nameWidth = Math.max(...partyMembers.map(m => m.name.length)) * 0.5;

    const content = `
      <style>
        .health-container {
          position: relative;
          display: inline-block;
          padding: 0 20px;
          box-sizing: content-box;
        }
        .healthbar {
          width: 100%;
          height: 16px;
          border-radius: 4px;
          overflow: hidden;
        }
        .health-label {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          text-align: center;
          font-size: 0.9em;
          line-height: 16px;
          font-weight: bold;
          color: #ffffff;
          text-shadow: 0 0 2px #000;
          pointer-events: none;
          white-space: nowrap;
        }
        .temp-hp {
          color: #00bfff;
        }
      </style>
      <div class="form-group">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Class (Level)</th>
              <th>HP</th>
              <th>AC</th>
              <th>GP</th>
            </tr>
          </thead>
          <tbody id="party-list">
          </tbody>
        </table>
      </div>
    `;

    return $(content);
  }
}

new PartyMembersApp().render(true);