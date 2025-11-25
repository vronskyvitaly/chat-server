// src/router/authorizationUserRouter.ts

import express from 'express'
import prisma from '../db/prisma'
import authenticateToken from '../middleware/authenticate-token'
import { postsNamespace } from './testGetUser'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Post:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         title:
 *           type: string
 *           example: My First Post
 *         content:
 *           type: string
 *           example: This is the content of my first post
 *         authorId:
 *           type: integer
 *           example: 1
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2023-01-01T00:00:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2023-01-01T00:00:00.000Z
 *     CreatePostRequest:
 *       type: object
 *       required:
 *         - title
 *         - content
 *       properties:
 *         title:
 *           type: string
 *           example: My New Post
 *         content:
 *           type: string
 *           example: Content of the new post
 *     Error:
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
 *   name: Posts
 *   description: API для управления постами
 */

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: Получить все посты
 *     description: Возвращает массив всех постов в системе. Требует аутентификации.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Успешный запрос. Возвращает массив постов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Post'
 *             example:
 *               - id: 1
 *                 title: "First Post"
 *                 content: "Content of first post"
 *                 authorId: 1
 *                 createdAt: "2023-01-01T00:00:00.000Z"
 *                 updatedAt: "2023-01-01T00:00:00.000Z"
 *               - id: 2
 *                 title: "Second Post"
 *                 content: "Content of second post"
 *                 authorId: 2
 *                 createdAt: "2023-01-02T00:00:00.000Z"
 *                 updatedAt: "2023-01-02T00:00:00.000Z"
 *       401:
 *         description: Пользователь не аутентифицирован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: "Пользователь не аутентифицирован"
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: "Database connection error"
 */
router.get('/posts', authenticateToken, async (req, res): Promise<any> => {
  try {
    // Получаем все посты из базы данных
    const posts = await prisma.post.findMany()

    // Проверяем, есть ли пользователь
    if (!req.user) {
      res.status(401).json({ message: 'Пользователь не аутентифицирован' })
    } else {
      // Возвращаем массив постов
      res.status(200).json(posts)
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
 * /api/posts/get-user-posts:
 *   get:
 *     summary: Получить посты текущего пользователя
 *     description: Возвращает массив постов, созданных текущим аутентифицированным пользователем
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Успешный запрос. Возвращает массив постов пользователя
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Post'
 *             example:
 *               - id: 1
 *                 title: "My Post"
 *                 content: "Content of my post"
 *                 authorId: 1
 *                 createdAt: "2023-01-01T00:00:00.000Z"
 *                 updatedAt: "2023-01-01T00:00:00.000Z"
 *       400:
 *         description: Не указан ID пользователя
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: "Не указан ID пользователя"
 *       401:
 *         description: Пользователь не аутентифицирован
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Database error occurred"
 */
router.get('/posts/get-user-posts', authenticateToken, async (req, res) => {
  const userId = req.user?.userId

  try {
    if (!userId) {
      res.status(400).json({ message: 'Не указан ID пользователя' })
      return
    } else {
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
    res.status(500).json({ error: errorMessage })
  }
})

/**
 * @swagger
 * /api/posts/add-post:
 *   post:
 *     summary: Создать новый пост
 *     description: Создает новый пост от имени текущего аутентифицированного пользователя
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       description: Данные для создания поста
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePostRequest'
 *           example:
 *             title: "My New Post"
 *             content: "Content of my new post"
 *     responses:
 *       201:
 *         description: Пост успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *             example:
 *               id: 3
 *               title: "My New Post"
 *               content: "Content of my new post"
 *               authorId: 1
 *               createdAt: "2023-01-03T00:00:00.000Z"
 *               updatedAt: "2023-01-03T00:00:00.000Z"
 *       400:
 *         description: Заголовок и содержание обязательны
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: "Заголовок и содержание обязательны"
 *       401:
 *         description: Пользователь не аутентифицирован
 *       500:
 *         description: Ошибка при создании поста
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: "Ошибка при создании поста"
 *               error: "Detailed error description"
 */
router.post('/posts/add-post', authenticateToken, async (req, res) => {
  const { title, content } = req.body
  const userId = req.user?.userId

  try {
    // Проверяем наличие обязательных полей
    if (!title || !content || !userId) {
      res.status(400).json({ message: 'Заголовок и содержание обязательны' })
      return
    } else {
      // Создаем новый пост
      const newPost = await prisma.post.create({
        data: {
          title,
          content,
          authorId: +userId!
        }
      })

      // ✅ ОТПРАВЛЯЕМ УВЕДОМЛЕНИЕ ВСЕМ ПОДКЛЮЧЕННЫМ КЛИЕНТАМ
      if (postsNamespace) {
        postsNamespace.emit('new_post', {
          post: newPost,
          message: 'New post created!',
          timestamp: new Date().toISOString()
        })
      }

      res.status(201).json(newPost)
    }
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

/**
 * @swagger
 * /api/posts/delete-post/{postId}:
 *   delete:
 *     summary: Удалить пост по ID
 *     description: Удаляет пост по его идентификатору. Требует аутентификации.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         description: ID поста для удаления
 *         schema:
 *           type: integer
 *           format: int64
 *         example: 1
 *     responses:
 *       200:
 *         description: Пост успешно удален
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *             example:
 *               id: 1
 *               title: "Deleted Post"
 *               content: "Content of deleted post"
 *               authorId: 1
 *               createdAt: "2023-01-01T00:00:00.000Z"
 *               updatedAt: "2023-01-01T00:00:00.000Z"
 *       401:
 *         description: Пользователь не аутентифицирован
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: "Database error occurred"
 */
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
