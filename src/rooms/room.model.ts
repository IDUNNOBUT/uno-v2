import * as mongoose from "mongoose";
import {Schema} from "mongoose";


export const UserSubSchema = new mongoose.Schema({
    user: {type: Schema.Types.ObjectId, ref: 'User'},
    cards: [{type: Schema.Types.ObjectId, ref: 'Card'}],
}, {_id: false});

export const OptionsSubSchema = new mongoose.Schema({
    order: String,
    currentUser: {type: Schema.Types.ObjectId, ref: 'User'},
    deck: [{type: Schema.Types.ObjectId, ref: 'Card'}],
    discard: [{type: Schema.Types.ObjectId, ref: 'Card'}],
    chosenColor: String,
}, {_id: false});

export const RoomSchema = new mongoose.Schema({
    code: String,
    status: String,
    users: [UserSubSchema],
    options: OptionsSubSchema,
    created: Date
});


export interface Room {
    id: string,
    code: string,
    status: string,
    users?: any[],
    options: {
        order: string,
        currentUser?: string,
        deck: any[],
        discard: any[],
        chosenColor?: string,
    },
    created: Date,
}