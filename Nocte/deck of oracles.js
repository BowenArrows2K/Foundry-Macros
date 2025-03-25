// Deck of Oracles Macro for Foundry VTT (D&D 5e)

// Ensure a token is selected (caster)
if (!canvas.tokens.controlled.length) {
    ui.notifications.warn("Please select a token to draw from the Deck of Oracles.");
    return;
}

let caster = canvas.tokens.controlled[0]; // The user drawing the card
let target = game.user.targets.first(); // The targeted token

// Check if a valid target exists
if (!target) {
    ui.notifications.warn("Please target a token before drawing a card.");
    return;
}

async function handleGMSelection(data) {
    if (!game.user.isGM) return;

    let gmCaster = canvas.tokens.get(data.data.casterTokenId);
    let gmTarget = canvas.tokens.get(data.data.targetTokenId);

    if (!gmCaster || !gmTarget) {
        console.error("Deck of Oracles Error: GM does not have valid caster or target selection.", gmCaster, gmTarget);
        ui.notifications.error("Error: GM must select and target the correct tokens.");
        return;
    }

    new Dialog({
        title: "GM Confirmation - Select & Target First",
        content: `
            <p><strong>GM Instructions:</strong></p>
            <ul>
                <li><strong>Step 1:</strong> Select the correct caster: <strong>${data.data.casterName}</strong></li>
                <li><strong>Step 2:</strong> Target the correct recipient: <strong>${data.data.targetName}</strong></li>
                <li><strong>Step 3:</strong> Click "Draw Cards" to determine effects.</li>
            </ul>
            <p style="color: red;">⚠️ If you do not select and target correctly, the effects will NOT be drawn!</p>
        `,
        buttons: {
            confirm: {
                label: "Draw Cards",
                callback: async () => {
                    let casterActor = gmCaster.actor;
                    let deckItem = casterActor.items.find(i => i.name === "Deck of Oracles");

                    if (!deckItem) {
                        ui.notifications.error("Deck of Oracles not found in selected caster's inventory.");
                        return;
                    }

                    let effects = deckItem.effects.contents;
                    if (effects.length === 0) {
                        ui.notifications.error("No effects found on the Deck of Oracles.");
                        return;
                    }

                    let drawCount = (gmCaster.id === gmTarget.id) ? 1 : 3; 
                    let selectedEffects = [];
                    let availableEffects = [...effects];

                    for (let i = 0; i < drawCount; i++) {
                        let index = Math.floor(Math.random() * availableEffects.length);
                        selectedEffects.push(availableEffects[index]);
                        availableEffects.splice(index, 1);
                    }

                    let drawnCards = selectedEffects.map(effect => ({
                        name: effect.name,
                        img: effect.img || "icons/svg/mystery-man.svg", // Default icon if missing
                        isReversed: Math.random() < 0.5 
                    }));

                    let chatMessageContent = `
                        <div style="background: linear-gradient(to right, #1c1f2e, #15202b); padding: 15px; border-radius: 12px; border: 2px solid #c1a34a; color: white; box-shadow: 0px 0px 15px rgba(193, 163, 74, 0.8);">
                            <h2 style="text-align: center; font-size: 18px; color: #c1a34a;">📜 Deck of Oracles - Fate Revealed 📜</h2>
                            <p style="text-align: center; font-size: 14px; font-style: italic;">The cards have spoken…</p>
                            <hr style="border: 1px solid #c1a34a;">
                            <div style="display: flex; flex-direction: column; gap: 10px;">`;

                    let appliedEffects = [];

                    for (let card of drawnCards) {
                        let orientation = card.isReversed ? "Reversed" : "Upright";
                        let recipient = card.isReversed ? gmCaster.name : gmTarget.name;
                        let imageStyle = card.isReversed ? 'style="transform: rotate(180deg); opacity: 0.9;"' : "";

                        chatMessageContent += `
                            <div style="background: rgba(255, 255, 255, 0.1); padding: 10px; border-radius: 8px; border-left: 4px solid #c1a34a;">
                                <p style="text-align: center; font-size: 16px; color: #c1a34a;"><strong>${card.name} (${orientation})</strong></p>
                                <div style="text-align: center;">
                                    <img src="${card.img}" ${imageStyle} style="max-width: 150px; height: auto; border-radius: 6px;">
                                </div>
                                <p style="text-align: center; font-size: 14px;">Effect applied to: <strong>${recipient}</strong></p>
                            </div>
                        `;

                        let newEffect = duplicate(deckItem.effects.getName(card.name)?.toObject());
                        if (!newEffect) {
                            ui.notifications.error(`Error: Effect "${card.name}" not found.`);
                            return;
                        }

                        newEffect.origin = casterActor.uuid;
                        newEffect.disabled = false;
                        let targetActor = card.isReversed ? gmCaster.actor : gmTarget.actor;
                        appliedEffects.push({ effect: newEffect, targetActor: targetActor });
                    }

                    chatMessageContent += `</div></div>`;

                    for (let effectEntry of appliedEffects) {
                        await effectEntry.targetActor.createEmbeddedDocuments("ActiveEffect", [effectEntry.effect]);
                    }

                    let whisperRecipients = [gmCaster.actor.name, gmTarget.actor.name].map(name => game.users.find(u => u.character?.name === name)?.id).filter(Boolean);

                    ChatMessage.create({
                        content: chatMessageContent,
                        whisper: whisperRecipients.length > 0 ? whisperRecipients : ChatMessage.getWhisperRecipients("GM")
                    });

                    ui.notifications.info("✅ Effects successfully applied.");
                }
            },
            cancel: {
                label: "Cancel",
                callback: () => {
                    ui.notifications.info("Effect application canceled.");
                }
            }
        },
        default: "confirm"
    }).render(true, { jQuery: true });
}


// Function to send request to the GM if a player runs the macro
function requestGMApproval() {
    let gm = game.users.find(u => u.isGM && u.active);
    if (!gm) {
        ui.notifications.error("No active Gamemaster found. Cannot apply effects.");
        return;
    }

    let requestData = {
        casterTokenId: caster.id,
        targetTokenId: target.id,
        casterName: caster.name,
        targetName: target.name,
        requesterId: game.user.id // Track who sent the request
    };

    UniversalEmit(gm.id, handleGMSelection, requestData);
    ui.notifications.info("Request sent to GM for effect application.");
}

// If a GM runs it, they can apply effects immediately
if (game.user.isGM) {
    handleGMSelection({
        data: {
            casterTokenId: caster.id,
            targetTokenId: target.id,
            casterName: caster.name,
            targetName: target.name
        },
    });
} else {
    requestGMApproval(); // Players request GM confirmation
}