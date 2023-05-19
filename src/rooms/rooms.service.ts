import {Injectable} from '@nestjs/common';
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";
import {Room} from "./room.model";
import {UsersService} from "../users/users.service";
import {nanoid} from 'nanoid';
import {TokensService} from "../tokens/tokens.service";
import {subDays, toDate} from "date-fns";

@Injectable()
export class RoomsService {
    constructor(@InjectModel('Room') private readonly roomModel: Model<Room>,
                private userService: UsersService,
                private tokenService: TokensService) {
    }

    async findRoom(code: string) {
        return this.roomModel.findOne({code});
    }

    async createRoom(user: { name: string, isHost: boolean }) {
        const hostId = await this.userService.createUser(user);
        const newRoom = new this.roomModel({
            code: nanoid(6),
            users: [{user: hostId}],
            status: 'created',
            options: {order: '', chosenColor: ''},
            created: toDate(new Date())
        })
        const result = await newRoom.save();
        return {code: result.code, token: this.tokenService.generateToken(hostId, user.isHost)};
    }

    async connectToRoom(name: string, code: string) {
        const room = await (await this.findRoom(code)).populate('users.user', "name");
        if (!room) {
            return null;
        }
        if (room.users.some((user: { user: { name: string } }) => user.user.name === name)) {
            return 'conflict';
        }
        if (room.users.length > 10) {
            return 'tooMany';
        }
        if (room.status !== 'created') {
            return 'tooLate';
        }
        const userId = await this.userService.createUser({name, isHost: false});
        room.users.push({user: userId});
        room.save();
        return {token: this.tokenService.generateToken(userId)}
    }

    async getUsers(code: string) {
        return (await (await this.findRoom(code)).populate('users.user')).users;
    }
}
