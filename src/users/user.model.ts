import * as mongoose from "mongoose";

export const UserSchema = new mongoose.Schema({
    name: String,
    imgURL: String,
    isHost: Boolean,
});

export interface User {
    id: string,
    name: string,
    imgURL: string,
    isHost: boolean
}