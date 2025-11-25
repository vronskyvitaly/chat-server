import { Server, Namespace } from 'socket.io'
import prisma from '../db/prisma'
import cookie from 'cookie'

export let postsNamespace: Namespace | null = null

// ✅ Хранилище онлайн пользователей
interface OnlineUser {
  socketId: string
  userId: number
  connectedAt: Date
  userData?: any
}

const onlineUsers = new Map<number, OnlineUser>()

export function webSocket(io: Server) {
  postsNamespace = io.of('/postsWS')

  postsNamespace.on('connection', async socket => {
    console.log('✅ Client connected to postsWS:', socket.id)

    let userId: number | null = null
    let userData = null

    // ✅ ПОЛУЧАЕМ USER_ID ИЗ COOKIES
    const cookiesHeader = socket.handshake.headers.cookie

    if (cookiesHeader) {
      const parsedCookies = cookie.parse(cookiesHeader)

      if (parsedCookies.userId) {
        userId = parseInt(parsedCookies.userId)
        console.log('👤 User ID from cookie:', userId)

        if (userId) {
          // ✅ ПОЛУЧАЕМ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ИЗ БД
          try {
            userData = await prisma.user.findUnique({
              where: { id: userId },
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                isOnline: true,
                lastSeen: true
              }
            })

            // ✅ ОБНОВЛЯЕМ СТАТУС В БАЗЕ ДАННЫХ
            if (userData) {
              await prisma.user.update({
                where: { id: userId },
                data: {
                  isOnline: true,
                  lastSeen: new Date()
                }
              })
            }
          } catch (error) {
            console.error('❌ Error fetching user data:', error)
          }

          // ✅ ДОБАВЛЯЕМ ПОЛЬЗОВАТЕЛЯ В ОНЛАЙН
          onlineUsers.set(userId, {
            socketId: socket.id,
            userId: userId,
            connectedAt: new Date(),
            userData: userData
          })
          console.log(`🟢 User ${userId} is now online`)

          // ✅ УВЕДОМЛЯЕМ ВСЕХ КЛИЕНТОВ О НОВОМ ОНЛАЙН ПОЛЬЗОВАТЕЛЕ
          if (postsNamespace && userData) {
            postsNamespace.emit('USER_ONLINE', {
              user: {
                id: userData.id,
                name: userData.name,
                email: userData.email,
                avatar: userData.avatar,
                isOnline: true,
                lastSeen: new Date().toISOString()
              },
              socketId: socket.id,
              onlineCount: onlineUsers.size // ✅ Добавляем количество онлайн
            })
            console.log(`📢 Notified all clients about user ${userId} online`)
          }

          // ✅ ОТПРАВЛЯЕМ ТЕКУЩЕМУ КЛИЕНТУ СПИСОК ВСЕХ ОНЛАЙН ПОЛЬЗОВАТЕЛЕЙ
          const onlineUsersList = await getOnlineUsersWithData()
          socket.emit('online_users_list', {
            users: onlineUsersList,
            count: onlineUsersList.length,
            timestamp: new Date().toISOString()
          })
        }
      }
    }

    // ✅ ОТПРАВЛЯЕМ ПОСТЫ КЛИЕНТУ
    try {
      const userAllPosts = await prisma.post.findMany()
      socket.emit('user_posts', {
        posts: userAllPosts,
        count: userAllPosts.length,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('❌ Error fetching posts:', error)
    }

    // // ✅ ОБРАБОТЧИК ДЛЯ ПОЛУЧЕНИЯ СПИСКА ОНЛАЙН ПОЛЬЗОВАТЕЛЕЙ
    // socket.on('get_online_users', async () => {
    //   try {
    //     const onlineUsersList = await getOnlineUsersWithData()
    //     socket.emit('online_users_list', {
    //       users: onlineUsersList,
    //       count: onlineUsersList.length,
    //       timestamp: new Date().toISOString()
    //     })
    //   } catch (error) {
    //     console.error('❌ Error fetching online users:', error)
    //   }
    // })

    // // ✅ ОБРАБОТЧИК ДЛЯ ПРОВЕРКИ КОНКРЕТНОГО ПОЛЬЗОВАТЕЛЯ
    // socket.on('check_user_online', (data: { userId: number }) => {
    //   const isOnline = onlineUsers.has(data.userId)
    //   const onlineUser = onlineUsers.get(data.userId)
    //
    //   socket.emit('user_online_status', {
    //     userId: data.userId,
    //     isOnline: isOnline,
    //     onlineSince: isOnline ? onlineUser?.connectedAt : null,
    //     socketId: isOnline ? onlineUser?.socketId : null
    //   })
    // })

    // ✅ ОБРАБОТЧИК ОТКЛЮЧЕНИЯ
    socket.on('disconnect', async reason => {
      console.log('❌ Client disconnected from postsWS:', socket.id, 'Reason:', reason)

      if (userId) {
        // ✅ УДАЛЯЕМ ПОЛЬЗОВАТЕЛЯ ИЗ ОНЛАЙН
        onlineUsers.delete(userId)
        console.log(`🔴 User ${userId} is now offline`)

        // ✅ УВЕДОМЛЯЕМ ВСЕХ КЛИЕНТОВ О ТОМ, ЧТО ПОЛЬЗОВАТЕЛЬ ОФФЛАЙН
        if (postsNamespace) {
          postsNamespace.emit('USER_OFFLINE', {
            user: userData,
            socketId: socket.id,
            onlineCount: onlineUsers.size // ✅ Добавляем обновленное количество
          })
          // ✅ УВЕДОМЛЯЕМ В КОНСОЛЬ Ч
          console.log(`📢 Notified all clients about user ${userId} offline`)
        }

        // ✅ ОБНОВЛЯЕМ СТАТУС В БАЗЕ ДАННЫХ
        try {
          await prisma.user.update({
            where: { id: userId },
            data: {
              isOnline: false,
              lastSeen: new Date()
            }
          })
        } catch (error) {
          console.error('❌ Error updating user status:', error)
        }
      }
    })

    socket.on('error', error => {
      console.error('🚨 postsWS Socket error:', socket.id, error)
    })
  })

  console.log('✅ Posts WebSocket namespace /postsWS initialized')
}

// ✅ Функция для получения онлайн пользователей с данными из БД
export async function getOnlineUsersWithData() {
  const onlineUsersList = Array.from(onlineUsers.values())

  if (onlineUsersList.length === 0) {
    return []
  }

  try {
    const userIds = onlineUsersList.map(user => user.userId)
    const usersData = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        isOnline: true,
        lastSeen: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return onlineUsersList
      .map(onlineUser => {
        const userData = usersData.find(user => user.id === onlineUser.userId)
        if (!userData) return null

        return {
          ...userData,
          socketId: onlineUser.socketId,
          // connectedAt: onlineUser.connectedAt,
          isOnline: true
        }
      })
      .filter(user => user !== null)
  } catch (error) {
    console.error('❌ Error fetching online users data:', error)
    return []
  }
}

// // ✅ Экспортируем функции для API
// export function getOnlineUsersCount(): number {
//   return onlineUsers.size
// }
//
// export function isUserOnline(userId: number): boolean {
//   return onlineUsers.has(userId)
// }
//
// export function getOnlineUsers(): Array<{ userId: number; socketId: string; connectedAt: Date }> {
//   return Array.from(onlineUsers.values()).map(user => ({
//     userId: user.userId,
//     socketId: user.socketId,
//     connectedAt: user.connectedAt
//   }))
// }
