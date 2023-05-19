import {Injectable} from '@nestjs/common';
import {JwtService} from "@nestjs/jwt";

@Injectable()
export class TokensService {
    constructor(private jwtService: JwtService) {
    }

    generateToken(id: string, isHost: boolean = false):string {
        return this.jwtService.sign({id, isHost}, {secret: process.env.SECRET, expiresIn: '24h'});
    }

    verifyToken(token: string):any {
        return this.jwtService.verify(token, {secret: process.env.SECRET});
    }
}
