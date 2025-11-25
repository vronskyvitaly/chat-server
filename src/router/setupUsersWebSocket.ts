import WebSocket from 'ws'
import express from 'express'
import expressWs from 'express-ws'
import prisma from '../db/prisma'
import cookie from 'cookie'

type UserMessageData = {
  type:
    | 'user_created'
    | 'user_updated'
    | 'user_deleted'
    | 'fetch_users'
    | 'connect'
    | 'send_message'
    | 'get_all_user_posts'
  userId?: string
  userData?: any
  messageData?: {
    content: string
    receiverId: string | number
    senderId: string | number
  }
}

type BroadcastUserMessage = {
  type:
    | 'user_created'
    | 'user_updated'
    | 'user_deleted'
    | 'users_list'
    | 'user_online'
    | 'user_offline'
    | 'connect'
    | 'error'
    | 'new_message'
    | 'message_delivered'
  user?: any
  users?: any[]
  userId?: string
  message?: any
  messageData?: any
  timestamp?: number
  error?: string
}

// Храним подключения с привязкой к userId
interface UserConnection {
  ws: WebSocket
  userId?: number
  connectedAt: Date
}

const userConnections: UserConnection[] = []

// Получить всех пользователей
async function getAllUsers() {
  try {
    const users = await prisma.user.findMany({
      omit: {
        password: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return users.map(user => ({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }))
  } catch (error) {
    console.error('Error getting all users:', error)
    return []
  }
}

// Получить или создать DIRECT чат между двумя пользователями
async function getOrCreateDirectChat(user1Id: number, user2Id: number) {
  try {
    // Ищем существующий DIRECT чат между пользователями
    const existingChat = await prisma.chat.findFirst({
      where: {
        type: 'DIRECT',
        members: {
          every: {
            userId: {
              in: [user1Id, user2Id]
            }
          }
        }
      },
      include: {
        members: true
      }
    })

    if (existingChat) {
      return existingChat
    }

    // Создаем новый DIRECT чат
    return await prisma.chat.create({
      data: {
        type: 'DIRECT',
        members: {
          create: [{ userId: user1Id }, { userId: user2Id }]
        }
      },
      include: {
        members: true
      }
    })
  } catch (error) {
    console.error('Error getting or creating chat:', error)
    throw error
  }
}

// Трансляция всем подключенным клиентам
export function broadcastToAll(message: string) {
  const connections = [...userConnections]
  console.log('broadcastToAll: ', message)

  connections.forEach(connection => {
    if (connection.ws.readyState === WebSocket.OPEN) {
      try {
        connection.ws.send(message)
      } catch (error) {
        console.error('Error sending message to client:', error)
      }
    }
  })
}

// Трансляция всем кроме указанного пользователя
function broadcastToAllExcept(userId: number, message: string) {
  const connections = userConnections.filter(conn => conn.userId !== userId)

  connections.forEach(connection => {
    if (connection.ws.readyState === WebSocket.OPEN) {
      try {
        connection.ws.send(message)
      } catch (error) {
        console.error('Error sending message to client:', error)
      }
    }
  })
}

// Отправить конкретному пользователю по userId
function sendToUser(userId: number, message: string) {
  const connection = userConnections.find(conn => conn.userId === userId)
  if (connection && connection.ws.readyState === WebSocket.OPEN) {
    try {
      connection.ws.send(message)
      console.log(`📤 Message sent to user ${userId}`)
    } catch (error) {
      console.error(`Error sending message to user ${userId}:`, error)
    }
  } else {
    console.log(`❌ User ${userId} is not connected`)
  }
}

// Отправить конкретному клиенту
function sendToClient(ws: WebSocket, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(message)
    } catch (error) {
      console.error('Error sending message to client:', error)
    }
  }
}

export function setupUsersWebSocket(app: expressWs.Application) {
  app.ws('/usersWS', async (ws: WebSocket, req: express.Request) => {
    const cookiesHeader = req.headers.cookie

    // Достаем userId из cookies
    let userId: number | null = null
    if (cookiesHeader) {
      const parsedCookies = cookie.parse(cookiesHeader)
      if (parsedCookies.userId) {
        userId = parseInt(parsedCookies.userId)
      }
    }

    // Создаем подключение с userId
    const userConnection: UserConnection = {
      ws,
      userId: userId || undefined,
      connectedAt: new Date()
    }

    userConnections.push(userConnection)

    // Если userId найден, обновляем статус пользователя на онлайн
    if (userId) {
      try {
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            isOnline: true,
            lastSeen: new Date()
          },
          omit: { password: true }
        })

        // Уведомляем всех о том, что пользователь онлайн
        const onlineMessage: BroadcastUserMessage = {
          type: 'user_online',
          user: {
            ...updatedUser,
            id: updatedUser.id.toString()
          },
          message: `User ${updatedUser.name} is now online`,
          timestamp: Date.now()
        }

        const postsUsers = await prisma.post.findMany({ where: { authorId: userId } })

        let res = {
          type: 'get_all_user_posts',
          posts: postsUsers
        }
        broadcastToAll(JSON.stringify(res))

        // Отправляем всем кроме текущего пользователя
        broadcastToAllExcept(userId, JSON.stringify(onlineMessage))
      } catch (error) {
        console.error('Error updating user online status:', error)
      }
    }

    try {
      // Получаем всех пользователей
      const allUsers = await getAllUsers()
      const usersListMessage: BroadcastUserMessage = {
        type: 'users_list',
        users: allUsers,
        timestamp: Date.now()
      }
      // Отправляем всем пользователей на клиент
      sendToClient(ws, JSON.stringify(usersListMessage))
    } catch (error) {
      console.error('Error sending initial users list:', error)
    }

    ws.on('message', async (data: string) => {
      console.log('message data 248', data)
      try {
        const messageData: UserMessageData = JSON.parse(data)
        await handleUserMessage(messageData, ws, userConnection)
      } catch (e) {
        console.error('Ошибка обработки сообщения пользователей:', e)

        // Отправляем ошибку клиенту
        const errorMessage: BroadcastUserMessage = {
          type: 'error',
          message: 'Invalid message format',
          timestamp: Date.now()
        }
        sendToClient(ws, JSON.stringify(errorMessage))
      }
    })

    ws.on('close', async (code, reason) => {
      console.log('Client disconnected from users management:', {
        userId: userConnection.userId || 'unknown',
        code,
        reason: reason.toString()
      })

      // Удаляем подключение из списка
      const index = userConnections.indexOf(userConnection)
      if (index > -1) {
        userConnections.splice(index, 1)
      }

      // Если пользователь был идентифицирован, обновляем его статус на offline
      if (userConnection.userId) {
        try {
          console.log(`🟡 User ${userConnection.userId} disconnected, setting offline status`)

          const updatedUser = await prisma.user.update({
            where: { id: userConnection.userId },
            data: {
              isOnline: false,
              lastSeen: new Date()
            },
            omit: { password: true }
          })

          console.log(`🔴 User ${userConnection.userId} (${updatedUser.name}) status set to offline`)

          // Уведомляем всех о том, что пользователь оффлайн
          const offlineMessage: BroadcastUserMessage = {
            type: 'user_offline',
            user: {
              ...updatedUser,
              id: updatedUser.id.toString()
            },
            message: `User ${updatedUser.name} is now offline`,
            timestamp: Date.now()
          }

          // Отправляем всем кроме отключившегося пользователя
          broadcastToAllExcept(userConnection.userId, JSON.stringify(offlineMessage))
        } catch (error) {
          console.error('Error updating user offline status:', error)
        }
      }

      console.log(`Remaining connections: ${userConnections.length}`)
      const connectedUsers = userConnections.filter(conn => conn.userId).map(conn => conn.userId)
      console.log(`Connected users: ${connectedUsers.length > 0 ? connectedUsers.join(', ') : 'none'}`)
    })

    ws.on('error', error => {
      console.error('Users WebSocket error:', error)
    })
  })
}

