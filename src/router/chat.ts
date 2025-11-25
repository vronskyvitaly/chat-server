import express from 'express'
import prisma from '../db/prisma'
import authenticateToken from '../middleware/authenticate-token'
import { broadcastToChat, sendToUser } from './setupChatWebSocket'

const router = express.Router()

/**
 * @swagger
 * /api/chat:
 *   get:
 *     summary: Универсальный endpoint для получения данных чатов
 *     description: Обрабатывает различные запросы через параметр 'c'
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: c
 *         required: true
 *         description: Действие (chats, get-messages, send-message)
 *         schema:
 *           type: string
 *           enum: [chats, get-messages, send-message]
 *       - in: query
 *         name: chatId
 *         description: ID чата (для get-messages, send-message)
 *         schema:
 *           type: string
 *       - in: query
 *         name: content
 *         description: Текст сообщения (для send-message)
 *         schema:
 *           type: string
 *       - in: query
 *         name: receiverId
 *         description: ID получателя (для send-message)
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Успешный запрос
 *       400:
 *         description: Неверные параметры
 *       401:
 *         description: Пользователь не аутентифицирован
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.get('/chat', authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Пользователь не аутентифицирован' })
      return
    }

    const { c: action, chatId, content, receiverId } = req.query

    console.log('🔧 Chat GET action:', { action, chatId, content, receiverId })

    switch (action) {
      case 'chats':
        await handleGetChats(req, res)
        break
      case 'get-messages':
        await handleGetMessages(req, res)
        break
      case 'send-message':
        await handleGetMessages(req, res)
        break
      default:
        res.status(400).json({ message: 'Неизвестное действие' })
    }
  } catch (err: unknown) {
    console.error('❌ Error in chat GET endpoint:', err)

    let errorMessage: string
    if (typeof err === 'string') {
      errorMessage = err
    } else if (err instanceof Error) {
      errorMessage = err.message
    } else {
      errorMessage = 'Unknown error occurred.'
    }

    res.status(500).json({
      message: 'Ошибка при обработке запроса',
      error: errorMessage
    })
  }
})

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Отправка сообщения через параметры
 *     description: Отправляет сообщение через параметры URL
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: c
 *         required: true
 *         description: Действие (send-message)
 *         schema:
 *           type: string
 *           enum: [send-message]
 *       - in: query
 *         name: content
 *         required: true
 *         description: Текст сообщения
 *         schema:
 *           type: string
 *       - in: query
 *         name: receiverId
 *         required: true
 *         description: ID получателя
 *         schema:
 *           type: integer
 *       - in: query
 *         name: chatId
 *         description: ID чата (опционально)
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Сообщение успешно отправлено
 *       400:
 *         description: Неверные параметры
 *       401:
 *         description: Пользователь не аутентифицирован
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Пользователь не аутентифицирован' })
      return
    }

    const { c: action, content, receiverId, chatId } = req.query

    console.log('🔧 Chat POST action:', { action, content, receiverId, chatId })

    if (action === 'send-message') {
      await handleSendMessage(req, res)
    } else {
      res.status(400).json({ message: 'Неизвестное действие' })
    }
  } catch (err: unknown) {
    console.error('❌ Error in chat POST endpoint:', err)

    let errorMessage: string
    if (typeof err === 'string') {
      errorMessage = err
    } else if (err instanceof Error) {
      errorMessage = err.message
    } else {
      errorMessage = 'Unknown error occurred.'
    }

    res.status(500).json({
      message: 'Ошибка при обработке запроса',
      error: errorMessage
    })
  }
})

// Функция для получения списка чатов
async function handleGetChats(req: express.Request, res: express.Response) {
  const userId = parseInt(req.user!.userId)

  console.log('🔍 Fetching chats for user:', userId)

  const chats = await prisma.chat.findMany({
    where: {
      members: {
        some: {
          userId: userId
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
              isOnline: true,
              lastSeen: true
            }
          }
        }
      },
      messages: {
        orderBy: {
          createdAt: 'desc'
        },
        take: 1,
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
      },
      _count: {
        select: {
          messages: {
            where: {
              isRead: false,
              senderId: { not: userId }
            }
          }
        }
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  })

  console.log('✅ Found chats:', chats.length)

  const formattedChats = chats.map(chat => {
    const lastMessage = chat.messages[0] || null
    const otherMembers = chat.members.filter(member => member.userId !== userId)

    let chatName = (chat as any).name
    let chatAvatar = null

    if (chat.type === 'DIRECT' && otherMembers.length > 0) {
      chatName = otherMembers[0].user.name
      chatAvatar = otherMembers[0].user.avatar
    }

    return {
      id: chat.id,
      type: chat.type,
      name: chatName,
      avatar: chatAvatar,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.content,
            senderId: lastMessage.senderId,
            chatId: lastMessage.chatId,
            isRead: lastMessage.isRead,
            createdAt: lastMessage.createdAt,
            sender: lastMessage.sender
          }
        : null,
      unreadCount: chat._count.messages,
      members: chat.members.map(member => ({
        id: member.id,
        userId: member.userId,
        user: member.user
      }))
    }
  })

  res.status(200).json(formattedChats)
}

// Функция для получения сообщений чата
async function handleGetMessages(req: express.Request, res: express.Response) {
  const userId = parseInt(req.user!.userId)
  const { chatId } = req.query

  if (!chatId || typeof chatId !== 'string') {
    res.status(400).json({ message: 'ID чата обязательно' })
    return
  }

  const chatMembership = await prisma.chatMember.findFirst({
    where: {
      chatId: chatId,
      userId: userId
    }
  })

  if (!chatMembership) {
    res.status(403).json({ message: 'У вас нет доступа к этому чату' })
    return
  }

  // Помечаем сообщения как прочитанные
  await prisma.message.updateMany({
    where: {
      chatId: chatId,
      senderId: { not: userId },
      isRead: false
    },
    data: {
      isRead: true
    }
  })

  const messages = await prisma.message.findMany({
    where: {
      chatId: chatId
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
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  res.status(200).json(messages)
}

// Функция для отправки сообщения через POST запрос
async function handleSendMessage(req: express.Request, res: express.Response) {
  const senderId = parseInt(req.user!.userId)
  const { content, receiverId, chatId } = req.query

  console.log('📨 Sending message via POST params:', { senderId, receiverId, content, chatId })

  if (!content || typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ message: 'Текст сообщения обязателен' })
    return
  }

  if (!receiverId) {
    res.status(400).json({ message: 'ID получателя обязательно' })
    return
  }

  const receiverIdNum = parseInt(receiverId as string)

  if (senderId === receiverIdNum) {
    res.status(400).json({ message: 'Нельзя отправить сообщение самому себе' })
    return
  }

  let targetChatId: string

  if (chatId && typeof chatId === 'string') {
    targetChatId = chatId

    const chatMembership = await prisma.chatMember.findFirst({
      where: {
        chatId: targetChatId,
        userId: senderId
      }
    })

    if (!chatMembership) {
      res.status(403).json({ message: 'У вас нет доступа к этому чату' })
      return
    }
  } else {
    let chat = await prisma.chat.findFirst({
      where: {
        type: 'DIRECT',
        AND: [{ members: { some: { userId: senderId } } }, { members: { some: { userId: receiverIdNum } } }]
      }
    })

    if (!chat) {
      console.log('💬 Creating new chat between:', senderId, 'and', receiverIdNum)

      const newChatId = `chat_${Date.now()}_${senderId}_${receiverIdNum}`

      chat = await prisma.chat.create({
        data: {
          id: newChatId,
          type: 'DIRECT',
          members: {
            create: [{ userId: senderId }, { userId: receiverIdNum }]
          }
        }
      })
      console.log('✅ New chat created with ID:', chat.id)
    } else {
      console.log('🔍 Found existing chat with ID:', chat.id)
    }

    targetChatId = chat.id
  }

  const existingChat = await prisma.chat.findUnique({
    where: { id: targetChatId }
  })

  if (!existingChat) {
    res.status(404).json({ message: 'Чат не найден' })
    return
  }

  const newMessage = await prisma.message.create({
    data: {
      content: (content as string).trim(),
      senderId: senderId,
      chatId: targetChatId,
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

  await prisma.chat.update({
    where: { id: targetChatId },
    data: { updatedAt: new Date() }
  })

  const formattedMessage = {
    id: newMessage.id,
    content: newMessage.content,
    senderId: newMessage.senderId,
    receiverId: receiverIdNum,
    chatId: newMessage.chatId,
    createdAt: newMessage.createdAt,
    isRead: newMessage.isRead,
    sender: newMessage.sender
  }

  console.log('583', formattedMessage)

  // ✅ ОТПРАВКА ЧЕРЕЗ WEBSOCKET
  const newMessageData = {
    type: 'new_message' as 'new_message',
    message: formattedMessage,
    chatId: targetChatId,
    timestamp: Date.now()
  }

  // Отправляем всем подписчикам чата
  broadcastToChat(targetChatId, newMessageData)

  // Отправляем конкретному получателю
  sendToUser(receiverIdNum, newMessageData)

  console.log(`✅ Message delivered via WebSocket to chat ${targetChatId}`)

  res.status(201).json(formattedMessage)
}

export default router
