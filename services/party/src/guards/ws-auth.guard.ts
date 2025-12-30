import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { GamerstakeService } from '../services/gamerstake.service';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private gamerstakeService: GamerstakeService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new WsException('No authentication token provided');
    }

    const user = await this.gamerstakeService.validateToken(token);

    if (!user) {
      throw new WsException('Invalid or expired token');
    }

    (client as Socket & { userId?: string; username?: string }).userId = user.id;
    (client as Socket & { userId?: string; username?: string }).username = user.username;

    return true;
  }
}
