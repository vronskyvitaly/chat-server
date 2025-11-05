import WebSocket from 'ws'
import express from 'express'
import expressWs from 'express-ws'
import { randomUUID } from 'crypto'

type MessageData = {
  username: string
  message: string
  id: string // Добавляем уникальный идентификатор
}

const clients: Map<WebSocket, string> = new Map() // Храним WebSocket и их уникальные ID

export function setupChat(app: expressWs.Application) {
  app.ws('/chat', (ws: WebSocket, req: express.Request) => {
    const userId = randomUUID() // Генерируем уникальный ID
    console.log('Новый участник присоединился к чату:', req.socket.remoteAddress, 'ID:', userId)

    clients.set(ws, userId) // Сохраняем ID пользователя

    ws.on('message', (data: string) => {
      try {
        const message: MessageData = JSON.parse(data)
        // Создаем сообщение для рассылки
        const broadcastMessage = {
          type: 'message',
          username: message.username,
          message: message.message,
          id: userId // добавляем ID пользователя
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

  function broadcast(message: string) {
    clients.forEach((_, client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    })
  }
}
