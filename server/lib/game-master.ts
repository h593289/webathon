import { WebSocket } from 'ws';

export default class GameMaster {
	
	private gameid : string;

	private players : Map<string, Player>
	private gamestate : GameState
	private cards : number[]
	private emptyslotcount : number

	private interval : NodeJS.Timer | null = null;
	private lastupdate : number = 0;
	private roundtimer : number = 0;

	constructor(gameid : string) {
		this.gameid = gameid;
		this.gamestate = GameState.JOINING;
		this.players = new Map();
		this.emptyslotcount = 60;
		this.cards = Array(this.emptyslotcount).fill(0);
		this.fillCards();
	}

	public start() {
		this.interval = setInterval(this.update.bind(this), 1000);
		this.lastupdate = Date.now();
		this.gamestate = GameState.ONGOING;
		this.broadcast({ type: 'game-start', content: { players: Object.keys(this.players) } });
	}

	private update() {
		let now = Date.now();
		let delta = now - this.lastupdate;
		this.lastupdate = now;

		let before = this.roundtimer;
		this.roundtimer += delta;
		if (before < 60000 && this.roundtimer >= 60000) { this.broadcast({ type: 'judge', content: {} }); }
		if (before < 65000 && this.roundtimer >= 65000) {
			let maxScore = Math.max(...Array.from(this.players.values()).map(player => player.getScore(this.gameid)));
			let judgement = Object.keys(this.players).map(playerid => {
				let player = this.players.get(playerid);
				if (player == null) return { playerid, buff: 0 };
				let score = player.getScore(this.gameid);
				let buff = Math.floor((score / maxScore) * 5);
				return { playerid, buff };
			});
			this.broadcast({ type: 'judge-result', content: { judgement } });
		}
		if (this.roundtimer >= 70000) {
			this.roundtimer = 0;
			this.fillCards();
			this.broadcast({ type: 'judgement-over', content: {} });
		}
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
	public onmessage(id : string, message : MessageToServer) {
		switch (message.type) {
			case 'card-select':
				if (this.gamestate != GameState.ONGOING) return;
				if (message.content.index < 0 || message.content.index >= this.cards.length) return;
				if (this.cards[message.content.index] == 0) return;
				this.onSelect(message.content.index, id);
				break;
			default:
				console.log(`Unknown message type "${message.type}" from player "${id}"`);
				return;
		}
	}

	private onSelect(index : number, playerid : string) {
		let player = this.players.get(playerid);
		if (player == null) return;

		player.select(index);

		let selected = player.getSelected();
		let ids = selected.map(i => this.cards[i]);
		let same = ids.every((val, _, arr) => val === arr[0]);
		//let id = ids[0];

		if (!same) {
			let events : CardEvent[] = selected.map(i => ({ index: i, type: 'hide' }));
			this.broadcast({ type: 'card-event', content: events });
			player.clearSelected();
			return;
		}

		if (selected.length == 2) {
			player.addScore(this.gameid, 1);
			player.clearSelected();
			for (let s of selected) { this.cards[s] = 0; }
			this.emptyslotcount += selected.length;
			let events : CardEvent[] = selected.map(i => ({ index: i, type: 'remove' }));
			this.broadcast({ type: 'score-update', content: { playerid, score: player.getScore(this.gameid) } });
			this.broadcast({ type: 'card-event', content: events });
			if (this.emptyslotcount >= 0.5 * this.cards.length) this.fillCards();
			return;
		}

		this.broadcast({ type: 'card-event', content: [{ index, type: 'reveal' }] });
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
			notify.push({ index: i, type: 'place', what: this.cards[i] });
		}
		this.emptyslotcount -= notify.length;
		this.broadcast({ type: 'card-event', content: notify });
	}

}

enum GameState { JOINING, ONGOING }

export class Player {

	private socket : WebSocket;
	private scores : Map<string, number>; // gameid to score
	private selected : Set<number>; // for current game session
	private buffs : Set<Buff>; // for current game session

	constructor(socket : WebSocket) { this.socket = socket; this.scores = new Map(); }

	public wssend(data : MessageToPlayer) { this.socket.send(JSON.stringify(data)); }

	public getScore(gameid : string) : number { return this.scores.get(gameid) ?? 0; }
	public addScore(gameid : string, score : number) {
		let current = this.scores.get(gameid) ?? 0;
		this.scores.set(gameid, current + score);
	}

	public select(index : number) { this.selected.add(index); }
	public deselect(index : number) { this.selected.delete(index); }
	public getSelected() : number[] { return Array.from(this.selected); }
	public clearSelected() { this.selected.clear(); }

	public addBuff(buff : Buff) { this.buffs.add(buff); }
	public removeBuff(buff : Buff) { this.buffs.delete(buff); }
	public clearBuffs() { this.buffs.clear(); }
	public hasBuff(buff : Buff) : boolean { return this.buffs.has(buff); }
}

type Buff = '';

type CardEvent =
	{ index : number, type : 'place', what : number } |
	{ index : number, type : 'reveal' } |
	{ index : number, type : 'hide' } |
	{ index : number, type : 'remove' }

type MessageToPlayer = 
	{ type: 'init', content: { cards: number[], score: number } } |
	{ type: 'card-event', content: CardEvent[] } |
	{ type: 'score-update', content: { playerid: string, score: number } } |
	{ type: 'game-start', content: { players: string[] } } |
	{ type: 'judge', content: {} } |
	{ type: 'judge-result', content: { judgement: { playerid: string, buff: number }[] } } |
	{ type: 'judgement-over', content: {} }

type MessageToServer =
    { type: 'card-select', content: { index: number } }