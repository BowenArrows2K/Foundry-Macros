Hooks.once("ready", () => {
    console.log("📡 Custom socket listener registered.");

    game.socket.on("system.dnd5e", async (data) => {
        if (data.type === "custom-event-type") {
            console.log("📡 Received custom-event-type", data);
            // Add your handling logic here
        }
    });
});

