import WebSocket from 'ws'
import express from 'express'
import expressWs from 'express-ws'
import prisma from '../db/prisma'
import cookie from 'cookie'

type ChatMessageData = {
  type: 'subscribe' | 'unsubscribe' | 'send_message' | 'mark_as_read' | 'typing' | 'connect'
  chatId?: string
  messageData?: {
    content: string
    receiverId: string | number
    senderId: string | number
    chatId?: string
  }
  messageId?: string
  isTyping?: boolean
}

type Typing =
  | 'new_message'
  | 'message_delivered'
  | 'message_read'
  | 'user_typing'
  | 'user_online'
  | 'user_offline'
  | 'connect'
  | 'error'

type BroadcastChatMessage = {
  type: Typing
  message?: Message
  messageId?: string
  chatId?: string
  userId?: number
  isTyping?: boolean
  timestamp?: number
  error?: string
}

type Message = {
  id: string
  content: string
  senderId: number
  receiverId: number
  chatId?: string
  createdAt: Date
  isRead: boolean
  sender: {
    id: number
    name: string
    avatar: string | null
  }
}

// Храним подключения с привязкой к userId и подписки на чаты
interface UserConnection {
  ws: WebSocket
  userId?: number
  connectedAt: Date
  subscribedChats: Set<string> // Set of chatIds that user is subscribed to
}

const userConnections: UserConnection[] = []

// Отправить конкретному клиенту
function sendToClient(ws: WebSocket, message: BroadcastChatMessage) {
  const messageString = JSON.stringify(message)
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(messageString)
      return true
    } catch (error) {
      console.error('Error sending message to client:', error)
      return false
    }
  }
  return false
}

// Подписать пользователя на чат
function subscribeToChat(userConnection: UserConnection, chatId: string) {
  userConnection.subscribedChats.add(chatId)
  console.log(`✅ User ${userConnection.userId} subscribed to chat ${chatId}`)
}

// // Отписать пользователя от чата
// function unsubscribeFromChat(userConnection: UserConnection, chatId: string) {
//   userConnection.subscribedChats.delete(chatId)
//   console.log(`❌ User ${userConnection.userId} unsubscribed from chat ${chatId}`)
// }

// Автоматически подписать пользователя на все его чаты
async function autoSubscribeToUserChats(userConnection: UserConnection) {
  if (!userConnection.userId) return

  try {
    const userChats = await prisma.chat.findMany({
      where: {
        members: {
          some: {
            userId: userConnection.userId
          }
        }
      },
      select: {
        id: true
      }
    })

    userChats.forEach(chat => {
      subscribeToChat(userConnection, chat.id)
    })

    console.log(`✅ User ${userConnection.userId} automatically subscribed to ${userChats.length} chats`)
  } catch (error) {
    console.error('Error auto-subscribing to chats:', error)
  }
}

