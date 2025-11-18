import WebSocket from 'ws'
import express from 'express'
import expressWs from 'express-ws'
import prisma from '../db/prisma'

type MessageData = {
  type: 'message' | 'private_message' | 'typing' | 'read_receipt' | 'join_chat' | 'leave_chat'
  username: string
  message: string
  receiverId?: string
  isTyping?: boolean
  chatId?: string
  messageId?: string
  targetUserId?: string
}

type BroadcastMessage = {
  type:
    | 'message'
    | 'private_message'
    | 'history'
    | 'user_online'
    | 'user_offline'
    | 'typing'
    | 'read_receipt'
    | 'user_joined'
    | 'user_left'
    | 'chat_created'
  id?: string
  username?: string
  message?: string
  isTyping?: boolean
  timestamp?: number
  senderId?: string
  receiverId?: string
  chatId?: string
  isPrivate?: boolean
  history?: any[]
  onlineUsers?: any[]
  typingUsers?: string[]
  chat?: any
  isRead?: boolean
}

// Храним подключения пользователей: userId → WebSocket[]
const userConnections = new Map<string, WebSocket[]>()
// Храним активные чаты пользователей: userId → chatId
const userActiveChats = new Map<string, string>()

function sendToUser(userId: string, message: string) {
  const clients = userConnections.get(userId)
  if (clients) {
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    })
  }
}

function broadcastToAll(message: string, excludeUserId?: string) {
  userConnections.forEach((clients, userId) => {
    if (userId !== excludeUserId) {
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message)
        }
      })
    }
  })
}

