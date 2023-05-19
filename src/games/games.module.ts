import {Module} from '@nestjs/common';
import { GamesGateway } from './games.gateway';
import {RoomsModule} from "../rooms/rooms.module";
import { GamesService } from './games.service';
import {MongooseModule} from "@nestjs/mongoose";
import {RoomSchema} from "../rooms/room.model";
import {CardSchema} from "./card.model";
import {TokensModule} from "../tokens/tokens.module";
import {UserSchema} from "../users/user.model";

@Module({
  imports:[MongooseModule.forFeature([{name: 'Room',schema: RoomSchema},{name:'Card',schema:CardSchema},{name: 'User',schema: UserSchema}]),RoomsModule, TokensModule],
  providers: [GamesGateway, GamesService],
})
export class GamesModule {

}
