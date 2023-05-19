import {Body, Controller, HttpException, HttpStatus, Post} from '@nestjs/common';
import {RoomsService} from "./rooms.service";
import {CreateRoomDto} from "./dto/create-room.dto";
import {ConnectToRoomDto} from "./dto/connect-to-room.dto";

@Controller('/rooms')
export class RoomsController {
    constructor(private roomService: RoomsService) {
    }

    @Post('create')
    async createRoom(@Body() dto: CreateRoomDto) {
        try {
            const data = await this.roomService.createRoom({...dto, isHost: true});
            return {event: 'create', data};
        } catch (e) {
            throw new HttpException('Something went wrong', HttpStatus.INTERNAL_SERVER_ERROR)
        }
    }

    @Post('connect')
    async connectToRoom(@Body() dto: ConnectToRoomDto) {
        const result = await this.roomService.connectToRoom(dto.name, dto.code);
        if (result === null) throw new HttpException('There is no such room', HttpStatus.NOT_FOUND);
        if (result === 'conflict') throw new HttpException('There is already such a user', HttpStatus.CONFLICT);
        if (result === 'tooMany') throw new HttpException('Too Many players in room', HttpStatus.CONFLICT);
        if (result === 'tooLate') throw new HttpException('Game already started or ended', HttpStatus.CONFLICT);
        return {event: 'connect', data: result};
    }


}
