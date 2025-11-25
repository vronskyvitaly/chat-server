// src/routes/authorizationUserRouter.ts

import express from 'express'
import prisma from '../../db/prisma'
import { getOnlineUsersWithData } from '../web-socket'

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

/**
 * @swagger
 * components:
 *   schemas:
 *     OnlineUser:
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
 *         avatar:
 *           type: string
 *           nullable: true
 *           example: https://example.com/avatar.jpg
 *         isOnline:
 *           type: boolean
 *           example: true
 *         lastSeen:
 *           type: string
 *           format: date-time
 *           example: 2023-01-01T00:00:00.000Z
 *         socketId:
 *           type: string
 *           example: abc123def456
 *     OnlineUsersResponse:
 *       type: object
 *       properties:
 *         users:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OnlineUser'
 *         count:
 *           type: integer
 *           example: 5
 */

/**
 * @swagger
 * /api/users/online:
 *   get:
 *     summary: Получить список онлайн пользователей
 *     description: Возвращает массив пользователей, которые сейчас онлайн через WebSocket
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Успешный запрос. Возвращает массив онлайн пользователей
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OnlineUsersResponse'
 *             example:
 *               users:
 *                 - id: 1
 *                   name: John Doe
 *                   email: john@example.com
 *                   avatar: https://example.com/avatar1.jpg
 *                   isOnline: true
 *                   lastSeen: 2023-01-01T00:00:00.000Z
 *                   socketId: "abc123"
 *                 - id: 2
 *                   name: Jane Smith
 *                   email: jane@example.com
 *                   avatar: null
 *                   isOnline: true
 *                   lastSeen: 2023-01-01T00:00:00.000Z
 *                   socketId: "def456"
 *               count: 2
 *
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/users/online', async (_, res) => {
  try {
    // Получаем онлайн пользователей с дополнительными данными
    const onlineUsers = await getOnlineUsersWithData()

    res.status(200).json({
      users: onlineUsers,
      count: onlineUsers.length
    })
  } catch (err: unknown) {
    console.error('❌ Error fetching online users:', err)

    let errorMessage: string
    if (typeof err === 'string') {
      errorMessage = err
    } else if (err instanceof Error) {
      errorMessage = err.message
    } else {
      errorMessage = 'Unknown error occurred.'
    }

    res.status(500).json({
      message: 'Failed to fetch online users',
      error: errorMessage
    })
  }
})

export default router
