import * as mongoose from "mongoose";
import {Schema} from "mongoose";

export const CardSchema = new mongoose.Schema({
    type: String,
    value: String,
    color: Schema.Types.Mixed
});

export interface Card {
    id: string,
    type: string,
    value: string,
    color: string | []
};