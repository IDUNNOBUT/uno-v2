import {Injectable} from '@nestjs/common';
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";
import {User} from "./user.model";
import {createApi} from "unsplash-js";
import {Random} from "unsplash-js/dist/methods/photos/types";

const nodeFetch = require('node-fetch');

@Injectable()
export class UsersService {
    unsplashApi = createApi({
        accessKey: process.env.UNSPLASH_ACCESS_KEY,
        fetch: nodeFetch,
    })

    constructor(@InjectModel('User') private readonly userModel: Model<User>) {
    }

    async createUser(user: { name: string, isHost: boolean }): Promise<string> {
        const imgURL = await this.getImg();
        const newUser = new this.userModel({
            ...user, imgURL
        });
        const result = await newUser.save();
        return result.id;
    }

    async getImg(): Promise<string> {
        return ((await this.unsplashApi.photos.getRandom({
            query: 'abstract',
            orientation: 'squarish'
        })).response as Random).urls.small;
    }
}
