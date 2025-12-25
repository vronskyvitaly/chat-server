import prisma from '../../../db/prisma'
import { wsService } from '../../../app'

interface IUser {
  socketId: string
  userId: number
  connectedAt: Date
}

export class UserService {
  private onlineUsers = new Map<number, IUser>()

  constructor() {}

  public async onUserConnected(socketId: string, userId: number) {
    console.log('onUserConnected socketId', socketId)
    console.log('onUserConnected userId', userId)
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: true, lastSeen: new Date() }
      })

      this.onlineUsers.set(userId, { socketId, userId, connectedAt: new Date() })

      wsService.getNotificationService().notify('USER_ONLINE', {
        user: await this.getUserData(userId),
        onlineCount: this.onlineUsers.size
      })

      console.log(`🟢 User ${userId} went online`)
    } catch (e) {
      console.error(
        'Error updating user status [src/web-socket/services/user-service/index.ts onUserConnected]',
        e
      )
    }
  }

  public async onUserDisconnected(userId: number) {
    if (!this.onlineUsers.has(userId)) return

    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { isOnline: false, lastSeen: new Date() },
        omit: { password: true }
      })

      this.onlineUsers.delete(userId)

      wsService.getNotificationService().notify('USER_OFFLINE', {
        user,
        onlineCount: this.onlineUsers.size
      })

      console.log(`🔴 User ${userId} went offline`)
    } catch (e) {
      console.log(
        'Error updating user status [src/web-socket/services/user-service/index.ts onUserDisconnected]',
        e
      )
    }
  }

  public async getUserData(userId: number) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, avatar: true, isOnline: true, lastSeen: true }
      })

      console.log('getUserData', user)

      return user
    } catch (e) {
      console.log('Error getting user data [src/web-socket/services/user-service/index.ts getUserData]', e)
      return null
    }
  }

  // Вспомогательные
  isUserOnline(userId: number): boolean {
    return this.onlineUsers.has(userId)
  }

  getSocketIdByUser(userId: number): string | undefined {
    return this.onlineUsers.get(userId)?.socketId
  }

  getOnlineUserIds(): number[] {
    return Array.from(this.onlineUsers.keys())
  }
}
