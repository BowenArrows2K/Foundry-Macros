const onlineUsers = game.users.filter(u => u.active);

async function testFunc(data) {
    console.log("Executing remote function:");
    ui.notifications.info("This dialog came from another client!");
    const remoteUser = game.users.get(data.userId);
    
    new Dialog({
        title: "Remote Dialog",
        content: `<p>This is from the socket! Received user name: ${remoteUser.name}</p>`,
        buttons: { ok: { label: "OK" } }
    }).render(true);
};

new Dialog({
    title: "Send Function via Socket",
    content: `
        <p>Select a player to send the function to:</p>
        <form>
            <select id="player-choice">
                ${onlineUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join("")}
            </select>
        </form>
    `,
    buttons: {
        ok: {
            label: "Send",
            callback: html => {
                const userId = html.find("#player-choice").val();
                UniversalEmit(userId, testFunc);
            }
        }
    }
}).render(true);