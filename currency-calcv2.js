const { ApplicationV2 } = foundry.applications.api;
const windowTitle = game.user.isGM === true ? "GM's Currency Spender" : actor?.name + `'s Spending`;

class CurrencySpenderApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "currency-spender-app",
    uniqueId: "currency-spender-app-001",
    classes: ["sheet", "dnd5e2"],
    tag: "section",
    actions: {},
    position: { width: 400, height: "auto" },
    window: {
      icon: "fas fa-coins",
      title: windowTitle,
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

  async getData(actor = game.user.character) {
    if (!actor) return {};
    const currency = actor.system?.currency ?? { cp: 0, sp: 0, gp: 0, pp: 0 };
    const totalGPValue = (currency.cp / 100 + currency.sp / 10 + currency.gp + currency.pp * 10).toFixed(2);
    return { currency, totalGPValue };
  }

  _calculatePayment(amountGP, currency, source) {
    const values = { pp: 1000, gp: 100, sp: 10, cp: 1 };
    const wallet = foundry.utils.deepClone(currency);
    const totalCopper = Math.round(amountGP * 100);
    const paid = { pp: 0, gp: 0, sp: 0, cp: 0 };
    const change = { gp: 0, sp: 0, cp: 0 };
    const ideal = {};
    const purchaseValue = { pp: 0, gp: 0, sp: 0, cp: 0 };
    let paidCopper = 0;
    let remaining = totalCopper;
    let pvremaining = totalCopper;

    // purchaseValue distribution
    for (const [type, value] of Object.entries(values).sort((a, b) => b[1] - a[1])) {
      purchaseValue[type] = type === "cp" ? pvremaining : Math.floor(pvremaining / value);
      pvremaining -= purchaseValue[type] * value;
    }

    // Ideal distribution
    for (const [type, value] of Object.entries(values).sort((a, b) => b[1] - a[1])) {
      ideal[type] = Math.min(Math.floor(remaining / value), wallet[type]);
      remaining -= ideal[type] * value;
    }

    const hasExact = remaining === 0;

    if (hasExact) {
      for (let type of ["pp", "gp", "sp", "cp"]) {
        paid[type] = ideal[type];
        paidCopper += values[type] * ideal[type];
        wallet[type] -= ideal[type];
      }
    } else {
      const valueTypes = ["cp", "sp", "gp", "pp"]
      const convList = {cp: "sp", sp: "gp", gp: "pp", pp: ""}
      const roundedCost = deepClone(purchaseValue);
      for (const [type, conv] of Object.entries(convList)) {
        if (roundedCost[type] === 0) continue;
        if (roundedCost[type] > wallet[type]) {
          if (type === "pp") {
            for (let type of valueTypes) {
              paid[type] = wallet[type];
              paidCopper += values[type] * wallet[type];
              wallet[type] -= wallet[type];
            }
            break;
          } else {
            roundedCost[conv] += 1;
            for (let i = 0; i <= valueTypes.indexOf(type); i++) {
              roundedCost[valueTypes[i]] = 0;
            };
            continue;
          }
        }
        paid[type] = roundedCost[type];
        paidCopper += values[type] * roundedCost[type];
        wallet[type] -= roundedCost[type];
      };

      if (paidCopper < totalCopper) {
        let short = totalCopper - paidCopper;
        const shortParts = [];
        for (const [type, value] of Object.entries(values).sort((a, b) => b[1] - a[1])) {
          const missing = Math.floor(short / value);
          short -= missing * value;
          if (missing > 0) shortParts.push(`<strong style="color: darkred;">${missing}</strong> ${type}`);
        }

        return {
          success: false,
          short,
          messageHTML: `
            <hr>
            <div style="font-size: 0.95em; line-height: 1.4;">
              <strong style="color: red;">❌ Insufficient funds.</strong><br />
              <strong>Amount Short:</strong> ${shortParts.join(", ")}
            </div>
          `
        };
      }

      // Change
      let extra = paidCopper - totalCopper;
      for (let type of ["gp", "sp", "cp"]) {
        const value = values[type];
        change[type] = Math.floor(extra / value);
        wallet[type] += change[type];
        extra %= value;
      }
    }

    const spentMsg = Object.entries(paid)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${v} ${k}`)
      .join(", ");

    const changeMsg = Object.values(change).some(v => v > 0)
      ? Object.entries(change).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(", ")
      : "No change returned.";

    const PVformatted = { gp: 0, sp: 0, cp: 0 };
    for (let type of ["pp", "gp", "sp", "cp"]) {
      if (type === "pp") {
        PVformatted["gp"] += purchaseValue[type] * 10 ?? 0;
      } else {
        PVformatted[type] += purchaseValue[type] ?? 0;
      };
    };
    
    const purchaseVal = Object.entries(PVformatted)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${v} ${k}`)
      .join(", ");

    const baseMessage = `
      <hr>
      <div style="font-size: 0.95em; line-height: 1.4;">
        ${(source === "preview")
          ? `${hasExact
            ? `<div><strong style="color: green;">✔ Exact denominations available</strong></div>`
            : `<div><strong style="color: darkorange;">⚠ Using alternate denominations</strong></div>`
          }
          <div><strong>Total:</strong> <span style="color: gold;">${amountGP.toFixed(2)} gp</span></div>
          <div><strong>Deducting:</strong> <span style="color: red;">${spentMsg}</span></div>
          <div><strong>Change:</strong> <span style="color: blue;">${changeMsg}</span></div>
          <div><strong>Purchase Value:</strong> <span style="color: green;">${purchaseVal}</span></div>
          <div style="margin-top: 0.5em;"><strong style="color: green;">✔ Sufficient Funds</strong></div>`
          : `<div><strong>Total:</strong> ${amountGP.toFixed(2)} gp</div>
          <div><strong>Deducting:</strong> ${spentMsg}</div>
          ${(changeMsg !== "No change returned.") ?`<div><strong>Change:</strong> <span style="color: blue;">${changeMsg}</span></div>` : ""}
          <div><strong>Purchase Value:</strong> ${purchaseVal}</div>`
        }
      </div>
    `;

    return {
      success: true,
      paid,
      change,
      wallet,
      paidCopper,
      hasExact,
      messageHTML: baseMessage
    };
  }

  async _handleSpendGold(html) {
    const actor = html.querySelector("#currency-spender-select")?.value ? game.actors.get(html.querySelector("#currency-spender-select")?.value) : game.user.character;
    if (!actor) return ui.notifications.warn("You must have a linked character.");

    const amount = parseFloat(html.querySelector("#gold-amount")?.value);
    if (isNaN(amount) || amount <= 0) return ui.notifications.warn("Enter a valid gold amount.");

    const result = this._calculatePayment(amount, actor.system?.currency ?? { cp: 0, sp: 0, gp: 0, pp: 0 }, "chat");

    if (!result.success) {
      return ui.notifications.error("Insufficient funds.");
    }

    await actor.update({ "system.currency": result.wallet });

    const fullMessage = `
      <div style="font-size: 1em; font-weight: bold;">💰 ${actor.name} spent ${(result.paidCopper / 100).toFixed(2)} gp</div>
      ${result.messageHTML}
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: fullMessage,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });

    this.close();
  }

  async #updateCurrencySpender(container, actor) {
    const body = container.querySelector("#currency-status");
    const { currency, totalGPValue } = await this.getData(actor);

    body.innerHTML = `
        <strong>Current Funds:</strong><br />
        ${currency.pp} pp, ${currency.gp} gp, ${currency.sp} sp, ${currency.cp} cp<br />
        <strong>Total GP Value:</strong> ${totalGPValue} gp
    `;
  }


  async _renderHTML() {
    const members = game.actors.filter(actor =>
      actor.hasPlayerOwner &&
      actor.type === "character" &&
      !actor.name.toLowerCase().includes("spectator") &&
      !actor.name.toLowerCase().includes("map")
    );
    const actor = game.user.isGM === true ? members[0] : game.user.character;
    const { currency, totalGPValue } = await this.getData(actor);
    if (!actor) return document.createElement("div");
    
    const select = document.createElement("select");
    const options = members.map(member => `<option value="${member.id}">${member.name}</option>`).join("");
    select.id = "currency-spender-select";
    select.innerHTML = `${options}`;

    const container = document.createElement("div");
    container.id = "currency-spender-container";
    const style = document.createElement("style");
    style.textContent = `
      #currency-spender-body {
        text-align: center; 
      }
      #currency-spender-body input, #currency-spender-body button {
        width: 100%; margin-top: 0.5em; padding: 0.5em; font-size: 1em;
      }
      #currency-spender-body input {
        color: #fff; border: 1px solid #555;
      }
      #currency-spender-body button {
        color: #fff; border: 1px solid #666; border-radius: 6px; font-weight: bold;
      }

      #currency-spender-body .amount-input {
        display: flex; align-items: center; vertical-align: middle;
      }
      #currency-spender-body .currency-preview {
        margin-top: 0.5em; font-size: 0.95em; text-align: center;
      }
    `;
    container.appendChild(style);
    const body = document.createElement("div");
    body.id = "currency-spender-body";
    body.innerHTML = `
      ${game.user.isGM ? select.outerHTML : ""}
      <div class="amount-input">
        <label style="white-space: nowrap;">Gold to Spend:</label>
        <input type="number" id="gold-amount" min="0" step="0.01" />
      </div>
      <div class="currency-preview" id="currency-status">
        <strong>Current Funds:</strong><br />
        ${currency.pp} pp, ${currency.gp} gp, ${currency.sp} sp, ${currency.cp} cp<br />
        <strong>Total GP Value:</strong> ${totalGPValue} gp
      </div>
      <div class="currency-preview" id="deduction-preview" style="display:none;"></div>
      <button data-action="spendGold">Spend</button>
    `;
    container.appendChild(body);

    let debounce;
    container.querySelector("#gold-amount").addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => this._updatePreview(container), 150);
    });

    if (game.user.isGM) {
      container.querySelector("#currency-spender-select").addEventListener("change", (event) => {
        const selectedValue = event.target.value;
        const actor = game.actors.get(selectedValue);
        this.#updateCurrencySpender(container, actor);
      });
    };

    container.querySelector("button[data-action='spendGold']").addEventListener("click", () => this._handleSpendGold(container));
    return container;
  }

  async _replaceHTML(inner, outer) {
    outer.innerHTML = "";
    outer.appendChild(inner);
  }

  async _updatePreview(html) {
    const amount = parseFloat(html.querySelector("#gold-amount")?.value);
    const previewDiv = html.querySelector("#deduction-preview");
    if (isNaN(amount) || amount <= 0) return previewDiv.style.display = "none";

    const actor = html.querySelector("#currency-spender-select")?.value ? game.actors.get(html.querySelector("#currency-spender-select")?.value) : game.user.character;
    const currency = actor?.system.currency ?? { cp: 0, sp: 0, gp: 0, pp: 0 };
    const result = this._calculatePayment(amount, currency, "preview");

    previewDiv.innerHTML = result.messageHTML;
    previewDiv.style.display = "block";
  }
}

new CurrencySpenderApp().render(true);
