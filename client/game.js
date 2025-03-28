const CARDS_PER_ROW = 10;
const CARD_WIDTH = 64;
const CARD_HEIGHT = 64;
const CARD_PADDING = 16;
const BOARD_PADDING = 10;

export default class Game {

	constructor() { this.setCardCount(1); }

	setCardCount(cardCount) {
		this.cards = Array(cardCount).fill(0);
		this.cardsMetadata = [];
		this.accumdt = 0;

		for (let i = 0; i < cardCount; ++i) {
			this.cardsMetadata[i] = {};
			let x = (i % CARDS_PER_ROW) * (CARD_WIDTH + CARD_PADDING) + BOARD_PADDING;
			let y = Math.floor(i / CARDS_PER_ROW) * (CARD_HEIGHT + CARD_PADDING) + BOARD_PADDING;
			let rot = 0;
			this.cardsMetadata[i].animation = { frame: 0, maxFrame: 1e308, type: 'idle', x, y, rot };
		}
	}

	// deal a new card
	dealCard(index, value) {
		this.cards[index] = value;

		let px = (index % CARDS_PER_ROW) * (CARD_WIDTH + CARD_PADDING) + BOARD_PADDING;
		let py = (Math.floor(index / CARDS_PER_ROW)) * (CARD_HEIGHT + CARD_PADDING) + BOARD_PADDING;
		let rot = Math.random() * Math.PI / 8 - Math.PI / 16;
		let animation = { frame: 0, maxFrame: 20, type: 'position_interpolate', fromX: -100, fromY: -100, fromRot: 0, toX: px, toY: py, toRot: rot };
		this.cardsMetadata[index].animation = animation;
	}

	onclick(x, y) {
		x -= BOARD_PADDING;
		y -= BOARD_PADDING;
		x /= (CARD_WIDTH + CARD_PADDING);
		y /= (CARD_HEIGHT + CARD_PADDING);
		if ((x % 1) * (CARD_WIDTH + CARD_PADDING) > CARD_WIDTH) return;
		if ((y % 1) * (CARD_HEIGHT + CARD_PADDING) > CARD_HEIGHT) return;
		x = Math.floor(x);
		y = Math.floor(y);
		if (x >= CARDS_PER_ROW) return;
		if (y >= (this.cards.length / CARDS_PER_ROW)) return;
		let i = x + y * CARDS_PER_ROW;
		if (i >= this.cardsMetadata.length) return;
		this.cardsMetadata[i].animation.color = 'green';
	}

	update(dt) {
		let tickrate = 1 / 60;
		this.accumdt += dt;
		let ticks = Math.floor(this.accumdt / tickrate);
		this.accumdt -= ticks * tickrate;

		for (let i = 0; i < this.cardsMetadata.length; ++i) {
			let animation = this.cardsMetadata[i].animation;
			animation.frame += ticks;
			if (animation.frame >= animation.maxFrame) {
				let x = 0, y = 0, rot = 0;
				switch (animation.type) {
					case 'position_interpolate':
						x = animation.toX; y = animation.toY; rot = animation.toRot;
						break;
					case 'idle':
						x = animation.x; y = animation.y; rot = animation.rot;
						break;
					default:
						console.error(`update - unknown animation type: ${animation.type}`);
				}
				animation.frame = Math.min(animation.frame, animation.maxFrame);
				this.cardsMetadata[i].animation = { frame: 0, maxFrame: 1e308, type: 'idle', x, y, rot };
			}
		}
	}

	render(ctx) {
		let width = window.innerWidth, height = window.innerHeight;
		ctx.fillStyle = '#202028';
		ctx.fillRect(0, 0, width, height);
	
		this._renderCards(ctx);
		
		window.requestAnimationFrame(this.render.bind(this, ctx));
	}

	_renderCards(ctx) {
		ctx.font = '30px Arial';
		for (let i = 0; i < this.cards.length; ++i) {
			let card = this.cards[i];
			let metadata = this.cardsMetadata[i];
			if (card == 0) continue;

			let animation = metadata.animation;

			ctx.save();
			let x = 0, y = 0, rot = 0;
			switch (animation.type) {
				case 'position_interpolate':
					let normalized = animation.frame / animation.maxFrame;
					x = normalized * animation.toX + (1 - normalized) * animation.fromX;
					y = normalized * animation.toY + (1 - normalized) * animation.fromY;
					rot = normalized * animation.toRot + (1 - normalized) * animation.fromRot;
					break;
				case 'idle':
					x = animation.x; y = animation.y; rot = animation.rot;
					break;
				default:
					console.error(`Unknown card animation type: ${animation.type}`);
					break;
			}
			ctx.translate(CARD_WIDTH / 2, CARD_HEIGHT / 2);
			ctx.translate(x, y);
			ctx.rotate(rot);

			ctx.fillStyle = 'red';
			if (animation.color != null) ctx.fillStyle = animation.color;
			ctx.fillRect(-CARD_WIDTH/2, -CARD_HEIGHT/2, CARD_WIDTH, CARD_HEIGHT);
			ctx.fillStyle = 'white';
			let metrics = ctx.measureText(card);
			let tw = metrics.width, th = metrics.actualBoundingBoxAscent;
			ctx.fillText(card, -tw/2, th/2);
			ctx.restore();
		}
	}

	onmessage(msg) {
		console.log("message from server", msg);
	}

}