import { Namespace } from 'socket.io'
import { SocketEvent } from '../../type'

export class NotificationService implements SocketEvent {
  constructor(private nsp: Namespace) {}

  notify<T extends string, D>(action: T, data: D) {
    this.broadcast(action, data)
  }

  // Интерфейс
  emit(event: string, data: any) {
    this.nsp.emit(event, data)
  }

  emitToUser(userId: number, event: string, data: any) {
    const socketId = this.getSocketIdByUser(userId)
    if (socketId) {
      this.nsp.sockets.get(socketId)?.emit(event, data)
    }
  }

  broadcast(event: string, data: any) {
    this.nsp.emit(event, data)
  }

  // Заглушка — в реальности будет инжектироваться OnlineUserService
  getSocketIdByUser(userId: number): string | undefined {
    return undefined
  }
}
