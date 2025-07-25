/**
 * Control panel for Twitch Chat Listener
 */

import './index.css';

let PORT: number | undefined;
let url = () => `http://localhost:${PORT}`

const update = async () => {
    document.getElementById("progress").style = "";

    const startButton: HTMLButtonElement = document.getElementById('start') as HTMLButtonElement;
    const stopButton: HTMLButtonElement = document.getElementById('stop') as HTMLButtonElement;

    try {
        const response = await fetch(`${url()}/plugins/active`, {
            method: 'POST',
        });

        if (response.ok) {
            const json = await response.json() as {
                plugins?: {
                    active?: boolean
                }
            };

            const isActive = json.plugins?.active;
            if (isActive !== undefined) {
                startButton.disabled = isActive;
                stopButton.disabled = !isActive;
            }
        }
    } catch (error) {
        console.error(error);
    }

    document.getElementById("progress").style = "visibility: hidden";
    document.getElementById("controls").style = "";
}

document.getElementById('start').addEventListener('click', async () => {
    const response = await fetch(`${url()}/plugins/start`, {
        method: 'POST',
    });
    if (response.ok) {
        setTimeout(async () => {
            await update();
        }, 1000);
    }
});

document.getElementById('stop').addEventListener('click', async () => {
    const response = await fetch(`${url()}/plugins/stop`, {
        method: 'POST',
    });
    if (response.ok) {
        setTimeout(async () => {
            await update();
        }, 1000);
    }
});

window.electron.onPort(async (port) => {
    PORT = port;
    await update();
});
