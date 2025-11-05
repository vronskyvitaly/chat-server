// src/routes/users.ts

import express from 'express'
import prisma from '../db/prisma'

const router = express.Router()

// GET /users
router.get('/users', async (req, res) => {
  try {
    // Получаем всех пользователей из базы данных
    const users = await prisma.user.findMany()
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

// Роут для поиска пользователя по email
router.get('/user/:email', async (req, res) => {
  const { email } = req.params // Получаем email из параметров маршрута

  try {
    // Ищем пользователя по email
    const user = await prisma.user.findUnique({
      where: { email: email } // Указываем условие поиска
    })

    // Если пользователь не найден, возвращаем 404
    if (!user) {
      res.status(404).json({ message: 'User not found' })
    }

    // Удаляем пароль из объекта пользователя
    const { password, ...userWithoutPassword }: any = user

    // Возвращаем найденного пользователя
    res.status(200).json(userWithoutPassword)
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

// POST /add-user
router.post('/add-user', async (req, res) => {
  const { name, email, password } = req.body
  try {
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

export default router
