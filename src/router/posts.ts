// src/routes/posts.ts

import express from 'express'
import prisma from '../db/prisma'
import authenticateToken from '../middleware/middleware'

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

// POST /add-post
router.post('/add-post', authenticateToken, async (req, res) => {
  const { title, content } = req.body
  try {
    // Создаем новый пост
    const newPost = await prisma.post.create({
      data: {
        title,
        content,
        authorId: (req.user as any).userId
      }
    })

    // Возвращаем успешный статус и созданный пост
    res.status(201).json(newPost)
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
    // Ошибка при создании поста
    res.status(500).send(errorMessage)
  }
})

// DELETE /delete-post/:postId
router.delete('/delete-post/:postId', async (req, res) => {
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
