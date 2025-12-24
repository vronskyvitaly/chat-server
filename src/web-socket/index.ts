import { Server } from 'socket.io'
import { UserService } from './services/user-service'
import { NotificationService } from './services/notification-service'
import { AuthService } from './services/auth-service'

let instance: WSService | null = null

export class WSService {
  private userService: UserService
  private notificationService: NotificationService

  constructor(private io: Server) {
    this.userService = new UserService(io)
    this.notificationService = new NotificationService(io)

    this.setupConnectionHandler()
  }

  private setupConnectionHandler() {
    const nsp = this.io.of('/WS')

    nsp.on('connection', async socket => {
      console.log('✅ Client connected:', socket.id)

      // Логирование ошибок сокета
      socket.on('error', (err: any) => {
        console.error(`⚠️ Socket ${socket.id} error:`, err)
      })

      // Глобальные ошибки на уровне клиента/сервера socket.io
      this.io.on('error', err => {
        console.error('⚠️ Socket.IO error:', err)
      })

      const user = await AuthService.getUserFromSocket(socket)
      if (!user) {
        socket.disconnect(true)
        return
      }

      // ✅ Помечаем как онлайн
      await this.userService.onUserConnected(socket.id, user.id)

      // ✅ Ловим отключение
      socket.on('disconnect', async () => {
        console.log('ssssss')
        console.log(`🔌 Socket ${socket.id} disconnected`)
        await this.userService.onUserDisconnected(user.id)
      })
    })
  }

  getOnlineUserService() {
    return this.userService
  }

  getNotificationService() {
    return this.notificationService
  }

  // Singleton (опционально)
  static getInstance(io?: Server): WSService {
    if (!instance && io) {
      instance = new WSService(io)
    }
    return instance!
  }
}
