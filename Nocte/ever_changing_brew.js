// Define the caster's name (always Thorbek Emberforge)
const casterName = "Thorbek Emberforge";

// Define the item name
const itemName = "Thorbek's Alebound Staff";

// Define effects corresponding to each roll (1d6)
const effectMapping = {
    1: "Stonebrew Stout",
    2: "Firewater Whiskey",
    3: "Wind's Ale",
    4: "Tranquility Mead",
    5: "Brawler's Lager",
    6: "Elixir of Luck"
};

// Get Thorbek Emberforge's actor
let caster = game.actors.getName(casterName);
if (!caster) {
    ui.notifications.error(`Could not find actor '${casterName}' in the game!`);
    return;
}

// Check if any token is targeted and it's not Thorbek
if (game.user.targets.size > 0) {
    let isOtherTargeted = Array.from(game.user.targets).some(token => token.actor?.name !== casterName);
    if (isOtherTargeted) {
        const macro = game.macros.getName("chosen_ever_changing_brew");
        if (macro) {
            macro.execute();
        } else {
            ui.notifications.warn("Macro 'chosen_ever_changing_brew' not found.");
        }
        return;
    }
}

// Find the item on Thorbek Emberforge
let item = caster.items.find(i => i.name === itemName);
if (!item) {
    ui.notifications.error(`${itemName} not found in ${caster.name}'s inventory!`);
    return;
}

// Get effects from the item
let itemEffects = item.effects.contents;
if (itemEffects.length === 0) {
    ui.notifications.error(`${itemName} has no active effects!`);
    return;
}

// Roll 1d6 asynchronously
new Roll("1d6").roll({ async: true }).then(roll => {
    let result = roll.total;
    let chosenEffectName = effectMapping[result];

    if (!chosenEffectName) {
        ui.notifications.error(`No effect mapped for roll ${result}.`);
        return;
    }

    // Find the corresponding effect on the item
    let chosenEffect = itemEffects.find(e => e.name === chosenEffectName);
    if (!chosenEffect) {
        ui.notifications.error(`Effect '${chosenEffectName}' not found on ${itemName}.`);
        return;
    }

    // Confirmation dialog
    let dialog = new Dialog({
        title: "Apply Effect",
        content: `<p>Thorbek Emberforge drinks from <strong>${itemName}</strong>.</p>
                  <p>Rolled <strong>${result}</strong>: <strong>${chosenEffect.name}</strong>.</p>
                  <p>Apply this effect to Thorbek Emberforge?</p>`,
        buttons: {
            yes: {
                label: "Apply",
                callback: async () => {
                    // Clone and apply the effect to Thorbek Emberforge
                    let effectData = chosenEffect.toObject();
                    await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
                    ui.notifications.info(`${chosenEffect.name} applied to ${casterName}.`);
                }
            },
            no: {
                label: "Cancel"
            }
        }
    });
    dialog.render(true);
});