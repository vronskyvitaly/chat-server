// src/router/index.ts

import express from 'express'
import authenticateToken from '../../middleware/authenticate-token'
import prisma from '../../db/prisma'

const router = express.Router()

// GET /posts
router.get('/posts', authenticateToken, async (req, res): Promise<any> => {
  try {
    // Получаем все посты из базы данных
    const posts = await prisma.post.findMany()

    // Проверяем, есть ли пользователь
    if (!req.user) {
      res.status(401).json({ message: 'Пользователь не аутентифицирован' })
    }

    // Возвращаем массив постов
    res.status(200).json(posts)
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

// GET /posts/get-user-posts — получение постов определённого пользователя
router.get('/posts/get-user-posts', authenticateToken, async (req, res) => {
  const userId = req.user?.userId

  try {
    if (!userId) {
      res.status(400).json({ message: 'Не указан ID пользователя' })
      return
    }

    // Получаем все посты указанного пользователя
    const userPosts = await prisma.post.findMany({
      where: {
        authorId: +userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Возвращаем посты
    res.status(200).json(userPosts)
  } catch (err: unknown) {
    let errorMessage: string
    if (typeof err === 'string') {
      errorMessage = err
    } else if (err instanceof Error) {
      errorMessage = err.message
    } else {
      errorMessage = 'Unknown error occurred.'
    }
    res.status(500).json({ error: errorMessage })
  }
})

// POST /add-post
router.post('/posts/add-post', authenticateToken, async (req, res) => {
  const { title, content } = req.body
  const userId = req.user?.userId

  try {
    // Проверяем наличие обязательных полей
    if (!title || !content) {
      res.status(400).json({ message: 'Заголовок и содержание обязательны' })
      return // ← ДОБАВЛЕНО
    }

    if (!userId) {
      res.status(400).json({ message: 'Не указан ID пользователя' })
      return
    }

    // Создаем новый пост
    const newPost = await prisma.post.create({
      data: {
        title,
        content,
        authorId: +userId!
      }
    })

    res.status(201).json(newPost)
  } catch (err: unknown) {
    console.error('Ошибка при создании поста:', err)

    let errorMessage = 'Unknown error occurred.'
    if (err instanceof Error) {
      errorMessage = err.message
    }

    res.status(500).json({
      message: 'Ошибка при создании поста',
      error: errorMessage
    })
  }
})

// DELETE /delete-post/:postId
router.delete('/posts/delete-post/:postId', authenticateToken, async (req, res) => {
  const postId = parseInt(req.params.postId, 10)
  try {
    // Удаляем пост по его ID
    const deletedPost = await prisma.post.delete({
      where: {
        id: +postId
      }
    })

    // Возвращаем успешный статус и удаленный пост
    res.status(200).json(deletedPost)
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
    // Ошибка при удалении поста
    res.status(500).send(errorMessage)
  }
})

export default router
