import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import {Server, Socket} from 'socket.io';
import {RoomsService} from "../rooms/rooms.service";
import {GamesService} from "./games.service";
import {TokensService} from "../tokens/tokens.service";
import {MoveDto} from "./dto/move.dto"
import {forwardRef, Inject} from "@nestjs/common";
import {DeleteUserDto} from "./dto/delete-user.dto";

@WebSocketGateway({
    cors: {
        origin: '*',
    }
})
export class GamesGateway implements OnGatewayConnection {
    constructor(private readonly roomsService: RoomsService, @Inject(forwardRef(() => GamesService))
    private gameService: GamesService, private readonly tokenService: TokensService) {
    }

    @WebSocketServer()
    server: Server;

    async sendGameState(code: string) {
        const state = await this.gameService.getGameState(code as string)
        this.server.in(code).emit('game.state', {event: 'game.state.all', data: {state}});
        for (const socket of this.server.sockets.adapter.rooms.get(code as string)) {
            const client = this.server.sockets.sockets.get(socket);
            const {code, token} = client.handshake.query;
            const {id} = this.tokenService.verifyToken(token as string);
            client.emit('game.state', {
                event: 'game.state.user',
                data: {state: await this.gameService.getUserState(id, code as string)}
            });
        }
    }

    @SubscribeMessage('initGame')
    async initGame(@MessageBody() data: {},
                   @ConnectedSocket() client: Socket) {
        const {code, token} = client.handshake.query;
        try {
            const {isHost} = this.tokenService.verifyToken(token as string);
            if (!isHost) {
                this.sendError(client, 'U not a host');
                return;
            }
            await this.gameService.initGame(code as string);
            await this.sendGameState(code as string);
        } catch (e) {
            this.sendError(client, 'Invalid token');
            return;
        }
    }

    @SubscribeMessage('move')
    async move(@MessageBody() data: MoveDto,
               @ConnectedSocket() client: Socket) {
        const {code, token} = client.handshake.query;
        try {
            const {id} = this.tokenService.verifyToken(token as string);
            if (!(await this.gameService.checkIsCurrentUser(code as string, id))) {
                this.sendError(client, 'Not current user');
                return;
            }
            await this.gameService.move(code as string, id, data);
            await this.sendGameState(code as string);
        } catch (e) {
            this.sendError(client, 'Invalid token');
            return;
        }
    }

    @SubscribeMessage('deleteUser')
    async deleteUser(@MessageBody() data: DeleteUserDto,
                     @ConnectedSocket() client: Socket) {
        const {code, token} = client.handshake.query;
        try {
            const {isHost} = this.tokenService.verifyToken(token as string);
            if (!isHost) {
                this.sendError(client, 'U not a host');
                return;
            }
            const {userId} = data;
            await this.gameService.deleteUser(code as string, userId);
            await this.sendGameState(code as string);
        } catch (e) {
            this.sendError(client, 'Invalid token');
            return;
        }
    }

    async handleConnection(client: Socket, ...args: any[]) {
        const {code, token} = client.handshake.query;
        if (!(await this.roomsService.findRoom(code as string))) {
            this.sendError(client, 'There is no such room');
            client.conn.close();
            return;
        }
        try {
            const {id} = this.tokenService.verifyToken(token as string);
            const users = (await this.roomsService.getUsers(code as string)).map(user => user.user);
            const [newUser] = users.filter(user => user.id === id);
            if (!newUser) {
                this.sendError(client, 'There is no such user');
                client.conn.close();
                return;
            }
            client.join(code);
            this.server.in(code).emit('room.players', {event: 'room.newConnection', data: {users, newUser}});
            await this.sendGameState(code as string);
        } catch (e) {
            this.sendError(client, 'Invalid token');
            client.conn.close();
        }
    }

    sendError(client: Socket, error: string) {
        client.emit('error', {data: {message: error}})
    }
}
