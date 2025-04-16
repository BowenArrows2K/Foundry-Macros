// ===== CONFIGURATION =====
const NORMAL_FEATURES = [
    "Hybrid Transformation Features: Normal Form",
    "Hybrid Transformation: Normal Form"
  ];
  
  const HYBRID_FEATURES = [
    "Hybrid Transformation Features",
    "Hybrid Transformation Features: Bloodlust",
    "Hybrid Transformation Features: Feral Might",
    "Hybrid Transformation Features: Predatory Strikes",
    "Hybrid Transformation Features: Resilient Hide",
    "Hybrid Transformation: Hybrid Form"
  ];
  
  // ===== CORE MACRO LOGIC =====
  (async () => {
    const token = canvas.tokens.controlled[0];
    const actor = token?.actor;
    if (!actor || !token) return ui.notifications.error("Select a token to run this macro.");
  
    const hasHybridForm = actor.items.find(i => i.name === "Hybrid Transformation: Hybrid Form");
    const hasNormalForm = actor.items.find(i => i.name === "Hybrid Transformation: Normal Form");
  
    const currentForm = hasHybridForm ? "Hybrid" : hasNormalForm ? "Normal" : "Unknown";
    const nextForm = currentForm === "Hybrid" ? "Normal" : "Hybrid";
  
    if (currentForm === "Unknown") return ui.notifications.warn("Could not determine current form. Transformation aborted.");

    new foundry.applications.api.DialogV2({
      window: { title: "Hybrid Form Change"},
      content: `<p>You are currently in <strong>${currentForm} Form</strong>.</p><p>Transform into <strong>${nextForm} Form</strong>?</p>`,
      buttons: [{
        action: "yes",
        label: "Yes",
        callback: async () => {
        this.close;
        const remove = currentForm === "Normal" ? NORMAL_FEATURES : HYBRID_FEATURES;
        const add = currentForm === "Normal" ? HYBRID_FEATURES : NORMAL_FEATURES;

        // Remove features
        for (let featureName of remove) {
            let item = actor.items.find(i => i.name === featureName);
            if (item) await item.delete();
            else console.warn(`Item not found for removal: ${featureName}`);
        }

        // Add features (from compendium or pre-created hidden items in actor)
        for (let featureName of add) {
            let item = game.items.getName(featureName);
            if (!item) {
            ui.notifications.warn(`Feature "${featureName}" not found in world items.`);
            continue;
            }
            await actor.createEmbeddedDocuments("Item", [item.toObject()]);
        }

        // Flip Token using TokenFlip.(ID) method
        if (typeof token.flip === "function") {
            token.flip();
        } else {
            console.warn("Token flip method or ID is invalid.");
        }

        ui.notifications.info(`Transformed into ${nextForm} Form.`);
        }
        }, {
        action: "no", 
        label: "No",
        default: true,
        callback: () => ui.notifications.info("Transformation canceled.")
        }]
    }).render(true);
  })();