async function handleUserMessage(
  messageData: UserMessageData,
  ws: WebSocket,
  userConnection: UserConnection
) {
  console.log('Handling user message:', messageData)
  switch (messageData.type) {
    case 'send_message':
      await handleSendMessage(messageData, userConnection)
      break
    case 'get_all_user_posts':
      let res = {
        type: 'get_all_user_posts',
        posts: [{ id: '33' }]
      }

      console.log('cрфботало')
      sendToClient(userConnection.ws, JSON.stringify(res))
      break
    case 'connect':
      // Просто подтверждаем подключение
      const connectResponse: BroadcastUserMessage = {
        type: 'connect',
        message: 'WebSocket connection confirmed',
        timestamp: Date.now()
      }
      sendToClient(ws, JSON.stringify(connectResponse))
      break
    default:
      console.warn('Unknown user message type:', messageData.type)

      // Отправляем ошибку о неизвестном типе сообщения
      const errorMessage: BroadcastUserMessage = {
        type: 'error',
        message: `Unknown message type: ${messageData.type}`,
        timestamp: Date.now()
      }
      sendToClient(ws, JSON.stringify(errorMessage))
  }
}

// Обработка отправки сообщения
async function handleSendMessage(messageData: UserMessageData, userConnection: UserConnection) {
  if (!messageData.messageData) {
    console.error('No messageData for send_message')
    const errorMessage: BroadcastUserMessage = {
      type: 'error',
      message: 'Missing message data',
      timestamp: Date.now()
    }
    sendToClient(userConnection.ws, JSON.stringify(errorMessage))
    return
  }

  const { content, receiverId, senderId } = messageData.messageData

  // Валидация данных
  if (!content || !receiverId || !senderId) {
    const errorMessage: BroadcastUserMessage = {
      type: 'error',
      message: 'Content, receiverId and senderId are required',
      timestamp: Date.now()
    }
    sendToClient(userConnection.ws, JSON.stringify(errorMessage))
    return
  }

  try {
    console.log(`💬 Sending message from ${senderId} to ${receiverId}: ${content}`)

    const senderIdNum = parseInt(senderId.toString())
    const receiverIdNum = parseInt(receiverId.toString())

    // Получаем или создаем DIRECT чат между пользователями
    const chat = await getOrCreateDirectChat(senderIdNum, receiverIdNum)

    // Создаем сообщение в базе данных
    const newMessage = await prisma.message.create({
      data: {
        chatId: chat.id,
        senderId: senderIdNum,
        content: content.trim()
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        chat: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatar: true
                  }
                }
              }
            }
          }
        }
      }
    })

    // Обновляем lastMessage в чате
    await prisma.chat.update({
      where: { id: chat.id },
      data: {
        lastMessage: content,
        updatedAt: new Date()
      }
    })

    const messageForBroadcast = {
      id: newMessage.id,
      content: newMessage.content,
      senderId: newMessage.senderId.toString(),
      receiverId: receiverId.toString(),
      sender: newMessage.sender,
      chatId: newMessage.chatId,
      timestamp: newMessage.createdAt,
      createdAt: newMessage.createdAt,
      isRead: newMessage.isRead
    }

    // Отправляем сообщение получателю
    const newMessageData: BroadcastUserMessage = {
      type: 'new_message',
      message: messageForBroadcast,
      timestamp: Date.now()
    }

    // Отправляем сообщение получателю (если он онлайн)
    sendToUser(receiverIdNum, JSON.stringify(newMessageData))
  } catch (error) {
    console.error('Error sending message:', error)
    const errorMessage: BroadcastUserMessage = {
      type: 'error',
      message: 'Ошибка при отправке сообщения',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }
    sendToClient(userConnection.ws, JSON.stringify(errorMessage))
  }
}
