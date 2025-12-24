import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import prisma from '../../db/prisma'
import authenticateToken from '../../middleware/authenticate-token'
import { wsService } from '../../app'
import { createImgInBucket } from '../../lib/s3-bucket/utils/create-img'
import multer from 'multer'

const router = Router()

// Получение или создание чата между двумя пользователями
router.get('/chat', authenticateToken, async (req, res) => {
  const userId = req.user?.userId
  const targetUserId = req.query?.targetUserId

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (targetUserId === '0' || isNaN(Number(targetUserId))) {
    res.status(400).json({ error: 'targetUserId is required and must be a number' })
    return
  }

  const parsedTargetId = Number(targetUserId)

  try {
    // 1. Найти DIRECT-чат между пользователями
    let chat = await prisma.chat.findFirst({
      where: {
        type: 'DIRECT',
        members: {
          every: {
            userId: { in: [Number(userId), parsedTargetId] }
          }
        }
      },
      include: {
        messages: {
          include: {
            sender: { select: { id: true, name: true, avatar: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    // 2. Если чата нет — создать
    if (!chat) {
      const chatId = uuidv4()
      await prisma.chat.create({
        data: {
          id: chatId,
          type: 'DIRECT',
          members: {
            create: [{ userId: Number(userId) }, { userId: parsedTargetId }]
          }
        }
      })

      // Получаем созданный чат с сообщениями
      chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: {
          messages: {
            include: {
              sender: { select: { id: true, name: true, avatar: true } }
            },
            orderBy: { createdAt: 'asc' }
          }
        }
      })
    }

    res.json(chat)
  } catch (error) {
    console.error('Error loading direct chat:', error)
    res.status(500).json({ error: 'Failed to load chat' })
  }
})

// Отправка сообщения в чат
router.post('/chat/message', authenticateToken, async (req, res) => {
  const { chatId, content } = req.body
  const senderId = req.user?.userId

  if (!chatId || !content?.trim()) {
    res.status(400).json({ error: 'chatId and content are required' })
    return
  }

  try {
    // Проверяем, существует ли чат и является ли пользователь участником
    const member = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: chatId,
          userId: Number(senderId)
        }
      }
    })

    if (!member) {
      res.status(403).json({ error: 'You are not a member of this chat' })
      return
    }

    // Создаём новое сообщение
    const message = await prisma.message.create({
      data: {
        id: uuidv4(),
        content: content.trim(),
        senderId: Number(senderId),
        chatId: chatId
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    })

    // Обновляем последнее сообщение в чате
    await prisma.chat.update({
      where: { id: chatId },
      data: { lastMessage: content.trim() }
    })

    wsService.getNotificationService().notify('CHAT_MESSAGE', { message: message })

    // Логируем отправку
    console.log(`📨 Message sent by user ${senderId} in chat ${chatId}:`, content.trim())

    // Возвращаем сообщение клиенту
    res.status(201).json(message)
  } catch (error) {
    console.error('Error sending message:', error)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

const upload = multer({ storage: multer.memoryStorage() }).single('file')

// Отправка изображения в чат (с поддержкой FormData)
router.post('/chat/image', authenticateToken, (req, res) => {
  upload(req, res, async err => {
    if (err) {
      console.error('Multer error:', err)
      res.status(500).json({ error: 'File upload failed' })
      return
    }

    const { chatId } = req.body
    const file = req.file
    const senderId = req.user?.userId

    if (!chatId) {
      res.status(400).json({ error: 'chatId is required' })
      return
    }

    if (!file) {
      res.status(400).json({ error: 'File is required' })
      return
    }

    try {
      // Проверяем, состоит ли пользователь в чате
      await prisma.chatMember.findUnique({
        where: {
          chatId_userId: {
            chatId: chatId,
            userId: Number(senderId)
          }
        }
      })

      // Просто передаём объект с buffer
      const uploadResult = await createImgInBucket('chat-images', {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype
      })

      if (uploadResult.resCode !== 200) {
        res.status(500).json({ error: 'Failed to upload image to storage' })
        return
      }
      if (uploadResult.error) {
        res.status(500).json({ error: uploadResult.error })
        return
      }

      if (!uploadResult.url) {
        res.status(500).json({ error: 'No image URL returned' })
      }

      // Создаём сообщение на изображение
      const message = await prisma.message.create({
        data: {
          id: uuidv4(),
          content: null,
          imageUrl: uploadResult.url,
          senderId: Number(senderId),
          chatId: chatId
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true
            }
          }
        }
      })

      // Обновляем lastMessage в чате
      await prisma.chat.update({
        where: { id: chatId },
        data: { lastMessage: '📸 Фото' }
      })

      // Уведомляем через WebSocket
      wsService.getNotificationService().notify('CHAT_MESSAGE', { message })

      console.log(`📸 Image sent by user ${senderId} in chat ${chatId}: ${uploadResult.url}`)

      res.status(201).json(message)
    } catch (error) {
      console.error('Error sending image:', error)
      res.status(500).json({ error: error })
    }
  })
})

export default router