// Получить или создать приватный чат между двумя пользователями
async function getOrCreatePrivateChat(userId1: string, userId2: string) {
  try {
    // Ищем существующий приватный чат между пользователями
    const existingChat = await prisma.chat.findFirst({
      where: {
        type: 'DIRECT',
        members: {
          every: {
            userId: {
              in: [parseInt(userId1), parseInt(userId2)]
            }
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                isOnline: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
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
    })

    if (existingChat) {
      return existingChat
    }

    // Создаем новый приватный чат
    return await prisma.chat.create({
      data: {
        type: 'DIRECT',
        members: {
          create: [{ userId: parseInt(userId1) }, { userId: parseInt(userId2) }]
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                isOnline: true
              }
            }
          }
        },
        messages: {
          include: {
            sender: {
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
    })
  } catch (error) {
    console.error('Error creating/getting private chat:', error)
    throw error
  }
}

// Получить информацию о всех пользователях (ВКЛЮЧАЯ текущего)
async function getAllUsersInfo() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        isOnline: true,
        lastSeen: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return users.map(user => ({
      userId: user.id.toString(),
      username: user.name,
      email: user.email,
      avatar: user.avatar,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    }))
  } catch (error) {
    console.error('Error getting all users:', error)
    return []
  }
}

// Получить чаты пользователя
async function getUserChats(userId: string) {
  try {
    return await prisma.chat.findMany({
      where: {
        members: {
          some: {
            userId: parseInt(userId)
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                isOnline: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })
  } catch (error) {
    console.error('Error getting user chats:', error)
    return []
  }
}

export function setupChatRoom(app: expressWs.Application) {
  app.ws('/chatroom', async (ws: WebSocket, req: express.Request) => {
    const userId = req.query.userId as string
    const username = req.query.username as string

    if (!userId) {
      ws.close(1008, 'User ID required')
      return
    }

    console.log('User connected to chat:', { userId, username })

    // Добавляем подключение пользователя (может быть несколько вкладок)
    if (!userConnections.has(userId)) {
      userConnections.set(userId, [])
    }
    userConnections.get(userId)!.push(ws)

    // Обновляем статус в БД только если это первое подключение
    if (userConnections.get(userId)!.length === 1) {
      await prisma.user.update({
        where: { id: parseInt(userId) },
        data: {
          isOnline: true,
          lastSeen: new Date()
        }
      })
    }

    // Получаем и отправляем список ВСЕХ пользователей (включая текущего)
    const allUsersInfo = await getAllUsersInfo()

    // Отправляем полный список пользователей текущему подключению
    const usersMessage: BroadcastMessage = {
      type: 'user_online',
      onlineUsers: allUsersInfo
    }
    ws.send(JSON.stringify(usersMessage))

    // Получаем и отправляем чаты пользователя
    const userChats = await getUserChats(userId)
    const chatsMessage: BroadcastMessage = {
      type: 'history',
      history: [],
      chat: userChats
    }
    ws.send(JSON.stringify(chatsMessage))

    // Уведомляем других пользователей о новом подключении только если это первое подключение
    if (userConnections.get(userId)!.length === 1) {
      const userJoinedMessage: BroadcastMessage = {
        type: 'user_joined',
        senderId: userId,
        username,
        message: `${username} в сети`,
        timestamp: Date.now()
      }

      // Рассылаем всем кроме себя обновление статуса
      broadcastToAll(JSON.stringify(userJoinedMessage), userId)

      // Отправляем обновленный список пользователей всем
      const updatedUsersMessage: BroadcastMessage = {
        type: 'user_online',
        onlineUsers: allUsersInfo
      }
      broadcastToAll(JSON.stringify(updatedUsersMessage), userId)
    }

    ws.on('message', async (data: string) => {
      try {
        const messageData: MessageData = JSON.parse(data)
        await handleMessage(messageData, userId, username, ws)
      } catch (e) {
        console.error('Ошибка обработки сообщения:', e)
      }
    })

    ws.on('close', async () => {
      console.log('User disconnected from chat:', { userId, username })

      // Удаляем конкретное подключение
      const userClients = userConnections.get(userId)
      if (userClients) {
        const index = userClients.indexOf(ws)
        if (index > -1) {
          userClients.splice(index, 1)
        }

        // Если это последнее подключение пользователя
        if (userClients.length === 0) {
          userConnections.delete(userId)
          userActiveChats.delete(userId)

          // Обновляем статус в БД
          await prisma.user.update({
            where: { id: parseInt(userId) },
            data: {
              isOnline: false,
              lastSeen: new Date()
            }
          })

          // Получаем обновленный список пользователей
          const updatedUsers = await getAllUsersInfo()

          // Уведомляем о выходе
          const userLeftMessage: BroadcastMessage = {
            type: 'user_left',
            senderId: userId,
            username,
            message: `${username} вышел из сети`,
            timestamp: Date.now()
          }

          // Отправляем обновленный список пользователей всем
          const updatedUsersMessage: BroadcastMessage = {
            type: 'user_online',
            onlineUsers: updatedUsers
          }

          // Рассылаем всем обновления
          broadcastToAll(JSON.stringify(userLeftMessage), userId)
          broadcastToAll(JSON.stringify(updatedUsersMessage), userId)
        }
      }
    })

    ws.on('error', error => {
      console.error('WebSocket error:', error)
    })
  })
}

async function handleMessage(messageData: MessageData, senderId: string, username: string, ws: WebSocket) {
  switch (messageData.type) {
    case 'private_message':
      await handlePrivateMessage(messageData, senderId, username)
      break
    case 'typing':
      handleTypingIndicator(messageData, senderId, username)
      break
    case 'join_chat':
      await handleJoinChat(messageData, senderId, username, ws)
      break
    case 'read_receipt':
      await handleReadReceipt(messageData, senderId)
      break
    default:
      console.warn('Unknown message type:', messageData.type)
  }
}

async function handleJoinChat(messageData: MessageData, senderId: string, username: string, ws: WebSocket) {
  if (!messageData.targetUserId) {
    console.log(username)
    console.error('No targetUserId for join_chat')
    return
  }

  const targetUserId = messageData.targetUserId

  try {
    // Получаем или создаем приватный чат
    const chat = await getOrCreatePrivateChat(senderId, targetUserId)
    userActiveChats.set(senderId, chat.id)

    // Отправляем историю чата пользователю
    const historyMessage: BroadcastMessage = {
      type: 'history',
      history: chat.messages.map(msg => ({
        id: msg.id,
        username: msg.sender.name,
        message: msg.content,
        senderId: msg.sender.id.toString(),
        receiverId: targetUserId,
        isPrivate: true,
        timestamp: msg.createdAt.getTime(),
        isRead: msg.isRead,
        chatId: chat.id
      })),
      chatId: chat.id
    }

    ws.send(JSON.stringify(historyMessage))
    console.log(`User ${senderId} joined chat with ${targetUserId}`)
  } catch (error) {
    console.error('Error joining chat:', error)
  }
}

async function handlePrivateMessage(messageData: MessageData, senderId: string, username: string) {
  if (!messageData.receiverId) {
    console.log(username)
    console.error('No receiverId for private message')
    return
  }

  try {
    // Получаем или создаем чат
    const chat = await getOrCreatePrivateChat(senderId, messageData.receiverId)

    // Сохраняем сообщение в базу данных
    const savedMessage = await prisma.message.create({
      data: {
        chatId: chat.id,
        senderId: parseInt(senderId),
        content: messageData.message,
        isRead: false
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        }
      }
    })

    // Обновляем последнее сообщение и время обновления чата
    await prisma.chat.update({
      where: { id: chat.id },
      data: {
        lastMessage: messageData.message,
        updatedAt: new Date()
      }
    })

    // Создаем сообщение для получателя
    const privateMessage: BroadcastMessage = {
      type: 'private_message',
      id: savedMessage.id,
      username: savedMessage.sender.name,
      message: savedMessage.content,
      senderId: savedMessage.sender.id.toString(),
      receiverId: messageData.receiverId,
      timestamp: savedMessage.createdAt.getTime(),
      isPrivate: true,
      isRead: false,
      chatId: chat.id
    }

    // Отправляем получателю, если он онлайн
    const receiverConnection = userConnections.get(messageData.receiverId)
    if (receiverConnection && receiverConnection.length > 0) {
      receiverConnection.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(privateMessage))
        }
      })

      // Помечаем сообщение как прочитанное
      await prisma.message.update({
        where: { id: savedMessage.id },
        data: { isRead: true }
      })

      privateMessage.isRead = true
    }

    // Также отправляем обратно отправителю для подтверждения
    const confirmationMessage: BroadcastMessage = {
      ...privateMessage,
      isRead: receiverConnection !== undefined && receiverConnection.length > 0
    }
    sendToUser(senderId, JSON.stringify(confirmationMessage))

    console.log(`Private message from ${senderId} to ${messageData.receiverId}: ${messageData.message}`)
  } catch (error) {
    console.error('Error saving private message:', error)
  }
}

async function handleReadReceipt(messageData: MessageData, senderId: string) {
  if (!messageData.messageId) return

  try {
    // Помечаем сообщение как прочитанное
    await prisma.message.update({
      where: { id: messageData.messageId },
      data: { isRead: true }
    })

    console.log(`Message ${messageData.messageId} marked as read by ${senderId}`)
  } catch (error) {
    console.error('Error updating read receipt:', error)
  }
}

function handleTypingIndicator(messageData: MessageData, senderId: string, username: string) {
  if (!messageData.receiverId) return

  const typingMessage = {
    type: 'typing',
    senderId,
    username,
    isTyping: messageData.isTyping,
    receiverId: messageData.receiverId
  }

  // Отправляем индикатор набора получателю
  sendToUser(messageData.receiverId, JSON.stringify(typingMessage))
}
