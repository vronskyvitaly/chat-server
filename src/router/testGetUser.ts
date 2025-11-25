// setupChatWebSocket.ts
import { Server, Namespace } from 'socket.io'
import prisma from '../db/prisma'
import cookie from 'cookie'

// ✅ Экспортируем postsNamespace чтобы использовать в других модулях
export let postsNamespace: Namespace | null = null

export function setupChatWebSocket(io: Server) {
  // ✅ Создаем отдельный namespace для постов
  postsNamespace = io.of('/postsWS')

  postsNamespace.on('connection', async socket => {
    console.log('✅ Client connected to postsWS:', socket.id)
    console.log('🔗 Transport:', socket.conn.transport.name)

    // ✅ ПОЛУЧАЕМ query параметры из handshake
    const queryParams = socket.handshake.query
    console.log('📋 Query parameters for postsWS:', queryParams)

    // ✅ ПОЛУЧАЕМ USER_ID ИЗ COOKIES
    let userId: number | null = null
    const cookiesHeader = socket.handshake.headers.cookie

    if (cookiesHeader) {
      const parsedCookies = cookie.parse(cookiesHeader)
      // console.log('🍪 All cookies:', parsedCookies)

      // Предполагаем, что userId хранится в cookie с именем 'userId'
      if (parsedCookies.userId) {
        userId = parseInt(parsedCookies.userId)
        console.log('👤 User ID from cookie:', userId)
      }
    }

    let userAllPosts = await prisma.post.findMany()

    // ✅ ОТПРАВЛЯЕМ ВСЕ ПОСТЫ КЛИЕНТУ СРАЗУ
    socket.emit('user_posts', {
      posts: userAllPosts,
      count: userAllPosts.length,
      timestamp: new Date().toISOString()
    })

    // ✅ ОТВЕЧАЕМ клиенту на test_response
    socket.emit('uu', {
      original: 33
    })

    // // ✅ Обработчик для подписки на обновления постов
    // socket.on('subscribe_to_posts', (data: { userId?: string }) => {
    //   console.log('🔔 Subscribe to posts request:', data)
    //
    //   // Подписываем на комнату постов
    //   socket.join('posts_updates')
    //
    //   socket.emit('posts_subscription_confirmed', {
    //     status: 'subscribed',
    //     userId: data.userId,
    //     timestamp: Date.now()
    //   })
    //
    //   // Отправляем тестовое обновление постов
    //   socket.emit('new_post', {
    //     id: Date.now(),
    //     title: 'Welcome to posts updates!',
    //     content: 'You will receive real-time post updates here',
    //     timestamp: new Date().toISOString()
    //   })
    // })

    // Обработчик отключения
    socket.on('disconnect', reason => {
      console.log('❌ Client disconnected from postsWS:', socket.id, 'Reason:', reason)
    })

    // Обработчик ошибок
    socket.on('error', error => {
      console.error('🚨 postsWS Socket error:', socket.id, error)
    })
  })

  console.log('✅ Posts WebSocket namespace /postsWS initialized')
}
