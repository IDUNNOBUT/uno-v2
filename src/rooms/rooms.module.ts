import {Module} from '@nestjs/common';
import {RoomsController} from './rooms.controller';
import {RoomsService} from './rooms.service';
import {MongooseModule} from "@nestjs/mongoose";
import {RoomSchema} from "./room.model";
import {UsersModule} from "../users/users.module";
import {TokensModule} from "../tokens/tokens.module";

@Module({
    imports: [MongooseModule.forFeature([{name: 'Room', schema: RoomSchema}]), UsersModule, TokensModule],
    controllers: [RoomsController],
    providers: [RoomsService],
    exports: [RoomsService]
})
export class RoomsModule {
}
