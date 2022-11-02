[![theeye.io](images/logo-theeye-theOeye-logo2.png)](https://theeye.io/en/index.html)

# Acceso programático

Se puede acceder a la API de distintas maneras:

- [Autenticación Basic](#authenticación-basic)
- Autentication Bearer
- [Secret Key](#secret-key)
- [Integration Tokens](#tokens-de-integración-integration-tokens)

-----

### Authenticación Basic

Se admiten los inicios de sesión utilizando el mecanismo de autenticación HTTP Basic para usuario locales.
Siempre utilizando protocolo de comunicación encriptado HTTPS, se debe enviar un request POST a la siguiente dirección, reemplazando `${usuario}` y `${contraseña}` acorde:

```

user=""
pass=""

curl -X POST "https://${user}:${pass}@app.theeye.io/api/auth/login"

```

En la respueta se obtiene un `access_token` JWT con una duración de 24 horas.
Este token es necesario para iniciar solicitudes que requieren autenticación BEARER

Esta solicitud inicia una session para el usuario en la última organización visitada.
Para seleccionar en que organización se desea iniciar la session se debe incluir el parámetro `customer` por querystring.

Una solicitud con una organización específica se vería como el siguiente

```

customer="coco"
user=""
pass=""

curl -X POST "https://${user}:${pass}@app.theeye.io/api/auth/login?customer=${customer}"

```

### Secret Key

Algunos recursos tienen disponibles endpoints que son accesibles utilizando una clave secreta propia que pueden ser ejecutados de forma anónima por quienes posean la URL completa, de esta forma es posible contruir API públicas.

[Más información](/tasks/#usando-la-secret-key-de-la-tarea-recomendado)

### Integration Tokens

Los tokens de integración permiten acceder a la API de la misma forma que lo hacen los Tokens Bearer.
A diferencia de los tokens de acceso de sesión generados mediante autenticación básica, los tokens de integración no tienen tiempo de expiración y pueden ser utilizados indefinidamente o hasta que un administrador los elimine del sistema.

