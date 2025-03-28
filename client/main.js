import Game from './game.js'

let game = new Game();

const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    context.scale(dpr, dpr);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let cards = []
let socket = new WebSocket("/websocket");
socket.onopen = e => {
    console.log("opened websocket");
    console.log(e);
    socket.onmessage = m => {
        console.log(m.data);
        let parsed = JSON.parse(m.data);
        switch (parsed.type) {
            case 'init':
                cards = parsed.content.cards;
                game.setCardCount(cards.length);
                for (let i = 0; i < cards.length; ++i) {
                    setTimeout(() => game.dealCard(i, cards[i]), 10 * i);
                }
                break;
            default:
                console.error(`Unknown parsed type: ${parsed.type}`);
                break;
        }
    }
    socket.send("hello!");
};

canvas.addEventListener('mousedown', e => game.onclick(e.clientX, e.clientY));

game.render(context);
let prevTime = Date.now();
setInterval(() => {
    let newTime = Date.now();
    game.update((newTime - prevTime) / 1000);
    prevTime = newTime;
}, 1 / 30 * 1000);