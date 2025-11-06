// chatHandler.ts
import WebSocket from 'ws'
import express from 'express'
import expressWs from 'express-ws'
import { randomUUID } from 'crypto'
import prisma from '../db/prisma'

type MessageData = {
  username: string
  message: string
}

type BroadcastMessage = {
  type: 'message' | 'history'
  id?: string
  username?: string
  message?: string
  timestamp?: number
  userId?: string
  history?: any[]
}

const clients: Map<WebSocket, string> = new Map()

export function setupChat(app: expressWs.Application) {
  app.ws('/chat', async (ws: WebSocket, req: express.Request) => {
    const userId = randomUUID()
    console.log('Новый участник присоединился к чату:', req.socket.remoteAddress, 'ID:', userId)

    clients.set(ws, userId)

    // Отправляем историю сообщений новому пользователю
    await sendMessageHistory(ws)

    ws.on('message', async (data: string) => {
      try {
        const messageData: MessageData = JSON.parse(data)

        // Сохраняем сообщение в базу данных
        const savedMessage = await prisma.chat_messages.create({
          data: {
            username: messageData.username,
            message: messageData.message,
            userId: userId
          }
        })

        // Создаем сообщение для рассылки
        const broadcastMessage: BroadcastMessage = {
          type: 'message',
          id: savedMessage.id,
          username: savedMessage.username,
          message: savedMessage.message,
          userId: savedMessage.userId,
          timestamp: savedMessage.timestamp.getTime()
        }

        broadcast(JSON.stringify(broadcastMessage))
      } catch (e) {
        console.error('Ошибка парсинга сообщения:', e)
      }
    })

    ws.on('close', () => {
      console.log('Участник покинул чат.', req.socket.remoteAddress, 'ID:', userId)
      clients.delete(ws)
    })
  })

  async function sendMessageHistory(ws: WebSocket) {
    try {
      // Получаем последние 50 сообщений из базы данных
      const history = await prisma.chat_messages.findMany({
        take: 50,
        orderBy: {
          timestamp: 'desc'
        }
      })

      const historyMessage: BroadcastMessage = {
        type: 'history',
        history: history.map(msg => ({
          id: msg.id,
          username: msg.username,
          message: msg.message,
          userId: msg.userId,
          timestamp: msg.timestamp.getTime()
        }))
      }

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(historyMessage))
      }
    } catch (error) {
      console.error('Error sending message history:', error)
    }
  }

  function broadcast(message: string) {
    clients.forEach((_, client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    })
  }
}
