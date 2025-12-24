import { Response, NextFunction, Request } from 'express'
import jwt from 'jsonwebtoken'

// Расширяем интерфейс Request для добавления пользователя
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
      }
    }
  }
}

// ✅ Интерфейс для декодированного токена
interface DecodedToken {
  userId: string
  iat?: number // issued at (опционально)
  exp?: number // expiration (опционально)
}

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    res.status(401).json({ message: 'Токен не предоставлен' })
    return
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (err: jwt.VerifyErrors | null, decoded): void => {
    if (err) {
      console.log(
        'Ошибка верификации токена в [src/middleware/authenticate-token/index.ts] authenticateToken:'
      )
      res.status(401).json({ message: 'Неверный токен' })
      return
    }

    // ✅ Type assertion с проверкой структуры
    const tokenData = decoded as DecodedToken

    if (!tokenData.userId) {
      res.status(401).json({ message: 'Невалидная структура токена' })
      return
    }

    // Сохраняем информацию о пользователе в запросе
    req.user = { userId: tokenData.userId }
    next()
  })
}

export default authenticateToken