export function setupChatWebSocket(app: expressWs.Application) {
  app.ws('/chatWS', async (ws: WebSocket, req: express.Request) => {
    const cookiesHeader = req.headers.cookie

    // Достаем userId из cookies
    let userId: number | null = null
    if (cookiesHeader) {
      const parsedCookies = cookie.parse(cookiesHeader)
      if (parsedCookies.userId) {
        userId = parseInt(parsedCookies.userId)
        console.log(`✅ Found userId in cookies: ${userId}`)
      }
    }

    // console.log(`🔗 Chat WebSocket connected: userId=${userId || 'unknown'}`)

    // Создаем подключение с userId
    const userConnection: UserConnection = {
      ws,
      userId: userId || undefined,
      connectedAt: new Date(),
      subscribedChats: new Set()
    }
    userConnections.push(userConnection)

    // Если userId найден, обновляем статус пользователя на онлайн
    if (userId) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            isOnline: true,
            lastSeen: new Date()
          },
          omit: { password: true }
        })

        // console.log(`🟢 User ${userId} (${updatedUser.name}) status set to online`)

        // Автоматически подписываем на все чаты пользователя
        await autoSubscribeToUserChats(userConnection)

        // Уведомляем всех о том, что пользователь онлайн
        const onlineMessage: BroadcastChatMessage = {
          type: 'user_online',
          userId: userId,
          timestamp: Date.now()
        }

        // Отправляем уведомление во все чаты, где есть этот пользователь
        const userChats = await prisma.chat.findMany({
          where: {
            members: {
              some: {
                userId: userId
              }
            }
          },
          select: {
            id: true
          }
        })

        userChats.forEach(chat => {
          broadcastToChat(chat.id, onlineMessage)
        })
      } catch (error) {
        console.error('Error updating user online status:', error)
      }
    }

    // Отправляем подтверждение подключения с правильным timestamp
    const connectMessage: BroadcastChatMessage = {
      type: 'connect',
      timestamp: Date.now()
    }
    sendToClient(ws, connectMessage)

    ws.on('message', async (data: string) => {
      try {
        const messageData: ChatMessageData = JSON.parse(data)
        console.log('📨 Received WebSocket message:', messageData.type)
        // await handleChatMessage(messageData, userConnection)
      } catch (e) {
        console.error('❌ Error processing chat message:', e)

        // Отправляем ошибку клиенту
        const errorMessage: BroadcastChatMessage = {
          type: 'error',
          error: 'Invalid message format',
          timestamp: Date.now()
        }
        sendToClient(ws, errorMessage)
      }
    })

    ws.on('close', async (code, reason) => {
      console.log('❌ Chat WebSocket disconnected:', {
        userId: userConnection.userId || 'unknown',
        code,
        reason: reason.toString()
      })

      // Если пользователь был идентифицирован, обновляем его статус на offline
      if (userConnection.userId) {
        try {
          const updatedUser = await prisma.user.update({
            where: { id: userConnection.userId },
            data: {
              isOnline: false,
              lastSeen: new Date()
            },
            omit: { password: true }
          })

          console.log(`🔴 User ${userConnection.userId} (${updatedUser.name}) status set to offline`)

          // Уведомляем все подписанные чаты о том, что пользователь оффлайн
          const offlineMessage: BroadcastChatMessage = {
            type: 'user_offline',
            userId: userConnection.userId,
            timestamp: Date.now()
          }

          userConnection.subscribedChats.forEach(chatId => {
            broadcastToChat(chatId, offlineMessage)
          })
        } catch (error) {
          console.error('Error updating user offline status:', error)
        }
      }

      // Удаляем подключение из списка
      const index = userConnections.indexOf(userConnection)
      if (index > -1) {
        userConnections.splice(index, 1)
      }

      console.log(`📊 Remaining chat connections: ${userConnections.length}`)
    })

    ws.on('error', error => {
      console.error('🚨 Chat WebSocket error:', error)
    })
  })
}

// Трансляция всем подписчикам чата
export function broadcastToChat(chatId: string, message: BroadcastChatMessage) {
  const messageString = JSON.stringify(message)
  let subscriberCount = 0

  userConnections.forEach(connection => {
    if (connection.subscribedChats.has(chatId) && connection.ws.readyState === WebSocket.OPEN) {
      try {
        connection.ws.send(messageString)
        subscriberCount++
      } catch (error) {
        console.error('Error sending message to chat subscriber:', error)
      }
    }
  })

  console.log(`📢 Broadcast to ${subscriberCount} subscribers of chat ${chatId}`)
  return subscriberCount
}

// Отправить конкретному пользователю по userId
export function sendToUser(userId: number, message: BroadcastChatMessage) {
  console.log('sendToUser 125 message', message)
  const messageString = JSON.stringify(message)
  let sentCount = 0

  // Ищем все подключения пользователя (может быть несколько вкладок)
  userConnections.forEach(connection => {
    if (connection.userId === userId && connection.ws.readyState === WebSocket.OPEN) {
      try {
        connection.ws.send(messageString)
        sentCount++
        console.log(`📤 Message sent to user ${userId}`)
      } catch (error) {
        console.error(`Error sending message to user ${userId}:`, error)
      }
    }
  })

  if (sentCount === 0) {
    console.log(`❌ User ${userId} is not connected or has no active connections`)
    return false
  } else {
    console.log(`✅ Message sent to ${sentCount} connection(s) of user ${userId}`)
    return true
  }
}
