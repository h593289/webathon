import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

import GameMaster, { Player } from './game-master'

const __rootname = path.join(__dirname, '..');

const port = 8080;

const game = new GameMaster("Neurally Deficient Dimension");

const app = express();
app.use(express.static(path.join(__rootname, './../client')));
app.get('/', (_, res) => res.sendFile(path.join(__rootname, './../client/index.html')));

const wss = new WebSocketServer({ noServer: true });
wss.on('connection', (ws) => {
	let id = uuidv4();
	console.log(`Connection from ${id}`);

	const player = new Player(ws);
	let joined = game.join(id, player);
	if (!joined) { console.log(`Player ${id} failed to join game and is getting kicked from the server`); ws.close(); return; }

	ws.on('message', message => { try { game.onmessage(id, JSON.parse(message.toString())); } catch (e) { console.error(e); } });
	ws.on('close', () => { game.leave(id); console.log(`Disconnect from ${id}`); });
});

const server = createServer();
server.on('request', app);
server.on('upgrade', (request, socket, head) => wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request)));
server.listen(port, () => console.log(`Server is running at http://localhost:${port}`));