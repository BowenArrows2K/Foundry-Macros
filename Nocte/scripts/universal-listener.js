Hooks.once("init", () => {
    console.log("Universal Listener module init");

    // Define and expose globally
    globalThis.UniversalEmit = function(userId, func, data) {
        let SocketData = {
            type: "universal-listener-eval",
            userId,
            code: func.toString(),
            data
        };
        console.log("Sending message to socket:", SocketData);
        game.socket.emit("module.somnos-custom-bundle", SocketData);
    };
});


Hooks.once("ready", () => {
    console.log("📡 Universal listener registered.");
    game.socket.on("module.somnos-custom-bundle", async (data) => {
        console.log(`Received message from socket: ${data}`);

        const isTarget = game.user.id === data.userId;
        if (!isTarget) {
            console.log("Not targeting this user, ignoring.");
            return;
        }

        if (data.type === "universal-listener-eval") {
            console.log("Executing remote function:", data.code);
            try {
                const fn = eval(`(${data.code})`);
                fn(data);
            } catch (err) {
                console.error("Error executing remote function:", err);
            }
        }
    });
});

