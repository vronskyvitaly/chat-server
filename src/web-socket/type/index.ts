export interface SocketEvent {
  emit(event: string, data: any): void
  emitToUser(userId: number, event: string, data: any): void
  broadcast(event: string, data: any): void
}
