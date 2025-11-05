import { Response, NextFunction, Request } from 'express'
import jwt from 'jsonwebtoken'

// Определяем интерфейс для пользователя, который будет храниться в токене
interface User {
  userId: string // или другой идентификатор, который вы используете
  // Можно добавить другие поля, если они есть в токене
}

// // Расширяем Request, чтобы включить пользовательские данные
// export interface RequestWithUser extends Request {
//   userId?: string
// }

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['authorization']?.split(' ')[1] // Получаем токен из заголовка

  if (!token) {
    res.status(401).json({ message: 'Токен не предоставлен' })
  } else {
    // Теперь мы уверены, что token - это строка
    jwt.verify(
      token,
      process.env.JWT_SECRET as string,
      (err: jwt.VerifyErrors | null, decoded: any): void => {
        if (err) {
          res.status(403).json({ message: 'Неверный токен' })
        }
        // Приведение типа, если ваш токен содержит данные пользователя
        req.user = decoded as User // Сохраняем информацию о пользователе в запросе
        next() // Переходим к следующему обработчику
      }
    )
  }
}

export default authenticateToken
