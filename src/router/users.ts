// src/routes/authorizationUserRouter.ts

import express from 'express'
import prisma from '../db/prisma'
import authenticateToken from '../middleware/authenticate-token'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: John Doe
 *         email:
 *           type: string
 *           format: email
 *           example: john@example.com
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2023-01-01T00:00:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2023-01-01T00:00:00.000Z
 *     Error:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Error message
 *     UserResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: John Doe
 *         email:
 *           type: string
 *           example: john@example.com
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2023-01-01T00:00:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2023-01-01T00:00:00.000Z
 *     DeleteUserResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: User deleted successfully
 *         deletedUser:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *               example: 1
 *             name:
 *               type: string
 *               example: John Doe
 *             email:
 *               type: string
 *               example: john@example.com
 *     CreateUserRequest:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         name:
 *           type: string
 *           example: John Doe
 *         email:
 *           type: string
 *           format: email
 *           example: john@example.com
 *         password:
 *           type: string
 *           format: password
 *           example: securePassword123
 */

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: API для управления пользователями
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Получить список всех пользователей
 *     description: Возвращает массив всех пользователей системы без паролей
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Успешный запрос. Возвращает массив пользователей
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserResponse'
 *             example:
 *               - id: 1
 *                 name: John Doe
 *                 email: john@example.com
 *                 createdAt: 2023-01-01T00:00:00.000Z
 *                 updatedAt: 2023-01-01T00:00:00.000Z
 *               - id: 2
 *                 name: Jane Smith
 *                 email: jane@example.com
 *                 createdAt: 2023-01-02T00:00:00.000Z
 *                 updatedAt: 2023-01-02T00:00:00.000Z
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Internal server error occurred
 */
router.get('/users', async (_, res) => {
  try {
    // Получаем всех пользователей из базы данных
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        email: true,
        password: false,
        isOnline: true
      }
    })
    // Возвращаем массив пользователей
    res.status(200).json(users)
  } catch (err: unknown) {
    // Типизируем err как неизвестный тип (unknown)
    let errorMessage: string
    if (typeof err === 'string') {
      errorMessage = err
    } else if (err instanceof Error) {
      errorMessage = err.message
    } else {
      errorMessage = 'Unknown error occurred.'
    }
    // Ошибка при получении данных
    res.status(500).send(errorMessage)
  }
})

/**
 * @swagger
 * /api/user/{email}:
 *   get:
 *     summary: Найти пользователя по email
 *     description: Возвращает информацию о пользователе по его email адресу
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         description: Email адрес пользователя
 *         schema:
 *           type: string
 *           format: email
 *         example: john@example.com
 *     responses:
 *       200:
 *         description: Пользователь найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *             example:
 *               id: 1
 *               name: John Doe
 *               email: john@example.com
 *               createdAt: 2023-01-01T00:00:00.000Z
 *               updatedAt: 2023-01-01T00:00:00.000Z
 *       404:
 *         description: Пользователь не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: User not found
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Database connection error
 */
router.get('/user/:email', async (req, res) => {
  const { email } = req.params

  try {
    // Ищем пользователя по email
    const user = await prisma.user.findUnique({
      where: { email: email },
      omit: { password: true }
    })

    // Если пользователь не найден, возвращаем 404
    if (!user) {
      res.status(404).json({ message: 'User not found' })
    } else {
      // Возвращаем найденного пользователя
      res.status(200).json(user)
    }
  } catch (err: unknown) {
    // Типизируем err как неизвестный тип (unknown)
    let errorMessage: string
    if (typeof err === 'string') {
      errorMessage = err
    } else if (err instanceof Error) {
      errorMessage = err.message
    } else {
      errorMessage = 'Unknown error occurred.'
    }
    // Ошибка при получении данных
    res.status(500).send(errorMessage)
  }
})

/**
 * @swagger
 * /api/user/add-user:
 *   post:
 *     summary: Создать нового пользователя
 *     description: Регистрирует нового пользователя в системе
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       description: Данные для создания пользователя
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *           example:
 *             name: John Doe
 *             email: john@example.com
 *             password: securePassword123
 *     responses:
 *       201:
 *         description: Пользователь успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *             example:
 *               id: 1
 *               name: John Doe
 *               email: john@example.com
 *               password: hashed_password_string
 *               createdAt: 2023-01-01T00:00:00.000Z
 *               updatedAt: 2023-01-01T00:00:00.000Z
 *       400:
 *         description: Не все обязательные поля заполнены
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: All fields are required
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Failed to create user
 */
