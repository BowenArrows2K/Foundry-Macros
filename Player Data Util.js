let members = game.actors.filter(actor =>
  actor.hasPlayerOwner &&
  actor.type === "character" &&
  !actor.name.toLowerCase().includes("spectator") &&
  !actor.name.toLowerCase().includes("map")
);
console.log(members);