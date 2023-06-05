import {forwardRef, Inject, Injectable} from '@nestjs/common';
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";
import {Room} from "../rooms/room.model";
import {Card} from "./card.model";
import {Cron, SchedulerRegistry} from "@nestjs/schedule";
import {MoveDto} from "./dto/move.dto";
import {GamesGateway} from "./games.gateway";
import {subDays} from 'date-fns';
import {User} from "../users/user.model";
import {isArray} from "util";

@Injectable()
export class GamesService {
    constructor(@InjectModel('Room') private readonly roomModel: Model<Room>, @InjectModel('User') private readonly userModel: Model<User>, @InjectModel('Card') private readonly cardModel: Model<Card>, private schedulerRegistry: SchedulerRegistry, @Inject(forwardRef(() => GamesGateway))
    private gamesGateway: GamesGateway) {
    }

    private TIMEOUT = 90;

    @Cron('0 0 12 * * *')
    async deleteOldGames() {
        const rooms = await this.roomModel.find({$or: [{created: {$lte: subDays(new Date(), 2)}}, {status: 'ended'}]}).populate('users.user')
        if (rooms.length) {
            try {
                const roomsIdToDelete = rooms.map(room => room.id);
                const usersIdToDelete = rooms.map(room => room.users.map(user => user.user.id)).flat();
                await this.userModel.deleteMany({_id: {$in: usersIdToDelete}});
                await this.roomModel.deleteMany({_id: {$in: roomsIdToDelete}});
            } catch (e) {
            }
        }
    }

    async getGameState(code: string) {
        const room = await this.roomModel.findOne({code}).populate('users.user').populate('options.discard');
        let {users, status, options: {deck, discard, order, currentUser, chosenColor}} = room;
        return {
            status,
            users: users.map((user: { user, cards }) => ({
                id: user.user.id,
                imgURL: user.user.imgURL,
                isHost: user.user.isHost,
                name: user.user.name,
                cardsCount: user.cards.length
            })),
            deck: deck.length,
            discard: discard.at(-1),
            order,
            currentUser,
            chosenColor
        }

    }

    async getUserState(id: string, code: string) {
        const room = await this.roomModel.findOne({code}).populate('users.user').populate('users.cards');
        return room.users.find((user) => user.user.id === id);
    }

    async initGame(code: string) {
        const room = await this.roomModel.findOne({code}).populate('users.user');
        if (room.status != 'created') {
            return;
        }
        const cards = await this.cardModel.find({});
        const newOrderCards = this.shuffleArray(cards);
        for (let i = 0; i < room.users.length; i++) {
            room.users[i].cards.push(...(newOrderCards.splice(0, 7).map(card => card.id)));
        }
        room.options.discard = [newOrderCards.shift()];
        room.options.deck = [...newOrderCards];
        room.status = 'inProgress';
        room.options.order = 'forward';
        room.options.currentUser = room.users[0].user.id;
        room.options.chosenColor = isArray(room.options.discard.at(-1).color) ? ['red','blue','yellow','green'][Math.floor(Math.random() * 4)] : '';
        await room.save();
        // this.waitForMove(code, room.options.currentUser.toString(), this.TIMEOUT);
    }

