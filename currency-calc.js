class CurrencySpenderApp extends Application {
    static get defaultOptions() {
      return mergeObject(super.defaultOptions, {
        id: "currency-spender-app",
        title: "Spend Currency",
        template: null,
        popOut: true,
        resizable: true,
        width: "auto",
        height: "auto",
        classes: ["dark-theme-dialog"]
      });
    }
  
    async _renderInner(...args) {
      const actor = game.user.character;
      const currency = actor?.system.currency ?? { cp: 0, sp: 0, gp: 0, pp: 0 };
      const totalGPValue = (currency.cp / 100 + currency.sp / 10 + currency.gp + currency.pp * 10).toFixed(2);
  
      const content = `
        <style>
          .dark-theme-dialog { background-color: #1e1e2f; color: #e0e0e0; font-family: sans-serif; padding: 10px; }
          .dark-theme-dialog input { background-color: #2c2f33; color: #ffffff; border: 1px solid #555; width: 100%; padding: 5px; margin-top: 10px; font-size: 1em; }
          .dark-theme-dialog button { margin-top: 10px; width: 100%; padding: 6px; font-weight: bold; border-radius: 6px; background-color: #444; color: #ffffff; border: 1px solid #666; }
          .dark-theme-dialog hr { border-color: #444; }
          .currency-preview { margin-top: 10px; font-size: 0.95em; text-align: center; color: #cccccc; }
          .currency-preview strong { color: #ffffff; }
          .currency-preview span { font-weight: bold; }
          .blue-bold { color: #66ccff; font-weight: bold; }
          .red-bold { color: #ff6f6f; font-weight: bold; }
        </style>
        <div class="form-group dark-theme-dialog">
          <label>Enter Gold Amount to Spend:</label>
          <input type="number" id="gold-amount" min="0" step="0.01" />
          <div class="currency-preview" id="currency-status">
            <strong>Current Funds:</strong><br />
            ${currency.pp} pp, ${currency.gp} gp, ${currency.sp} sp, ${currency.cp} cp<br />
            <strong>Total GP Value:</strong> ${totalGPValue} gp
          </div>
          <div class="currency-preview" id="deduction-preview" style="display:none;"></div>
          <button id="spend-gold">Spend</button>
        </div>
      `;
      return $(content);
    }
  
    async _render(...args) {
      const result = await super._render(...args);
      this.setPosition({ height: "auto", width: "auto" });
      return result;
    }
  
    activateListeners(html) {
      super.activateListeners(html);
  
      const actor = game.user.character;
      const values = { pp: 1000, gp: 100, sp: 10, cp: 1 };
      const denomOrder = ["cp", "sp", "gp", "pp"];
  
      const updatePreview = () => {
        const amount = parseFloat(html.find("#gold-amount").val());
        const previewDiv = html.find("#deduction-preview");
        if (isNaN(amount) || amount <= 0 || !actor) return previewDiv.hide();
  
        const currency = actor.system.currency;
        const totalCopper = Math.round(amount * 100);
        const availableCopper = denomOrder.reduce((sum, type) => sum + (currency[type] * values[type]), 0);
  
        if (availableCopper < totalCopper) {
          const missing = totalCopper - availableCopper;
          const ppShort = Math.floor(missing / 1000);
          const gpShort = Math.floor((missing % 1000) / 100);
          const spShort = Math.floor((missing % 100) / 10);
          const cpShort = missing % 10;
  
          const shortParts = [];
          if (ppShort) shortParts.push(`<span class='red-bold'>${ppShort}</span> pp`);
          if (gpShort) shortParts.push(`<span class='red-bold'>${gpShort}</span> gp`);
          if (spShort) shortParts.push(`<span class='red-bold'>${spShort}</span> sp`);
          if (cpShort) shortParts.push(`<span class='red-bold'>${cpShort}</span> cp`);
  
          previewDiv.html(`
            <hr><strong>Spending Preview:</strong><br />
            <span class='red-bold'>Insufficient funds.</span><br/>
            Amount Short: ${shortParts.join(", ")}
          `).show();
          return;
        }
  
        let spent = { pp: 0, gp: 0, sp: 0, cp: 0 };
        let wallet = foundry.utils.deepClone(currency);
        let remaining = totalCopper;
        let paid = 0;
  
        for (let type of denomOrder) {
          const value = values[type];
          while (wallet[type] > 0 && remaining > 0) {
            wallet[type]--;
            spent[type]++;
            remaining -= value;
            paid += value;
          }
        }
  
        let change = paid - totalCopper;
        let returned = { gp: 0, sp: 0, cp: 0 };
        if (change > 0) {
          if (spent.pp > 0) {
            returned.gp = Math.floor(change / 100);
            change %= 100;
          }
          returned.sp = Math.floor(change / 10);
          returned.cp = change % 10;
  
          wallet.gp += returned.gp;
          wallet.sp += returned.sp;
          wallet.cp += returned.cp;
        }
  
        const spentMsg = `${spent.pp} pp, ${spent.gp} gp, ${spent.sp} sp, ${spent.cp} cp`;
        const changeParts = [];
        if (returned.gp) changeParts.push(`<span class='blue-bold'>${returned.gp}</span> gp`);
        if (returned.sp) changeParts.push(`<span class='blue-bold'>${returned.sp}</span> sp`);
        if (returned.cp) changeParts.push(`<span class='blue-bold'>${returned.cp}</span> cp`);
        const changeMsg = changeParts.length > 0 ? `Change Returned: ${changeParts.join(", ")}` : "No change returned.";
  
        const breakdown = `
          <br /><strong>Purchase Value:</strong><br />
          ${Math.floor(totalCopper / 100)} gp,
          ${Math.floor((totalCopper % 100) / 10)} sp,
          ${totalCopper % 10} cp
        `;
  
        previewDiv.html(`
          <hr><strong>Spending Preview:</strong><br />
          Total: <span style='color:#ffff99;'>${amount.toFixed(2)} gp</span><br />
          Deducting: <span>${spentMsg}</span><br/>
          ${changeMsg}
          ${breakdown}
          <br /><span style='color:#90ee90;'>Sufficient Funds</span>
        `).show();
      };
  
      html.find("#gold-amount").on("input", updatePreview);
  
      html.find("#spend-gold").on("click", async () => {
        const amount = parseFloat(html.find("#gold-amount").val());
        if (isNaN(amount) || amount <= 0) return ui.notifications.warn("Please enter a valid amount of gold.");
        if (!actor) return ui.notifications.warn("You must have a linked character sheet.");
  
        const currency = actor.system.currency;
        const totalCopper = Math.round(amount * 100);
        const availableCopper = denomOrder.reduce((sum, type) => sum + (currency[type] * values[type]), 0);
  
        if (availableCopper < totalCopper) {
          const missing = totalCopper - availableCopper;
          const ppShort = Math.floor(missing / 1000);
          const gpShort = Math.floor((missing % 1000) / 100);
          const spShort = Math.floor((missing % 100) / 10);
          const cpShort = missing % 10;
  
          const parts = [];
          if (ppShort) parts.push(`${ppShort} pp`);
          if (gpShort) parts.push(`${gpShort} gp`);
          if (spShort) parts.push(`${spShort} sp`);
          if (cpShort) parts.push(`${cpShort} cp`);
  
          return ui.notifications.error(`Insufficient funds. Amount short: ${parts.join(", ")}.`);
        }
  
        let spent = { pp: 0, gp: 0, sp: 0, cp: 0 };
        let wallet = foundry.utils.deepClone(currency);
        let remaining = totalCopper;
        let paid = 0;
  
        for (let type of denomOrder) {
          const value = values[type];
          while (wallet[type] > 0 && remaining > 0) {
            wallet[type]--;
            spent[type]++;
            remaining -= value;
            paid += value;
          }
        }
  
        let change = paid - totalCopper;
        let returned = { gp: 0, sp: 0, cp: 0 };
        if (change > 0) {
          if (spent.pp > 0) {
            returned.gp = Math.floor(change / 100);
            change %= 100;
          }
          returned.sp = Math.floor(change / 10);
          returned.cp = change % 10;
  
          wallet.gp += returned.gp;
          wallet.sp += returned.sp;
          wallet.cp += returned.cp;
        }
  
        await actor.update({ "system.currency": wallet });
  
        const spentMsg = `${spent.pp} pp, ${spent.gp} gp, ${spent.sp} sp, ${spent.cp} cp`;
        const changeParts = [];
        if (returned.gp) changeParts.push(`<span class='blue-bold'>${returned.gp}</span> gp`);
        if (returned.sp) changeParts.push(`<span class='blue-bold'>${returned.sp}</span> sp`);
        if (returned.cp) changeParts.push(`<span class='blue-bold'>${returned.cp}</span> cp`);
        const changeMsg = changeParts.length > 0 ? `Change Returned: ${changeParts.join(", ")}` : "No change returned.";
  
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `
            <strong>${actor.name}</strong> spent <strong>${amount.toFixed(2)} gp</strong>.<br/>
            Breakdown: ${spentMsg}<br/>
            ${changeMsg}
          `,
          type: CONST.CHAT_MESSAGE_TYPES.OTHER
        });
  
        this.close();
      });
    }
  }
  
  new CurrencySpenderApp().render(true);