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

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    res.status(401).json({ message: 'Токен не предоставлен' })
    return
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (err: jwt.VerifyErrors | null, decoded: any): void => {
    if (err) {
      console.log('Ошибка верификации токена в authenticateToken:')
      res.status(401).json({ message: 'Неверный токен' })
      return
    }

    // Сохраняем информацию о пользователе в запросе
    req.user = { userId: decoded.userId }
    next() // Переходим к следующему обработчику
  })
}

export default authenticateToken