router.post('/user/add-user', async (req, res) => {
  const { name, email, password } = req.body
  try {
    if (!name || !email || !password) {
      res.status(400).json({ message: 'All fields are required' })
    } else {
      // Создаем нового пользователя
      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          password
        }
      })

      // Возвращаем успешный статус и пользователя
      res.status(201).json(newUser)
    }
  } catch (err: unknown) {
    // Типизируем err как неизвестный тип (unknown)
    let errorMessage: string
    if (typeof err === 'string') {
      errorMessage = err
    } else if (err instanceof Error) {
      errorMessage = err.message
    } else {
      errorMessage = 'Unknown error occurred.'
    }
    // Ошибка при получении данных
    res.status(500).send(errorMessage)
  }
})

/**
 * @swagger
 * /api/users/delete-user/{id}:
 *   delete:
 *     summary: Удалить пользователя по ID
 *     description: Удаляет пользователя из системы по его идентификатору
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID пользователя для удаления
 *         schema:
 *           type: integer
 *           format: int64
 *         example: 1
 *     responses:
 *       200:
 *         description: Пользователь успешно удален
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteUserResponse'
 *             example:
 *               message: User deleted successfully
 *               deletedUser:
 *                 id: 1
 *                 name: John Doe
 *                 email: john@example.com
 *       404:
 *         description: Пользователь не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: User not found
 *       409:
 *         description: Нельзя удалить пользователя из-за связанных записей в других таблицах
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Cannot delete user. User has related records in other tables.
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Database error occurred
 */
router.delete('/users/delete-user/:id', async (req, res) => {
  const { id } = req.params

  try {
    // Проверяем существование пользователя
    const existingUser = await prisma.user.findUnique({
      where: { id: +id }
    })

    if (!existingUser) {
      res.status(404).json({ message: 'User not found' })
    } else {
      // Удаляем пользователя
      await prisma.user.delete({
        where: { id: +id }
      })

      res.status(200).json({
        message: 'User deleted successfully',
        deletedUser: {
          id: existingUser!.id,
          name: existingUser!.name,
          email: existingUser!.email
        }
      })
    }
  } catch (err: unknown) {
    let errorMessage: string
    if (typeof err === 'string') {
      errorMessage = err
    } else if (err instanceof Error) {
      errorMessage = err.message
    } else {
      errorMessage = 'Unknown error occurred.'
    }

    // Специальная обработка ошибок связанных с внешними ключами
    if (err instanceof Error && err.message.includes('foreign key constraint')) {
      errorMessage = 'Cannot delete user. User has related records in other tables.'
      res.status(409).send(errorMessage)
    }

    res.status(500).send(errorMessage)
  }
})

