import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import usersRouter from './router/users'
import postsRouter from './router/posts'
import authorizationUserRouter from './router/auth/authorization'
import { setupChat } from './router/сhat'
import expressWs from 'express-ws'
import session from 'express-session'

dotenv.config()

export const app = expressWs(express()).app

// Настройка ответов
app.use(express.json())
// Доступ
app.use(cors())

// Настройка сессий
app.use(
  session({
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Установите true, если используете HTTPS
  })
)

// Настройка маршрутов
app.use('/api/auth', authorizationUserRouter)
app.use('/api', usersRouter)
app.use('/api', postsRouter)

// Передаем `app` в `setupChat`
setupChat(app)
