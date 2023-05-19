import {Module} from '@nestjs/common';
import {ConfigModule} from "@nestjs/config";
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {MongooseModule} from '@nestjs/mongoose';
import { RoomsModule } from './rooms/rooms.module';
import { GamesModule } from './games/games.module';
import { TokensModule } from './tokens/tokens.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
    imports: [ConfigModule.forRoot(),
        MongooseModule.forRoot(process.env.DB_CONNECT_STRING),
        ScheduleModule.forRoot(),
        RoomsModule,
        GamesModule,
        TokensModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {

}
