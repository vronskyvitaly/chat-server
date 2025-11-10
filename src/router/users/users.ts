// src/routes/authorizationUserRouter.ts

import express from 'express'
import prisma from '../../db/prisma'

const router = express.Router()

// GET /users
router.get('/users', async (req, res) => {
  try {
    // Получаем всех пользователей из базы данных
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        email: true
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

// Роут для поиска пользователя по email
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
    }

    // Возвращаем найденного пользователя
    res.status(200).json(user)
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
router.post('/user/add-user', async (req, res) => {
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

// DELETE /users/:id - удаление пользователя
router.delete('/users/delete-user/:id', async (req, res) => {
  const { id } = req.params

  try {
    // Проверяем существование пользователя
    const existingUser = await prisma.user.findUnique({
      where: { id: +id }
    })

    if (!existingUser) {
      res.status(404).json({ message: 'User not found' })
    }
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

export default router
