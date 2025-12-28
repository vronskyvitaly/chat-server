import { server } from './app'

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
