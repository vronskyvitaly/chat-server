import cookie from 'cookie'
import prisma from '../../../db/prisma'

export class AuthService {
  static async getUserFromSocket(socket: any) {
    console.log('🔐 Getting user from socket')
    const cookiesHeader = socket.handshake.headers.cookie
    console.log('cookiesHeader ', cookiesHeader)
    if (!cookiesHeader) return null

    const parsedCookies = cookie.parse(cookiesHeader)
    const userId = parsedCookies.userId ? parseInt(parsedCookies.userId, 10) : null
    if (!userId) return null

    try {
      return await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, avatar: true }
      })
    } catch (error) {
      console.error(
        '❌ Error fetching user src/web-socket/services/auth-service/index.ts [getUserFromSocket]:',
        error
      )
      return null
    }
  }
}
