const item = game.items.getName("Thorbek's Alebound Staff");
console.log(item)
if (item) {
    let activity = item.system.activities.getName("Attack")
    console.log(activity)
    game.actor
}