import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../../db/prisma'

const authorizationUserRouter = Router()

// Регистрация пользователя
authorizationUserRouter.post('/register', async (req, res): Promise<void> => {
  const { name, email, password } = req.body

  try {
    // Проверяем, существует ли пользователь с таким email
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      res.status(400).json({ message: 'Пользователь с таким email уже зарегистрирован' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // Создаем нового пользователя
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword
      }
    })

    res.status(201).json({ message: 'Пользователь зарегистрирован', userId: user.id })
  } catch (error) {
    res.status(500).json({ message: 'Ошибка регистрации', error })
  }
})

// Вход пользователя
authorizationUserRouter.post('/login', async (req, res): Promise<void> => {
  const { email, password } = req.body

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ message: 'Неверный логин или пароль' })
    }

    if (user) {
      const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '1m' })
      const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, {
        expiresIn: '7d'
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

      res.json({ accessToken, refreshToken, id: user.id, email: email })
    }
  } catch (error) {
    res.status(500).json({
      message: 'Ошибка при авторизации'
    })
  }
})

// Обновление access-токена
authorizationUserRouter.post('/token/refresh', async (req, res): Promise<void> => {
  const { refreshToken } = req.body

  try {
    console.log('Запрос был отправлен на обновление refresh-токена в authorizationUserRouter')

    const storedToken = await prisma.userRefreshToken.findFirst({
      where: { refreshToken }
    })

    if (!storedToken || new Date() > new Date(storedToken.expiresAt)) {
      res.status(403).json({ message: 'Недействительный refresh-токен' })
    }

    const accessToken = jwt.sign({ userId: storedToken!.userId }, process.env.JWT_SECRET as string, {
      expiresIn: '15m'
    })
    console.log('Обновленный access-токен: ', accessToken)
    res.json({ accessToken })
  } catch (error) {
    res.status(500).json({ message: 'Ошибка обновления токена' })
  }
})

// Выход пользователя
authorizationUserRouter.post('/logout', async (req, res): Promise<void> => {
  const { refreshToken } = req.body

  try {
    // Удаляем токены, соответствующие refreshToken
    const deletedTokens = await prisma.userRefreshToken.deleteMany({
      where: { refreshToken }
    })

    if (deletedTokens.count === 0) {
      res.status(404).json({ message: 'Токен не найден' })
    }

    res.status(204).send()
  } catch (error) {
    res.status(500).json({ message: 'Ошибка при выходе' })
  }
})

export default authorizationUserRouter
