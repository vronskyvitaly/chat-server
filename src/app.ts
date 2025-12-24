import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import usersRouter from './router/users'
import postsRouter from './router/posts'
import chatRouter from './router/chat'
import swaggerRouter from './router/swagger'
import authorizationUserRouter from './router/auth/authorizationUserRouter'
import session from 'express-session'
import { Server } from 'socket.io'
import { createServer } from 'http'
import path from 'path'
import { WSService } from './web-socket'

dotenv.config()

// 1. Express приложение
const app = express()

// 2. HTTP сервер
const server = createServer(app)

// 3. Socket.IO сервер
const io = new Server(server, {
  cors: {
    origin: '*',
    credentials: true
  }
})

// 4. Middleware
app.use(cors({ origin: '*', credentials: true }))
app.use(express.json())

// 5. Static files
app.use(express.static(path.resolve(__dirname, '../src/static')))
app.use(
  session({
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  })
)

// 6. Маршруты
app.use('/api/auth', authorizationUserRouter)
app.use('/api-docs', swaggerRouter)
app.use('/api', usersRouter)
app.use('/api', postsRouter)
app.use('/api', chatRouter)

// 7. WebSocket
const wsService = WSService.getInstance(io)

export { app, io, server, wsService }
