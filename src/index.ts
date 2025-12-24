import { app, server } from './app'
import cors from 'cors'

app.use(
  cors({
    origin: '*'
    // ?
    // origin: ["https://express-start-project.vercel.app"],
    // methods: "GET,POST,PUT,DELETE",
    // allowedHeaders:"Content-Type",
    // credentials: true,
  })
)

const port = process.env.PORT || 3001
const startApp = () => {
  server.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  })
}

startApp()

// закрытие DB
process.on('beforeExit', async () => {
  try {
    console.log('Закрыли подключение к базе данных')
    // await client.close();
  } catch (e) {
    console.log(e)
  }
})

//
