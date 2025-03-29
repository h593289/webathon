import Game from './game.js'

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

let socket = new WebSocket("/websocket");
socket.onopen = e => {
    console.log("Connected websocket");
    function send(obj) { socket.send(JSON.stringify(obj)); }
    let game = new Game(send);
    socket.onmessage = m => {
        let parsed = JSON.parse(m.data);
        game.onmessage(parsed);
    }
    canvas.addEventListener('mousedown', e => game.onclick(e.clientX, e.clientY));
    game.render(context);
    let prevTime = Date.now();
    setInterval(() => {
        let newTime = Date.now();
        game.update((newTime - prevTime) / 1000);
        prevTime = newTime;
    }, 1 / 30 * 1000);
    send({type:'start-game',content:{}});
};