    shuffleArray(array: Array<Card>) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    }

    async checkIsCurrentUser(code: string, id: string): Promise<boolean> {
        const room = await this.roomModel.findOne({code}).populate('users.user').populate('users.cards');
        const currentUser = room.options.currentUser.toString();
        return currentUser === id;
    }

    async deleteUser(code: string, id: string) {
        const room = await this.roomModel.findOne({code}).populate('users.user');
        if (room.options.currentUser === id && room.status === 'inProgress') {
            this.shiftMovePart(room, id, 1);
            try {
                this.schedulerRegistry.deleteTimeout(id);
                // this.waitForMove(code, room.options.currentUser.toString(), this.TIMEOUT);
            } catch (e) {
            }
        }
        if (room.status === 'inProgress') {
            const userCards = room.users.find((user) => user.user.id === id).cards;
            room.options.deck = [...room.options.deck, ...userCards];
        }
        room.users = room.users.filter(user => user.user.id !== id);
        await room.save();
        await this.userModel.findByIdAndDelete(id);
    }

    async move(code: string, id: string, dto: MoveDto) {
        try {
            this.schedulerRegistry.deleteTimeout(id);
        } catch (e) {
        }
        let room = await this.roomModel.findOne({code}).populate('users.user');
        if (room.status != 'inProgress') {
            return;
        }
        const {cardId, chosenColor} = dto.data;
        if (room.options.deck.length <= 4) {
            let cardsFromDiscard = room.options.discard.splice(0, room.options.discard.length - 1);
            cardsFromDiscard = this.shuffleArray(cardsFromDiscard);
            room.options.deck = [...room.options.deck, ...cardsFromDiscard];
        }
        if(dto.action !=='takeFromDeck') {
            this.commonMovePart(room, id, cardId);
        }
        const currentUser = room.users.find(user => user.user.id === id);
        if (!currentUser.cards.length) {
            room.status = 'ended';
            await room.save();
            return;
        }
        switch (dto.action) {
            case 'common': {
                room.options.chosenColor = '';
                this.shiftMovePart(room, id, 1);
                break;
            }
            case 'takeFromDeck': {
                await this.takeFromDeckMovePart(room, id, 1);
                this.shiftMovePart(room, id, 1);
                break;
            }
            case 'skip': {
                room.options.chosenColor = '';
                this.shiftMovePart(room, id, 2);
                break;
            }
            case 'reverse': {
                room.options.chosenColor = '';
                room.options.order = room.options.order === 'forward' ? 'reverse' : 'forward';
                this.shiftMovePart(room, id, 1);
                break;
            }
            case 'takeTwo': {
                room.options.chosenColor = '';
                this.shiftMovePart(room, id, 1);
                console.log(room.options.currentUser);
                this.takeFromDeckMovePart(room, room.options.currentUser.toString(), 2);
                break;
            }
            case 'changeColor': {
                this.shiftMovePart(room, id, 1);
                room.options.chosenColor = chosenColor;
                break;
            }
            case 'changeColorTakeFour': {
                this.shiftMovePart(room, id, 1);
                console.log(room.options.currentUser);
                this.takeFromDeckMovePart(room, room.options.currentUser.toString(), 4);
                room.options.chosenColor = chosenColor;
                break;
            }
        }
        await room.save();
        // this.waitForMove(code, room.options.currentUser.toString(), this.TIMEOUT);
    }

    commonMovePart(room, id: string, cardId: string) {
        room.users = room.users.map((user: { user, cards }) => user.user.id === id ?
            {...user, cards: user.cards.filter(card => card.toString() !== cardId)}
            : user);
        room.options.discard = [...room.options.discard, cardId];
    }

    shiftMovePart(room, id: string, shift: number) {
        const index = room.users.findIndex((user) => user.user.id === id);
        const usersCount = room.users.length;
        room.options.currentUser = room.options.order === 'forward' ?
            room.users.at((index + shift) % usersCount).user.id
            : room.users.at(Math.abs((index - shift) % usersCount)).user.id;
    }

    takeFromDeckMovePart(room, id: string, quantity: number) {
        const cardFromDeck = room.options.deck.splice(0, quantity);
        room.users = room.users.map((user: { user, cards }) => user.user.id === id ? {
            ...user,
            cards: [...user.cards, ...cardFromDeck]
        } : user);
    }

    waitForMove(code: string, id: string, time: number) {
        const timeout = setTimeout(async () => {
            let room = await this.roomModel.findOne({code}).populate('users.user');
            try {
                this.schedulerRegistry.deleteTimeout(id);
            } catch (e) {
            }
            this.takeFromDeckMovePart(room, id, 1);
            this.shiftMovePart(room, id, 1);
            await room.save();
            this.waitForMove(code, room.options.currentUser.toString(), this.TIMEOUT);
            await this.gamesGateway.sendGameState(code);
        }, time * 1000);
        this.schedulerRegistry.addTimeout(id, timeout);
    }
}
