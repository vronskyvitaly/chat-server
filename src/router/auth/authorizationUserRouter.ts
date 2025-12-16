import bcrypt from 'bcrypt'
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../../db/prisma'
import authenticateToken from '../../middleware/authenticate-token'

const authorizationUserRouter = Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     UserRegistration:
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
 *     UserLogin:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: john@example.com
 *         password:
 *           type: string
 *           format: password
 *           example: securePassword123
 *     RefreshTokenRequest:
 *       type: object
 *       required:
 *         - refreshToken
 *       properties:
 *         refreshToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     LogoutRequest:
 *       type: object
 *       required:
 *         - refreshToken
 *       properties:
 *         refreshToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     RegistrationResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Пользователь зарегистрирован
 *         userId:
 *           type: integer
 *           example: 1
 *     LoginResponse:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         refreshToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         id:
 *           type: integer
 *           example: 1
 *         email:
 *           type: string
 *           example: john@example.com
 *     RefreshTokenResponse:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Error message
 *         error:
 *           type: string
 *           example: Detailed error description
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: API для аутентификации и управления пользователями
 */

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Получить список онлайн пользователей
 *     description: Возвращает массив пользователей, которые сейчас онлайн через WebSocket
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Успешный запрос. Возвращает массив онлайн пользователей
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OnlineUsersResponse'
 *             example:
 *               user:
 *                 - id: 1
 *                   name: John Doe
 *                   email: john@example.com
 *                   avatar: https://example.com/avatar1.jpg
 *                   isOnline: true
 *                   lastSeen: 2023-01-01T00:00:00.000Z
 *                   socketId: "abc123"
 *               count: 1
 *
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
authorizationUserRouter.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId
    console.log('authorizationUserRouter', userId)
    if (!userId) {
      res.status(401).json({
        message: 'Not authorized'
      })
      return
    } else {
      const user = await prisma.user.findUnique({ where: { id: +userId }, omit: { password: true } })
      res.status(200).json({
        ...user
      })
    }
  } catch (err: unknown) {
    console.error('❌ Error [src/router/auth/authorizationUserRouter.ts authorizationUserRouter/me]:', err)

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

/**
 * @swagger
 * /api/auth/sign-up:
 *   post:
 *     summary: Регистрация нового пользователя
 *     description: Создает нового пользователя в системе
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       description: Данные для регистрации пользователя
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRegistration'
 *           example:
 *             name: John Doe
 *             email: john@example.com
 *             password: securePassword123
 *     responses:
 *       201:
 *         description: Пользователь успешно зарегистрирован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegistrationResponse'
 *             example:
 *               message: Пользователь зарегистрирован
 *               userId: 1
 *       400:
 *         description: Пользователь с таким email уже зарегистрирован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Пользователь с таким email уже зарегистрирован
 *       500:
 *         description: Ошибка регистрации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Ошибка регистрации
 *               error: Database connection failed
 */
authorizationUserRouter.post('/sign-up', async (req, res): Promise<void> => {
  const { name, email, password } = req.body

  try {
    // Проверяем, существует ли пользователь с таким email
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      res.status(400).json({ message: 'Пользователь с таким email уже зарегистрирован' })
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)

      // Создаем нового пользователя
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword
        },
        omit: { password: true }
      })

      res.status(201).json({ message: 'Пользователь зарегистрирован', userId: user.id })
    }
  } catch (error) {
    console.log(
      '❌ Error [src/router/auth/authorizationUserRouter.ts authorizationUserRouter/sing-up]:',
      error
    )
    res.status(500).json({ message: 'Ошибка регистрации', error })
  }
})

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход пользователя в систему
 *     description: Аутентификация пользователя и выдача access и refresh токенов
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       description: Учетные данные пользователя
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserLogin'
 *           example:
 *             email: john@example.com
 *             password: securePassword123
 *     responses:
 *       200:
 *         description: Успешный вход в систему
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *             example:
 *               accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *               refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *               id: 1
 *               email: john@example.com
 *       401:
 *         description: Неверный логин или пароль
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Неверный логин или пароль
 *       500:
 *         description: Ошибка при авторизации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Ошибка при авторизации
 */
authorizationUserRouter.post('/login', async (req, res): Promise<void> => {
  const { email, password } = req.body

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ message: 'Неверный логин или пароль' })
    } else {
      const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '1m' })
      const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, {
        expiresIn: '7d'
      })

      // Обновляем статус пользователя на "online"
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          isOnline: true,
          lastSeen: new Date()
        },
        omit: { password: true }
      })

      // Сохранение refresh токена в базе данных
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 дней
      await prisma.userRefreshToken.create({
        data: {
          userId: user.id,
          refreshToken,
          expiresAt
        }
      })

      res.json({
        accessToken,
        refreshToken,
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name
      })
    }
  } catch (error) {
    console.log('❌ Error [src/router/auth/authorizationUserRouter.ts authorizationUserRouter/login]:', error)
    res.status(500).json({
      message: 'Ошибка при авторизации'
    })
  }
})

/**
 * @swagger
 * /api/auth/token/refresh:
 *   post:
 *     summary: Обновление access токена
 *     description: Выдает новый access токен по валидному refresh токену
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       description: Refresh токен для обновления access токена
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *           example:
 *             refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Access токен успешно обновлен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RefreshTokenResponse'
 *             example:
 *               accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       403:
 *         description: Недействительный refresh токен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Недействительный refresh-токен
 *       500:
 *         description: Ошибка обновления токена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Ошибка обновления токена
 */
authorizationUserRouter.post('/token/refresh', async (req, res): Promise<void> => {
  const { refreshToken } = req.body

  try {
    console.log('Запрос был отправлен на обновление refresh-токена в authorizationUserRouter')

    const storedToken = await prisma.userRefreshToken.findFirst({
      where: { refreshToken }
    })

    if (!storedToken || new Date() > new Date(storedToken.expiresAt)) {
      res.status(403).json({ message: 'Недействительный refresh-токен' })
    } else {
      const accessToken = jwt.sign({ userId: storedToken!.userId }, process.env.JWT_SECRET as string, {
        expiresIn: '15m'
      })
      console.log('Обновленный access-токен: ', accessToken)
      res.json({ accessToken })
    }
  } catch (error) {
    console.log(
      '❌ Error [src/router/auth/authorizationUserRouter.ts authorizationUserRouter/token/refresh]:',
      error
    )
    res.status(500).json({ message: 'Ошибка обновления токена' })
  }
})

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Выход пользователя из системы
 *     description: Удаляет refresh токен пользователя для завершения сессии
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       description: Refresh токен для удаления
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LogoutRequest'
 *           example:
 *             refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       204:
 *         description: Успешный выход из системы
 *       404:
 *         description: Токен не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Токен не найден
 *       500:
 *         description: Ошибка при выходе
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Ошибка при выходе
 */
authorizationUserRouter.post('/logout', async (req, res): Promise<void> => {
  const { refreshToken } = req.body

  try {
    // Удаляем токены, соответствующие refreshToken
    const deletedTokens = await prisma.userRefreshToken.deleteMany({
      where: { refreshToken }
    })

    if (deletedTokens.count === 0) {
      res.status(404).json({ message: 'Токен не найден' })
    } else {
      res.status(204).send()
    }
  } catch (error) {
    console.log(
      '❌ Error [src/router/auth/authorizationUserRouter.ts authorizationUserRouter/logout]:',
      error
    )
    res.status(500).json({ message: 'Ошибка при выходе' })
  }
})

export default authorizationUserRouter
