import { WebSocket } from 'ws';

export default class GameMaster {
	
	private gameid : string;

	private players : Map<string, Player>
	private gamestate : GameState
	private cards : number[]

	constructor(gameid : string) {
		this.gameid = gameid;
		this.gamestate = GameState.JOINING;
		this.players = new Map();
		this.cards = Array(60).fill(0);
		this.fillCards();
	}

	// Player with id joins
	public join(id : string, player : Player) : boolean {
		if (this.gamestate != GameState.JOINING) return false;
		if (this.players.get(id) != null) this.leave(id);
		this.players.set(id, player);
		console.log(`Player "${id}" joined game "${this.gameid}"... now has ${this.players.size} players`);
		player.wssend({ type: 'init', content: { cards: this.cards, score: player.getScore(this.gameid) }});
		return true;
	}

	// Player with id leaves
	public leave(id : string) {
		this.players.delete(id);
		console.log(`Player "${id}" left game "${this.gameid}"... now has ${this.players.size} players`);
	}

	// Message from player with id
	public onmessage(id : string, message : string) {
		console.log("message", id, message);
	}

	// Broadcast a message to all players
	private broadcast(message : MessageToPlayer) {
		this.players.forEach(player => player.wssend(message));
	}

	private fillCards() {
		let notify : CardEvent[] = [];
		for (let i = 0; i < this.cards.length; ++i) {
			if (this.cards[i] != 0) continue;
			this.cards[i] = Math.ceil(Math.random() * 9);
			notify.push({ index: i, type: 'place', what: this.cards[i] })
		}
		this.broadcast({ type: 'card-event', content: notify });
	}

}

type CardEvent = { index : number, type : 'place', what : number }
enum GameState { JOINING, ONGOING }

export class Player {

	private socket : WebSocket;
	private scores : Map<string, number>; // gameid to score

	constructor(socket : WebSocket) { this.socket = socket; this.scores = new Map(); }

	public wssend(data : MessageToPlayer) { this.socket.send(JSON.stringify(data)); }

	public getScore(gameid : string) : number { return this.scores.get(gameid) ?? 0; }
}

type MessageToPlayer = 
	{ type: 'init', content: { cards: number[], score: number } } |
	{ type: 'card-event', content: CardEvent[] }