// Упрощенная версия - получаем сообщения между двумя пользователями
router.post('/users/get-messages', authenticateToken, async (req, res) => {
  try {
    // Проверяем, есть ли пользователь
    if (!req.user) {
      res.status(401).json({ message: 'Пользователь не аутентифицирован' })
      return
    }

    const userId = req?.user?.userId
    const { otherUserId } = req.body

    console.log('🔍 Fetching messages for:', { userId, otherUserId })

    // Валидация входных данных
    if (!userId) {
      res.status(400).json({ message: 'ID пользователя обязательно' })
      return
    }

    if (!otherUserId) {
      res.status(400).json({ message: 'ID собеседника обязательно' })
      return
    }

    const userIdNum = parseInt(userId)
    const otherUserIdNum = parseInt(otherUserId)

    console.log('🔍 Parsed IDs:', { userIdNum, otherUserIdNum })

    // Находим чат между двумя пользователями
    const chat = await prisma.chat.findFirst({
      where: {
        type: 'DIRECT',
        AND: [{ members: { some: { userId: userIdNum } } }, { members: { some: { userId: otherUserIdNum } } }]
      },
      include: {
        members: true // Включаем members для отладки
      }
    })

    console.log('🔍 Found chat:', chat)
    console.log('🔍 Chat members:', chat?.members)

    let messages: any[] = []

    if (chat) {
      // Получаем сообщения из найденного чата
      messages = await prisma.message.findMany({
        where: {
          chatId: chat.id
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

      console.log('🔍 Found messages:', messages.length)
    } else {
      console.log('❌ No chat found between users')

      // Дополнительная проверка - ищем чаты каждого пользователя отдельно
      const userChats = await prisma.chat.findMany({
        where: {
          type: 'DIRECT',
          members: {
            some: { userId: userIdNum }
          }
        },
        include: {
          members: true
        }
      })

      console.log('🔍 User chats:', userChats.length)

      const otherUserChats = await prisma.chat.findMany({
        where: {
          type: 'DIRECT',
          members: {
            some: { userId: otherUserIdNum }
          }
        },
        include: {
          members: true
        }
      })

      console.log('🔍 Other user chats:', otherUserChats.length)
    }

    // Форматируем сообщения для клиента
    const formattedMessages = messages.map(message => ({
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      receiverId: message.senderId === userIdNum ? otherUserIdNum : userIdNum,
      chatId: message.chatId,
      timestamp: message.createdAt,
      isRead: message.isRead,
      sender: message.sender
    }))

    console.log('✅ Sending formatted messages:', formattedMessages.length)

    // Возвращаем массив сообщений
    res.status(200).json(formattedMessages)
  } catch (err: unknown) {
    console.error('❌ Error fetching messages:', err)
    let errorMessage: string
    if (typeof err === 'string') {
      errorMessage = err
    } else if (err instanceof Error) {
      errorMessage = err.message
    } else {
      errorMessage = 'Unknown error occurred.'
    }
    res.status(500).json({ message: 'Ошибка при получении сообщений', error: errorMessage })
  }
})

router.post('/users/send-message', authenticateToken, async (req, res) => {
  try {
    // Проверяем аутентификацию
    if (!req.user) {
      res.status(401).json({ message: 'Пользователь не аутентифицирован' })
      return
    }

    const senderId = req.user.userId
    const { content, receiverId, chatId } = req.body

    console.log('📨 Sending message:', { senderId, receiverId, content, chatId })

    // Валидация входных данных
    if (!content || !content.trim()) {
      res.status(400).json({ message: 'Текст сообщения обязателен' })
      return
    }

    if (!receiverId) {
      res.status(400).json({ message: 'ID получателя обязательно' })
      return
    }

    const senderIdNum = parseInt(senderId)
    const receiverIdNum = parseInt(receiverId)

    // Проверяем, что отправитель и получатель разные пользователи
    if (senderIdNum === receiverIdNum) {
      res.status(400).json({ message: 'Нельзя отправить сообщение самому себе' })
      return
    }

    let targetChatId: string

    // Если chatId передан, используем его
    if (chatId) {
      targetChatId = String(chatId)

      // Проверяем, что пользователь является участником чата
      const chatMembership = await prisma.chatMember.findFirst({
        where: {
          chatId: targetChatId,
          userId: senderIdNum
        }
      })

      if (!chatMembership) {
        res.status(403).json({ message: 'У вас нет доступа к этому чату' })
        return
      }
    } else {
      // Ищем существующий чат между пользователями
      let chat = await prisma.chat.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { members: { some: { userId: senderIdNum } } },
            { members: { some: { userId: receiverIdNum } } }
          ]
        }
      })

      // Если чат не существует, создаем новый
      if (!chat) {
        console.log('💬 Creating new chat between:', senderIdNum, 'and', receiverIdNum)

        // Генерируем уникальный ID для чата
        const newChatId = `chat_${Date.now()}_${senderIdNum}_${receiverIdNum}`

        chat = await prisma.chat.create({
          data: {
            id: newChatId,
            type: 'DIRECT',
            members: {
              create: [{ userId: senderIdNum }, { userId: receiverIdNum }]
            }
          }
        })
        console.log('✅ New chat created with ID:', chat.id)
      } else {
        console.log('🔍 Found existing chat with ID:', chat.id)
      }

      targetChatId = chat.id
    }

    // Проверяем существование чата перед созданием сообщения
    const existingChat = await prisma.chat.findUnique({
      where: { id: targetChatId }
    })

    if (!existingChat) {
      res.status(404).json({ message: 'Чат не найден' })
      return
    }

    console.log('✅ Chat exists:', existingChat.id)

    // Создаем сообщение
    const newMessage = await prisma.message.create({
      data: {
        content: content.trim(),
        senderId: senderIdNum,
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

    console.log('✅ Message created with ID:', newMessage.id)

    // Форматируем ответ для клиента
    const formattedMessage = {
      id: newMessage.id,
      content: newMessage.content,
      senderId: newMessage.senderId,
      receiverId: newMessage.senderId === senderIdNum ? receiverIdNum : senderIdNum,
      chatId: newMessage.chatId,
      timestamp: newMessage.createdAt,
      isRead: newMessage.isRead,
      sender: newMessage.sender
    }

    console.log('📤 Sending formatted message response')

    // Возвращаем созданное сообщение
    res.status(201).json(formattedMessage)
  } catch (err: unknown) {
    console.error('❌ Error sending message:', err)

    let errorMessage: string
    if (typeof err === 'string') {
      errorMessage = err
    } else if (err instanceof Error) {
      errorMessage = err.message
    } else {
      errorMessage = 'Unknown error occurred.'
    }

    // Специальная обработка ошибок базы данных
    if (err instanceof Error && 'code' in err) {
      const prismaError = err as { code: string; meta?: any }

      if (prismaError.code === 'P2003') {
        errorMessage = 'Ошибка внешнего ключа: проверьте существование чата или пользователя'
        res.status(400).json({ message: errorMessage })
        return
      }
    }

    res.status(500).json({
      message: 'Ошибка при отправке сообщения',
      error: errorMessage
    })
  }
})
export default router
