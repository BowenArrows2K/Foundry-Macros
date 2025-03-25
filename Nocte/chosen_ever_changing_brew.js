// Define the caster's name and item name
const casterName = "Thorbek Emberforge";
const itemName = "Thorbek's Alebound Staff";

// Get the actor for Thorbek Emberforge
let casterActor = game.actors.find(a => a.name === casterName);
if (!casterActor) {
    ui.notifications.error(`Actor "${casterName}" not found!`);
    return;
}

// Find the item on Thorbek
let item = casterActor.items.find(i => i.name === itemName);
if (!item) {
    ui.notifications.error(`${itemName} not found in ${casterName}'s inventory!`);
    return;
}

// Get effects from the item
let itemEffects = item.effects.contents;
if (itemEffects.length === 0) {
    ui.notifications.error(`${itemName} has no active effects!`);
    return;
}

// Get the selected target (if any)
let selectedTarget = game.user.targets.size > 0
    ? Array.from(game.user.targets)[0]
    : canvas.tokens.controlled[0] ?? null;

function requestOwnerApproval(targetToken, selectedEffect) {
    let allOwners = game.users.filter(u => targetToken.actor.testUserPermission(u, "OWNER"));
    let activeNonGMOwners = allOwners.filter(u => u.active && !u.isGM && u.id !== game.user.id);

    let ownerUser = activeNonGMOwners[0];

    if (!ownerUser) {
        ownerUser = game.users.find(u => u.isGM && u.active);
        if (!ownerUser) {
            ui.notifications.warn("No owner or GM available to approve the effect.");
            return false;
        }
    }

    let requestData = {
        effectName: selectedEffect.name,
        targetName: targetToken.name,
        actorUuid: targetToken.actor.uuid,
        effectData: selectedEffect.toObject()
    };

    console.log("📤 Sending effect approval to", ownerUser.name, requestData);
    UniversalEmit(ownerUser.id, showApprovalDialog, requestData);
    ui.notifications.info(`Effect approval request sent to ${ownerUser.name}.`);
}

async function showApprovalDialog(data) {
    console.log("🪄 Showing approval dialog for:", data.data.effectName, "→", data.data.targetName);

    const targetActor = await fromUuid(data.data.actorUuid);
    if (!targetActor) return;

    new Dialog({
        title: "Effect Approval",
        content: `<p><strong>${game.user.name}</strong>, do you approve applying <strong>${data.data.effectName}</strong> to <strong>${data.data.targetName}</strong>?</p>`,
        buttons: {
            yes: {
                label: "Approve",
                callback: async () => {
                    data.data.effectData.disabled = false;
                    await targetActor.createEmbeddedDocuments("ActiveEffect", [data.data.effectData]);
                    ui.notifications.info(`${data.data.effectName} approved and applied to ${data.data.targetName}.`);
                }
            },
            no: {
                label: "Reject",
                callback: () => {
                    ui.notifications.warn(`${data.data.effectName} was not approved.`);
                }
            }
        },
        default: "yes"
    }).render(true, { jQuery: true });
}

if (selectedTarget) {
    let effectOptions = itemEffects.map(effect => `<option value="${effect.id}">${effect.name}</option>`).join("");

    let dialog = new Dialog({
        title: "Select an Effect",
        content: `
            <p>Choose an effect to apply to <strong>${selectedTarget.name}</strong>:</p>
            <form>
                <div class="form-group">
                    <label>Effect:</label>
                    <select id="effect-choice">${effectOptions}</select>
                </div>
            </form>
        `,
        buttons: {
            apply: {
                label: "Apply Effect",
                callback: async (html) => {
                    let selectedEffectId = html.find("#effect-choice").val();
                    let selectedEffect = itemEffects.find(e => e.id === selectedEffectId);
                    if (!selectedEffect) {
                        ui.notifications.error("Invalid effect selection.");
                        return;
                    }
                    console.log("Requesting owner approval...");
                    requestOwnerApproval(selectedTarget, selectedEffect);
                }
            },
            cancel: {
                label: "Cancel"
            }
        }
    });
    dialog.render(true);
}