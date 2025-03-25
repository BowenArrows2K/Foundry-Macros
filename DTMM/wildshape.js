const folderName = "[Extras] Aeris Moonshadow";
const folder = game.actors.contents.find(f => f.folder?.name === folderName);
if (!folder) return ui.notifications.error(`Folder '${folderName}' not found.`);

const wildShapes = game.actors.contents.filter(a => a.folder?.name === folderName);
const [token] = canvas.tokens.controlled;
const actor = token?.actor;
if (!token || !actor) return ui.notifications.warn("Please select your Druid's token before using Wild Shape.");

const flagScope = "dnd5e";
const wildshapeDataKey = "wildshapeOriginalData";
const wildshapeData = await actor.getFlag(flagScope, wildshapeDataKey);

if (wildshapeData) {
  const { image, name, abilities, hp, saves, skills, senses, rotation } = wildshapeData;
  if (!image || !name || !abilities || !hp || !saves || !skills || !senses || rotation === undefined)
    return ui.notifications.error("Original form data is missing!");

  const addedItems = actor.items.filter(i => i.getFlag(flagScope, "wildshapeTemp"));
  await Promise.all(addedItems.map(i => i.delete()));

  const proficiencyUpdates = {
    ...Object.fromEntries(Object.entries(saves).map(([k, v]) => [`system.abilities.${k}.proficient`, v])),
    ...Object.fromEntries(Object.entries(skills).map(([k, v]) => [`system.skills.${k}.value`, v]))
  };

  await actor.update({
    "flags.dnd5e.polymorph": null,
    "system.abilities.str.value": abilities.str,
    "system.abilities.dex.value": abilities.dex,
    "system.abilities.con.value": abilities.con,
    "system.attributes.hp.value": hp.value,
    "system.attributes.hp.max": hp.max,
    "system.attributes.senses": senses,
    ...proficiencyUpdates
  });

  await token.document.update({
    "texture.src": image,
    "name": name,
    "width": 1,
    "height": 1,
    "rotation": rotation
  });

  await actor.unsetFlag(flagScope, wildshapeDataKey);
  ui.notifications.info("Reverted to original form.");

} else {
  const saves = Object.fromEntries(Object.entries(actor.system.abilities).map(([k, v]) => [k, v.proficient]));
  const skills = Object.fromEntries(Object.entries(actor.system.skills).map(([k, v]) => [k, v.value]));

  const wildshapeData = {
    image: token.document.texture.src,
    name: token.document.name,
    abilities: {
      str: actor.system.abilities.str.value,
      dex: actor.system.abilities.dex.value,
      con: actor.system.abilities.con.value
    },
    hp: {
      value: actor.system.attributes.hp.value,
      max: actor.system.attributes.hp.max
    },
    saves,
    skills,
    senses: duplicate(actor.system.attributes.senses),
    rotation: token.document.rotation
  };

  const options = wildShapes.map(a => `<option value="${a.id}">${a.name}</option>`).join("");

  new Dialog({
    title: "Wild Shape Selection",
    content: `<p>Select a Wild Shape form:</p><select id="wildshape-select">${options}</select>`,
    buttons: {
      transform: {
        label: "Transform",
        callback: async (html) => {
          const selectedId = html.find("#wildshape-select").val();
          const wildShapeActor = game.actors.get(selectedId);
          if (!wildShapeActor) return ui.notifications.error("Wild Shape form not found!");

          await actor.setFlag(flagScope, wildshapeDataKey, wildshapeData);

          const abilities = wildShapeActor.system.abilities;
          const skills = wildShapeActor.system.skills;
          const senses = wildShapeActor.system.attributes.senses;
          const hp = wildShapeActor.system.attributes.hp;
          const proto = wildShapeActor.prototypeToken;

          const features = wildShapeActor.items.filter(i => ["feat", "weapon"].includes(i.type));
          await Promise.all(features.map(i => {
            const copy = duplicate(i);
            copy.flags = { [flagScope]: { wildshapeTemp: true } };
            return actor.createEmbeddedDocuments("Item", [copy]);
          }));

          const proficiencyUpdates = {
            ...Object.fromEntries(Object.entries(abilities).map(([k, v]) => [`system.abilities.${k}.proficient`, Math.max(actor.system.abilities[k].proficient, v.proficient)])),
            ...Object.fromEntries(Object.entries(skills).map(([k, v]) => [`system.skills.${k}.value`, Math.max(actor.system.skills[k]?.value ?? 0, v.value)]))
          };

          await Promise.all([
            actor.update({
              "flags.dnd5e.polymorph": wildShapeActor.id,
              "system.abilities.str.value": abilities.str.value,
              "system.abilities.dex.value": abilities.dex.value,
              "system.abilities.con.value": abilities.con.value,
              "system.attributes.hp.value": hp.value,
              "system.attributes.hp.max": hp.max,
              "system.attributes.senses": duplicate(senses),
              ...proficiencyUpdates
            }),
            token.document.update({
              "texture.src": proto.texture.src,
              "name": `${wildShapeActor.name} (${token.document.name})`,
              "width": proto.width,
              "height": proto.height
            })
          ]);

          ui.notifications.info(`Transformed into ${wildShapeActor.name}!`);
        }
      },
      cancel: { label: "Cancel" }
    }
  }).render(true);
}
