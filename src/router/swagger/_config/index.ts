// src/swagger/swaggerConfig.ts
import swaggerJSDoc from 'swagger-jsdoc'

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chat API',
      version: '1.0.0',
      description: 'API для управления пользователями и постами блога',
      contact: {
        name: 'API Support',
        email: 'vronskyvitaly@mail.ru'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'https://server.developerserver.ru',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: [
    './src/router/**/*.ts',
    './src/routes/**/*.ts',
    './dist/src/router/**/*.js',
    './dist/src/routes/**/*.js'
  ]
}

export const swaggerSpec = swaggerJSDoc(options)
