// Macro: Log Targeted Actor Info to Console

// Get the first targeted token from the user's targets
const target = Array.from(game.user.targets)[0];

if (!target) {
  ui.notifications.warn("Please target a token first.");
  return;
}

// Log actor information to the console
console.log("Targeted Token:", target);
console.log("Targeted Actor:", target.actor);
console.log("Actor Data (system):", target.actor.system);