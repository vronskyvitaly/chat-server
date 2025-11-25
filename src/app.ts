import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import usersRouter from './router/users'
import postsRouter from './router/posts'
import swaggerRouter from './router/swagger'
import chatsRouter from './router/chat'
import authorizationUserRouter from './router/auth/authorizationUserRouter'
import session from 'express-session'
import path from 'path'
import { Server } from 'socket.io'
import { createServer } from 'http'
import { setupChatWebSocket } from './router/testGetUser'

dotenv.config()

// 1. Express приложение
const app = express()

// 2. HTTP сервер
const server = createServer(app)

// 3. Socket.IO сервер
const io = new Server(server, {
  cors: { origin: '*', credentials: true }
})

// 4. Middleware
app.use(cors({ origin: '*', credentials: true }))
app.use(express.json())
app.use(express.static(path.resolve(__dirname, '../src/static')))
app.use(
  session({
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    cookie: { secure: false }
  })
)

// 5. Маршруты
app.use('/api/auth', authorizationUserRouter)
app.use('/api-docs', swaggerRouter)
app.use('/api', usersRouter)
app.use('/api', postsRouter)
app.use('/api', chatsRouter)

// 6. WebSocket
setupChatWebSocket(io)

export { app, io, server }
